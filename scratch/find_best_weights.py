import os, sys, pickle, json, torch
import numpy as np
from sklearn.metrics import roc_auc_score
from sklearn.linear_model import LogisticRegression

project_root = os.getcwd()
if project_root not in sys.path: sys.path.insert(0, project_root)
from config import PATHS, DEVICE
from src.pipeline.pipeline import build_full_pipeline

pipe = build_full_pipeline('data/nhanes_clinical_cohort.csv', temporal_dir='data/temporal', rppg_csv='data/rppg_features.csv')
ds_train = pipe['datasets']['train']
ds_val = pipe['datasets']['val']
ds_test = pipe['datasets']['test']

with open('DiabetesMultimodal/checkpoints/classical_xgb_folds.pkl', 'rb') as f: xgb = pickle.load(f)
with open('DiabetesMultimodal/checkpoints/classical_lgbm_folds.pkl', 'rb') as f: lgbm = pickle.load(f)
with open('DiabetesMultimodal/checkpoints/classical_logreg_folds.pkl', 'rb') as f: logreg = pickle.load(f)
from src.models.diabetes_model_net import DiabetesMultimodalNet
gmu_model = DiabetesMultimodalNet(n_clinical_features=11)
gmu_model.load_state_dict(torch.load('DiabetesMultimodal/checkpoints/gmu_best.pt', map_location=DEVICE))
gmu_model.eval()

def get_preds(ds):
    labels, x_clin, x_rppg, x_temp, x_mask = [], [], [], [], []
    for b in ds:
        labels.append(b['label'].numpy())
        x_clin.append(b['clinical'].numpy())
        x_rppg.append(b['rppg'].numpy())
        x_temp.append(b['temporal'].numpy())
        x_mask.append(b['temp_mask'].numpy())
    labels = np.array(labels)
    x_clin = np.array(x_clin)
    x_rppg = np.array(x_rppg)
    x_temp = np.array(x_temp)
    x_mask = np.array(x_mask)

    with torch.no_grad():
        out = gmu_model(torch.tensor(x_clin, dtype=torch.float32), torch.tensor(x_temp, dtype=torch.float32), torch.tensor(x_rppg, dtype=torch.float32), torch.tensor(x_mask, dtype=torch.bool))
        p_gmu = torch.sigmoid(out['logit']).cpu().numpy().ravel()

    p_xgb = np.mean([m.predict_proba(x_clin)[:, 1] for m in xgb], axis=0)
    p_lgbm = np.mean([m.predict_proba(x_clin)[:, 1] for m in lgbm], axis=0)
    p_logreg = np.mean([m.predict_proba(m._scaler.transform(x_clin))[:, 1] for m in logreg], axis=0)

    base = np.stack([p_xgb, p_lgbm, p_logreg, p_gmu], axis=1)
    dis = np.std(base, axis=1, keepdims=True)
    x_meta = np.hstack([base, dis]).astype(np.float32)
    return x_meta, labels

x_meta_train, y_train = get_preds(ds_train)
x_meta_val, y_val = get_preds(ds_val)
x_meta_test, y_test = get_preds(ds_test)

lr = LogisticRegression(positive=True, fit_intercept=True)
lr.fit(np.vstack([x_meta_train, x_meta_val]), np.concatenate([y_train, y_val]))

p_test = lr.predict_proba(x_meta_test)[:, 1]
print(f'LogReg Meta-Learner AUC on test: {roc_auc_score(y_test, p_test):.4f}')
print('Coefficients:', lr.coef_)
print('Intercept:', lr.intercept_)
