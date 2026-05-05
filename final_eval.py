import os
import sys
import torch
import numpy as np
import pandas as pd
import pickle
import json
from sklearn.metrics import roc_auc_score, average_precision_score

# Add project root to path
project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, TARGET_COLUMN
from src.pipeline.pipeline import build_full_pipeline
from src.models.diabetes_model_net import DiabetesMultimodalNet
from src.stacking.stacking import MetaLearnerNet, IsotonicCalibrator, build_meta_features

def final_evaluation():
    # 1. Load Data
    nhanes_csv = os.path.join(project_root, "data", "nhanes_clinical_cohort.csv")
    rppg_csv = os.path.join(project_root, "data", "rppg_features.csv")
    temporal_dir = os.path.join(project_root, "data", "temporal")
    
    pipeline_data = build_full_pipeline(nhanes_csv, temporal_dir=temporal_dir, rppg_csv=rppg_csv)
    idx_test = pipeline_data["idx_test"]
    X_test_clin = pipeline_data["X_clinical_all"][idx_test]
    y_test = pipeline_data["labels_all"][idx_test]
    
    # 2. Load Models
    prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
    with open(prep_path, "rb") as f:
        preps = pickle.load(f)
    
    n_clin = preps["clinical"].n_features
    gmu_model = DiabetesMultimodalNet(n_clinical_features=n_clin)
    gmu_model.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location=DEVICE))
    gmu_model.to(DEVICE)
    gmu_model.eval()

    classical_models = {}
    for name in ["xgb", "lgbm", "logreg"]:
        path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
        with open(path, "rb") as f:
            classical_models[name] = pickle.load(f)

    meta_pt = PATHS.meta_learner_weights.replace(".pkl", ".pt")
    meta_cfg_p = PATHS.meta_learner_weights.replace(".pkl", "_config.json")
    with open(meta_cfg_p, "r") as f:
        meta_cfg = json.load(f)
    
    meta_model = MetaLearnerNet(input_dim=meta_cfg["input_dim"], hidden_dims=meta_cfg["hidden_dims"])
    meta_model.load_state_dict(torch.load(meta_pt, map_location=DEVICE))
    meta_model.to(DEVICE)
    meta_model.eval()

    calibrator = IsotonicCalibrator.load(PATHS.calibrator_weights)

    # 3. Predict on Test Set
    # Base Predictions
    test_preds = {"xgb": [], "lgbm": [], "logreg": []}
    for i in range(5):
        test_preds["xgb"].append(classical_models["xgb"][i].predict_proba(X_test_clin)[:, 1])
        test_preds["lgbm"].append(classical_models["lgbm"][i].predict_proba(X_test_clin)[:, 1])
        X_sc = classical_models["logreg"][i]._scaler.transform(X_test_clin)
        test_preds["logreg"].append(classical_models["logreg"][i].predict_proba(X_sc)[:, 1])
    
    classical_test = {k: np.mean(v, axis=0) for k, v in test_preds.items()}
    
    # GMU Predictions
    test_loader = pipeline_data["loaders"]["test"]
    gmu_probas = []
    with torch.no_grad():
        for batch in test_loader:
            out = gmu_model(batch["clinical"].to(DEVICE), batch["temporal"].to(DEVICE), 
                            batch["rppg"].to(DEVICE), batch["temp_mask"].to(DEVICE))
            gmu_probas.extend(torch.sigmoid(out["logit"]).cpu().numpy())
    gmu_probas = np.array(gmu_probas)

    # Meta Features
    X_meta_test = build_meta_features(classical_test, gmu_probas)
    
    # Final Prediction
    with torch.no_grad():
        proba_meta = torch.sigmoid(meta_model(torch.tensor(X_meta_test, dtype=torch.float32).to(DEVICE))).cpu().numpy()
    
    proba_final = calibrator.predict(proba_meta)
    
    # 4. Metrics
    auc = roc_auc_score(y_test, proba_final)
    auprc = average_precision_score(y_test, proba_final)
    
    print(f"\n[Final Test Results]")
    print(f"  AUC  : {auc:.4f}")
    print(f"  AUPRC: {auprc:.4f}")
    
    # Check for probability collapse
    print(f"  Proba Range: [{proba_final.min():.4f}, {proba_final.max():.4f}]")
    
    if auc > 0.70:
        print("✅ Final Evaluation: PASS")
    else:
        print("❌ Final Evaluation: FAIL (Low AUC)")

if __name__ == "__main__":
    final_evaluation()
