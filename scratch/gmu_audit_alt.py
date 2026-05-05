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

def run_gmu_audit_alt():
    # Use the preprocessor from the SAME directory
    prep_path = os.path.join(project_root, "DiabetesMultimodal", "checkpoints", "preprocessors.pkl")
    with open(prep_path, "rb") as f:
        preprocessors = pickle.load(f)

    clin_prep = preprocessors["clinical"]
    n_clin = clin_prep.n_features
    print(f"Using preprocessor with {n_clin} features")
    
    gmu_model = DiabetesMultimodalNet(n_clinical_features=n_clin)
    weights_path = os.path.join(project_root, "DiabetesMultimodal", "checkpoints", "gmu_best.pt")
    gmu_model.load_state_dict(torch.load(weights_path, map_location=DEVICE))
    gmu_model.to(DEVICE)
    gmu_model.eval()
    
    mc_infer = MCDropoutInference(gmu_model, T=30)

    # Note: Case features might need to match the 32 features of this preprocessor
    # But for now let's see if it runs with the 11 features (it should fill NaNs)
    
    cases = {
        "Case A (Healthy)": {
            "clinical": {"age": 25, "bmi": 21, "glucose_fasting_mg_dl": 95, "sex": 1},
            "rppg": {"hr_bpm": 65}
        },
        "Case B (Moderate)": {
            "clinical": {"age": 55, "bmi": 29, "glucose_fasting_mg_dl": 110, "sex": 1},
            "rppg": {"hr_bpm": 80}
        },
        "Case C (High)": {
            "clinical": {"age": 65, "bmi": 35, "glucose_fasting_mg_dl": 125, "sex": 1},
            "rppg": {"hr_bpm": 95}
        },
        "Case D (Critical)": {
            "clinical": {"age": 60, "bmi": 30, "glucose_fasting_mg_dl": 140, "sex": 1},
            "rppg": {"hr_bpm": 85}
        }
    }

    print("\n" + "="*60)
    print(f"{'CASE':<25} | {'PROBA (GMU)':<12} | {'UNCERTAINTY'}")
    print("-" * 60)

    for name, data in cases.items():
        df_clin = pd.DataFrame([data["clinical"]])
        X_clin = clin_prep.transform(df_clin)
        t_clin = torch.tensor(X_clin, dtype=torch.float32).to(DEVICE)
        
        t_rppg = torch.zeros((1, 8), dtype=torch.float32).to(DEVICE)
        t_temp = torch.zeros((1, 168, 12), dtype=torch.float32).to(DEVICE)
        t_mask = torch.ones((1, 168), dtype=torch.bool).to(DEVICE)
        
        res = mc_infer.predict(t_clin, t_temp, t_rppg, t_mask, device=DEVICE)
        print(f"{name:<25} | {res['mean_proba'].item():.4f}       | {res['std_proba'].item():.4f}")

    print("="*60)

if __name__ == "__main__":
    run_gmu_audit_alt()
