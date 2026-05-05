import os
import sys
import json
import torch
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List

# Add project root to sys.path
project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, NUMERICAL_FEATURES, CATEGORICAL_FEATURES, INFER_CFG
from src.models.diabetes_model_net import DiabetesMultimodalNet, MCDropoutInference
from src.stacking.stacking import MetaLearnerNet, IsotonicCalibrator, apply_clinical_hard_rules

# Load models
MODELS = {}

def load_models():
    prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
    with open(prep_path, "rb") as f:
        MODELS["preprocessors"] = pickle.load(f)
    
    prep_clin = MODELS["preprocessors"]["clinical"]
    n_clin = prep_clin.n_features
    
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
    
    meta_path = PATHS.meta_learner_weights.replace(".pkl", ".pt")
    meta_cfg_path = PATHS.meta_learner_weights.replace(".pkl", "_config.json")
    if os.path.exists(meta_path) and os.path.exists(meta_cfg_path):
        with open(meta_cfg_path, "r") as f:
            meta_cfg = json.load(f)
        MODELS["meta_learner"] = MetaLearnerNet(
            input_dim=meta_cfg["input_dim"],
            hidden_dims=meta_cfg.get("hidden_dims", [64, 32]),
            dropout=meta_cfg.get("dropout", 0.2)
        )
        MODELS["meta_learner"].load_state_dict(torch.load(meta_path, map_location=DEVICE))
        MODELS["meta_learner"].to(DEVICE)
        MODELS["meta_learner"].eval()
        MODELS["meta_input_dim"] = meta_cfg["input_dim"]
    
    calib_path = PATHS.calibrator_weights
    if os.path.exists(calib_path):
        MODELS["calibrator"] = IsotonicCalibrator.load(calib_path)

def run_inference(clinical_data: Dict, rppg_data: Dict):
    # 1. Clinical
    df_clin = pd.DataFrame([clinical_data])
    for col in MODELS["preprocessors"]["clinical"].feature_names:
        if col not in df_clin.columns: df_clin[col] = np.nan
    X_clin = MODELS["preprocessors"]["clinical"].transform(df_clin)
    
    # 2. rPPG
    rppg_dict = {feat: np.nan for feat in MODELS["preprocessors"]["rppg"].rppg_features}
    rppg_dict.update(rppg_data)
    df_rppg = pd.DataFrame([rppg_dict])
    X_rppg = MODELS["preprocessors"]["rppg"].transform(df_rppg)
    
    # 3. GMU
    t_clin = torch.tensor(X_clin, dtype=torch.float32).to(DEVICE)
    t_rppg = torch.tensor(X_rppg, dtype=torch.float32).to(DEVICE)
    t_temp = torch.zeros((1, 168, 12), dtype=torch.float32).to(DEVICE)
    t_mask = torch.ones((1, 168), dtype=torch.bool).to(DEVICE)
    
    with torch.no_grad():
        out = MODELS["gmu"](t_clin, t_temp, t_rppg, t_mask)
        proba_gmu = torch.sigmoid(out["logit"]).item()
        gates = out["gates"].cpu().numpy()[0] # [3, 256]
        mean_gates = gates.mean(axis=1) # [3]
    
    # 4. Uncertainty
    mc_infer = MCDropoutInference(MODELS["gmu"], T=30)
    mc_results = mc_infer.predict(t_clin, t_temp, t_rppg, t_mask, device=DEVICE)
    uncertainty = mc_results["std_proba"].item()
    
    # 5. Stacking
    if "meta_learner" in MODELS:
        p_xgb = np.mean([m.predict_proba(X_clin)[:, 1] for m in MODELS["classical_xgb"]], axis=0)[0]
        p_lgbm = np.mean([m.predict_proba(X_clin)[:, 1] for m in MODELS["classical_lgbm"]], axis=0)[0]
        m_logreg = MODELS["classical_logreg"][0]
        X_clin_lr = m_logreg._scaler.transform(X_clin) if hasattr(m_logreg, "_scaler") else X_clin
        p_logreg = np.mean([m.predict_proba(X_clin_lr)[:, 1] for m in MODELS["classical_logreg"]], axis=0)[0]
        
        meta_input_dim = MODELS["meta_input_dim"]
        X_meta = torch.tensor([[p_xgb, p_lgbm, p_logreg, proba_gmu][:meta_input_dim]], dtype=torch.float32).to(DEVICE)
        with torch.no_grad():
            proba_meta = torch.sigmoid(MODELS["meta_learner"](X_meta)).item()
        
        proba_final_raw = MODELS["calibrator"].predict(np.array([proba_meta]))[0] if "calibrator" in MODELS else proba_meta
    else:
        proba_final_raw = proba_gmu
        
    # 6. Hard Rules
    glucose_val = clinical_data.get("glucose_fasting_mg_dl", np.nan)
    g_val_arr = np.array([glucose_val])
    proba_final, _ = apply_clinical_hard_rules(np.array([proba_final_raw]), g_val_arr, verbose=False)
    
    return {
        "probability": float(proba_final[0]),
        "uncertainty": uncertainty,
        "gates": mean_gates,
        "raw_probs": {"xgb": p_xgb, "lgbm": p_lgbm, "logreg": p_logreg, "gmu": proba_gmu} if "meta_learner" in MODELS else {"gmu": proba_gmu}
    }

def audit():
    load_models()
    cases = [
        {"name": "Case A (Healthy)", "clinical": {"age": 25, "bmi": 21, "glucose_fasting_mg_dl": 95, "smoking": 0, "family_history": 0, "gender": 1, "bloodpressure": 115, "pregnancies": 0, "skinthickness": 15, "insulin": 70, "diabetespedigreefunction": 0.3}, "rppg": {"hr_bpm": 65, "sdnn_ms": 60, "rmssd_ms": 55, "spo2": 99}},
        {"name": "Case B (Moderate)", "clinical": {"age": 50, "bmi": 29, "glucose_fasting_mg_dl": 110, "smoking": 1, "family_history": 1, "gender": 1, "bloodpressure": 135, "pregnancies": 0, "skinthickness": 25, "insulin": 120, "diabetespedigreefunction": 0.6}, "rppg": {"hr_bpm": 75, "sdnn_ms": 35, "rmssd_ms": 30, "spo2": 96}},
        {"name": "Case C (High)", "clinical": {"age": 65, "bmi": 32, "glucose_fasting_mg_dl": 120, "smoking": 1, "family_history": 1, "gender": 1, "bloodpressure": 145, "pregnancies": 0, "skinthickness": 30, "insulin": 180, "diabetespedigreefunction": 0.8}, "rppg": {"hr_bpm": 85, "sdnn_ms": 20, "rmssd_ms": 15, "spo2": 94}},
        {"name": "Case D (Critical)", "clinical": {"age": 45, "bmi": 25, "glucose_fasting_mg_dl": 130, "smoking": 0, "family_history": 0, "gender": 1, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 20, "insulin": 90, "diabetespedigreefunction": 0.4}, "rppg": {"hr_bpm": 70, "sdnn_ms": 40, "rmssd_ms": 35, "spo2": 97}}
    ]
    
    for case in cases:
        res = run_inference(case["clinical"], case["rppg"])
        print(f"\n{case['name']}: Prob={res['probability']:.4f}, Unc={res['uncertainty']:.4f}")
        print(f"  Raw Probs: {res['raw_probs']}")
        print(f"  GMU Gates (Clin/Temp/rPPG): {res['gates']}")

if __name__ == "__main__":
    audit()
