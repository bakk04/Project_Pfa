import os
import sys
import torch
import numpy as np
import pandas as pd
import pickle
import json
import traceback

# Add project root to path
project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, TRAIN_CFG, STACK_CFG, INFER_CFG, FEATURE_REGISTRY
from src.pipeline.pipeline import build_full_pipeline
from src.training.train_base import train_gmu_model, extract_oof_embeddings
from src.stacking.stacking import ClassicalOOFTrainer, build_meta_features, optimize_meta_learner, train_final_meta_learner, IsotonicCalibrator

def rebuild_system():
    print("\n" + "="*80, flush=True)
    print("  REBUILDING DIABETES PREDICTION SYSTEM (SaMD GRADE)", flush=True)
    print("="*80, flush=True)

    try:
        # 1. Pipeline & Preprocessing
        print("\n[Step 1] Fitting preprocessors and preparing data...", flush=True)
        nhanes_csv = os.path.join(project_root, "data", "nhanes_clinical_cohort.csv")
        rppg_csv = os.path.join(project_root, "data", "rppg_features.csv")
        temporal_dir = os.path.join(project_root, "data", "temporal")
        
        pipeline_data = build_full_pipeline(nhanes_csv, temporal_dir=temporal_dir, rppg_csv=rppg_csv)
        n_clin = pipeline_data["n_clinical"]
        print(f"  Unified Feature Dimension: {n_clin}", flush=True)

        # 2. Train GMU Model
        print("\n[Step 2] Training GMU model...", flush=True)
        gmu_results = train_gmu_model(pipeline_data, n_clinical_features=n_clin, epochs=10) 
        gmu_model = gmu_results["model"]

        # 3. Extract OOF Embeddings for Stacking
        print("\n[Step 3] Extracting OOF embeddings (GMU)...", flush=True)
        oof_data = extract_oof_embeddings(pipeline_data, n_clinical_features=n_clin, epochs_per_fold=3)
        
        # 4. Train Classical Models (OOF)
        print("\n[Step 4] Training Classical Models (XGB, LGBM, LogReg)...", flush=True)
        X_all = pipeline_data["X_clinical_all"]
        idx_tv = np.concatenate([pipeline_data["idx_train"], pipeline_data["idx_val"]])
        X_tv = X_all[idx_tv]
        y_tv = pipeline_data["labels_all"][idx_tv]
        
        classical_trainer = ClassicalOOFTrainer(X_tv, y_tv, feature_names=FEATURE_REGISTRY["all_clinical"])
        oof_classical = classical_trainer.run()

        # 5. Build Meta-Features
        print("\n[Step 5] Building Meta-Features...", flush=True)
        gmu_probas_oof = oof_data["probas_oof"]
        X_meta = build_meta_features(oof_classical, gmu_probas_oof)

        # 6. Optimize and Train Meta-Learner
        print("\n[Step 6] Training Meta-Learner...", flush=True)
        best_params = optimize_meta_learner(X_meta, y_tv, n_trials=5)
        meta_learner = train_final_meta_learner(X_meta, y_tv, best_params)

        # 7. Calibration
        print("\n[Step 7] Fitting Calibrator...", flush=True)
        meta_learner.eval()
        with torch.no_grad():
            meta_probas = torch.sigmoid(meta_learner(torch.tensor(X_meta, dtype=torch.float32).to(DEVICE))).cpu().numpy()
        
        calibrator = IsotonicCalibrator()
        calibrator.fit(meta_probas, y_tv)
        calibrator.save(PATHS.calibrator_weights)

        # 8. Save Preprocessors
        print("\n[Step 8] Saving preprocessors...", flush=True)
        prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
        with open(prep_path, "wb") as f:
            pickle.dump({
                "clinical": pipeline_data["clin_preprocessor"],
                "temporal": pipeline_data["temp_preprocessor"],
                "rppg":     pipeline_data["rppg_preprocessor"]
            }, f)

        print("\n" + "="*80, flush=True)
        print("  SYSTEM REBUILD COMPLETE (11-FEATURE UNIFIED SCHEMA)", flush=True)
        print("="*80, flush=True)
    except Exception as e:
        print(f"\n❌ REBUILD FAILED at step {sys.exc_info()[2].tb_lineno}: {e}", flush=True)
        traceback.print_exc()

if __name__ == "__main__":
    rebuild_system()
