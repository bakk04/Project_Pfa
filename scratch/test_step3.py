import os
import sys
import torch
import numpy as np

project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE
from src.pipeline.pipeline import build_full_pipeline
from src.training.train_base import extract_oof_embeddings

def test_step3():
    print("Fitting pipeline...", flush=True)
    nhanes_csv = os.path.join(project_root, "data", "nhanes_clinical_cohort.csv")
    pipeline_data = build_full_pipeline(nhanes_csv)
    n_clin = pipeline_data["n_clinical"]
    
    print("Running Step 3 (OOF) - 1 fold, 1 epoch...", flush=True)
    try:
        oof_data = extract_oof_embeddings(pipeline_data, n_clinical_features=n_clin, n_folds=2, epochs_per_fold=1)
        print("STEP 3 SUCCESSFUL", flush=True)
    except Exception as e:
        print(f"STEP 3 FAILED: {e}", flush=True)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_step3()
