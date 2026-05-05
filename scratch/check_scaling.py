import pickle
import os
import sys
import numpy as np

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS

prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
with open(prep_path, "rb") as f:
    preps = pickle.load(f)

clin_prep = preps["clinical"]
print(f"Feature Names: {clin_prep.feature_names}")
print(f"Scaler Center: {clin_prep.num_scaler.center_}")
print(f"Scaler Scale:  {clin_prep.num_scaler.scale_}")

# Test Case A transform
import pandas as pd
case_a = pd.DataFrame([{
    "age": 25, 
    "bmi": 21, 
    "glucose_fasting_mg_dl": 95, 
    "smoking": 0, 
    "family_history": 0, 
    "gender": 1,
    "bloodpressure": 120,
    "pregnancies": 0,
    "skinthickness": 20,
    "insulin": 80,
    "diabetespedigreefunction": 0.5
}])
# Fill missing features with median if not provided
for col in clin_prep.feature_names:
    if col not in case_a.columns:
        case_a[col] = np.nan

X_transformed = clin_prep.transform(case_a)
print(f"Transformed Case A: {X_transformed}")
