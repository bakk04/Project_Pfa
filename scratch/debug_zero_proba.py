import torch
import numpy as np
import pandas as pd
import pickle
import os
import sys
import json

# Add project root to sys.path
sys.path.insert(0, '.')

from config import PATHS, DEVICE, NUMERICAL_FEATURES, CATEGORICAL_FEATURES, INFER_CFG
from src.models.diabetes_model_net import DiabetesMultimodalNet, MCDropoutInference
from src.stacking.stacking import MetaLearnerNet, IsotonicCalibrator

# Mocking API helpers
def _calculate_age(birth_date_str: str) -> int:
    from datetime import datetime, date
    birth_date = datetime.strptime(birth_date_str, "%Y-%m-%d").date()
    today = date(2026, 5, 5) # Match user's system date
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

def _calculate_bmi(weight_kg: float, height_cm: float) -> float:
    return weight_kg / ((height_cm / 100.0) ** 2)

def _build_clinical_dataframe(age, bmi, glucose_val, smoking, family_history):
    clinical_dict = {feat: np.nan for feat in NUMERICAL_FEATURES + CATEGORICAL_FEATURES}
    known_values = {
        "glucose_fasting_mg_dl": glucose_val,
        "age": float(age),
        "bmi": bmi,
        "smoking": float(smoking),
        "family_history": float(family_history),
        "gender": 1.0,
        "bloodpressure": 120.0,
        "pregnancies": 0.0,
        "skinthickness": 20.0,
        "insulin": 90.0,
        "diabetespedigreefunction": 0.4,
    }
    for feat in clinical_dict:
        if feat in known_values: clinical_dict[feat] = known_values[feat]
    return pd.DataFrame([clinical_dict])

# Load models
with open(os.path.join(PATHS.checkpoints, "preprocessors.pkl"), "rb") as f:
    preps = pickle.load(f)

gmu = DiabetesMultimodalNet(n_clinical_features=preps["clinical"].n_features)
gmu.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location='cpu'))
gmu.eval()

models = {}
for name in ["xgb", "lgbm", "logreg"]:
    path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
    with open(path, "rb") as f: models[name] = pickle.load(f)

with open(os.path.join(PATHS.checkpoints, "meta_learner_config.json"), "r") as f:
    meta_cfg = json.load(f)
meta_learner = MetaLearnerNet(input_dim=meta_cfg["input_dim"])
meta_learner.load_state_dict(torch.load(os.path.join(PATHS.checkpoints, "meta_learner.pt"), map_location='cpu'))
meta_learner.eval()

calibrator = IsotonicCalibrator.load(PATHS.calibrator_weights)

# Input data from user
json_in = {
  "clinical_data": {
    "weight": 70, "height": 180, "glucose_fasting_mg_dl": 95,
    "hba1c": 5.4, "smoking": False, "familyHistory": False, "dateOfBirth": "2000-05-15"
  },
  "rppg_features": {
    "heart_rate": 65, "hrv_sdnn": 60, "hrv_rmssd": 45, "spo2": 98
  },
  "temporal_data": [
    {"timestamp": "2026-05-05T08:00:00", "sensor_value_1": 65.0, "sensor_value_2": 98.0}
  ]
}

age = _calculate_age(json_in["clinical_data"]["dateOfBirth"])
bmi = _calculate_bmi(json_in["clinical_data"]["weight"], json_in["clinical_data"]["height"])
df_clin = _build_clinical_dataframe(age, bmi, 95, 0, 0)
X_clin = preps["clinical"].transform(df_clin)

# Base predictions
p_xgb = np.mean([m.predict_proba(X_clin)[:, 1] for m in models["xgb"]])
p_lgbm = np.mean([m.predict_proba(X_clin)[:, 1] for m in models["lgbm"]])
p_logreg = np.mean([m.predict_proba(m._scaler.transform(X_clin))[:, 1] for m in models["logreg"]])

t_clin = torch.tensor(X_clin, dtype=torch.float32)

# Build RPPG
rppg_dict = {feat: np.nan for feat in preps["rppg"].feature_names}
rppg_dict.update({"hr_bpm": 65, "sdnn_ms": 60, "rmssd_ms": 45, "spo2": 98})
X_rppg = preps["rppg"].transform(pd.DataFrame([rppg_dict]))
t_rppg = torch.tensor(X_rppg, dtype=torch.float32)

# Build Temporal
t_seq = np.zeros((1, 168, 12), dtype=np.float32)
t_mask = np.ones((1, 168), dtype=bool)
t_seq[0, 0, 0] = 65.0
t_seq[0, 0, 1] = 98.0
t_mask[0, 0] = False
t_temp = torch.tensor(t_seq, dtype=torch.float32)
t_mask_t = torch.tensor(t_mask, dtype=torch.bool)

with torch.no_grad():
    out = gmu(t_clin, t_temp, t_rppg, t_mask_t)
    p_gmu = torch.sigmoid(out["logit"]).item()

base_preds = [float(p_xgb), float(p_lgbm), float(p_logreg), float(p_gmu)]
disagreement = float(np.std(base_preds))
meta_in = base_preds + [disagreement]

t_meta_in = torch.tensor([meta_in], dtype=torch.float32)
with torch.no_grad():
    logit_meta = meta_learner(t_meta_in).item()
    p_meta = torch.sigmoid(torch.tensor(logit_meta)).item()

p_calibrated = calibrator.predict(np.array([p_meta]))[0]

print(f"Base Preds: XGB={p_xgb:.4f}, LGBM={p_lgbm:.4f}, LogReg={p_logreg:.4f}, GMU={p_gmu:.4f}")
print(f"Meta In: {meta_in}")
print(f"Meta Logit: {logit_meta:.4f}")
print(f"Meta Proba: {p_meta:.4f}")
print(f"Calibrated Proba: {p_calibrated:.4f}")
