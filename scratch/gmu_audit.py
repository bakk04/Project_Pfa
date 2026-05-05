import os
import sys
import torch
import numpy as np
import pandas as pd
import pickle

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, NUMERICAL_FEATURES, CATEGORICAL_FEATURES, INFER_CFG
from src.models.diabetes_model_net import DiabetesMultimodalNet, MCDropoutInference

def run_gmu_audit():
    prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
    with open(prep_path, "rb") as f:
        preprocessors = pickle.load(f)

    clin_prep = preprocessors["clinical"]
    n_clin = clin_prep.n_features
    
    gmu_model = DiabetesMultimodalNet(n_clinical_features=n_clin)
    gmu_model.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location=DEVICE))
    gmu_model.to(DEVICE)
    gmu_model.eval()
    
    mc_infer = MCDropoutInference(gmu_model, T=30)

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

    print("\n" + "="*60)
    print(f"{'CASE':<25} | {'PROBA (GMU)':<12} | {'UNCERTAINTY'}")
    print("-" * 60)

    for name, data in cases.items():
        df_clin = pd.DataFrame([data["clinical"]])
        if "glucose" in df_clin.columns: df_clin["glucose_fasting_mg_dl"] = df_clin["glucose"]
        X_clin = clin_prep.transform(df_clin)
        t_clin = torch.tensor(X_clin, dtype=torch.float32).to(DEVICE)
        
        t_rppg = torch.tensor(preprocessors["rppg"].transform(pd.DataFrame([data["rppg"]])), dtype=torch.float32).to(DEVICE)
        t_temp = torch.zeros((1, 168, 12), dtype=torch.float32).to(DEVICE)
        t_mask = torch.ones((1, 168), dtype=torch.bool).to(DEVICE)
        
        res = mc_infer.predict(t_clin, t_temp, t_rppg, t_mask, device=DEVICE)
        print(f"{name:<25} | {res['mean_proba'].item():.4f}       | {res['std_proba'].item():.4f}")

    print("="*60)

if __name__ == "__main__":
    run_gmu_audit()
