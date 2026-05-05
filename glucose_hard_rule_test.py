import os
import sys
import torch
import numpy as np
import pandas as pd
import pickle

# Add project root to path
project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, INFER_CFG
from src.stacking.stacking import apply_clinical_hard_rules

def glucose_hard_rule_test():
    print("\n[Glucose Hard Rule Test]")
    
    # Test cases for hard rules
    test_probs = np.array([0.1, 0.1, 0.1])
    test_glucose = np.array([95, 110, 130]) # Normal, Prediabetic, Diabetic
    
    corrected_probs, stats = apply_clinical_hard_rules(test_probs, test_glucose, verbose=True)
    
    # Expected results:
    # 95 -> 0.1 (No change)
    # 110 -> max(0.1, 0.5) = 0.5
    # 130 -> 1.0
    
    results = []
    if abs(corrected_probs[0] - 0.1) < 1e-5: results.append(True)
    else: print(f"  Fail: Glucose 95 expected 0.1, got {corrected_probs[0]}")
    
    if abs(corrected_probs[1] - 0.5) < 1e-5: results.append(True)
    else: print(f"  Fail: Glucose 110 expected 0.5, got {corrected_probs[1]}")
    
    if abs(corrected_probs[2] - 1.0) < 1e-5: results.append(True)
    else: print(f"  Fail: Glucose 130 expected 1.0, got {corrected_probs[2]}")
    
    if all(results):
        print("✅ Glucose Hard Rule Test: PASS")
    else:
        print("❌ Glucose Hard Rule Test: FAIL")

if __name__ == "__main__":
    glucose_hard_rule_test()
