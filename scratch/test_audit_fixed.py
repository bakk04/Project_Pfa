import os
import sys
import torch
import numpy as np
import pandas as pd
import pickle
import json

# Add project root to path
project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, NUMERICAL_FEATURES, CATEGORICAL_FEATURES, INFER_CFG
from src.models.diabetes_model_net import DiabetesMultimodalNet, MCDropoutInference
from src.stacking.stacking import MetaLearnerNet, IsotonicCalibrator, apply_clinical_hard_rules

def load_models():
    MODELS = {}
    prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
    with open(prep_path, "rb") as f:
        MODELS["preprocessors"] = pickle.load(f)

    clin_prep = MODELS["preprocessors"]["clinical"]
    n_clin = clin_prep.n_features
    
    gmu_model = DiabetesMultimodalNet(n_clinical_features=n_clin)
    gmu_model.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location=DEVICE))
    gmu_model.to(DEVICE)
    gmu_model.eval()
    MODELS["gmu"] = gmu_model

    for name in ["xgb", "lgbm", "logreg"]:
        path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
        if os.path.exists(path):
            with open(path, "rb") as f:
                MODELS[f"classical_{name}"] = pickle.load(f)

    # Use a fixed input dim for meta-learner (5 features as per stacking.py)
    MODELS["meta_input_dim"] = 5
    meta_pt = os.path.join(PATHS.checkpoints, "meta_learner.pt")
    if os.path.exists(meta_pt):
        meta_model = MetaLearnerNet(
            input_dim=5,
            hidden_dims=[64, 32],
            dropout=0.2,
        )
        meta_model.load_state_dict(torch.load(meta_pt, map_location=DEVICE))
        meta_model.to(DEVICE)
        meta_model.eval()
        MODELS["meta_learner"] = meta_model

    if os.path.exists(PATHS.calibrator_weights):
        MODELS["calibrator"] = IsotonicCalibrator.load(PATHS.calibrator_weights)
        
    return MODELS

def predict_case(MODELS, clinical_vals, rppg_vals, temporal_vals=None):
    # Clinical
    df_clin = pd.DataFrame([clinical_vals])
    # Mapping for glucose
    if "glucose" in df_clin.columns and "glucose_fasting_mg_dl" not in df_clin.columns:
        df_clin["glucose_fasting_mg_dl"] = df_clin["glucose"]
    
    X_clin = MODELS["preprocessors"]["clinical"].transform(df_clin)
    
    # FIX: Model mismatch - append a zero column if needed
    if X_clin.shape[1] == 11:
        X_clin = np.concatenate([X_clin, np.zeros((1, 1))], axis=1)
    
    t_clin = torch.tensor(X_clin[:, :11], dtype=torch.float32).to(DEVICE)
    
    # rPPG
    rppg_prep = MODELS["preprocessors"]["rppg"]
    df_rppg = pd.DataFrame([rppg_vals])
    X_rppg = rppg_prep.transform(df_rppg)
    t_rppg = torch.tensor(X_rppg, dtype=torch.float32).to(DEVICE)
    
    # Temporal (Zeros for audit)
    t_temp = torch.zeros((1, 168, 12), dtype=torch.float32).to(DEVICE)
    t_mask = torch.ones((1, 168), dtype=torch.bool).to(DEVICE)
    
    # GMU Inference
    mc_infer = MCDropoutInference(MODELS["gmu"], T=30)
    mc_results = mc_infer.predict(t_clin, t_temp, t_rppg, t_mask, device=DEVICE)
    proba_gmu = mc_results["mean_proba"].item()
    uncertainty = mc_results["std_proba"].item()
    
    # Stacking
    p_xgb = np.mean([m.predict_proba(X_clin)[:, 1] for m in MODELS["classical_xgb"]])
    p_lgbm = np.mean([m.predict_proba(X_clin)[:, 1] for m in MODELS["classical_lgbm"]])
    # LogReg might fail if its scaler expects 11
    try:
        p_logreg = np.mean([m.predict_proba(m._scaler.transform(X_clin))[:, 1] for m in MODELS["classical_logreg"]])
    except:
        # Fallback to unscladed if mismatch
        p_logreg = np.mean([m.predict_proba(X_clin)[:, 1] for m in MODELS["classical_logreg"]])
    
    base_preds = [p_xgb, p_lgbm, p_logreg, proba_gmu]
    model_disagreement = np.std(base_preds)
    
    X_meta_np = np.array([base_preds + [model_disagreement]], dtype=np.float32)
    X_meta_t = torch.tensor(X_meta_np, dtype=torch.float32).to(DEVICE)
    
    with torch.no_grad():
        proba_meta = torch.sigmoid(MODELS["meta_learner"](X_meta_t)).item()
        
    if "calibrator" in MODELS:
        proba_calibrated = MODELS["calibrator"].predict(np.array([proba_meta]))[0]
    else:
        proba_calibrated = proba_meta
    
    # Hard Rules
    glucose = clinical_vals.get("glucose_fasting_mg_dl", clinical_vals.get("glucose", 90))
    proba_final, rule_stats = apply_clinical_hard_rules(np.array([proba_calibrated]), np.array([glucose]), verbose=False)
    
    return {
        "proba_final": proba_final[0],
        "uncertainty_mc": uncertainty,
        "uncertainty_disagreement": model_disagreement,
        "proba_gmu": proba_gmu,
        "proba_meta": proba_meta,
        "proba_calibrated": proba_calibrated,
        "rule_stats": rule_stats,
        "base_preds": base_preds
    }

def run_audit():
    MODELS = load_models()
    
    cases = {
        "Case A (Healthy)": {
            "clinical": {"age": 25, "bmi": 21, "glucose": 95, "smoking": 0, "family_history": 0, "gender": 1, "bloodpressure": 110, "pregnancies": 0, "skinthickness": 20, "insulin": 40, "diabetespedigreefunction": 0.2},
            "rppg": {"hr_bpm": 65, "sdnn_ms": 70, "rmssd_ms": 60, "lf_power": 1.0, "hf_power": 1.0, "lf_hf_ratio": 1.0, "pnn50_pct": 20, "mean_rr_ms": 900, "spo2": 99}
        },
        "Case B (Moderate)": {
            "clinical": {"age": 50, "bmi": 29, "glucose": 110, "smoking": 1, "family_history": 0, "gender": 1, "bloodpressure": 125, "pregnancies": 0, "skinthickness": 25, "insulin": 80, "diabetespedigreefunction": 0.4},
            "rppg": {"hr_bpm": 80, "sdnn_ms": 35, "rmssd_ms": 30, "lf_power": 0.8, "hf_power": 0.6, "lf_hf_ratio": 1.3, "pnn50_pct": 10, "mean_rr_ms": 750, "spo2": 96}
        },
        "Case C (High)": {
            "clinical": {"age": 65, "bmi": 35, "glucose": 120, "smoking": 1, "family_history": 1, "gender": 1, "bloodpressure": 140, "pregnancies": 0, "skinthickness": 30, "insulin": 120, "diabetespedigreefunction": 0.8},
            "rppg": {"hr_bpm": 95, "sdnn_ms": 15, "rmssd_ms": 10, "lf_power": 0.5, "hf_power": 0.3, "lf_hf_ratio": 1.6, "pnn50_pct": 2, "mean_rr_ms": 630, "spo2": 94}
        },
        "Case D (Critical - ADA)": {
            "clinical": {"age": 40, "bmi": 28, "glucose": 130, "smoking": 0, "family_history": 0, "gender": 1, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 25, "insulin": 60, "diabetespedigreefunction": 0.3},
            "rppg": {"hr_bpm": 75, "sdnn_ms": 40, "rmssd_ms": 35, "lf_power": 0.9, "hf_power": 0.8, "lf_hf_ratio": 1.1, "pnn50_pct": 15, "mean_rr_ms": 800, "spo2": 98}
        }
    }
    
    results = {}
    print("\n" + "="*90)
    print(f"{'CASE':<25} | {'PROBA':<7} | {'UNC_MC':<7} | {'UNC_DIS':<7} | {'BASE_PREDS'}")
    print("-" * 90)
    
    for name, data in cases.items():
        try:
            res = predict_case(MODELS, data["clinical"], data["rppg"])
            results[name] = res
            base = [f"{b:.2f}" for b in res["base_preds"]]
            print(f"{name:<25} | {res['proba_final']:.4f}  | {res['uncertainty_mc']:.4f}  | {res['uncertainty_disagreement']:.4f}  | {base}")
        except Exception as e:
            print(f"{name:<25} | ERROR: {e}")

    print("="*90)

if __name__ == "__main__":
    run_audit()
