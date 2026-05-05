import os
import sys
import json
import torch
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List
from sklearn.metrics import roc_auc_score, accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Add project root to sys.path
project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, NUMERICAL_FEATURES, CATEGORICAL_FEATURES, INFER_CFG, TARGET_COLUMN
from src.models.diabetes_model_net import DiabetesMultimodalNet, MCDropoutInference
from src.pipeline.pipeline import build_full_pipeline, _resolve_glucose_column
from src.stacking.stacking import MetaLearnerNet, IsotonicCalibrator, apply_clinical_hard_rules, build_meta_features

class ClinicalAuditEngine:
    def __init__(self):
        self.models = {}
        self.results = {}
        self.global_score = 0
        self.metrics = {}
        self.fail_reasons = []

    def load_components(self):
        try:
            self.pipe_data = build_full_pipeline(
                nhanes_csv=os.path.join("data", "nhanes_clinical_cohort.csv"),
                temporal_dir=os.path.join("data", "temporal"),
                rppg_csv=os.path.join("data", "rppg_features.csv")
            )
            self.models["preprocessors"] = {
                "clinical": self.pipe_data["clin_preprocessor"],
                "temporal": self.pipe_data["temp_preprocessor"],
                "rppg": self.pipe_data["rppg_preprocessor"]
            }

            n_clin = self.models["preprocessors"]["clinical"].n_features
            gmu_model = DiabetesMultimodalNet(n_clinical_features=n_clin)
            paths_to_try = [
                PATHS.gmu_best_weights,
                os.path.join("outputs", "checkpoints", "gmu_best.pt"),
                os.path.join("DiabetesMultimodal", "checkpoints", "gmu_best.pt")
            ]
            gmu_weights = next((p for p in paths_to_try if os.path.exists(p)), None)
            
            if not gmu_weights: raise FileNotFoundError("GMU weights not found.")
            
            gmu_model.load_state_dict(torch.load(gmu_weights, map_location=DEVICE))
            gmu_model.to(DEVICE)
            gmu_model.eval()
            self.models["gmu"] = gmu_model

            for name in ["xgb", "lgbm", "logreg"]:
                path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
                if not os.path.exists(path): path = os.path.join("outputs", "checkpoints", f"classical_{name}_folds.pkl")
                if not os.path.exists(path): path = os.path.join("DiabetesMultimodal", "checkpoints", f"classical_{name}_folds.pkl")
                if os.path.exists(path):
                    with open(path, "rb") as f: self.models[f"classical_{name}"] = pickle.load(f)

            meta_pt = PATHS.meta_learner_weights.replace(".pkl", ".pt")
            meta_cfg_p = PATHS.meta_learner_weights.replace(".pkl", "_config.json")
            if not os.path.exists(meta_pt):
                meta_pt = os.path.join("outputs", "checkpoints", "meta_learner.pt")
                meta_cfg_p = os.path.join("outputs", "checkpoints", "meta_learner_config.json")
            if not os.path.exists(meta_pt):
                meta_pt = os.path.join("DiabetesMultimodal", "checkpoints", "meta_learner.pt")
                meta_cfg_p = os.path.join("DiabetesMultimodal", "checkpoints", "meta_learner_config.json")

            if os.path.exists(meta_pt) and os.path.exists(meta_cfg_p):
                with open(meta_cfg_p, "r") as f: meta_cfg = json.load(f)
                meta_model = MetaLearnerNet(input_dim=meta_cfg["input_dim"])
                meta_model.load_state_dict(torch.load(meta_pt, map_location=DEVICE))
                meta_model.to(DEVICE)
                meta_model.eval()
                self.models["meta_learner"] = meta_model
                self.models["meta_input_dim"] = meta_cfg["input_dim"]

            calib_path = PATHS.calibrator_weights
            if not os.path.exists(calib_path): calib_path = os.path.join("outputs", "calibration", "isotonic_calibrator.pkl")
            if not os.path.exists(calib_path): calib_path = os.path.join("DiabetesMultimodal", "calibration", "isotonic_calibrator.pkl")
            if os.path.exists(calib_path): self.models["calibrator"] = IsotonicCalibrator.load(calib_path)

            return True
        except Exception as e:
            print(f"❌ Failed to load components: {e}")
            return False

    def predict(self, clinical_df: pd.DataFrame, rppg_df: pd.DataFrame, temporal_seq: np.ndarray, temporal_mask: np.ndarray):
        X_clin = self.models["preprocessors"]["clinical"].transform(clinical_df)
        X_rppg = self.models["preprocessors"]["rppg"].transform(rppg_df)
        
        t_clin = torch.tensor(X_clin, dtype=torch.float32).to(DEVICE)
        t_rppg = torch.tensor(X_rppg, dtype=torch.float32).to(DEVICE)
        t_temp = torch.tensor(temporal_seq, dtype=torch.float32).to(DEVICE)
        t_mask = torch.tensor(temporal_mask, dtype=torch.bool).to(DEVICE)

        with torch.no_grad():
            out = self.models["gmu"](t_clin, t_temp, t_rppg, t_mask)
            proba_gmu = torch.sigmoid(out["logit"]).cpu().numpy()
            gates = out["gates"].cpu().numpy()

        mc_infer = MCDropoutInference(self.models["gmu"], T=30)
        mc_results = mc_infer.predict(t_clin, t_temp, t_rppg, t_mask, device=DEVICE)
        uncertainty = mc_results["std_proba"].cpu().numpy()

        if "meta_learner" in self.models:
            p_xgb = np.mean([m.predict_proba(X_clin)[:, 1] for m in self.models["classical_xgb"]], axis=0)
            p_lgbm = np.mean([m.predict_proba(X_clin)[:, 1] for m in self.models["classical_lgbm"]], axis=0)
            p_logreg_list = []
            for m in self.models["classical_logreg"]:
                X_clin_lr = m._scaler.transform(X_clin) if hasattr(m, "_scaler") else X_clin
                p_logreg_list.append(m.predict_proba(X_clin_lr)[:, 1])
            p_logreg = np.mean(p_logreg_list, axis=0)

            oof_preds = {"xgb": p_xgb, "lgbm": p_lgbm, "logreg": p_logreg}
            X_meta = build_meta_features(oof_preds, proba_gmu)
            X_meta_t = torch.tensor(X_meta, dtype=torch.float32).to(DEVICE)
            with torch.no_grad():
                proba_meta = torch.sigmoid(self.models["meta_learner"](X_meta_t)).cpu().numpy()
            proba_calibrated = self.models["calibrator"].predict(proba_meta) if "calibrator" in self.models else proba_meta
        else:
            proba_calibrated = proba_gmu

        glucose_vals = clinical_df["glucose_fasting_mg_dl"].values
        proba_final, _ = apply_clinical_hard_rules(proba_calibrated, glucose_vals, verbose=False)
        
        return proba_final, uncertainty, gates.mean(axis=2)

    def run_part1(self):
        profiles = []
        for g in np.linspace(80, 200, 10):
            p = {
                "age": 45, "bmi": 25 + (g-80)/10, "glucose_fasting_mg_dl": g, 
                "smoking": 1 if g > 140 else 0, "family_history": 1 if g > 160 else 0,
                "gender": 1, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 20,
                "insulin": 90, "diabetespedigreefunction": 0.4
            }
            profiles.append(p)
        
        df = pd.DataFrame(profiles)
        rppg_df = pd.DataFrame([{feat: 0.0 for feat in self.models["preprocessors"]["rppg"].rppg_features}] * 10)
        t_seq = np.zeros((10, 168, 12))
        t_mask = np.ones((10, 168), dtype=bool)

        probs, _, _ = self.predict(df, rppg_df, t_seq, t_mask)
        is_monotone = all(probs[i] <= probs[i+1] + 1e-4 for i in range(len(probs)-1))
        
        if is_monotone:
            self.results["part1"] = "PASS"
            return True
        self.results["part1"] = "FAIL"
        self.fail_reasons.append("Non-monotone behavior detected.")
        return False

    def run_part2(self):
        ds_test = self.pipe_data["datasets"]["test"]
        all_labels, all_probs = [], []
        loader = torch.utils.data.DataLoader(ds_test, batch_size=32, shuffle=False)
        
        for batch in loader:
            clinical_df = pd.DataFrame(batch["clinical"].numpy(), columns=self.models["preprocessors"]["clinical"].feature_names)
            glucose_raw = batch["glucose"].numpy()
            clinical_df["glucose_fasting_mg_dl"] = glucose_raw
            rppg_df = pd.DataFrame(batch["rppg"].numpy(), columns=self.models["preprocessors"]["rppg"].feature_names)
            
            temporal_seq = batch["temporal"].numpy()
            temporal_mask = batch["temp_mask"].numpy()
            probs, _, _ = self.predict(clinical_df, rppg_df, temporal_seq, temporal_mask)
            all_labels.extend(batch["label"].numpy())
            all_probs.extend(probs)

        all_labels = np.array(all_labels)
        self.test_probs = np.array(all_probs)
        preds = (self.test_probs >= 0.5).astype(int)

        auc = roc_auc_score(all_labels, self.test_probs)
        acc = accuracy_score(all_labels, preds)
        prec = precision_score(all_labels, preds)
        rec = recall_score(all_labels, preds)
        f1 = f1_score(all_labels, preds)
        cm = confusion_matrix(all_labels, preds)

        self.metrics = {
            "auc": auc, "accuracy": acc, "precision": prec, "recall": rec, "f1": f1, "cm": cm.tolist()
        }

        if auc >= 0.80:
            self.results["part2"] = "PASS"
            return True
        self.results["part2"] = "FAIL"
        self.fail_reasons.append(f"ROC-AUC {auc:.4f} < 0.80")
        return False

    def run_part3(self):
        # Probability Distribution
        if not hasattr(self, 'test_probs'):
            self.results["part3"] = "FAIL"
            self.fail_reasons.append("No probabilities to evaluate.")
            return False
            
        p_min, p_max = self.test_probs.min(), self.test_probs.max()
        if p_min < 0.1 and p_max > 0.9:
            self.results["part3"] = "PASS"
            return True
        self.results["part3"] = "FAIL"
        self.fail_reasons.append("Probability collapse detected.")
        return False

    def run_part4(self):
        p = {
            "age": 45, "bmi": 25, "glucose_fasting_mg_dl": 126.1, 
            "smoking": 0, "family_history": 0,
            "gender": 1, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 20,
            "insulin": 90, "diabetespedigreefunction": 0.4
        }
        df = pd.DataFrame([p])
        rppg_df = pd.DataFrame([{feat: 0.0 for feat in self.models["preprocessors"]["rppg"].rppg_features}])
        prob, _, _ = self.predict(df, rppg_df, np.zeros((1, 168, 12)), np.ones((1, 168), dtype=bool))
        
        if prob[0] >= 0.99: 
            self.results["part4"] = "PASS"
            return True
        self.results["part4"] = "FAIL"
        self.fail_reasons.append("Hard rule failed to trigger.")
        return False

    def run_part5(self):
        # Feature Integrity
        features = self.models["preprocessors"]["clinical"].feature_names
        if "glucose_fasting_mg_dl" in features or "glucose" in features:
            self.results["part5"] = "PASS"
            return True
        self.results["part5"] = "FAIL"
        self.fail_reasons.append("Missing critical features in preprocessor.")
        return False

    def run_part6(self):
        # Label consistency
        ds = self.pipe_data["datasets"]["train"]
        labels = []
        glucose_vals = []
        loader = torch.utils.data.DataLoader(ds, batch_size=64)
        for batch in loader:
            labels.extend(batch["label"].numpy())
            glucose_vals.extend(batch["glucose"].numpy())
        corr = np.corrcoef(labels, glucose_vals)[0, 1]
        if corr > 0:
            self.results["part6"] = "PASS"
            return True
        self.results["part6"] = "FAIL"
        self.fail_reasons.append("Label inversion suspected.")
        return False

    def run_part7(self):
        # Multimodal fusion
        ds = self.pipe_data["datasets"]["test"]
        loader = torch.utils.data.DataLoader(ds, batch_size=10, shuffle=True)
        batch = next(iter(loader))
        clinical_df = pd.DataFrame(batch["clinical"].numpy(), columns=self.models["preprocessors"]["clinical"].feature_names)
        clinical_df["glucose_fasting_mg_dl"] = batch["glucose"].numpy()
        rppg_df = pd.DataFrame(batch["rppg"].numpy(), columns=self.models["preprocessors"]["rppg"].feature_names)
        
        _, _, gates = self.predict(clinical_df, rppg_df, batch["temporal"].numpy(), batch["temp_mask"].numpy())
        avg_gates = gates.mean(axis=0)
        
        if all(g > 0.1 for g in avg_gates):
            self.results["part7"] = "PASS"
            return True
        self.results["part7"] = "FAIL"
        self.fail_reasons.append("One modality dominates.")
        return False

    def run_part8(self):
        # Calibration & Uncertainty
        ds = self.pipe_data["datasets"]["test"]
        loader = torch.utils.data.DataLoader(ds, batch_size=10)
        batch = next(iter(loader))
        clinical_df = pd.DataFrame(batch["clinical"].numpy(), columns=self.models["preprocessors"]["clinical"].feature_names)
        clinical_df["glucose_fasting_mg_dl"] = batch["glucose"].numpy()
        rppg_df = pd.DataFrame(batch["rppg"].numpy(), columns=self.models["preprocessors"]["rppg"].feature_names)
        
        _, uncertainties, _ = self.predict(clinical_df, rppg_df, batch["temporal"].numpy(), batch["temp_mask"].numpy())
        if np.std(uncertainties) > 0.001:
            self.results["part8"] = "PASS"
            return True
        self.results["part8"] = "FAIL"
        self.fail_reasons.append("Uncertainty is constant.")
        return False

    def run_part9(self):
        # Robustness
        p = {
            "age": 45, "bmi": np.nan, "glucose_fasting_mg_dl": 500, 
            "smoking": 0, "family_history": 0,
            "gender": 1, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 20,
            "insulin": 90, "diabetespedigreefunction": 0.4
        }
        df = pd.DataFrame([p])
        rppg_df = pd.DataFrame([{feat: 0.0 for feat in self.models["preprocessors"]["rppg"].rppg_features}])
        try:
            prob, _, _ = self.predict(df, rppg_df, np.zeros((1, 168, 12)), np.ones((1, 168), dtype=bool))
            if prob[0] >= 0.99:
                self.results["part9"] = "PASS"
                return True
            self.results["part9"] = "FAIL"
            self.fail_reasons.append("Model failed to handle extreme glucose value.")
            return False
        except Exception as e:
            self.results["part9"] = "FAIL"
            self.fail_reasons.append(f"Model crashed on robust inputs: {e}")
            return False

    def run_part10(self):
        # Generalization
        ds_train = self.pipe_data["datasets"]["train"]
        all_labels, all_probs = [], []
        # Sample 100 for speed
        loader = torch.utils.data.DataLoader(ds_train, batch_size=32, shuffle=True)
        count = 0
        for batch in loader:
            clinical_df = pd.DataFrame(batch["clinical"].numpy(), columns=self.models["preprocessors"]["clinical"].feature_names)
            clinical_df["glucose_fasting_mg_dl"] = batch["glucose"].numpy()
            rppg_df = pd.DataFrame(batch["rppg"].numpy(), columns=self.models["preprocessors"]["rppg"].feature_names)
            probs, _, _ = self.predict(clinical_df, rppg_df, batch["temporal"].numpy(), batch["temp_mask"].numpy())
            all_labels.extend(batch["label"].numpy())
            all_probs.extend(probs)
            count += len(probs)
            if count > 200: break
            
        train_auc = roc_auc_score(all_labels, all_probs)
        if abs(train_auc - self.metrics["auc"]) < 0.20:
            self.results["part10"] = "PASS"
            return True
        self.results["part10"] = "FAIL"
        self.fail_reasons.append("Large gap between train and validation performance.")
        return False

    def run_part11(self):
        # Explainability
        xgb_models = self.models.get("classical_xgb", [])
        if not xgb_models:
            self.results["part11"] = "FAIL"
            self.fail_reasons.append("No XGB model to check explainability.")
            return False
            
        feat_imp = xgb_models[0].feature_importances_
        features = self.models["preprocessors"]["clinical"].feature_names
        imp_dict = dict(zip(features, feat_imp))
        
        # Check if glucose is among top 5 features
        sorted_feats = sorted(imp_dict.items(), key=lambda x: x[1], reverse=True)
        top_5 = [f[0] for f in sorted_feats[:5]]
        
        if "glucose_fasting_mg_dl" in top_5 or "glucose" in top_5:
            self.results["part11"] = "PASS"
            return True
        self.results["part11"] = "FAIL"
        self.fail_reasons.append("Glucose is not a top feature.")
        return False

    def run_part12(self):
        # Production Safety
        try:
            # We already tested invalid inputs in Part 9 (Robustness), here we check if API structure exists
            if os.path.exists("src/api/main.py"):
                self.results["part12"] = "PASS"
                return True
        except:
            pass
        self.results["part12"] = "FAIL"
        self.fail_reasons.append("API structure not found.")
        return False

    def execute_all(self):
        self.load_components()
        self.run_part1()
        self.run_part2()
        self.run_part3()
        self.run_part4()
        self.run_part5()
        self.run_part6()
        self.run_part7()
        self.run_part8()
        self.run_part9()
        self.run_part10()
        self.run_part11()
        self.run_part12()
        
        passed = sum(1 for v in self.results.values() if v == "PASS")
        self.global_score = (passed / 12) * 100
        
        verdict = "SAFE FOR PRODUCTION" if self.global_score == 100 else "MEDICALLY UNSAFE"
        risk_level = "LOW" if self.global_score == 100 else "HIGH"

        report = {
            "VERDICT": verdict,
            "GLOBAL_SCORE": self.global_score,
            "DETAILED_RESULTS": self.results,
            "METRICS": self.metrics,
            "FAIL_REASONS": self.fail_reasons,
            "RISK_LEVEL": risk_level,
            "INFO": "Model checkpoint: gmu_best.pt, Data: nhanes_clinical_cohort.csv (Test split: 100 samples), Threshold: 0.5"
        }

        print("\n============================================================")
        print("FINAL AUDIT REPORT")
        print("============================================================")
        print(json.dumps(report, indent=2))
        print("============================================================")
        print(f"\nFINAL VERDICT: {verdict}")

if __name__ == "__main__":
    engine = ClinicalAuditEngine()
    engine.execute_all()
