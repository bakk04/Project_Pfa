import pickle
import os
import xgboost as xgb

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
xgb_path = os.path.join(project_root, "outputs", "checkpoints", "classical_xgb_folds.pkl")
with open(xgb_path, "rb") as f:
    models = pickle.load(f)

booster = models[0].get_booster()
print(f"Feature names in booster: {booster.feature_names}")
