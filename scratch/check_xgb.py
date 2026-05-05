import pickle
import os
import sys

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
xgb_path = os.path.join(project_root, "outputs", "checkpoints", "classical_xgb_folds.pkl")
with open(xgb_path, "rb") as f:
    models = pickle.load(f)

print(f"XGBoost model expects {models[0].n_features_in_} features")
if hasattr(models[0], "feature_names_in_"):
    print("Feature names in model:")
    print(models[0].feature_names_in_)
