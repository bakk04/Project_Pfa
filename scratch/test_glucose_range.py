import os
import sys
import torch
import pickle
import numpy as np
import pandas as pd

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE

# Load models
MODELS = {}

def load_models():
    prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
    with open(prep_path, "rb") as f:
        MODELS["preprocessors"] = pickle.load(f)
    
    from src.models.diabetes_model_net import DiabetesMultimodalNet
    prep_clin = MODELS["preprocessors"]["clinical"]
    n_clin = prep_clin.n_features
    
    gmu_model = DiabetesMultimodalNet(n_clinical_features=n_clin)
    gmu_model.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location=DEVICE))
    gmu_model.to(DEVICE)
    gmu_model.eval()
    MODELS["gmu"] = gmu_model

def test_extreme_glucose():
    load_models()
    
    base_clin = {"age": 45, "bmi": 25, "smoking": 0, "family_history": 0, "gender": 1, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 20, "insulin": 90, "diabetespedigreefunction": 0.5}
    base_rppg = {"hr_bpm": 70, "sdnn_ms": 40, "rmssd_ms": 35, "spo2": 97}
    
    glucoses = [40, 70, 90, 110, 130, 200, 400]
    results = []
    
    clin_prep = MODELS["preprocessors"]["clinical"]
    rppg_prep = MODELS["preprocessors"]["rppg"]

    for g in glucoses:
        clin = base_clin.copy()
        clin["glucose_fasting_mg_dl"] = g
        df_clin = pd.DataFrame([clin])
        for col in clin_prep.feature_names:
            if col not in df_clin.columns: df_clin[col] = np.nan
        X_clin = clin_prep.transform(df_clin)
        
        df_rppg = pd.DataFrame([base_rppg])
        for col in rppg_prep.feature_names:
            if col not in df_rppg.columns: df_rppg[col] = np.nan
        X_rppg = rppg_prep.transform(df_rppg)
        
        t_clin = torch.tensor(X_clin, dtype=torch.float32).to(DEVICE)
        t_rppg = torch.tensor(X_rppg, dtype=torch.float32).to(DEVICE)
        t_temp = torch.zeros((1, 168, 12), dtype=torch.float32).to(DEVICE)
        t_mask = torch.ones((1, 168), dtype=torch.bool).to(DEVICE)
        
        with torch.no_grad():
            out = MODELS["gmu"](t_clin, t_temp, t_rppg, t_mask)
            prob = torch.sigmoid(out["logit"]).item()
            results.append((g, prob))
            
    print("\nGlucose Sensitivity Test:")
    for g, p in results:
        print(f"  Glucose {g:3d} -> Prob {p:.4f}")

if __name__ == "__main__":
    test_extreme_glucose()
