import pickle
import os
import sys

# Add project root to sys.path
project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS

prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
if os.path.exists(prep_path):
    with open(prep_path, "rb") as f:
        preps = pickle.load(f)
    clin_prep = preps["clinical"]
    print(f"Clinical Feature Names: {clin_prep.feature_names}")
else:
    print(f"Preprocessor not found at {prep_path}")
