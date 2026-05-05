import os
import sys
import torch
import numpy as np
import pandas as pd
import pickle

project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.pipeline.pipeline import build_full_pipeline
from src.stacking.stacking import MetaLearnerNet, build_meta_features
from sklearn.metrics import roc_auc_score

pipeline_data = build_full_pipeline(
    nhanes_csv=os.path.join("data", "nhanes_clinical_cohort.csv"),
    temporal_dir=os.path.join("data", "temporal"),
    rppg_csv=os.path.join("data", "rppg_features.csv")
)

with open(os.path.join("outputs", "checkpoints", "classical_xgb_folds.pkl"), "rb") as f:
    xgb_models = pickle.load(f)
with open(os.path.join("outputs", "checkpoints", "classical_lgbm_folds.pkl"), "rb") as f:
    lgbm_models = pickle.load(f)
with open(os.path.join("outputs", "checkpoints", "classical_logreg_folds.pkl"), "rb") as f:
    logreg_models = pickle.load(f)

ds_test = pipeline_data["datasets"]["test"]
X_clin = []
labels = []
for i in range(len(ds_test)):
    batch = ds_test[i]
    X_clin.append(batch["clinical"].numpy())
    labels.append(batch["label"].numpy())

X_clin = np.array(X_clin)
labels = np.array(labels)

p_xgb = np.mean([m.predict_proba(X_clin)[:, 1] for m in xgb_models], axis=0)
p_lgbm = np.mean([m.predict_proba(X_clin)[:, 1] for m in lgbm_models], axis=0)
p_logreg_list = []
for m in logreg_models:
    X_clin_lr = m._scaler.transform(X_clin) if hasattr(m, "_scaler") else X_clin
    p_logreg_list.append(m.predict_proba(X_clin_lr)[:, 1])
p_logreg = np.mean(p_logreg_list, axis=0)

print(f"XGB Test AUC: {roc_auc_score(labels, p_xgb):.4f}")
print(f"LGBM Test AUC: {roc_auc_score(labels, p_lgbm):.4f}")
print(f"LogReg Test AUC: {roc_auc_score(labels, p_logreg):.4f}")
