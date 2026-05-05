import os
import sys
import torch
import numpy as np
import pickle

# Add project root to path
project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE

def feature_integrity_test():
    print("\n[Feature Integrity Test]")
    
    # 1. Preprocessor
    prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
    with open(prep_path, "rb") as f:
        preps = pickle.load(f)
    n_features = preps["clinical"].n_features
    print(f"  Preprocessor: {n_features} features")
    
    # 2. GMU Model
    from src.models.diabetes_model_net import DiabetesMultimodalNet
    gmu_model = DiabetesMultimodalNet(n_clinical_features=n_features)
    try:
        gmu_model.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location=DEVICE))
        print(f"  GMU Model: OK (Loaded with {n_features} features)")
    except Exception as e:
        print(f"  GMU Model: FAIL ({e})")

    # 3. Classical Models
    mismatches = []
    for name in ["xgb", "lgbm", "logreg"]:
        path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
        with open(path, "rb") as f:
            models = pickle.load(f)
            expected = models[0].n_features_in_
            print(f"  {name.upper():<8}: {expected} features")
            if expected != n_features:
                mismatches.append(name)
                
    if not mismatches:
        print("✅ Feature Integrity Test: PASS")
    else:
        print(f"❌ Feature Integrity Test: FAIL (Mismatches in: {mismatches})")

if __name__ == "__main__":
    feature_integrity_test()
