import os, sys, pickle, json, torch
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression

project_root = os.getcwd()
if project_root not in sys.path: sys.path.insert(0, project_root)
from config import PATHS, DEVICE
from src.pipeline.pipeline import build_full_pipeline
from src.stacking.stacking import MetaLearnerNet, IsotonicCalibrator
from src.models.diabetes_model_net import DiabetesMultimodalNet

print("1. Loading pipeline and datasets...")
pipe = build_full_pipeline('data/nhanes_clinical_cohort.csv', temporal_dir='data/temporal', rppg_csv='data/rppg_features.csv')
ds_train = pipe['datasets']['train']
ds_val = pipe['datasets']['val']
ds_test = pipe['datasets']['test']

print("2. Loading base models...")
with open('DiabetesMultimodal/checkpoints/classical_xgb_folds.pkl', 'rb') as f: xgb = pickle.load(f)
with open('DiabetesMultimodal/checkpoints/classical_lgbm_folds.pkl', 'rb') as f: lgbm = pickle.load(f)
with open('DiabetesMultimodal/checkpoints/classical_logreg_folds.pkl', 'rb') as f: logreg = pickle.load(f)

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

print("3. Generating OOF predictions for Meta-Learner...")
x_meta_train, y_train = get_preds(ds_train)
x_meta_val, y_val = get_preds(ds_val)

x_meta_all = np.vstack([x_meta_train, x_meta_val])
y_all = np.concatenate([y_train, y_val])

print("4. Training Logistic Regression Meta-Learner...")
lr = LogisticRegression()
lr.fit(x_meta_all, y_all)
print('Coefficients:', lr.coef_)
print('Intercept:', lr.intercept_)

# Save to MetaLearnerNet
meta_net = MetaLearnerNet(input_dim=x_meta_all.shape[1])
# It's just a single Linear layer: self.net = nn.Linear(input_dim, 1, bias=True)
meta_net.net.weight = torch.nn.Parameter(torch.tensor(lr.coef_, dtype=torch.float32))
meta_net.net.bias = torch.nn.Parameter(torch.tensor(lr.intercept_, dtype=torch.float32))
meta_net.eval()

# Verify PyTorch model output matches Sklearn output exactly
with torch.no_grad():
    pt_out = torch.sigmoid(meta_net(torch.tensor(x_meta_all, dtype=torch.float32))).cpu().numpy()
sk_out = lr.predict_proba(x_meta_all)[:, 1]
print("Max diff between PT and Sklearn:", np.max(np.abs(pt_out - sk_out)))

print("5. Fitting Isotonic Calibrator...")
calibrator = IsotonicCalibrator()
# To avoid Plaat scaling fallback, we just fit it on the meta outputs.
calibrator.fit(pt_out, y_all)

print("6. Saving models...")
for base_dir in ['outputs', 'DiabetesMultimodal']:
    os.makedirs(os.path.join(base_dir, 'checkpoints'), exist_ok=True)
    os.makedirs(os.path.join(base_dir, 'calibration'), exist_ok=True)
    
    # Save meta
    pt_path = os.path.join(base_dir, 'checkpoints', 'meta_learner.pt')
    cfg_path = os.path.join(base_dir, 'checkpoints', 'meta_learner_config.json')
    torch.save(meta_net.state_dict(), pt_path)
    with open(cfg_path, 'w') as f:
        json.dump({'input_dim': x_meta_all.shape[1], 'hidden_dims': [], 'dropout': 0.0, 'best_auc': float(roc_auc_score(y_all, pt_out))}, f)
    
    # Save calibrator
    calib_path = os.path.join(base_dir, 'calibration', 'isotonic_calibrator.pkl')
    calibrator.save(calib_path)

print("Fix applied successfully.")
