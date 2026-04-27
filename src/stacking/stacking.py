# =============================================================================
# stacking.py — Stacking, Méta-Learner, Hard Rules & Calibration Isotonique
# =============================================================================
# Ce script implémente la couche de stacking (Ensemble) sur les prédictions
# des modèles de base. Pipeline :
#
#   [XGBoost OOF] ─┐
#   [LightGBM OOF] ─┤
#   [LogReg OOF]  ─┼──► [Meta-Learner Dense (Optuna)] ─► [Calibration] ─► [Hard Rules]
#   [GMU OOF]     ─┘
#
# Étapes :
#   1. Entraînement OOF de XGBoost, LightGBM, Logistic Regression
#   2. Construction de la matrice de features du méta-learner [N, 4+]
#   3. Optimisation Optuna du méta-learner (réseau dense [64→32])
#   4. Calibration post-training avec Isotonic Regression
#   5. Inférence finale avec hard rules cliniques
#   6. Rapport de performance complet
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
from sklearn.calibration import CalibratedClassifierCV
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
    TRAIN_CFG, STACK_CFG, INFER_CFG, PATHS, DEVICE
)
from models import DiabetesMultimodalNet, MCDropoutInference
from pipeline import OOFCrossValidator, DiabetesMultimodalDataset, build_dataloaders
from train_base import compute_metrics, CompositeLoss, train_one_epoch, validate


# =============================================================================
# 1. ENTRAÎNEMENT OOF DES MODÈLES CLASSIQUES (XGBoost, LightGBM, LogReg)
# =============================================================================

class ClassicalOOFTrainer:
    """
    Entraîne XGBoost, LightGBM et Logistic Regression en mode OOF.
    Génère les prédictions Out-Of-Fold pour le stacking.
    """

    def __init__(
        self,
        X: np.ndarray,         # Features tabulaires [N, n_features]
        y: np.ndarray,         # Labels [N]
        n_folds: int = TRAIN_CFG.n_folds,
        seed: int    = TRAIN_CFG.seed,
    ):
        self.X       = X
        self.y       = y
        self.n_folds = n_folds
        self.seed    = seed
        self.skf     = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)

        # Stockage des modèles entraînés par fold (pour inférence)
        self.models: Dict[str, List] = {"xgb": [], "lgbm": [], "logreg": []}
        # Prédictions OOF
        self.oof_preds: Dict[str, np.ndarray] = {}

    def _train_xgb_fold(self, X_tr, y_tr, X_vl, y_vl) -> Tuple[object, np.ndarray]:
        """Entraîne XGBoost sur un fold."""
        params = STACK_CFG.xgb_params.copy()

        # Adapter tree_method si pas de GPU
        if not torch.cuda.is_available():
            params["tree_method"] = "hist"

        early_stop = params.pop("early_stopping_rounds", 50)
        model = xgb.XGBClassifier(**params, early_stopping_rounds=early_stop)
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_vl, y_vl)],
            verbose=False,
        )
        proba = model.predict_proba(X_vl)[:, 1]
        return model, proba

    def _train_lgbm_fold(self, X_tr, y_tr, X_vl, y_vl) -> Tuple[object, np.ndarray]:
        """Entraîne LightGBM sur un fold."""
        params = STACK_CFG.lgbm_params.copy()

        # Adapter device si pas de GPU
        if not torch.cuda.is_available():
            params["device"] = "cpu"

        early_stop = params.pop("early_stopping_rounds", 50)
        model = lgb.LGBMClassifier(**params, early_stopping_rounds=early_stop)
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_vl, y_vl)],
            callbacks=[lgb.early_stopping(early_stop, verbose=False),
                       lgb.log_evaluation(-1)],
        )
        proba = model.predict_proba(X_vl)[:, 1]
        return model, proba

    def _train_logreg_fold(self, X_tr, y_tr, X_vl, y_vl) -> Tuple[object, np.ndarray]:
        """Entraîne Logistic Regression sur un fold."""
        # Normalisation (LR est sensible à l'échelle)
        scaler  = StandardScaler()
        X_tr_sc = scaler.fit_transform(X_tr)
        X_vl_sc = scaler.transform(X_vl)

        model = LogisticRegression(**STACK_CFG.logreg_params)
        model.fit(X_tr_sc, y_tr)

        proba = model.predict_proba(X_vl_sc)[:, 1]
        # Attacher le scaler au modèle pour l'inférence
        model._scaler = scaler
        return model, proba

    def run(self) -> Dict[str, np.ndarray]:
        """
        Entraîne tous les modèles en OOF et retourne les prédictions.
        Retourne : {
            'xgb'   : [N] — probas OOF XGBoost
            'lgbm'  : [N] — probas OOF LightGBM
            'logreg': [N] — probas OOF LogReg
        }
        """
        print("\n" + "="*60)
        print("  ENTRAÎNEMENT OOF DES MODÈLES CLASSIQUES")
        print("="*60)

        oof_xgb    = np.zeros(len(self.y))
        oof_lgbm   = np.zeros(len(self.y))
        oof_logreg = np.zeros(len(self.y))

        for fold_idx, (tr_idx, vl_idx) in enumerate(self.skf.split(self.X, self.y)):
            X_tr, X_vl = self.X[tr_idx], self.X[vl_idx]
            y_tr, y_vl = self.y[tr_idx], self.y[vl_idx]

            print(f"\n[Fold {fold_idx+1}/{self.n_folds}] Train:{len(tr_idx)} | Val:{len(vl_idx)}")

            # XGBoost
            m_xgb, p_xgb     = self._train_xgb_fold(X_tr, y_tr, X_vl, y_vl)
            oof_xgb[vl_idx]  = p_xgb
            auc_xgb          = roc_auc_score(y_vl, p_xgb)
            self.models["xgb"].append(m_xgb)
            print(f"  XGBoost   AUC: {auc_xgb:.4f}")

            # LightGBM
            m_lgbm, p_lgbm    = self._train_lgbm_fold(X_tr, y_tr, X_vl, y_vl)
            oof_lgbm[vl_idx]  = p_lgbm
            auc_lgbm          = roc_auc_score(y_vl, p_lgbm)
            self.models["lgbm"].append(m_lgbm)
            print(f"  LightGBM  AUC: {auc_lgbm:.4f}")

            # Logistic Regression
            m_lr, p_lr         = self._train_logreg_fold(X_tr, y_tr, X_vl, y_vl)
            oof_logreg[vl_idx] = p_lr
            auc_lr             = roc_auc_score(y_vl, p_lr)
            self.models["logreg"].append(m_lr)
            print(f"  LogReg    AUC: {auc_lr:.4f}")

        # AUCs globaux OOF
        print(f"\n{'─'*40}")
        print(f"  OOF Global XGBoost  : {roc_auc_score(self.y, oof_xgb):.4f}")
        print(f"  OOF Global LightGBM : {roc_auc_score(self.y, oof_lgbm):.4f}")
        print(f"  OOF Global LogReg   : {roc_auc_score(self.y, oof_logreg):.4f}")

        self.oof_preds = {
            "xgb"   : oof_xgb,
            "lgbm"  : oof_lgbm,
            "logreg": oof_logreg,
        }

        # Sauvegarde des modèles
        for name, model_list in self.models.items():
            path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
            with open(path, "wb") as f:
                pickle.dump(model_list, f)
        print(f"\n💾 Modèles classiques sauvegardés → {PATHS.checkpoints}")

        return self.oof_preds

    def predict_test(self, X_test: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Prédit sur le test set en moyennant les prédictions de tous les folds.
        (Stratégie "averaging" pour réduire la variance)
        """
        preds = {"xgb": [], "lgbm": [], "logreg": []}

        for fold_idx in range(self.n_folds):
            preds["xgb"].append(
                self.models["xgb"][fold_idx].predict_proba(X_test)[:, 1]
            )
            preds["lgbm"].append(
                self.models["lgbm"][fold_idx].predict_proba(X_test)[:, 1]
            )
            # LogReg : appliquer le scaler du fold correspondant
            X_sc = self.models["logreg"][fold_idx]._scaler.transform(X_test)
            preds["logreg"].append(
                self.models["logreg"][fold_idx].predict_proba(X_sc)[:, 1]
            )

        return {k: np.mean(v, axis=0) for k, v in preds.items()}


# =============================================================================
# 2. MÉTA-LEARNER : RÉSEAU DENSE [64 → 32] + LOGISTIC REGRESSION L2
# =============================================================================

class MetaLearnerNet(nn.Module):
    """
    Petit réseau dense pour le méta-learner du stacking.
    Input : concaténation des prédictions OOF [n_base_models] ou
            [n_base_models + n_embedding_features]
    Output : logit binaire
    """

    def __init__(
        self,
        input_dim: int,
        hidden_dims: List[int] = STACK_CFG.meta_hidden_dims,
        dropout: float         = STACK_CFG.meta_dropout,
    ):
        super().__init__()
        layers = []
        in_dim = input_dim

        for h_dim in hidden_dims:
            layers.extend([
                nn.Linear(in_dim, h_dim),
                nn.LayerNorm(h_dim),
                nn.GELU(),
                nn.Dropout(dropout),
            ])
            in_dim = h_dim

        layers.append(nn.Linear(in_dim, 1))
        self.net = nn.Sequential(*layers)
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


# =============================================================================
# 3. OPTIMISATION OPTUNA DU MÉTA-LEARNER
# =============================================================================

def build_meta_features(
    oof_preds: Dict[str, np.ndarray],
    gmu_probas: np.ndarray,
    gmu_embeddings: Optional[np.ndarray] = None,
    include_embeddings: bool = False,
) -> np.ndarray:
    """
    Construit la matrice de features du méta-learner.
    Colonnes : [xgb_proba, lgbm_proba, logreg_proba, gmu_proba] +
               optionnellement les 256 dimensions du GMU embedding.
    """
    base = np.stack([
        oof_preds["xgb"],
        oof_preds["lgbm"],
        oof_preds["logreg"],
        gmu_probas,
    ], axis=1)  # [N, 4]

    if include_embeddings and gmu_embeddings is not None:
        # Réduction de dimension de l'embedding (pour éviter la malédiction dim)
        # On prend seulement les 32 premières dimensions via PCA rapide
        from sklearn.decomposition import PCA
        pca = PCA(n_components=32, random_state=TRAIN_CFG.seed)
        emb_reduced = pca.fit_transform(gmu_embeddings)  # [N, 32]
        base = np.hstack([base, emb_reduced])

    return base.astype(np.float32)


def optuna_meta_objective(
    trial: optuna.Trial,
    X_meta: np.ndarray,
    y: np.ndarray,
    n_folds: int  = 3,
    device: torch.device = DEVICE,
) -> float:
    """
    Objective Optuna : maximise l'AUC OOF du méta-learner.
    Explore les hyperparamètres du réseau dense et de son entraînement.
    """
    # Hyperparamètres à optimiser
    lr             = trial.suggest_float("lr",      1e-4, 1e-2, log=True)
    dropout        = trial.suggest_float("dropout", 0.0,  0.5)
    n_layers       = trial.suggest_int("n_layers",  1, 3)
    layer_dim_base = trial.suggest_categorical("layer_dim", [32, 64, 128])
    batch_size     = trial.suggest_categorical("batch_size", [32, 64, 128])
    epochs         = trial.suggest_int("epochs", 20, 80)
    weight_decay   = trial.suggest_float("weight_decay", 1e-5, 1e-2, log=True)

    hidden_dims = [layer_dim_base // (2**i) for i in range(n_layers)]
    hidden_dims = [max(d, 16) for d in hidden_dims]  # Minimum 16 neurons

    skf     = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    aucs    = []

    X_t = torch.tensor(X_meta, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.float32)

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

        # Pondération de classe
        n_pos = y_tr.sum().item()
        n_neg = len(y_tr) - n_pos
        pos_w = torch.tensor([n_neg / (n_pos + 1e-8)]).to(device)
        loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_w)

        optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)

        ds    = TensorDataset(X_tr, y_tr)
        loader = DataLoader(ds, batch_size=batch_size, shuffle=True)

        model.train()
        for _ in range(epochs):
            for X_b, y_b in loader:
                optimizer.zero_grad()
                logit = model(X_b)
                loss  = loss_fn(logit, y_b)
                loss.backward()
                optimizer.step()

        # Évaluation sur le fold de validation
        model.eval()
        with torch.no_grad():
            logit_val = model(X_vl)
            prob_val  = torch.sigmoid(logit_val).cpu().numpy()

        try:
            auc = roc_auc_score(y_vl, prob_val)
        except Exception:
            auc = 0.5
        aucs.append(auc)

    return float(np.mean(aucs))


def optimize_meta_learner(
    X_meta: np.ndarray,
    y: np.ndarray,
    n_trials: int   = STACK_CFG.optuna_n_trials,
    timeout: int    = STACK_CFG.optuna_timeout,
    device: torch.device = DEVICE,
) -> Dict:
    """
    Lance l'optimisation Optuna du méta-learner.
    Retourne les meilleurs hyperparamètres.
    """
    print("\n" + "="*60)
    print("  OPTIMISATION OPTUNA DU MÉTA-LEARNER")
    print(f"  Trials: {n_trials} | Timeout: {timeout}s")
    print("="*60)

    study = optuna.create_study(
        direction="maximize",
        sampler=TPESampler(seed=TRAIN_CFG.seed),
        study_name="meta_learner_diabetes",
        storage=PATHS.optuna_db,
        load_if_exists=True,
    )

    study.optimize(
        lambda trial: optuna_meta_objective(trial, X_meta, y, device=device),
        n_trials=n_trials,
        timeout=timeout,
        show_progress_bar=True,
    )

    best_params = study.best_params
    best_auc    = study.best_value

    print(f"\n✅ Meilleur AUC OOF Méta-Learner : {best_auc:.4f}")
    print(f"   Meilleurs hyperparamètres :")
    for k, v in best_params.items():
        print(f"     {k}: {v}")

    # Sauvegarde
    optuna_path = os.path.join(PATHS.logs, "optuna_best_params.json")
    with open(optuna_path, "w") as f:
        json.dump({"best_params": best_params, "best_auc": best_auc}, f, indent=2)

    return best_params


# =============================================================================
# 4. ENTRAÎNEMENT FINAL DU MÉTA-LEARNER
# =============================================================================

def train_final_meta_learner(
    X_meta: np.ndarray,
    y: np.ndarray,
    best_params: Dict,
    device: torch.device = DEVICE,
) -> MetaLearnerNet:
    """
    Entraîne le méta-learner final sur TOUTES les données avec les
    meilleurs hyperparamètres trouvés par Optuna.
    """
    print("\n[Meta-Learner] Entraînement final sur toutes les données OOF...")

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

    X_t = torch.tensor(X_meta, dtype=torch.float32).to(device)
    y_t = torch.tensor(y, dtype=torch.float32).to(device)

    n_pos = y_t.sum().item()
    n_neg = len(y_t) - n_pos
    pos_w = torch.tensor([n_neg / (n_pos + 1e-8)]).to(device)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_w)

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    ds     = TensorDataset(X_t, y_t)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True)

    model.train()
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        for X_b, y_b in loader:
            optimizer.zero_grad()
            logit = model(X_b)
            loss  = loss_fn(logit, y_b)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
        scheduler.step()

        if epoch % 10 == 0:
            model.eval()
            with torch.no_grad():
                logit_all = model(X_t)
                prob_all  = torch.sigmoid(logit_all).cpu().numpy()
            auc = roc_auc_score(y, prob_all)
            print(f"  Epoch {epoch}/{epochs} | Loss: {epoch_loss/len(loader):.4f} | AUC: {auc:.4f}")
            model.train()

    # Sauvegarde
    torch.save(model.state_dict(), PATHS.meta_learner_weights.replace(".pkl", ".pt"))
    print(f"💾 Méta-learner sauvegardé → {PATHS.meta_learner_weights.replace('.pkl', '.pt')}")
    return model


# =============================================================================
# 5. CALIBRATION ISOTONIQUE
# =============================================================================

class IsotonicCalibrator:
    """
    Calibration post-training par régression isotonique.
    Corrige le biais de calibration des probabilités du modèle de stacking.
    Entraîné sur un set de calibration dédié (typiquement le set de validation).
    """

    def __init__(self):
        self.calibrator = IsotonicRegression(out_of_bounds="clip", increasing=True)
        self.fitted = False

    def fit(self, y_prob: np.ndarray, y_true: np.ndarray) -> "IsotonicCalibrator":
        """Fit la régression isotonique sur les probabilités de validation."""
        self.calibrator.fit(y_prob, y_true)
        self.fitted = True
        print(f"[Calibration] Isotonic Regression fittée sur {len(y_prob)} samples")
        ece_before = self._compute_ece(y_true, y_prob)
        ece_after  = self._compute_ece(y_true, self.predict(y_prob))
        print(f"  ECE avant calibration : {ece_before:.4f}")
        print(f"  ECE après calibration : {ece_after:.4f}")
        return self

    def predict(self, y_prob: np.ndarray) -> np.ndarray:
        """Calibre les probabilités."""
        assert self.fitted, "Calibrateur non fitté."
        return self.calibrator.predict(y_prob).clip(0, 1)

    def save(self, path: str = PATHS.calibrator_weights):
        with open(path, "wb") as f:
            pickle.dump(self, f)
        print(f"💾 Calibrateur sauvegardé → {path}")

    @classmethod
    def load(cls, path: str = PATHS.calibrator_weights) -> "IsotonicCalibrator":
        with open(path, "rb") as f:
            return pickle.load(f)

    @staticmethod
    def _compute_ece(y_true, y_prob, n_bins=10) -> float:
        bins = np.linspace(0, 1, n_bins + 1)
        ece  = 0.0
        for lb, ub in zip(bins[:-1], bins[1:]):
            mask = (y_prob >= lb) & (y_prob < ub)
            if mask.sum() == 0:
                continue
            ece += (mask.sum() / len(y_true)) * abs(y_prob[mask].mean() - y_true[mask].mean())
        return float(ece)


# =============================================================================
# 6. RÈGLES CLINIQUES DURES (HARD RULES)
# =============================================================================

def apply_clinical_hard_rules(
    y_prob: np.ndarray,
    glucose_values: np.ndarray,
    hba1c_values: Optional[np.ndarray] = None,
    verbose: bool = True,
) -> Tuple[np.ndarray, Dict]:
    """
    Applique les règles cliniques déterministes qui outrepassent le modèle.

    Règles implémentées (basées sur les guidelines ADA 2024) :
      - Glucose à jeun ≥ 126 mg/dL    → HIGH RISK (forcer proba = 1.0)
      - HbA1c ≥ 6.5%                  → HIGH RISK (forcer proba = 1.0)
      - Glucose à jeun ≥ 100 mg/dL    → Proba min = 0.5 (pré-diabète)
      - HbA1c ≥ 5.7% et < 6.5%        → Proba min = 0.4 (pré-diabète)

    Retourne :
      - y_prob_corrected : probabilités corrigées
      - rule_stats       : statistiques des corrections
    """
    y_prob_corrected = y_prob.copy()
    rule_stats = {
        "glucose_high_risk"    : 0,
        "glucose_prediabetes"  : 0,
        "hba1c_high_risk"      : 0,
        "hba1c_prediabetes"    : 0,
        "total_corrections"    : 0,
    }

    # ── Règle 1 : Glucose ≥ 126 → HIGH RISK ──────────────────────────────
    mask_glucose_hr = glucose_values >= INFER_CFG.glucose_high_risk_mg_dl
    y_prob_corrected[mask_glucose_hr] = 1.0
    rule_stats["glucose_high_risk"] = int(mask_glucose_hr.sum())

    # ── Règle 2 : Glucose ≥ 100 et < 126 → Pré-diabète (proba min 0.5) ──
    mask_glucose_pre = (
        (glucose_values >= INFER_CFG.glucose_prediabetes_mg_dl) &
        (glucose_values <  INFER_CFG.glucose_high_risk_mg_dl)
    )
    y_prob_corrected[mask_glucose_pre] = np.maximum(
        y_prob_corrected[mask_glucose_pre], 0.5
    )
    rule_stats["glucose_prediabetes"] = int(mask_glucose_pre.sum())

    # ── Règle 3 : HbA1c ≥ 6.5% → HIGH RISK ──────────────────────────────
    if hba1c_values is not None:
        mask_hba1c_hr = hba1c_values >= INFER_CFG.hba1c_high_risk
        # Ne pas écraser si glucose a déjà forcer à 1.0
        mask_hba1c_hr_new = mask_hba1c_hr & ~mask_glucose_hr
        y_prob_corrected[mask_hba1c_hr] = 1.0
        rule_stats["hba1c_high_risk"] = int(mask_hba1c_hr.sum())

        # ── Règle 4 : HbA1c ≥ 5.7% et < 6.5% → Pré-diabète (proba min 0.4)
        mask_hba1c_pre = (
            (hba1c_values >= INFER_CFG.hba1c_prediabetes) &
            (hba1c_values <  INFER_CFG.hba1c_high_risk)
        )
        y_prob_corrected[mask_hba1c_pre] = np.maximum(
            y_prob_corrected[mask_hba1c_pre], 0.4
        )
        rule_stats["hba1c_prediabetes"] = int(mask_hba1c_pre.sum())

    rule_stats["total_corrections"] = (
        rule_stats["glucose_high_risk"] +
        rule_stats["glucose_prediabetes"] +
        rule_stats["hba1c_high_risk"] +
        rule_stats["hba1c_prediabetes"]
    )

    if verbose:
        print(f"\n[Hard Rules Cliniques]")
        print(f"  Glucose ≥ {INFER_CFG.glucose_high_risk_mg_dl} mg/dL → HIGH RISK : "
              f"{rule_stats['glucose_high_risk']} cas")
        print(f"  Glucose ≥ {INFER_CFG.glucose_prediabetes_mg_dl} mg/dL (pré-DT2)  : "
              f"{rule_stats['glucose_prediabetes']} cas")
        if hba1c_values is not None:
            print(f"  HbA1c ≥ {INFER_CFG.hba1c_high_risk}% → HIGH RISK           : "
                  f"{rule_stats['hba1c_high_risk']} cas")
            print(f"  HbA1c ≥ {INFER_CFG.hba1c_prediabetes}% (pré-DT2)            : "
                  f"{rule_stats['hba1c_prediabetes']} cas")
        print(f"  Total corrections : {rule_stats['total_corrections']}")

    return y_prob_corrected, rule_stats


# =============================================================================
# 7. PIPELINE D'INFÉRENCE FINALE (PRODUCTION)
# =============================================================================

class StackingEnsemble:
    """
    Classe d'ensemble complète pour l'inférence en production.
    Encapsule : modèles classiques + GMU + méta-learner + calibrateur + hard rules.
    """

    def __init__(
        self,
        classical_trainer : ClassicalOOFTrainer,
        gmu_model         : DiabetesMultimodalNet,
        meta_learner      : MetaLearnerNet,
        calibrator        : IsotonicCalibrator,
        include_embeddings: bool = False,
        device            : torch.device = DEVICE,
    ):
        self.classical  = classical_trainer
        self.gmu_model  = gmu_model
        self.meta       = meta_learner
        self.calibrator = calibrator
        self.include_embeddings = include_embeddings
        self.device     = device
        self.mc_infer   = MCDropoutInference(gmu_model, T=INFER_CFG.mc_dropout_passes)

    @torch.no_grad()
    def predict(
        self,
        X_clinical_scaled: np.ndarray,
        clinical_tensor  : torch.Tensor,
        temporal_tensor  : torch.Tensor,
        rppg_tensor      : torch.Tensor,
        temp_mask_tensor : torch.Tensor,
        glucose_values   : np.ndarray,
        hba1c_values     : Optional[np.ndarray] = None,
    ) -> Dict[str, np.ndarray]:
        """
        Prédiction complète sur un batch de patients.

        Retourne :
        {
            'proba_final'    : [N] — probabilités finales (calibrées + hard rules)
            'proba_uncalib'  : [N] — avant calibration
            'proba_raw'      : [N] — avant méta-learner
            'uncertainty'    : [N] — écart-type MC Dropout
            'risk_class'     : [N] — "HIGH", "MODERATE", "LOW"
            'rule_stats'     : dict — statistiques hard rules
        }
        """
        # 1. Prédictions des modèles classiques
        classical_preds = self.classical.predict_test(X_clinical_scaled)

        # 2. Prédictions GMU (avec MC Dropout pour l'incertitude)
        mc_out    = self.mc_infer.predict(
            clinical_tensor, temporal_tensor, rppg_tensor, temp_mask_tensor,
            device=self.device
        )
        gmu_proba  = mc_out["mean_proba"].cpu().numpy()
        uncertainty = mc_out["std_proba"].cpu().numpy()

        # Embeddings GMU optionnels
        gmu_emb = None
        if self.include_embeddings:
            gmu_emb = self.gmu_model.get_embedding(
                clinical_tensor.to(self.device),
                temporal_tensor.to(self.device),
                rppg_tensor.to(self.device),
                temp_mask_tensor.to(self.device),
            ).cpu().numpy()

        # 3. Construction des features méta
        X_meta = build_meta_features(
            classical_preds, gmu_proba, gmu_emb, self.include_embeddings
        )

        # 4. Prédiction du méta-learner
        self.meta.eval()
        X_meta_t    = torch.tensor(X_meta, dtype=torch.float32).to(self.device)
        logit_meta  = self.meta(X_meta_t)
        proba_meta  = torch.sigmoid(logit_meta).cpu().numpy()

        # 5. Calibration isotonique
        proba_calib = self.calibrator.predict(proba_meta)

        # 6. Hard Rules cliniques
        proba_final, rule_stats = apply_clinical_hard_rules(
            proba_calib, glucose_values, hba1c_values, verbose=True
        )

        # 7. Classification en classes de risque
        risk_class = np.where(
            proba_final >= 0.8, "HIGH",
            np.where(proba_final >= 0.5, "MODERATE", "LOW")
        )

        return {
            "proba_final"   : proba_final,
            "proba_uncalib" : proba_meta,
            "proba_gmu"     : gmu_proba,
            "uncertainty"   : uncertainty,
            "risk_class"    : risk_class,
            "rule_stats"    : rule_stats,
        }


# =============================================================================
# 8. RAPPORT DE PERFORMANCE DU STACKING
# =============================================================================

def print_stacking_report(
    y_true: np.ndarray,
    proba_dict: Dict[str, np.ndarray],
):
    """
    Affiche un rapport comparatif de performance de tous les modèles.
    """
    print("\n" + "="*60)
    print("  RAPPORT DE PERFORMANCE — STACKING ENSEMBLE")
    print("="*60)

    models_to_eval = {
        "GMU (seul)"       : proba_dict.get("proba_gmu"),
        "Méta (non-calib)" : proba_dict.get("proba_uncalib"),
        "Ensemble final"   : proba_dict.get("proba_final"),
    }

    header = f"{'Modèle':<25} {'AUC':>6} {'AUPRC':>6} {'F1':>6} {'Brier':>6} {'ECE':>6}"
    print(f"\n{header}")
    print("─" * 60)

    for name, proba in models_to_eval.items():
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

    # Distribution des classes de risque
    if "risk_class" in proba_dict:
        rc = proba_dict["risk_class"]
        print(f"\n[Distribution des classes de risque]")
        for cls in ["HIGH", "MODERATE", "LOW"]:
            n = (rc == cls).sum()
            print(f"  {cls:10s} : {n:4d} ({100*n/len(rc):5.1f}%)")

    # Incertitude MC Dropout
    if "uncertainty" in proba_dict:
        unc = proba_dict["uncertainty"]
        print(f"\n[Incertitude MC Dropout (T={INFER_CFG.mc_dropout_passes})]")
        print(f"  Moyenne : {unc.mean():.4f}")
        print(f"  Max     : {unc.max():.4f}")
        high_unc = (unc > INFER_CFG.uncertainty_warning_threshold).sum()
        print(f"  Haute incertitude (>{INFER_CFG.uncertainty_warning_threshold}) : "
              f"{high_unc} ({100*high_unc/len(unc):.1f}%)")


# =============================================================================
# 9. SCRIPT PRINCIPAL STACKING
# =============================================================================

def run_stacking_pipeline(train_output: Dict) -> Dict:
    """
    Point d'entrée principal du stacking.
    Reçoit le dictionnaire retourné par train_base.main().

    Args:
        train_output : {
            'model'        : DiabetesMultimodalNet (entraîné)
            'oof_data'     : {'embeddings_oof', 'probas_oof', 'labels_oof'}
            'pipeline_data': données du pipeline complet
            'n_clinical'   : nombre de features cliniques
        }
    """
    print("\n" + "="*60)
    print("  PIPELINE DE STACKING — MÉTA-LEARNER MULTIMODAL")
    print("="*60)

    gmu_model     = train_output["model"]
    oof_data      = train_output["oof_data"]
    pipeline_data = train_output["pipeline_data"]
    n_clinical    = train_output["n_clinical"]

    # Features cliniques pour les modèles classiques
    X_all    = pipeline_data["X_clinical_all"]
    y_all    = pipeline_data["labels_all"]
    idx_train = pipeline_data["idx_train"]
    idx_val   = pipeline_data["idx_val"]
    idx_test  = pipeline_data["idx_test"]

    # Indices train+val pour l'OOF (le test est sacré)
    idx_trainval = np.concatenate([idx_train, idx_val])
    X_trainval   = X_all[idx_trainval]
    y_trainval   = y_all[idx_trainval]
    X_test_clin  = X_all[idx_test]
    y_test       = y_all[idx_test]

    # ─────────────────────────────────────────────────────────────────────
    # ÉTAPE 1 : OOF des modèles classiques
    # ─────────────────────────────────────────────────────────────────────
    classical_trainer = ClassicalOOFTrainer(X_trainval, y_trainval)
    oof_classical     = classical_trainer.run()

    # ─────────────────────────────────────────────────────────────────────
    # ÉTAPE 2 : Construction des features méta (OOF)
    # ─────────────────────────────────────────────────────────────────────
    # Les probas OOF du GMU (calculées dans train_base.py)
    gmu_oof_probas = oof_data["probas_oof"]
    gmu_embeddings = oof_data["embeddings_oof"]
    labels_oof     = oof_data["labels_oof"]

    # Aligner les longueurs (peut différer si idx_train ≠ idx de l'OOF GMU)
    n_meta = min(len(oof_classical["xgb"]), len(gmu_oof_probas))
    X_meta = build_meta_features(
        {k: v[:n_meta] for k, v in oof_classical.items()},
        gmu_oof_probas[:n_meta],
        gmu_embeddings[:n_meta],
        include_embeddings=False,  # Mettre True pour enrichir le méta-learner
    )
    y_meta = labels_oof[:n_meta]
    print(f"\n[Meta-features] Shape : {X_meta.shape}")

    # ─────────────────────────────────────────────────────────────────────
    # ÉTAPE 3 : Optimisation Optuna + Entraînement méta-learner
    # ─────────────────────────────────────────────────────────────────────
    best_params  = optimize_meta_learner(X_meta, y_meta, device=DEVICE)
    meta_learner = train_final_meta_learner(X_meta, y_meta, best_params, device=DEVICE)

    # ─────────────────────────────────────────────────────────────────────
    # ÉTAPE 4 : Calibration sur le set de validation
    # ─────────────────────────────────────────────────────────────────────
    print("\n[Calibration] Fit sur le set de validation...")
    # Prédictions du méta-learner sur le val set
    X_val_classical = classical_trainer.predict_test(X_all[idx_val])
    ds_val          = pipeline_data["datasets"]["val"]
    val_loader      = DataLoader(ds_val, batch_size=128, shuffle=False)

    val_gmu_probas = []
    val_labels     = []
    gmu_model.eval()
    with torch.no_grad():
        for batch in val_loader:
            out = gmu_model(
                batch["clinical"].to(DEVICE),
                batch["temporal"].to(DEVICE),
                batch["rppg"].to(DEVICE),
                batch["temp_mask"].to(DEVICE),
            )
            val_gmu_probas.extend(torch.sigmoid(out["logit"]).cpu().numpy().tolist())
            val_labels.extend(batch["label"].numpy().tolist())

    val_gmu_probas = np.array(val_gmu_probas)
    val_labels_arr = np.array(val_labels)

    X_meta_val = build_meta_features(
        {k: v[:len(val_labels_arr)] for k, v in X_val_classical.items()}
        if isinstance(X_val_classical, dict) else
        {
            "xgb"   : classical_trainer.predict_test(X_all[idx_val])["xgb"],
            "lgbm"  : classical_trainer.predict_test(X_all[idx_val])["lgbm"],
            "logreg": classical_trainer.predict_test(X_all[idx_val])["logreg"],
        },
        val_gmu_probas,
    )

    meta_learner.eval()
    with torch.no_grad():
        logit_val = meta_learner(torch.tensor(X_meta_val).to(DEVICE))
        proba_val = torch.sigmoid(logit_val).cpu().numpy()

    calibrator = IsotonicCalibrator()
    calibrator.fit(proba_val, val_labels_arr)
    calibrator.save()

    # ─────────────────────────────────────────────────────────────────────
    # ÉTAPE 5 : Évaluation finale sur le test set
    # ─────────────────────────────────────────────────────────────────────
    print("\n[Évaluation finale] Test set...")
    ds_test      = pipeline_data["datasets"]["test"]
    test_loader  = DataLoader(ds_test, batch_size=128, shuffle=False)

    test_gmu_probas  = []
    test_gmu_embs    = []
    test_labels      = []
    test_glucose     = []

    gmu_model.eval()
    gmu_model.return_embeddings = True
    with torch.no_grad():
        for batch in test_loader:
            out = gmu_model(
                batch["clinical"].to(DEVICE),
                batch["temporal"].to(DEVICE),
                batch["rppg"].to(DEVICE),
                batch["temp_mask"].to(DEVICE),
            )
            test_gmu_probas.extend(torch.sigmoid(out["logit"]).cpu().numpy())
            test_gmu_embs.append(out["embedding"].cpu().numpy())
            test_labels.extend(batch["label"].numpy())
            test_glucose.extend(batch["glucose"].numpy())

    test_gmu_probas  = np.array(test_gmu_probas)
    test_gmu_embs    = np.vstack(test_gmu_embs)
    test_labels_arr  = np.array(test_labels)
    test_glucose_arr = np.array(test_glucose)

    test_classical = classical_trainer.predict_test(X_test_clin)
    X_meta_test    = build_meta_features(test_classical, test_gmu_probas)

    meta_learner.eval()
    with torch.no_grad():
        logit_test  = meta_learner(torch.tensor(X_meta_test).to(DEVICE))
        proba_test  = torch.sigmoid(logit_test).cpu().numpy()

    proba_test_calib = calibrator.predict(proba_test)

    # Hard rules
    proba_test_final, rule_stats = apply_clinical_hard_rules(
        proba_test_calib, test_glucose_arr, verbose=True
    )

    risk_class = np.where(
        proba_test_final >= 0.8, "HIGH",
        np.where(proba_test_final >= 0.5, "MODERATE", "LOW")
    )

    proba_dict = {
        "proba_gmu"    : test_gmu_probas,
        "proba_uncalib": proba_test,
        "proba_final"  : proba_test_final,
        "risk_class"   : risk_class,
        "uncertainty"  : np.zeros(len(proba_test_final)),  # MC Dropout fait dans StackingEnsemble
    }

    print_stacking_report(test_labels_arr, proba_dict)

    # Sauvegarde des résultats finaux
    final_results = {
        "test_auc_ensemble"      : float(roc_auc_score(test_labels_arr, proba_test_final)),
        "test_auc_gmu"           : float(roc_auc_score(test_labels_arr, test_gmu_probas)),
        "test_auprc_ensemble"    : float(average_precision_score(test_labels_arr, proba_test_final)),
        "hard_rule_stats"        : rule_stats,
        "risk_distribution"      : {
            "HIGH"    : int((risk_class == "HIGH").sum()),
            "MODERATE": int((risk_class == "MODERATE").sum()),
            "LOW"     : int((risk_class == "LOW").sum()),
        },
    }
    with open(os.path.join(PATHS.logs, "stacking_final_results.json"), "w") as f:
        json.dump(final_results, f, indent=2)

    print(f"\n✅ STACKING TERMINÉ")
    print(f"   AUC Ensemble final : {final_results['test_auc_ensemble']:.4f}")
    print(f"   AUC GMU seul       : {final_results['test_auc_gmu']:.4f}")

    return {
        "classical_trainer": classical_trainer,
        "meta_learner"     : meta_learner,
        "calibrator"       : calibrator,
        "final_results"    : final_results,
        "proba_dict"       : proba_dict,
        "y_test"           : test_labels_arr,
    }


# =============================================================================
# 10. POINT D'ENTRÉE (à appeler après train_base.main())
# =============================================================================

if __name__ == "__main__":
    """
    Utilisation dans Google Colab :
    ────────────────────────────────
    from train_base import main as train_main
    from stacking import run_stacking_pipeline

    # Étape 1 : Entraîner le modèle GMU
    train_output = train_main()

    # Étape 2 : Lancer le stacking
    stack_output = run_stacking_pipeline(train_output)
    ────────────────────────────────
    """
    print("stacking.py — Importer et appeler run_stacking_pipeline(train_output)")
    print("Voir les docstrings pour l'usage complet.")