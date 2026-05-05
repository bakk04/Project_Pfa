import pickle
import os

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
for name in ["xgb", "lgbm", "logreg"]:
    path = os.path.join(project_root, "outputs", "checkpoints", f"classical_{name}_folds.pkl")
    if os.path.exists(path):
        with open(path, "rb") as f:
            models = pickle.load(f)
        print(f"{name} expects {models[0].n_features_in_} features")
