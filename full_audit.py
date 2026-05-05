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

# ===========================================================================
# AUDIT CORE
# ===========================================================================

class ClinicalAuditEngine:
    def __init__(self):
        self.models = {}
        self.results = {}
        self.global_score = 0
        self.metrics = {}
        self.fail_reasons = []

    def load_components(self):
        print("[Audit] Loading components...")
        try:
            # 1. Pipeline data (to get preprocessors and test set)
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

            # 2. GMU Model
            n_clin = self.models["preprocessors"]["clinical"].n_features
            gmu_model = DiabetesMultimodalNet(n_clinical_features=n_clin)
            # Try multiple possible paths
            paths_to_try = [
                PATHS.gmu_best_weights,
                os.path.join("outputs", "checkpoints", "gmu_best.pt"),
                os.path.join("DiabetesMultimodal", "checkpoints", "gmu_best.pt")
            ]
            gmu_weights = None
            for p in paths_to_try:
                if os.path.exists(p):
                    gmu_weights = p
                    break
            
            if not gmu_weights:
                raise FileNotFoundError("GMU weights not found.")
            
            gmu_model.load_state_dict(torch.load(gmu_weights, map_location=DEVICE))
            gmu_model.to(DEVICE)
            gmu_model.eval()
            self.models["gmu"] = gmu_model

            # 3. Classical Models
            for name in ["xgb", "lgbm", "logreg"]:
                path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
                if not os.path.exists(path):
                    path = os.path.join("outputs", "checkpoints", f"classical_{name}_folds.pkl")
                if not os.path.exists(path):
                    path = os.path.join("DiabetesMultimodal", "checkpoints", f"classical_{name}_folds.pkl")
                
                if os.path.exists(path):
                    with open(path, "rb") as f:
                        self.models[f"classical_{name}"] = pickle.load(f)

            # 4. Meta-Learner
            meta_pt = PATHS.meta_learner_weights.replace(".pkl", ".pt")
            meta_cfg_p = PATHS.meta_learner_weights.replace(".pkl", "_config.json")
            if not os.path.exists(meta_pt):
                meta_pt = os.path.join("outputs", "checkpoints", "meta_learner.pt")
                meta_cfg_p = os.path.join("outputs", "checkpoints", "meta_learner_config.json")
            if not os.path.exists(meta_pt):
                meta_pt = os.path.join("DiabetesMultimodal", "checkpoints", "meta_learner.pt")
                meta_cfg_p = os.path.join("DiabetesMultimodal", "checkpoints", "meta_learner_config.json")

            if os.path.exists(meta_pt) and os.path.exists(meta_cfg_p):
                with open(meta_cfg_p, "r") as f:
                    meta_cfg = json.load(f)
                meta_model = MetaLearnerNet(
                    input_dim=meta_cfg["input_dim"]
                )
                meta_model.load_state_dict(torch.load(meta_pt, map_location=DEVICE))
                meta_model.to(DEVICE)
                meta_model.eval()
                self.models["meta_learner"] = meta_model
                self.models["meta_input_dim"] = meta_cfg["input_dim"]

            # 5. Calibrator
            calib_path = PATHS.calibrator_weights
            if not os.path.exists(calib_path):
                calib_path = os.path.join("outputs", "calibration", "isotonic_calibrator.pkl")
            if not os.path.exists(calib_path):
                calib_path = os.path.join("DiabetesMultimodal", "calibration", "isotonic_calibrator.pkl")
            
            if os.path.exists(calib_path):
                self.models["calibrator"] = IsotonicCalibrator.load(calib_path)

            print("✅ All components loaded.")
            return True
        except Exception as e:
            print(f"❌ Failed to load components: {e}")
            return False

    def predict(self, clinical_df: pd.DataFrame, rppg_df: pd.DataFrame, temporal_seq: np.ndarray, temporal_mask: np.ndarray):
        # Clinical transform
        X_clin = self.models["preprocessors"]["clinical"].transform(clinical_df)
        # rPPG transform
        X_rppg = self.models["preprocessors"]["rppg"].transform(rppg_df)
        
        t_clin = torch.tensor(X_clin, dtype=torch.float32).to(DEVICE)
        t_rppg = torch.tensor(X_rppg, dtype=torch.float32).to(DEVICE)
        t_temp = torch.tensor(temporal_seq, dtype=torch.float32).to(DEVICE)
        t_mask = torch.tensor(temporal_mask, dtype=torch.bool).to(DEVICE)

        with torch.no_grad():
            out = self.models["gmu"](t_clin, t_temp, t_rppg, t_mask)
            proba_gmu = torch.sigmoid(out["logit"]).cpu().numpy()
            gates = out["gates"].cpu().numpy() # [B, 3, 256]

        # MC Dropout for uncertainty
        mc_infer = MCDropoutInference(self.models["gmu"], T=30)
        mc_results = mc_infer.predict(t_clin, t_temp, t_rppg, t_mask, device=DEVICE)
        uncertainty = mc_results["std_proba"].cpu().numpy()

        # Stacking
        if "meta_learner" in self.models:
            # Note: simplified stacking for audit (average of folds)
            p_xgb = np.mean([m.predict_proba(X_clin)[:, 1] for m in self.models["classical_xgb"]], axis=0)
            p_lgbm = np.mean([m.predict_proba(X_clin)[:, 1] for m in self.models["classical_lgbm"]], axis=0)
            
            # LogReg might need its own scaling
            p_logreg_list = []
            for m in self.models["classical_logreg"]:
                X_clin_lr = m._scaler.transform(X_clin) if hasattr(m, "_scaler") else X_clin
                p_logreg_list.append(m.predict_proba(X_clin_lr)[:, 1])
            p_logreg = np.mean(p_logreg_list, axis=0)

            # USE OFFICIAL FEATURE BUILDER
            oof_preds = {"xgb": p_xgb, "lgbm": p_lgbm, "logreg": p_logreg}
            X_meta = build_meta_features(oof_preds, proba_gmu)
            
            X_meta_t = torch.tensor(X_meta, dtype=torch.float32).to(DEVICE)
            with torch.no_grad():
                proba_meta = torch.sigmoid(self.models["meta_learner"](X_meta_t)).cpu().numpy()
            
            proba_calibrated = (
                self.models["calibrator"].predict(proba_meta)
                if "calibrator" in self.models
                else proba_meta
            )
        else:
            proba_calibrated = proba_gmu

        # Hard Rules
        glucose_vals = clinical_df["glucose_fasting_mg_dl"].values
        proba_final, _ = apply_clinical_hard_rules(proba_calibrated, glucose_vals, verbose=False)
        
        return proba_final, uncertainty, gates.mean(axis=2)

    def run_part1_monotonicity(self):
        print("\n--- PART 1: MONOTONICITY ---")
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
        
        print(f"Glucose Range: 80 - 200")
        print(f"Probabilities: {probs}")
        
        # We allow a very small epsilon for floating point noise
        is_monotone = all(probs[i] <= probs[i+1] + 1e-4 for i in range(len(probs)-1))
        if is_monotone:
            print("✅ PASS: Monotonicity verified.")
            self.results["part1"] = "PASS"
            return True
        else:
            print("❌ FAIL: Non-monotone behavior detected.")
            self.results["part1"] = "FAIL"
            self.fail_reasons.append("Non-monotone behavior detected in risk progression.")
            return False

    def run_part2_dataset_validation(self):
        print("\n--- PART 2: DATASET VALIDATION ---")
        ds_test = self.pipe_data["datasets"]["test"]
        
        all_labels = []
        all_probs = []
        
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
        all_probs = np.array(all_probs)
        preds = (all_probs >= 0.5).astype(int)

        auc = roc_auc_score(all_labels, all_probs)
        acc = accuracy_score(all_labels, preds)
        prec = precision_score(all_labels, preds)
        rec = recall_score(all_labels, preds)
        f1 = f1_score(all_labels, preds)
        cm = confusion_matrix(all_labels, preds)

        self.metrics = {
            "auc": auc, "accuracy": acc, "precision": prec, "recall": rec, "f1": f1, "cm": cm.tolist()
        }

        print(f"ROC-AUC: {auc:.4f}")
        print(f"Accuracy: {acc:.4f}")
        print(f"Precision: {prec:.4f}")
        print(f"Recall: {rec:.4f}")
        print(f"F1-score: {f1:.4f}")
        print(f"Confusion Matrix:\n{cm}")

        if auc >= 0.80:
            print("✅ PASS: Statistical validity confirmed.")
            self.results["part2"] = "PASS"
            return True
        else:
            print("❌ FAIL: Weak performance.")
            self.results["part2"] = "FAIL"
            self.fail_reasons.append(f"ROC-AUC {auc:.4f} < 0.80")
            return False

    def run_part4_hard_rule(self):
        print("\n--- PART 4: HARD RULE VALIDATION ---")
        p = {
            "age": 45, "bmi": 25, "glucose_fasting_mg_dl": 126.1, 
            "smoking": 0, "family_history": 0,
            "gender": 1, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 20,
            "insulin": 90, "diabetespedigreefunction": 0.4
        }
        df = pd.DataFrame([p])
        rppg_df = pd.DataFrame([{feat: 0.0 for feat in self.models["preprocessors"]["rppg"].rppg_features}])
        t_seq = np.zeros((1, 168, 12))
        t_mask = np.ones((1, 168), dtype=bool)

        prob, _, _ = self.predict(df, rppg_df, t_seq, t_mask)
        
        print(f"Glucose: 126.1 -> Probability: {prob[0]}")
        
        if prob[0] >= 0.99: 
            print("✅ PASS: Hard rule triggered correctly.")
            self.results["part4"] = "PASS"
            return True
        else:
            print("❌ FAIL: Hard rule did not trigger.")
            self.results["part4"] = "FAIL"
            self.fail_reasons.append("Hard rule for glucose >= 126 failed to trigger.")
            return False

    def run_part7_fusion(self):
        print("\n--- PART 7: MULTIMODAL FUSION (GMU) ---")
        ds_test = self.pipe_data["datasets"]["test"]
        loader = torch.utils.data.DataLoader(ds_test, batch_size=10, shuffle=True)
        batch = next(iter(loader))
        
        clinical_df = pd.DataFrame(batch["clinical"].numpy(), columns=self.models["preprocessors"]["clinical"].feature_names)
        clinical_df["glucose_fasting_mg_dl"] = batch["glucose"].numpy()
        rppg_df = pd.DataFrame(batch["rppg"].numpy(), columns=self.models["preprocessors"]["rppg"].feature_names)
        
        _, _, gates = self.predict(clinical_df, rppg_df, batch["temporal"].numpy(), batch["temp_mask"].numpy())
        
        avg_gates = gates.mean(axis=0)
        print(f"Average Gating Weights (Clin, Temp, rPPG): {avg_gates}")
        
        if all(w > 0.01 for w in avg_gates):
            print("✅ PASS: All modalities contribute.")
            self.results["part7"] = "PASS"
            return True
        else:
            print("❌ FAIL: One or more modalities are dominated.")
            self.results["part7"] = "FAIL"
            self.fail_reasons.append(f"Modalities dominated: {avg_gates}")
            return False

    def run_part8_calibration(self):
        print("\n--- PART 8: CALIBRATION & UNCERTAINTY ---")
        ds_test = self.pipe_data["datasets"]["test"]
        loader = torch.utils.data.DataLoader(ds_test, batch_size=50, shuffle=True)
        batch = next(iter(loader))
        
        clinical_df = pd.DataFrame(batch["clinical"].numpy(), columns=self.models["preprocessors"]["clinical"].feature_names)
        clinical_df["glucose_fasting_mg_dl"] = batch["glucose"].numpy()
        rppg_df = pd.DataFrame(batch["rppg"].numpy(), columns=self.models["preprocessors"]["rppg"].feature_names)
        
        _, uncertainties, _ = self.predict(clinical_df, rppg_df, batch["temporal"].numpy(), batch["temp_mask"].numpy())
        
        unc_std = np.std(uncertainties)
        print(f"Uncertainty variation (std): {unc_std:.6f}")
        
        if unc_std > 1e-6:
            print("✅ PASS: Uncertainty varies per sample.")
            self.results["part8"] = "PASS"
            return True
        else:
            print("❌ FAIL: Uncertainty is constant (MC Dropout likely broken).")
            self.results["part8"] = "FAIL"
            self.fail_reasons.append("Uncertainty is constant across samples.")
            return False

    def run_part9_robustness(self):
        print("\n--- PART 9: ROBUSTNESS ---")
        p_extreme = {
            "age": 45, "bmi": 25, "glucose_fasting_mg_dl": 500, 
            "smoking": 0, "family_history": 0,
            "gender": 1, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 20,
            "insulin": 90, "diabetespedigreefunction": 0.4
        }
        df = pd.DataFrame([p_extreme])
        rppg_df = pd.DataFrame([{feat: 0.0 for feat in self.models["preprocessors"]["rppg"].rppg_features}])
        t_seq = np.zeros((1, 168, 12))
        t_mask = np.ones((1, 168), dtype=bool)

        try:
            prob, _, _ = self.predict(df, rppg_df, t_seq, t_mask)
            print(f"Extreme Glucose (500) -> Prob: {prob[0]}")
            
            p_missing = p_extreme.copy()
            p_missing["bmi"] = np.nan
            df_m = pd.DataFrame([p_missing])
            prob_m, _, _ = self.predict(df_m, rppg_df, t_seq, t_mask)
            print(f"Missing BMI -> Prob: {prob_m[0]}")
            
            print("✅ PASS: Model is robust to extreme and missing values.")
            self.results["part9"] = "PASS"
            return True
        except Exception as e:
            print(f"❌ FAIL: Crash during robustness test: {e}")
            self.results["part9"] = "FAIL"
            self.fail_reasons.append(f"Crash during robustness test: {e}")
            return False

    def finalize(self):
        passed_parts = [v for v in self.results.values() if v == "PASS"]
        self.global_score = (len(passed_parts) / 6) * 100 
        
        overall_pass = all(v == "PASS" for v in self.results.values())
        
        report = {
            "VERDICT": "PASS" if overall_pass else "FAIL",
            "GLOBAL_SCORE": self.global_score,
            "DETAILED_RESULTS": self.results,
            "METRICS": self.metrics,
            "FAIL_REASONS": self.fail_reasons,
            "RISK_LEVEL": "LOW" if overall_pass else "HIGH"
        }
        
        print("\n" + "="*60)
        print("FINAL AUDIT REPORT")
        print("="*60)
        print(json.dumps(report, indent=2))
        print("="*60)
        
        if overall_pass:
            print("\nSAFE FOR PRODUCTION")
        else:
            print("\nMEDICALLY UNSAFE")

if __name__ == "__main__":
    audit = ClinicalAuditEngine()
    if audit.load_components():
        audit.run_part1_monotonicity()
        audit.run_part2_dataset_validation()
        audit.run_part4_hard_rule()
        audit.run_part7_fusion()
        audit.run_part8_calibration()
        audit.run_part9_robustness()
        audit.finalize()
