import pickle
import os
import sys

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

prep_path = os.path.join(project_root, "DiabetesMultimodal", "checkpoints", "preprocessors.pkl")
with open(prep_path, "rb") as f:
    prep = pickle.load(f)

clin = prep["clinical"]
print(f"Numerical features: {clin.numerical_features}")
print(f"Categorical features: {clin.categorical_features}")
print(f"Feature names (fitted): {clin.feature_names}")
print(f"Number of features in feature_names: {len(clin.feature_names)}")
