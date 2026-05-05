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

def stacking_shape_check():
    print("\n[Stacking Shape Check]")
    
    try:
        # 1. Classical Models
        classical_path = os.path.join(PATHS.checkpoints, "classical_xgb_folds.pkl")
        with open(classical_path, "rb") as f:
            xgb_folds = pickle.load(f)
        n_clin = xgb_folds[0].n_features_in_
        print(f"  Base Models: Expect {n_clin} clinical features")
        
        # 2. Meta-learner
        meta_cfg_p = PATHS.meta_learner_weights.replace(".pkl", "_config.json")
        with open(meta_cfg_p, "r") as f:
            import json
            meta_cfg = json.load(f)
        n_meta = meta_cfg["input_dim"]
        print(f"  Meta-learner: Expects {n_meta} input features (4 base + 1 disagreement)")
        
        if n_meta == 5:
            print("✅ Stacking Shape Check: PASS")
        else:
            print(f"❌ Stacking Shape Check: FAIL (Meta input dim is {n_meta}, expected 5)")
            
    except Exception as e:
        print(f"❌ Stacking Shape Check: ERROR ({e})")

if __name__ == "__main__":
    stacking_shape_check()
