import os
import sys
import torch
import numpy as np
import pandas as pd
import pickle
import json

# Add project root to path
project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, NUMERICAL_FEATURES, CATEGORICAL_FEATURES, INFER_CFG
from src.models.diabetes_model_net import DiabetesMultimodalNet, MCDropoutInference
from src.stacking.stacking import StackingEnsemble, ClassicalOOFTrainer, MetaLearnerNet, IsotonicCalibrator

def load_system():
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
            
    # Mock trainer for StackingEnsemble
    class MockTrainer:
        def __init__(self, models): self.models = models
        def predict_test(self, X):
            preds = {"xgb": [], "lgbm": [], "logreg": []}
            for i in range(5):
                preds["xgb"].append(self.models["xgb"][i].predict_proba(X)[:, 1])
                preds["lgbm"].append(self.models["lgbm"][i].predict_proba(X)[:, 1])
                X_sc = self.models["logreg"][i]._scaler.transform(X)
                preds["logreg"].append(self.models["logreg"][i].predict_proba(X_sc)[:, 1])
            return {k: np.mean(v, axis=0) for k, v in preds.items()}

    trainer = MockTrainer(classical_models)
    
    meta_pt = PATHS.meta_learner_weights.replace(".pkl", ".pt")
    meta_cfg_p = PATHS.meta_learner_weights.replace(".pkl", "_config.json")
    with open(meta_cfg_p, "r") as f:
        meta_cfg = json.load(f)
    
    meta_model = MetaLearnerNet(input_dim=meta_cfg["input_dim"], hidden_dims=meta_cfg["hidden_dims"], dropout=0)
    meta_model.load_state_dict(torch.load(meta_pt, map_location=DEVICE))
    meta_model.to(DEVICE)
    meta_model.eval()

    calibrator = IsotonicCalibrator.load(PATHS.calibrator_weights)
    
    return StackingEnsemble(trainer, gmu_model, meta_model, calibrator), preps

def monotonicity_test():
    try:
        import json
        ensemble, preps = load_system()
    except Exception as e:
        print(f"FAILED TO LOAD SYSTEM: {e}")
        return

    # Test cases
    cases = [
        {"glucose": 90, "bmi": 22, "age": 25, "label": "Healthy"},
        {"glucose": 110, "bmi": 28, "age": 45, "label": "Moderate"},
        {"glucose": 125, "bmi": 32, "age": 60, "label": "High"},
        {"glucose": 140, "bmi": 35, "age": 65, "label": "Critical"}
    ]
    
    probs = []
    print("\n[Monotonicity Test]")
    for c in cases:
        clinical = {"age": c["age"], "bmi": c["bmi"], "glucose_fasting_mg_dl": c["glucose"], "gender": 1, "smoking": 0, "family_history": 0, "bloodpressure": 120, "pregnancies": 0, "skinthickness": 20, "insulin": 50, "diabetespedigreefunction": 0.3}
        df_clin = pd.DataFrame([clinical])
        X_clin_scaled = preps["clinical"].transform(df_clin)
        t_clin = torch.tensor(X_clin_scaled, dtype=torch.float32).to(DEVICE)
        t_rppg = torch.zeros((1, 8), dtype=torch.float32).to(DEVICE)
        t_temp = torch.zeros((1, 168, 12), dtype=torch.float32).to(DEVICE)
        t_mask = torch.ones((1, 168), dtype=torch.bool).to(DEVICE)
        
        out = ensemble.predict(X_clin_scaled, t_clin, t_temp, t_rppg, t_mask, np.array([c["glucose"]]))
        p = out["proba_final"][0]
        probs.append(p)
        print(f"  {c['label']:<10} (G={c['glucose']}): Prob={p:.4f}")

    # Verify monotonicity
    is_monotone = all(probs[i] <= probs[i+1] for i in range(len(probs)-1))
    if is_monotone:
        print("✅ Monotonicity Test: PASS")
    else:
        print("❌ Monotonicity Test: FAIL (Risk did not increase with worsening features)")

if __name__ == "__main__":
    monotonicity_test()
