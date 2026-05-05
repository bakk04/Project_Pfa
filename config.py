# =============================================================================
# config.py — Configuration Centrale du Projet Multimodal Diabète
# =============================================================================
# Ce fichier est la source unique de vérité pour tous les hyperparamètres,
# chemins de fichiers, et dimensions d'architecture.
# Toute modification globale doit être faite ici.
# =============================================================================

import os
import torch
from dataclasses import dataclass, field
from typing import List, Optional

# ===========================================================================
# 1. DÉTECTION DE L'ENVIRONNEMENT (Colab vs Local)
# ===========================================================================

IS_COLAB = "COLAB_GPU" in os.environ or "google.colab" in str(globals())
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"[Config] Environnement détecté : {'Google Colab' if IS_COLAB else 'Local'}")
print(f"[Config] Device utilisé        : {DEVICE}")

# ===========================================================================
# 2. CHEMINS (Données et Artefacts)
# ===========================================================================

DRIVE_ROOT = "."
OUTPUT_ROOT = os.path.join(DRIVE_ROOT, "DiabetesMultimodal")

@dataclass
class PathConfig:
    """Tous les chemins du projet."""
    root: str = OUTPUT_ROOT
    data_root: str = DRIVE_ROOT

    # Sous-répertoires
    checkpoints: str = field(init=False)
    logs:        str = field(init=False)
    data:        str = field(init=False)
    oof_preds:   str = field(init=False)
    calibration: str = field(init=False)

    def __post_init__(self):
        self.checkpoints = os.path.join(self.root, "checkpoints")
        self.logs        = os.path.join(self.root, "logs")
        self.data        = os.path.join(self.data_root, "data")
        self.oof_preds   = os.path.join(self.root, "oof_predictions")
        self.calibration = os.path.join(self.root, "calibration")
        self._create_dirs()

    def _create_dirs(self):
        """Crée les répertoires s'ils n'existent pas."""
        for path in [self.checkpoints, self.logs, self.data,
                     self.oof_preds, self.calibration]:
            os.makedirs(path, exist_ok=True)

    # Fichiers spécifiques
    @property
    def gmu_best_weights(self) -> str:
        return os.path.join(self.checkpoints, "gmu_best.pt")

    @property
    def meta_learner_weights(self) -> str:
        return os.path.join(self.checkpoints, "meta_learner.pkl")

    @property
    def calibrator_weights(self) -> str:
        return os.path.join(self.calibration, "isotonic_calibrator.pkl")

    @property
    def optuna_db(self) -> str:
        return f"sqlite:///{os.path.join(self.root, 'optuna_study.db')}"


PATHS = PathConfig()

# ===========================================================================
# 3. DIMENSIONS DES VECTEURS D'EMBEDDING
# ===========================================================================
# Ces dimensions sont les "contrats" entre les modules.
# Modifier ici propage automatiquement partout.

@dataclass
class EmbeddingDims:
    """Dimensions de sortie de chaque branche."""
    # Branche 1 - Clinique/Tabulaire
    clinical: int = 256        # h_clin  : [B, 256]

    # Branche 2 - Temporelle
    temporal: int = 256        # h_temp  : [B, 256]

    # Branche 3 - rPPG (avant projection)
    rppg_raw: int = 128        # h_rppg_raw : [B, 128]

    # Branche 3 - rPPG (après projection Linear -> clinical_dim)
    rppg_proj: int = 256       # h_rppg : [B, 256]

    # GMU - vecteur fusionné final
    gmu_out: int = 256         # z : [B, 256]

    # Nombre de branches (pour le GMU)
    n_branches: int = 3

    @property
    def gmu_input(self) -> int:
        """Taille de la concaténation pour le gating GMU."""
        return self.clinical + self.temporal + self.rppg_proj  # 768


EMBED = EmbeddingDims()

# ===========================================================================
# 4. HYPERPARAMÈTRES DE LA BRANCHE CLINIQUE (TabNet + ResNet-MLP)
# ===========================================================================

@dataclass
class ClinicalConfig:
    """Configuration de la branche tabulaire."""
    # Dimensions des features d'entrée
    # (sera écrasé dynamiquement selon le dataset NHANES)
    input_dim: int = 11        # Nombre de features cliniques (age, bmi, glucose, etc.)

    # --- TabNet ---
    tabnet_n_d: int = 64       # Largeur de la couche décisionnelle
    tabnet_n_a: int = 64       # Largeur de la couche d'attention
    tabnet_n_steps: int = 5    # Nombre d'étapes de feature selection
    tabnet_gamma: float = 1.5  # Coefficient de relaxation de l'entropie
    tabnet_momentum: float = 0.02
    tabnet_epsilon: float = 1e-15

    # --- ResNet-MLP (après TabNet embedding) ---
    resnet_hidden_dims: List[int] = field(
        default_factory=lambda: [512, 256]
    )
    resnet_dropout: float = 0.3
    resnet_use_batch_norm: bool = True

    # Dimension de sortie (doit correspondre à EMBED.clinical)
    output_dim: int = 256


CLINICAL_CFG = ClinicalConfig()

# ===========================================================================
# 5. HYPERPARAMÈTRES DE LA BRANCHE TEMPORELLE (Temporal Transformer)
# ===========================================================================

@dataclass
class TemporalConfig:
    """Configuration du Transformer temporel (données Terra/Vital 7 jours)."""
    # Format des données : (B, seq_len, feature_dim)
    seq_len: int = 7 * 24      # 7 jours x 24h = 168 pas de temps horaires
                               # Adapter selon la granularité des données API
    feature_dim: int = 12      # Ex: HR, SpO2, steps, calories, RR, HRV...

    # --- Transformer ---
    d_model: int = 128         # Dimension interne du modèle
    n_heads: int = 8           # Multi-head self-attention (d_model % n_heads == 0)
    n_layers: int = 4          # Nombre de blocs Transformer
    d_ff: int = 512            # Dimension feed-forward intermédiaire
    dropout: float = 0.1
    max_seq_len: int = 512     # Pour le positional encoding

    # Projection vers dimension commune
    proj_dim: int = 256        # Doit correspondre à EMBED.temporal

    # Agrégation de la séquence (cls_token | mean_pool | last)
    aggregation: str = "mean_pool"


TEMPORAL_CFG = TemporalConfig()

# ===========================================================================
# 6. HYPERPARAMÈTRES DE LA BRANCHE rPPG (1D-CNN)
# ===========================================================================

@dataclass
class RPPGConfig:
    """Configuration de la branche rPPG (features extraites en edge)."""
    # Features rPPG extraites localement
    # Ex: HR, RMSSD, LF, HF, LF/HF ratio, PSD_peaks (8 features typiques)
    input_dim: int = 8         # Nombre de features rPPG scalaires

    # --- 1D-CNN Shallow ---
    # Conv layers : (out_channels, kernel_size)
    conv_layers: List[tuple] = field(
        default_factory=lambda: [
            (32, 3),   # Couche 1 : 32 filtres, kernel 3
            (64, 3),   # Couche 2 : 64 filtres, kernel 3
            (128, 1),  # Couche 3 : 128 filtres, kernel 1 (pointwise)
        ]
    )
    use_batch_norm: bool = True
    activation: str = "relu"

    # Dimension intermédiaire avant projection
    raw_output_dim: int = 128   # Doit correspondre à EMBED.rppg_raw

    # Projection Linear [128 -> 256]
    proj_dim: int = 256         # Doit correspondre à EMBED.rppg_proj


RPPG_CFG = RPPGConfig()

# ===========================================================================
# 7. HYPERPARAMÈTRES DU GMU (Gated Multimodal Unit)
# ===========================================================================

@dataclass
class GMUConfig:
    """Configuration de l'unité de fusion GMU."""
    input_dim: int = EMBED.gmu_input   # 768 (concat des 3 branches)
    branch_dim: int = EMBED.clinical   # 256 (dimension commune de chaque branche)
    n_branches: int = EMBED.n_branches # 3

    # Normalisation post-fusion
    use_layer_norm: bool = True
    dropout: float = 0.3

    # Connexion résiduelle depuis h_clin (branche principale)
    use_residual: bool = True

    # Dimension de sortie du GMU
    output_dim: int = EMBED.gmu_out    # 256


GMU_CFG = GMUConfig()

# ===========================================================================
# 8. HYPERPARAMÈTRES D'ENTRAÎNEMENT DU MODÈLE PROFOND
# ===========================================================================

@dataclass
class TrainConfig:
    """Configuration d'entraînement du réseau GMU."""
    # --- Général ---
    seed: int = 42
    epochs: int = 100
    batch_size: int = 64
    num_workers: int = 0       # 0 pour éviter les problèmes de multiprocessing sur Windows

    # --- Optimiseur (AdamW) ---
    lr: float = 1e-3
    weight_decay: float = 1e-4
    betas: tuple = (0.9, 0.999)

    # --- Scheduler (CosineAnnealingWarmRestarts) ---
    scheduler: str = "cosine_warm"
    warmup_epochs: int = 5
    T_0: int = 20             # Période initiale du cosine restart
    T_mult: int = 2
    eta_min: float = 1e-6

    # --- Early Stopping ---
    patience: int = 15
    monitor: str = "val_auc"  # Métrique à surveiller
    mode: str = "max"

    # --- Loss ---
    loss: str = "bce_with_logits"
    # Pondération de classe (calculée dynamiquement selon class imbalance)
    # pos_weight sera calculé dans le script d'entraînement

    # --- Validation ---
    val_split: float = 0.15
    test_split: float = 0.10

    # --- Cross-Validation (pour OOF stacking) ---
    n_folds: int = 5
    stratified: bool = True    # StratifiedKFold (dataset déséquilibré)

    # --- Gradient Clipping ---
    grad_clip: float = 1.0

    # --- Logging ---
    log_every_n_steps: int = 10
    use_wandb: bool = False    # Activer si wandb installé sur Colab


TRAIN_CFG = TrainConfig()

# ===========================================================================
# 9. HYPERPARAMÈTRES DE L'INFÉRENCE (MC Dropout)
# ===========================================================================

@dataclass
class InferenceConfig:
    """Configuration de l'inférence avec estimation d'incertitude."""
    # Monte Carlo Dropout
    mc_dropout_passes: int = 30   # T=30 passes forward stochastiques
    mc_dropout_rate: float = 0.3  # Taux de dropout pendant l'inférence

    # Seuils de décision
    decision_threshold: float = 0.5    # Seuil probabiliste principal
    high_confidence_threshold: float = 0.8  # Confiance haute

    # Incertitude (écart-type) : alarme si trop élevée
    uncertainty_warning_threshold: float = 0.15

    # --- Règles Cliniques Dures (Hard Rules) ---
    glucose_high_risk_mg_dl: float = 126.0  # ADA guideline : ≥126 -> Diabète
    glucose_prediabetes_mg_dl: float = 100.0  # Pré-diabète si ≥100

    # HbA1c (si disponible dans les features)
    hba1c_high_risk: float = 6.5   # ≥6.5% -> Diabète confirmé
    hba1c_prediabetes: float = 5.7 # ≥5.7% -> Pré-diabète


INFER_CFG = InferenceConfig()

# ===========================================================================
# 10. CONFIGURATION DES MODÈLES DE STACKING (XGBoost, LightGBM, LogReg)
# ===========================================================================

@dataclass
class StackingConfig:
    """Configuration du méta-learner et des modèles de base."""
    # --- XGBoost ---
    xgb_params: dict = field(default_factory=lambda: {
        "n_estimators": 1000,
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 5,
        "gamma": 0.1,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "use_label_encoder": False,
        "eval_metric": "auc",
        "early_stopping_rounds": 50,
        "tree_method": "gpu_hist",   # GPU si disponible sur Colab
        "random_state": 42,
    })

    # --- LightGBM ---
    lgbm_params: dict = field(default_factory=lambda: {
        "n_estimators": 1000,
        "num_leaves": 63,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_samples": 20,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "metric": "auc",
        "early_stopping_rounds": 50,
        "device": "gpu" if torch.cuda.is_available() else "cpu",
        "random_state": 42,
        "verbose": -1,
    })

    # --- Logistic Regression ---
    logreg_params: dict = field(default_factory=lambda: {
        "C": 1.0,              # Inverse de la régularisation L2
        "max_iter": 1000,
        "solver": "lbfgs",
        "random_state": 42,
    })

    # --- Meta-Learner (réseau dense [64 -> 32]) ---
    meta_hidden_dims: List[int] = field(
        default_factory=lambda: [64, 32]
    )
    meta_dropout: float = 0.2
    meta_lr: float = 1e-3
    meta_epochs: int = 50

    # --- Optuna (hyperopt du meta-learner) ---
    optuna_n_trials: int = 50
    optuna_timeout: int = 600  # 10 minutes max

    # Nombre de modèles de base (XGB + LGBM + LogReg + GMU)
    n_base_models: int = 4     # Input du meta-learner


STACK_CFG = StackingConfig()

# =============================================================================
# 11. FEATURES CLINIQUES (Colonnes NHANES / Formulaire utilisateur)
# =============================================================================

# Features numériques continues
# FIX-A : Utilisation du nom canonique "glucose_fasting_mg_dl" au lieu de "glucose"
NUMERICAL_FEATURES = [
    "age", "bmi", "glucose_fasting_mg_dl", "bloodpressure", 
    "pregnancies", "skinthickness", "insulin", 
    "diabetespedigreefunction"
]

# Features catégorielles (encodées avant injection)
CATEGORICAL_FEATURES = [
    "gender",              # 1: Male, 2: Female (NHANES style)
    "smoking",             # 0: No, 1: Yes
    "family_history",      # 0: No, 1: Yes
]

# Features rPPG scalaires (extraites en local sur le device)
RPPG_FEATURES = [
    "hr_bpm",              # Fréquence cardiaque moyenne
    "rmssd_ms",            # Root Mean Square of Successive Differences (HRV)
    "lf_power",            # Puissance basses fréquences (0.04-0.15 Hz)
    "hf_power",            # Puissance hautes fréquences (0.15-0.4 Hz)
    "lf_hf_ratio",         # Ratio sympatho-vagal
    "sdnn_ms",             # Standard deviation of NN intervals
    "pnn50_pct",           # % de différences successives > 50ms
    "mean_rr_ms",          # Intervalle RR moyen
]

# Features temporelles (API Terra/Vital, par heure)
TEMPORAL_FEATURES = [
    "hr_hourly",           # Fréquence cardiaque horaire
    "spo2_pct",            # Saturation en oxygène
    "steps_hourly",        # Pas par heure
    "calories_hourly",     # Calories brûlées par heure
    "rr_interval_ms",      # Intervalle RR (HRV approximatif)
    "skin_temp_celsius",   # Température cutanée
    "respiratory_rate",    # Fréquence respiratoire
    "stress_score",        # Score de stress (API propriétaire)
    "sleep_stage",         # 0: Awake, 1: Light, 2: Deep, 3: REM
    "activity_intensity",  # Intensité de l'activité (MET)
    "blood_glucose_cgm",   # Glycémie CGM si disponible (NaN sinon)
    "hrv_rmssd",           # HRV RMSSD horaire
]

# Target
TARGET_COLUMN = "diabetes_target"  # 0: Non-diabétique, 1: Diabétique

# ===========================================================================
# 12. CONTRAINTES MÉDICALES & SÉCURITÉ (Centralisation)
# ===========================================================================

# Clips physiologiques pour éviter les aberrations
CLINICAL_SAFETY_CLIP = {
    "age":                      (0.0,   120.0),
    "bmi":                      (10.0,  80.0),
    "glucose_fasting_mg_dl":    (20.0,  600.0),
    "bloodpressure":            (20.0,  200.0),
    "insulin":                  (0.0,   900.0),
    "skinthickness":            (0.0,   100.0),
    "pregnancies":              (0.0,   20.0),
    "diabetespedigreefunction": (0.0,   4.0),
}

# Features devant être corrélées positivement avec le risque (Monotonicity)
MONOTONE_INCREASING_FEATURES = [
    "age", "bmi", "glucose_fasting_mg_dl", "bloodpressure", 
    "pregnancies", "skinthickness", "insulin", "diabetespedigreefunction",
    "smoking", "family_history"
]

# Features devant être corrélées négativement avec le risque
MONOTONE_DECREASING_FEATURES = []  # HDL par exemple, si ajouté plus tard

# ===========================================================================
# 14. REGISTRE DES FEATURES (Single Source of Truth)
# ===========================================================================

FEATURE_REGISTRY = {
    "numerical": NUMERICAL_FEATURES,
    "categorical": CATEGORICAL_FEATURES,
    "all_clinical": NUMERICAL_FEATURES + CATEGORICAL_FEATURES,
    "rppg": RPPG_FEATURES,
    "temporal": TEMPORAL_FEATURES,
    "target": TARGET_COLUMN
}

# Mapping Index -> Feature Name (pour XGBoost/LGBM consistency)
FEATURE_INDEX_MAP = {i: name for i, name in enumerate(FEATURE_REGISTRY["all_clinical"])}

# ===========================================================================
# 13. RÉSUMÉ DE CONFIGURATION (pour debug rapide)
# ===========================================================================

def print_config_summary():
    """Affiche un résumé lisible de la configuration."""
    print("\n" + "="*60)
    print("  CONFIGURATION MULTIMODAL DIABÈTE — RÉSUMÉ")
    print("="*60)
    print(f"  Device                : {DEVICE}")
    print(f"  Drive Root            : {PATHS.root}")
    print(f"  Checkpoint dir        : {PATHS.checkpoints}")
    print(f"\n  [Dimensions]")
    print(f"  h_clin                : [{EMBED.clinical}]")
    print(f"  h_temp                : [{EMBED.temporal}]")
    print(f"  h_rppg (raw->proj)     : [{EMBED.rppg_raw}] -> [{EMBED.rppg_proj}]")
    print(f"  GMU input (concat)    : [{EMBED.gmu_input}]")
    print(f"  GMU output z          : [{EMBED.gmu_out}]")
    print(f"\n  [Données]")
    print(f"  Features cliniques    : {len(NUMERICAL_FEATURES + CATEGORICAL_FEATURES)}")
    print(f"  Features rPPG         : {len(RPPG_FEATURES)}")
    print(f"  Features temporelles  : {len(TEMPORAL_FEATURES)} x {TEMPORAL_CFG.seq_len} steps")
    print(f"\n  [Entraînement]")
    print(f"  Epochs                : {TRAIN_CFG.epochs}")
    print(f"  Batch size            : {TRAIN_CFG.batch_size}")
    print(f"  Learning rate         : {TRAIN_CFG.lr}")
    print(f"  CV Folds (OOF)        : {TRAIN_CFG.n_folds}")
    print(f"\n  [Inférence]")
    print(f"  MC Dropout passes     : {INFER_CFG.mc_dropout_passes}")
    print(f"  Glucose Hard Rule     : >={INFER_CFG.glucose_high_risk_mg_dl} mg/dL -> HIGH RISK")
    print("="*60 + "\n")


if __name__ == "__main__":
    print_config_summary()