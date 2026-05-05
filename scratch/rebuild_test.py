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

from config import PATHS, DEVICE, FEATURE_REGISTRY
from src.pipeline.pipeline import build_full_pipeline
from src.training.train_base import train_gmu_model, extract_oof_embeddings
from src.stacking.stacking import ClassicalOOFTrainer, build_meta_features, optimize_meta_learner, train_final_meta_learner, IsotonicCalibrator

def test():
    print("Step 1...")
    nhanes_csv = os.path.join(project_root, "data", "nhanes_clinical_cohort.csv")
    pipeline_data = build_full_pipeline(nhanes_csv)
    n_clin = pipeline_data["n_clinical"]
    
    print("Step 2 (1 epoch)...")
    train_gmu_model(pipeline_data, n_clinical_features=n_clin, epochs=1)
    
    print("Step 3 (1 fold, 1 epoch)...")
    oof_data = extract_oof_embeddings(pipeline_data, n_clinical_features=n_clin, n_folds=2, epochs_per_fold=1)
    
    print("Step 4...")
    idx_tv = np.concatenate([pipeline_data["idx_train"], pipeline_data["idx_val"]])
    X_tv = pipeline_data["X_clinical_all"][idx_tv]
    y_tv = pipeline_data["labels_all"][idx_tv]
    classical_trainer = ClassicalOOFTrainer(X_tv, y_tv, feature_names=FEATURE_REGISTRY["all_clinical"], n_folds=2)
    oof_classical = classical_trainer.run()
    
    print("SUCCESS")

if __name__ == "__main__":
    test()
