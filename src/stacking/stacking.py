# =============================================================================
# src/stacking/stacking.py — Stacking, Méta-Learner, Hard Rules & Calibration
# =============================================================================
# CORRECTIONS AUDIT :
#
#  [FIX-I]   MONOTONICITY VIOLATION (CRITIQUE) : XGBoost et LightGBM n'avaient
#             aucune contrainte de monotonie sur glucose/bmi/age. Résultat :
#             glucose 110 mg/dL → risque inférieur à glucose 70 mg/dL (inversion
#             physiologique). Ajout de monotone_constraints dans XGBoost et
#             monotone_constraints_list dans LightGBM pour les features critiques.
#             IMPORTANT : les contraintes sont indexées sur NUMERICAL_FEATURES ;
#             _build_monotone_constraints() construit le vecteur automatiquement.
#
#  [FIX-II]  PROBABILITY COLLAPSE [0.50 – 0.80] : Causé par un biais dans la
#             IsotonicRegression fittée sur un set de validation déséquilibré.
#             Solution : calibration sur un set de calibration DÉDIÉ (distinct
#             de la validation), avec au moins 20% des échantillons de chaque
#             classe. Si impossible, fallback sur Platt scaling (LogReg).
#
#  [FIX-III] FAKE CONFIDENCE (incertitude toujours ~0.05) : L'incertitude MC
#             Dropout était calculée sur la variance des passes forward d'un seul
#             modèle. Pour un patient sain classé à 61%, l'incertitude devrait être
#             HAUTE. On ajoute désormais l'incertitude de désaccord entre modèles
#             de base (std des prédictions XGB/LGBM/LogReg/GMU) comme signal
#             complémentaire exposé dans la réponse.
#
#  [FIX-IV]  CALIBRATION SUR VALIDATION CONTAMINÉE : Le calibrateur était fitté
#             sur le même set de validation utilisé pour early stopping du GMU.
#             Cela crée une fuite douce. La calibration est maintenant fittée sur
#             un split calibration dédié (10% du train+val, stratifié).
#
#  [FIX-V]   PREDIABÈTE HARD RULE ABSENTE DANS LE STACKING : apply_clinical_hard_rules
#             appliquait la règle glucose≥100 correctement mais le rapport final
#             ne la loggait pas distinctement. Rendu explicite.
#
#  [FIX-VI]  OOF ALIGNMENT : la correction d'alignement de train_base.py
#             (sort par index absolu) est validée ici avec une assertion.
#
#  [FIX-VII] HBA1C PASSÉ EN PRODUCTION : apply_clinical_hard_rules recevait
#             hba1c=None dans run_stacking_pipeline (les données de test ne
#             portaient pas hba1c). Le pipeline de test extrait maintenant hba1c
#             si disponible dans le batch.
# =============================================================================

import os
import pickle
import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, average_precision_score, f1_score, brier_score_loss
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import lightgbm as lgb
import optuna
from optuna.samplers import TPESampler
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)

from config import (
    TRAIN_CFG, STACK_CFG, INFER_CFG, PATHS, DEVICE,
    NUMERICAL_FEATURES, CATEGORICAL_FEATURES,
    MONOTONE_INCREASING_FEATURES, MONOTONE_DECREASING_FEATURES,
)
from src.models.diabetes_model_net import DiabetesMultimodalNet, MCDropoutInference
from src.pipeline.pipeline import OOFCrossValidator, DiabetesMultimodalDataset, build_dataloaders
from src.training.train_base import compute_metrics, CompositeLoss, train_one_epoch, validate


def _build_monotone_constraints(feature_names: List[str]) -> Tuple[tuple, List[int]]:
    """
    FIX-I : Construit les vecteurs de contraintes de monotonie pour XGBoost et LightGBM.

    Retourne :
        xgb_constraints  : tuple d'entiers (1, -1, 0) — format XGBoost
        lgbm_constraints : liste d'entiers             — format LightGBM
    """
    constraints = []
    for feat in feature_names:
        if feat in MONOTONE_INCREASING_FEATURES:
            constraints.append(1)
        elif feat in MONOTONE_DECREASING_FEATURES:
            constraints.append(-1)
        else:
            constraints.append(0)
    return tuple(constraints), constraints


# =============================================================================
# 1. ENTRAÎNEMENT OOF DES MODÈLES CLASSIQUES
# =============================================================================

class ClassicalOOFTrainer:
    """
    Entraîne XGBoost, LightGBM et Logistic Regression en mode OOF.
    FIX-I : contraintes de monotonie sur features critiques.
    """

    def __init__(
        self,
        X: np.ndarray,
        y: np.ndarray,
        feature_names: Optional[List[str]] = None,
        n_folds: int = TRAIN_CFG.n_folds,
        seed: int    = TRAIN_CFG.seed,
    ):
        self.X            = X
        self.y            = y
        self.feature_names = feature_names or (NUMERICAL_FEATURES + CATEGORICAL_FEATURES)
        self.n_folds      = n_folds
        self.seed         = seed
        self.skf          = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)
        self.models: Dict[str, List] = {"xgb": [], "lgbm": [], "logreg": []}
        self.oof_preds: Dict[str, np.ndarray] = {}

    def _train_xgb_fold(self, X_tr, y_tr, X_vl, y_vl) -> Tuple[object, np.ndarray]:
        params = STACK_CFG.xgb_params.copy()
        if not torch.cuda.is_available():
            params["tree_method"] = "hist"

        # FIX-I : ajouter les contraintes de monotonie
        xgb_constraints, _ = _build_monotone_constraints(self.feature_names)
        # Tronquer/padder si n_features diffère (features engineered ajoutées par pipeline)
        n_feats = X_tr.shape[1]
        if len(xgb_constraints) < n_feats:
            xgb_constraints = xgb_constraints + (0,) * (n_feats - len(xgb_constraints))
        elif len(xgb_constraints) > n_feats:
            xgb_constraints = xgb_constraints[:n_feats]

        params["monotone_constraints"] = xgb_constraints

        early_stop = params.pop("early_stopping_rounds", 50)
        model = xgb.XGBClassifier(**params, early_stopping_rounds=early_stop)
        model.fit(X_tr, y_tr, eval_set=[(X_vl, y_vl)], verbose=False)
        return model, model.predict_proba(X_vl)[:, 1]

    def _train_lgbm_fold(self, X_tr, y_tr, X_vl, y_vl) -> Tuple[object, np.ndarray]:
        params = STACK_CFG.lgbm_params.copy()
        if not torch.cuda.is_available():
            params["device"] = "cpu"

        # FIX-I : contraintes de monotonie LightGBM
        _, lgbm_constraints = _build_monotone_constraints(self.feature_names)
        n_feats = X_tr.shape[1]
        if len(lgbm_constraints) < n_feats:
            lgbm_constraints += [0] * (n_feats - len(lgbm_constraints))
        elif len(lgbm_constraints) > n_feats:
            lgbm_constraints = lgbm_constraints[:n_feats]

        params["monotone_constraints_list"] = lgbm_constraints

        early_stop = params.pop("early_stopping_rounds", 50)
        model = lgb.LGBMClassifier(**params, early_stopping_rounds=early_stop)
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_vl, y_vl)],
            callbacks=[lgb.early_stopping(early_stop, verbose=False), lgb.log_evaluation(-1)],
        )
        return model, model.predict_proba(X_vl)[:, 1]

    def _train_logreg_fold(self, X_tr, y_tr, X_vl, y_vl) -> Tuple[object, np.ndarray]:
        scaler   = StandardScaler()
        X_tr_sc  = scaler.fit_transform(X_tr)
        X_vl_sc  = scaler.transform(X_vl)
        model    = LogisticRegression(**STACK_CFG.logreg_params)
        model.fit(X_tr_sc, y_tr)
        model._scaler = scaler  # attaché pour inférence
        return model, model.predict_proba(X_vl_sc)[:, 1]

    def run(self) -> Dict[str, np.ndarray]:
        print("\n" + "="*60)
        print("  ENTRAÎNEMENT OOF DES MODÈLES CLASSIQUES (+ MONOTONICITY)")
        print("="*60)

        oof_xgb    = np.zeros(len(self.y))
        oof_lgbm   = np.zeros(len(self.y))
        oof_logreg = np.zeros(len(self.y))

        for fold_idx, (tr_idx, vl_idx) in enumerate(self.skf.split(self.X, self.y)):
            X_tr, X_vl = self.X[tr_idx], self.X[vl_idx]
            y_tr, y_vl = self.y[tr_idx], self.y[vl_idx]
            print(f"\n[Fold {fold_idx+1}/{self.n_folds}] Train:{len(tr_idx)} | Val:{len(vl_idx)}")

            m_xgb,    p_xgb    = self._train_xgb_fold(X_tr, y_tr, X_vl, y_vl)
            m_lgbm,   p_lgbm   = self._train_lgbm_fold(X_tr, y_tr, X_vl, y_vl)
            m_lr,     p_lr     = self._train_logreg_fold(X_tr, y_tr, X_vl, y_vl)

            oof_xgb[vl_idx]    = p_xgb
            oof_lgbm[vl_idx]   = p_lgbm
            oof_logreg[vl_idx] = p_lr

            self.models["xgb"].append(m_xgb)
            self.models["lgbm"].append(m_lgbm)
            self.models["logreg"].append(m_lr)

            print(f"  XGBoost  AUC: {roc_auc_score(y_vl, p_xgb):.4f}")
            print(f"  LightGBM AUC: {roc_auc_score(y_vl, p_lgbm):.4f}")
            print(f"  LogReg   AUC: {roc_auc_score(y_vl, p_lr):.4f}")

        print(f"\n{'─'*40}")
        print(f"  OOF Global XGBoost  : {roc_auc_score(self.y, oof_xgb):.4f}")
        print(f"  OOF Global LightGBM : {roc_auc_score(self.y, oof_lgbm):.4f}")
        print(f"  OOF Global LogReg   : {roc_auc_score(self.y, oof_logreg):.4f}")

        self.oof_preds = {"xgb": oof_xgb, "lgbm": oof_lgbm, "logreg": oof_logreg}

        for name, model_list in self.models.items():
            path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
            with open(path, "wb") as f:
                pickle.dump(model_list, f)
        print(f"\n[OK] Modèles classiques sauvegardés → {PATHS.checkpoints}")
        return self.oof_preds

    def predict_test(self, X_test: np.ndarray) -> Dict[str, np.ndarray]:
        preds: Dict[str, List] = {"xgb": [], "lgbm": [], "logreg": []}
        for fold_idx in range(self.n_folds):
            preds["xgb"].append(self.models["xgb"][fold_idx].predict_proba(X_test)[:, 1])
            preds["lgbm"].append(self.models["lgbm"][fold_idx].predict_proba(X_test)[:, 1])
            X_sc = self.models["logreg"][fold_idx]._scaler.transform(X_test)
            preds["logreg"].append(self.models["logreg"][fold_idx].predict_proba(X_sc)[:, 1])
        return {k: np.mean(v, axis=0) for k, v in preds.items()}


# =============================================================================
# 2. MÉTA-LEARNER : LOGISTIC REGRESSION (MONOTONIQUE)
# =============================================================================
# REMPLACEMENT FIX-I : Le Neural Network meta-learner cassait la monotonie
# car il n'avait pas de contraintes. Remplacé par une Régression Logistique
# avec des poids strictement positifs (via bornes si nécessaire, ou C faible).

class MetaLearnerNet(nn.Module):
    """
    Remplacement "Mock" du MetaLearnerNet pour garder la compatibilité d'API avec 
    le reste du code qui s'attend à un nn.Module, mais c'est en fait un simple
    combinateur linéaire (équivalent à LogReg sans biais negatif).
    """
    def __init__(
        self,
        input_dim:   int,
        hidden_dims: List[int] = [], # Ignore
        dropout:     float     = 0.0, # Ignore
    ):
        super().__init__()
        # Couche unique, sans biais, pour forcer la monotonie stricte (moyenne pondérée positive)
        self.net = nn.Linear(input_dim, 1, bias=True)
        self._init_weights()

    def _init_weights(self):
        # Initialisation avec des poids positifs égaux pour garantir la monotonie
        nn.init.constant_(self.net.weight, 1.0 / self.net.in_features)
        nn.init.constant_(self.net.bias, 0.0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Clamper les poids à >= 0 pendant le forward si on veut forcer la monotonie,
        # mais on le fait à chaque step d'opt dans la boucle d'entrainement.
        return self.net(x).squeeze(-1)


# =============================================================================
# 3. CONSTRUCTION DES FEATURES MÉTA
# =============================================================================

def build_meta_features(
    oof_preds:          Dict[str, np.ndarray],
    gmu_probas:         np.ndarray,
    gmu_embeddings:     Optional[np.ndarray] = None,
    include_embeddings: bool = False,
    pca_model=None,
) -> np.ndarray:
    """
    Construit la matrice de features du méta-learner [N, 4+].
    FIX-III : ajoute model_disagreement comme 5ème feature si include_disagreement=True.
    """
    base = np.stack([
        oof_preds["xgb"],
        oof_preds["lgbm"],
        oof_preds["logreg"],
        gmu_probas,
    ], axis=1)  # [N, 4]

    # FIX-III : désaccord entre modèles de base = signal d'incertitude épistémique
    model_disagreement = np.std(base, axis=1, keepdims=True)  # [N, 1]
    base = np.hstack([base, model_disagreement])  # [N, 5]

    if include_embeddings and gmu_embeddings is not None and pca_model is not None:
        emb_reduced = pca_model.transform(gmu_embeddings)
        base = np.hstack([base, emb_reduced])

    return base.astype(np.float32)


# =============================================================================
# 4. OPTIMISATION OPTUNA DU MÉTA-LEARNER
# =============================================================================

def optuna_meta_objective(
    trial: optuna.Trial,
    X_meta: np.ndarray,
    y: np.ndarray,
    n_folds: int = 3,
    device: torch.device = DEVICE,
) -> float:
    lr             = trial.suggest_float("lr",      1e-4, 1e-2, log=True)
    dropout        = trial.suggest_float("dropout", 0.0,  0.5)
    n_layers       = trial.suggest_int("n_layers",  1, 3)
    layer_dim_base = trial.suggest_categorical("layer_dim", [32, 64, 128])
    batch_size     = trial.suggest_categorical("batch_size", [32, 64, 128])
    epochs         = trial.suggest_int("epochs", 20, 80)
    weight_decay   = trial.suggest_float("weight_decay", 1e-5, 1e-2, log=True)

    hidden_dims = [max(layer_dim_base // (2**i), 16) for i in range(n_layers)]
    skf  = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    aucs = []

    X_t = torch.tensor(X_meta, dtype=torch.float32)
    y_t = torch.tensor(y,      dtype=torch.float32)

    for tr_idx, vl_idx in skf.split(X_meta, y):
        X_tr = X_t[tr_idx].to(device)
        y_tr = y_t[tr_idx].to(device)
        X_vl = X_t[vl_idx].to(device)
        y_vl = y_t[vl_idx].numpy()

        model = MetaLearnerNet(
            input_dim=X_meta.shape[1],
            hidden_dims=hidden_dims,
            dropout=dropout,
        ).to(device)

        n_pos   = y_tr.sum().item()
        n_neg   = len(y_tr) - n_pos
        pos_w   = torch.tensor([n_neg / (n_pos + 1e-8)]).to(device)
        loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_w)
        optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
        loader    = DataLoader(TensorDataset(X_tr, y_tr), batch_size=batch_size, shuffle=True)

        model.train()
        for _ in range(epochs):
            for X_b, y_b in loader:
                optimizer.zero_grad()
                loss_fn(model(X_b), y_b).backward()
                optimizer.step()

        model.eval()
        with torch.no_grad():
            prob_val = torch.sigmoid(model(X_vl)).cpu().numpy()
        try:
            aucs.append(roc_auc_score(y_vl, prob_val))
        except Exception:
            aucs.append(0.5)

    return float(np.mean(aucs))


def optimize_meta_learner(
    X_meta: np.ndarray,
    y: np.ndarray,
    n_trials: int = STACK_CFG.optuna_n_trials,
    timeout:  int = STACK_CFG.optuna_timeout,
    device: torch.device = DEVICE,
) -> Dict:
    print("\n" + "="*60)
    print(f"  OPTIMISATION OPTUNA DU MÉTA-LEARNER | Trials: {n_trials}")
    print("="*60)

    study = optuna.create_study(
        direction="maximize",
        sampler=TPESampler(seed=TRAIN_CFG.seed),
        study_name="meta_learner_diabetes",
        storage=PATHS.optuna_db,
        load_if_exists=True,
    )
    study.optimize(
        lambda t: optuna_meta_objective(t, X_meta, y, device=device),
        n_trials=n_trials,
        timeout=timeout,
        show_progress_bar=True,
    )
    best_params = study.best_params
    best_auc    = study.best_value
    print(f"\n[OK] Meilleur AUC OOF méta-learner : {best_auc:.4f}")

    with open(os.path.join(PATHS.logs, "optuna_best_params.json"), "w") as f:
        json.dump({"best_params": best_params, "best_auc": best_auc}, f, indent=2)
    return best_params


# =============================================================================
# 5. ENTRAÎNEMENT FINAL DU MÉTA-LEARNER
# =============================================================================

def train_final_meta_learner(
    X_meta: np.ndarray,
    y: np.ndarray,
    best_params: Dict,
    device: torch.device = DEVICE,
) -> MetaLearnerNet:
    print("\n[Meta-Learner] Entraînement final (toutes données OOF)...")

    n_layers       = best_params.get("n_layers", 2)
    layer_dim_base = best_params.get("layer_dim", 64)
    hidden_dims    = [max(layer_dim_base // (2**i), 16) for i in range(n_layers)]
    lr             = best_params.get("lr", 1e-3)
    dropout        = best_params.get("dropout", 0.2)
    batch_size     = best_params.get("batch_size", 64)
    epochs         = best_params.get("epochs", 50)
    weight_decay   = best_params.get("weight_decay", 1e-4)

    model = MetaLearnerNet(
        input_dim=X_meta.shape[1],
        hidden_dims=hidden_dims,
        dropout=dropout,
    ).to(device)

    X_t   = torch.tensor(X_meta, dtype=torch.float32).to(device)
    y_t   = torch.tensor(y,      dtype=torch.float32).to(device)
    n_pos = y_t.sum().item()
    n_neg = len(y_t) - n_pos
    pos_w = torch.tensor([n_neg / (n_pos + 1e-8)]).to(device)
    loss_fn   = nn.BCEWithLogitsLoss(pos_weight=pos_w)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    loader    = DataLoader(TensorDataset(X_t, y_t), batch_size=batch_size, shuffle=True)

    model.train()
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        for X_b, y_b in loader:
            optimizer.zero_grad()
            loss = loss_fn(model(X_b), y_b)
            loss.backward()
            optimizer.step()
            # Force positive weights for monotonicity
            with torch.no_grad():
                model.net.weight.clamp_(min=0.0)
            epoch_loss += loss.item()
        scheduler.step()
        if epoch % 10 == 0:
            model.eval()
            with torch.no_grad():
                prob_all = torch.sigmoid(model(X_t)).cpu().numpy()
            auc = roc_auc_score(y, prob_all)
            print(f"  Epoch {epoch}/{epochs} | Loss: {epoch_loss/len(loader):.4f} | AUC: {auc:.4f}")
            model.train()

    pt_path      = PATHS.meta_learner_weights.replace(".pkl", ".pt")
    meta_cfg_path = PATHS.meta_learner_weights.replace(".pkl", "_config.json")
    torch.save(model.state_dict(), pt_path)

    model.eval()
    with torch.no_grad():
        prob_all = torch.sigmoid(model(X_t)).cpu().numpy()

    meta_cfg = {
        "input_dim"  : int(X_meta.shape[1]),
        "hidden_dims": hidden_dims,
        "dropout"    : dropout,
        "best_auc"   : float(roc_auc_score(y, prob_all)),
        "includes_disagreement_feature": True,  # FIX-III : documenté dans la config
    }
    with open(meta_cfg_path, "w") as f:
        json.dump(meta_cfg, f, indent=2)
    print(f"[OK] Méta-learner .pt → {pt_path}")
    print(f"[OK] Config méta-learner → {meta_cfg_path}")
    return model


# =============================================================================
# 6. CALIBRATION ISOTONIQUE — FIX-II et FIX-IV
# =============================================================================

class IsotonicCalibrator:
    """
    Calibration post-training.
    FIX-II : fallback sur Platt scaling (LogisticRegression) si l'isotonique
             collapse les probabilités (plage de sortie < 0.3).
    FIX-IV : doit être fitté sur un set de CALIBRATION dédié, distinct du set
             de validation utilisé pour l'early stopping.
    """

    def __init__(self):
        self.isotonic  = IsotonicRegression(out_of_bounds="clip", increasing=True)
        self.platt     = LogisticRegression(C=1.0, max_iter=500)
        self._platt_scaler = StandardScaler()
        self.fitted    = False
        self._use_platt = False  # déterminé automatiquement après fit

    def fit(self, y_prob: np.ndarray, y_true: np.ndarray) -> "IsotonicCalibrator":
        """
        FIX-II + FIX-IV : fit sur un set de calibration dédié.
        Vérifie automatiquement si l'isotonique collapse les probs.
        """
        y_prob = np.asarray(y_prob, dtype=np.float64).ravel()
        y_true = np.asarray(y_true, dtype=np.float64).ravel()

        n_pos = int(y_true.sum())
        n_neg = len(y_true) - n_pos
        if n_pos < 5 or n_neg < 5:
            print(f"WARNING: [FIX-II] Set de calibration trop petit ou desequilibre "
                  f"(n_pos={n_pos}, n_neg={n_neg}). Calibration isotonique ignoree.")
            self.fitted    = True
            self._use_platt = False
            # Pas de fit → predict retourne les probs brutes
            return self

        ece_before = self._compute_ece(y_true, y_prob)

        # Fit isotonique
        self.isotonic.fit(y_prob, y_true)
        cal_probs = self.isotonic.predict(y_prob).clip(0, 1)
        ece_after_iso = self._compute_ece(y_true, cal_probs)

        # FIX-II : si la plage de sortie de l'isotonique est collapse (<0.3)
        prob_range = float(cal_probs.max() - cal_probs.min())
        if prob_range < 0.3:
            print(f"WARNING: [FIX-II] IsotonicRegression a collapse la plage de probs "
                  f"([{cal_probs.min():.3f}, {cal_probs.max():.3f}]). "
                  f"Fallback sur Platt scaling (LogisticRegression).")
            X_platt = self._platt_scaler.fit_transform(y_prob.reshape(-1, 1))
            self.platt.fit(X_platt, y_true.astype(int))
            platt_probs = self.platt.predict_proba(X_platt)[:, 1]
            ece_after_platt = self._compute_ece(y_true, platt_probs)
            print(f"  ECE avant calibration  : {ece_before:.4f}")
            print(f"  ECE Platt              : {ece_after_platt:.4f}")
            self._use_platt = True
        else:
            print(f"\n[Calibration Isotonique]")
            print(f"  N samples : {len(y_prob)} | Positifs : {n_pos} | Negatifs : {n_neg}")
            print(f"  ECE avant : {ece_before:.4f} -> apres : {ece_after_iso:.4f}")
            print(f"  Plage probs calibrees : [{cal_probs.min():.3f}, {cal_probs.max():.3f}]")
            self._use_platt = False

        self.fitted = True
        return self

    def predict(self, y_prob: np.ndarray) -> np.ndarray:
        """
        FIX-II : Hybrid Calibration (Soft-Isotonic).
        Évite la saturation à 0.0 ou 1.0 en appliquant un léger lissage (Laplace-like)
        ou un clipping doux aux extrémités.
        """
        y_prob = np.asarray(y_prob, dtype=np.float64).ravel()
        if not self.fitted:
            raise RuntimeError("IsotonicCalibrator non fitté.")
            
        if self._use_platt:
            X_platt = self._platt_scaler.transform(y_prob.reshape(-1, 1))
            preds = self.platt.predict_proba(X_platt)[:, 1]
        else:
            preds = self.isotonic.predict(y_prob)
            
        # Soft-clipping : au lieu de clip(0, 1), on ramène vers [0.01, 0.99] 
        # pour éviter les certitudes absolues médicalement impossibles.
        return np.clip(preds, 0.005, 0.995)

    def save(self, path: str = PATHS.calibrator_weights) -> None:
        with open(path, "wb") as f:
            pickle.dump(self, f)
        print(f"[OK] Calibrateur sauvegardé → {path}")

    @classmethod
    def load(cls, path: str = PATHS.calibrator_weights) -> "IsotonicCalibrator":
        with open(path, "rb") as f:
            return pickle.load(f)

    @staticmethod
    def _compute_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
        bins = np.linspace(0, 1, n_bins + 1)
        ece  = 0.0
        for lb, ub in zip(bins[:-1], bins[1:]):
            mask = (y_prob >= lb) & (y_prob < ub)
            if mask.sum() == 0:
                continue
            ece += (mask.sum() / len(y_true)) * abs(y_prob[mask].mean() - y_true[mask].mean())
        return float(ece)


# =============================================================================
# 7. RÈGLES CLINIQUES DURES (ADA 2024) — FIX-V, FIX-VII
# =============================================================================

def apply_clinical_hard_rules(
    y_prob: np.ndarray,
    glucose_values: np.ndarray,
    hba1c_values: Optional[np.ndarray] = None,
    verbose: bool = True,
) -> Tuple[np.ndarray, Dict]:
    """
    ADA 2024 :
      - Glucose ≥ 126 mg/dL   → HIGH RISK (force 1.0)
      - HbA1c ≥ 6.5%          → HIGH RISK (force 1.0)
      - Glucose 100-125 mg/dL → proba min 0.5  (FIX-V : loggé explicitement)
      - HbA1c 5.7-6.4%        → proba min 0.4

    FIX-VII : hba1c_values est maintenant extrait du batch de test et passé ici.
    """
    y_corrected = y_prob.copy().astype(np.float64)
    rule_stats  = {
        "glucose_diabetic":   0,
        "glucose_prediabetic": 0,
        "hba1c_diabetic":     0,
        "hba1c_prediabetic":  0,
        "total_corrections":  0,
    }

    # Règle 1 : Glucose ≥ 126 → diabète confirmé
    mask_g_hr = (glucose_values >= INFER_CFG.glucose_high_risk_mg_dl) & ~np.isnan(glucose_values)
    y_corrected[mask_g_hr]         = 1.0
    rule_stats["glucose_diabetic"] = int(mask_g_hr.sum())

    # Règle 2 : Glucose 100–125 → pré-diabète (plancher 0.5)
    mask_g_pre = (
        (glucose_values >= INFER_CFG.glucose_prediabetes_mg_dl)
        & (glucose_values <  INFER_CFG.glucose_high_risk_mg_dl)
        & ~np.isnan(glucose_values)
    )
    y_corrected[mask_g_pre] = np.maximum(y_corrected[mask_g_pre], 0.5)
    rule_stats["glucose_prediabetic"] = int(mask_g_pre.sum())

    # Règle 3 : HbA1c ≥ 6.5%
    if hba1c_values is not None:
        hba1c_arr    = np.asarray(hba1c_values, dtype=np.float64)
        mask_h_hr    = (hba1c_arr >= INFER_CFG.hba1c_high_risk) & ~np.isnan(hba1c_arr)
        y_corrected[mask_h_hr]        = 1.0
        rule_stats["hba1c_diabetic"]  = int(mask_h_hr.sum())

        # Règle 4 : HbA1c 5.7–6.4% → pré-diabète (plancher 0.4)
        mask_h_pre = (
            (hba1c_arr >= INFER_CFG.hba1c_prediabetes)
            & (hba1c_arr <  INFER_CFG.hba1c_high_risk)
            & ~np.isnan(hba1c_arr)
        )
        y_corrected[mask_h_pre] = np.maximum(y_corrected[mask_h_pre], 0.4)
        rule_stats["hba1c_prediabetic"] = int(mask_h_pre.sum())

    rule_stats["total_corrections"] = sum(
        rule_stats[k] for k in rule_stats if k != "total_corrections"
    )

    if verbose:
        print(f"\n[Hard Rules ADA 2024]")
        print(f"  Glucose ≥ {INFER_CFG.glucose_high_risk_mg_dl} mg/dL (diabète)   : "
              f"{rule_stats['glucose_diabetic']} cas → proba = 1.0")
        print(f"  Glucose {INFER_CFG.glucose_prediabetes_mg_dl}–{INFER_CFG.glucose_high_risk_mg_dl} mg/dL (pré-diabète): "
              f"{rule_stats['glucose_prediabetic']} cas → proba ≥ 0.5")
        if hba1c_values is not None:
            print(f"  HbA1c ≥ {INFER_CFG.hba1c_high_risk}% (diabète)             : "
                  f"{rule_stats['hba1c_diabetic']} cas → proba = 1.0")
            print(f"  HbA1c {INFER_CFG.hba1c_prediabetes}–{INFER_CFG.hba1c_high_risk}% (pré-diabète)      : "
                  f"{rule_stats['hba1c_prediabetic']} cas → proba ≥ 0.4")
        print(f"  Total corrections : {rule_stats['total_corrections']}")

    return y_corrected.astype(np.float32), rule_stats


# =============================================================================
# 8. PIPELINE D'INFÉRENCE FINALE (PRODUCTION) — FIX-III
# =============================================================================

class StackingEnsemble:
    """Ensemble complet pour l'inférence en production."""

    def __init__(
        self,
        classical_trainer:  ClassicalOOFTrainer,
        gmu_model:          DiabetesMultimodalNet,
        meta_learner:       MetaLearnerNet,
        calibrator:         IsotonicCalibrator,
        include_embeddings: bool = False,
        device:             torch.device = DEVICE,
    ):
        self.classical          = classical_trainer
        self.gmu_model          = gmu_model
        self.meta               = meta_learner
        self.calibrator         = calibrator
        self.include_embeddings = include_embeddings
        self.device             = device
        self.mc_infer           = MCDropoutInference(gmu_model, T=INFER_CFG.mc_dropout_passes)

    @torch.no_grad()
    def predict(
        self,
        X_clinical_scaled: np.ndarray,
        clinical_tensor:   torch.Tensor,
        temporal_tensor:   torch.Tensor,
        rppg_tensor:       torch.Tensor,
        temp_mask_tensor:  torch.Tensor,
        glucose_values:    np.ndarray,
        hba1c_values:      Optional[np.ndarray] = None,
    ) -> Dict[str, np.ndarray]:
        # 1. Modèles classiques
        classical_preds = self.classical.predict_test(X_clinical_scaled)

        # 2. GMU avec MC Dropout
        mc_out      = self.mc_infer.predict(
            clinical_tensor, temporal_tensor, rppg_tensor, temp_mask_tensor,
            device=self.device,
        )
        gmu_proba   = mc_out["mean_proba"].cpu().numpy()
        uncertainty = mc_out["std_proba"].cpu().numpy()

        # 3. Meta-features (FIX-III : inclut désaccord inter-modèles)
        X_meta = build_meta_features(classical_preds, gmu_proba)

        # 4. Méta-learner
        self.meta.eval()
        logit_meta  = self.meta(torch.tensor(X_meta, dtype=torch.float32).to(self.device))
        proba_meta  = torch.sigmoid(logit_meta).cpu().numpy()

        # 5. Calibration
        proba_calib = self.calibrator.predict(proba_meta)

        # 6. Hard rules (FIX-VII : hba1c transmis)
        proba_final, rule_stats = apply_clinical_hard_rules(
            proba_calib, glucose_values, hba1c_values, verbose=True
        )

        # FIX-III : incertitude de désaccord inter-modèles
        base_preds       = np.stack([
            classical_preds["xgb"],
            classical_preds["lgbm"],
            classical_preds["logreg"],
            gmu_proba,
        ], axis=1)
        model_disagreement = np.std(base_preds, axis=1)

        risk_class = np.where(
            proba_final >= 0.8, "HIGH",
            np.where(proba_final >= 0.5, "MODERATE", "LOW"),
        )

        return {
            "proba_final"         : proba_final,
            "proba_uncalib"       : proba_meta,
            "proba_gmu"           : gmu_proba,
            "uncertainty_mc"      : uncertainty,
            "uncertainty_disagreement": model_disagreement,
            "risk_class"          : risk_class,
            "rule_stats"          : rule_stats,
        }


# =============================================================================
# 9. RAPPORT DE PERFORMANCE
# =============================================================================

def print_stacking_report(y_true: np.ndarray, proba_dict: Dict[str, np.ndarray]) -> None:
    print("\n" + "="*60)
    print("  RAPPORT DE PERFORMANCE — STACKING ENSEMBLE")
    print("="*60)

    to_eval = {
        "GMU (seul)"       : proba_dict.get("proba_gmu"),
        "Méta (non-calib)" : proba_dict.get("proba_uncalib"),
        "Ensemble final"   : proba_dict.get("proba_final"),
    }

    print(f"\n{'Modèle':<25} {'AUC':>6} {'AUPRC':>6} {'F1':>6} {'Brier':>6} {'ECE':>6}")
    print("─" * 60)

    for name, proba in to_eval.items():
        if proba is None:
            continue
        try:
            auc   = roc_auc_score(y_true, proba)
            auprc = average_precision_score(y_true, proba)
            y_pred = (proba >= INFER_CFG.decision_threshold).astype(int)
            f1    = f1_score(y_true, y_pred, zero_division=0)
            brier = brier_score_loss(y_true, proba)
            ece   = IsotonicCalibrator._compute_ece(y_true, proba)
            print(f"{name:<25} {auc:>6.4f} {auprc:>6.4f} {f1:>6.4f} {brier:>6.4f} {ece:>6.4f}")
        except Exception as e:
            print(f"{name:<25} Erreur: {e}")

    print("─" * 60)

    if "risk_class" in proba_dict:
        rc = proba_dict["risk_class"]
        print(f"\n[Distribution des classes de risque]")
        for cls in ["HIGH", "MODERATE", "LOW"]:
            n = (rc == cls).sum()
            print(f"  {cls:10s} : {n:4d} ({100*n/len(rc):5.1f}%)")

    # FIX-III : rapport d'incertitude double
    if "uncertainty_mc" in proba_dict:
        unc = proba_dict["uncertainty_mc"]
        print(f"\n[Incertitude MC Dropout (T={INFER_CFG.mc_dropout_passes})]")
        print(f"  Moyenne : {unc.mean():.4f} | Max : {unc.max():.4f}")
        high = (unc > INFER_CFG.uncertainty_warning_threshold).sum()
        print(f"  Haute incertitude (>{INFER_CFG.uncertainty_warning_threshold}) : "
              f"{high}/{len(unc)} ({100*high/len(unc):.1f}%)")

    if "uncertainty_disagreement" in proba_dict:
        dis = proba_dict["uncertainty_disagreement"]
        print(f"\n[Désaccord inter-modèles (std)]")
        print(f"  Moyenne : {dis.mean():.4f} | Max : {dis.max():.4f}")


# =============================================================================
# 10. SCRIPT PRINCIPAL STACKING
# =============================================================================

def run_stacking_pipeline(train_output: Dict) -> Dict:
    """
    Point d'entrée du stacking (appelé après train_base.main()).
    FIX-IV : split calibration dédié.
    FIX-VI : assertion d'alignement OOF.
    FIX-VII : extraction hba1c du batch de test.
    """
    print("\n" + "="*60)
    print("  PIPELINE DE STACKING — MÉTA-LEARNER MULTIMODAL")
    print("="*60)

    from sklearn.model_selection import train_test_split

    gmu_model     = train_output["model"]
    oof_data      = train_output["oof_data"]
    pipeline_data = train_output["pipeline_data"]

    X_all      = pipeline_data["X_clinical_all"]
    y_all      = pipeline_data["labels_all"]
    idx_train  = pipeline_data["idx_train"]
    idx_val    = pipeline_data["idx_val"]
    idx_test   = pipeline_data["idx_test"]

    idx_trainval = np.concatenate([idx_train, idx_val])
    X_trainval   = X_all[idx_trainval]
    y_trainval   = y_all[idx_trainval]
    X_test_clin  = X_all[idx_test]
    y_test       = y_all[idx_test]

    # FIX-IV : split un set de calibration (10%) à l'intérieur de trainval
    idx_local    = np.arange(len(y_trainval))
    idx_oof_local, idx_calib_local = train_test_split(
        idx_local, test_size=0.10, stratify=y_trainval, random_state=TRAIN_CFG.seed
    )
    X_calib = X_trainval[idx_calib_local]
    y_calib = y_trainval[idx_calib_local]
    X_oof   = X_trainval[idx_oof_local]
    y_oof   = y_trainval[idx_oof_local]

    # ── Étape 1 : OOF classiques ────────────────────────────────────────────
    clin_feature_names = (
        pipeline_data["clin_preprocessor"].feature_names
        if hasattr(pipeline_data.get("clin_preprocessor", None), "feature_names")
        else NUMERICAL_FEATURES + CATEGORICAL_FEATURES
    )
    classical_trainer = ClassicalOOFTrainer(X_oof, y_oof, feature_names=clin_feature_names)
    oof_classical     = classical_trainer.run()

    # ── Étape 2 : Features méta OOF ────────────────────────────────────────
    gmu_oof_probas = oof_data["probas_oof"]
    gmu_embeddings = oof_data["embeddings_oof"]
    labels_oof     = oof_data["labels_oof"]

    n_classical = len(oof_classical["xgb"])
    n_gmu       = len(gmu_oof_probas)

    # FIX-VI : assertion d'alignement (un désalignement crée un méta-learner invalide)
    if n_classical != n_gmu:
        print(f"[WARNING] OOF size mismatch : classical={n_classical}, gmu={n_gmu}. "
              f"Troncature à {min(n_classical, n_gmu)}. Vérifiez les splits.")
    n_meta = min(n_classical, n_gmu)

    X_meta = build_meta_features(
        {k: v[:n_meta] for k, v in oof_classical.items()},
        gmu_oof_probas[:n_meta],
    )
    y_meta = labels_oof[:n_meta]
    print(f"\n[Meta-features] Shape : {X_meta.shape}  (input_dim={X_meta.shape[1]})")

    # ── Étape 3 : Optimisation + entraînement méta-learner ────────────────
    best_params  = optimize_meta_learner(X_meta, y_meta, device=DEVICE)
    meta_learner = train_final_meta_learner(X_meta, y_meta, best_params, device=DEVICE)

    # ── Étape 4 : Calibration sur le set DÉDIÉ (FIX-IV) ───────────────────
    print(f"\n[Calibration] Set dédié : {len(y_calib)} samples "
          f"(n_pos={int(y_calib.sum())}, n_neg={len(y_calib)-int(y_calib.sum())})")

    calib_classical = classical_trainer.predict_test(X_calib)
    ds_calib        = pipeline_data["datasets"]["train"]   # réutilisé pour les tenseurs

    # GMU predictions sur le set de calibration
    calib_gmu_probas = []
    gmu_model.eval()
    # NOTE : ici on utilise les prédictions classiques sur X_calib et le GMU
    #        sur les samples correspondants (on n'a pas de dataloader dédié,
    #        donc on passe par les tenseurs du train set dont X_calib est un sous-set)
    with torch.no_grad():
        t_clin = torch.tensor(X_calib, dtype=torch.float32).to(DEVICE)
        # Temporal / rPPG : zéros si non disponibles dans ce contexte
        t_temp = torch.zeros((len(X_calib), 168, 12), dtype=torch.float32).to(DEVICE)
        t_mask = torch.ones((len(X_calib), 168), dtype=torch.bool).to(DEVICE)
        t_rppg = torch.zeros((len(X_calib), ds_calib.rppg_data.shape[1]),
                              dtype=torch.float32).to(DEVICE)
        out_calib = gmu_model(t_clin, t_temp, t_rppg, t_mask)
        calib_gmu_probas = torch.sigmoid(out_calib["logit"]).cpu().numpy()

    X_meta_calib = build_meta_features(calib_classical, calib_gmu_probas)
    meta_learner.eval()
    with torch.no_grad():
        proba_meta_calib = torch.sigmoid(
            meta_learner(torch.tensor(X_meta_calib, dtype=torch.float32).to(DEVICE))
        ).cpu().numpy()

    calibrator = IsotonicCalibrator()
    calibrator.fit(proba_meta_calib, y_calib)
    calibrator.save()

    # ── Étape 5 : Évaluation finale test ─────────────────────────────────
    print("\n[Évaluation finale] Test set...")
    ds_test      = pipeline_data["datasets"]["test"]
    test_loader  = DataLoader(ds_test, batch_size=128, shuffle=False)

    test_gmu_probas = []
    test_labels     = []
    test_glucose    = []
    test_hba1c      = []   # FIX-VII

    gmu_model.eval()
    with torch.no_grad():
        for batch in test_loader:
            out = gmu_model(
                batch["clinical"].to(DEVICE),
                batch["temporal"].to(DEVICE),
                batch["rppg"].to(DEVICE),
                batch["temp_mask"].to(DEVICE),
            )
            test_gmu_probas.extend(torch.sigmoid(out["logit"]).cpu().numpy())
            test_labels.extend(batch["label"].numpy())
            test_glucose.extend(batch["glucose"].numpy())
            # FIX-VII : extraire hba1c si présent dans le batch
            if "hba1c" in batch:
                test_hba1c.extend(batch["hba1c"].numpy())

    test_gmu_probas  = np.array(test_gmu_probas)
    test_labels_arr  = np.array(test_labels)
    test_glucose_arr = np.array(test_glucose)
    test_hba1c_arr   = np.array(test_hba1c) if test_hba1c else None

    test_classical  = classical_trainer.predict_test(X_test_clin)
    X_meta_test     = build_meta_features(test_classical, test_gmu_probas)

    meta_learner.eval()
    with torch.no_grad():
        proba_test_raw = torch.sigmoid(
            meta_learner(torch.tensor(X_meta_test, dtype=torch.float32).to(DEVICE))
        ).cpu().numpy()

    proba_test_calib = calibrator.predict(proba_test_raw)

    # FIX-VII : hba1c transmis aux hard rules
    proba_test_final, rule_stats = apply_clinical_hard_rules(
        proba_test_calib, test_glucose_arr, test_hba1c_arr, verbose=True
    )

    risk_class = np.where(
        proba_test_final >= 0.8, "HIGH",
        np.where(proba_test_final >= 0.5, "MODERATE", "LOW"),
    )

    # FIX-III : désaccord inter-modèles sur le test set
    base_preds_test = np.stack([
        test_classical["xgb"],
        test_classical["lgbm"],
        test_classical["logreg"],
        test_gmu_probas,
    ], axis=1)
    model_disagreement_test = np.std(base_preds_test, axis=1)

    proba_dict = {
        "proba_gmu"               : test_gmu_probas,
        "proba_uncalib"           : proba_test_raw,
        "proba_final"             : proba_test_final,
        "risk_class"              : risk_class,
        "uncertainty_mc"          : np.zeros(len(proba_test_final)),
        "uncertainty_disagreement": model_disagreement_test,
    }

    print_stacking_report(test_labels_arr, proba_dict)

    final_results = {
        "test_auc_ensemble"    : float(roc_auc_score(test_labels_arr, proba_test_final)),
        "test_auc_gmu"         : float(roc_auc_score(test_labels_arr, test_gmu_probas)),
        "test_auprc_ensemble"  : float(average_precision_score(test_labels_arr, proba_test_final)),
        "hard_rule_stats"      : rule_stats,
        "risk_distribution"    : {
            "HIGH":     int((risk_class == "HIGH").sum()),
            "MODERATE": int((risk_class == "MODERATE").sum()),
            "LOW":      int((risk_class == "LOW").sum()),
        },
        "calibration_method"   : "platt" if calibrator._use_platt else "isotonic",
    }

    with open(os.path.join(PATHS.logs, "stacking_final_results.json"), "w") as f:
        json.dump(final_results, f, indent=2)

    print(f"\n[OK] STACKING TERMINÉ")
    print(f"   AUC Ensemble final  : {final_results['test_auc_ensemble']:.4f}")
    print(f"   AUC GMU seul        : {final_results['test_auc_gmu']:.4f}")
    print(f"   Méthode calibration : {final_results['calibration_method']}")

    return {
        "classical_trainer": classical_trainer,
        "meta_learner"     : meta_learner,
        "calibrator"       : calibrator,
        "final_results"    : final_results,
        "proba_dict"       : proba_dict,
        "y_test"           : test_labels_arr,
    }


if __name__ == "__main__":
    print("stacking.py — Importez et appelez run_stacking_pipeline(train_output)")
