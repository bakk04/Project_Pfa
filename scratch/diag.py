import os
import sys
import torch
import numpy as np
import pandas as pd
import pickle

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import NUMERICAL_FEATURES, CATEGORICAL_FEATURES, PATHS

def diag():
    print(f"Config features: {len(NUMERICAL_FEATURES) + len(CATEGORICAL_FEATURES)}")
    
    prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
    with open(prep_path, "rb") as f:
        prep = pickle.load(f)
    print(f"Prep feature_names: {len(prep['clinical'].feature_names)}")
    
    xgb_path = os.path.join(PATHS.checkpoints, "classical_xgb_folds.pkl")
    with open(xgb_path, "rb") as f:
        models = pickle.load(f)
    print(f"XGB expects: {models[0].n_features_in_}")
    
    # Check if target is in features
    if "diabetes_target" in prep["clinical"].feature_names:
        print("ALERT: diabetes_target is in features (LEAKAGE!)")
    
    # Check for diabetic feature
    if "diabetic" in prep["clinical"].feature_names:
        print("ALERT: 'diabetic' feature is in features (LEAKAGE!)")

    # Check for common names
    common = set(NUMERICAL_FEATURES + CATEGORICAL_FEATURES)
    prep_names = set(prep["clinical"].feature_names)
    print(f"Missing in Prep: {common - prep_names}")
    print(f"Extra in Prep: {prep_names - common}")

    # Check if we can find 12th feature by trying to predict with 12 cols
    X_dummy = np.zeros((1, 12))
    try:
        models[0].predict(X_dummy)
        print("XGB runs with 12 features")
    except Exception as e:
        print(f"XGB fails with 12 features: {e}")

diag()
