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

def calibration_test():
    print("\n[Calibration Test]")
    
    try:
        calibrator_path = PATHS.calibrator_weights
        with open(calibrator_path, "rb") as f:
            calibrator = pickle.load(f)
        
        # Test calibration range
        test_probs = np.linspace(0, 1, 100)
        calibrated = calibrator.predict(test_probs)
        
        p_min, p_max = calibrated.min(), calibrated.max()
        p_range = p_max - p_min
        print(f"  Calibrated Range: [{p_min:.4f}, {p_max:.4f}] (Width: {p_range:.4f})")
        
        if p_range > 0.5:
            print("✅ Calibration Test: PASS (Good probability spread)")
        else:
            print("❌ Calibration Test: FAIL (Probability collapse detected)")
            
    except Exception as e:
        print(f"❌ Calibration Test: ERROR ({e})")

if __name__ == "__main__":
    calibration_test()
