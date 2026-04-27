# =============================================================================
# pipeline.py — Dataset & DataLoader Multimodaux pour la Prédiction du Diabète
# =============================================================================
# Gère l'alignement et le prétraitement des trois modalités :
#   1. Données tabulaires (NHANES / formulaire utilisateur)
#   2. Données temporelles (séries de 7 jours, API Terra/Vital)
#   3. Features rPPG scalaires (extraites en local sur le device)
#
# Architecture des données :
#   Chaque sample est un triplet (clinical_features, temporal_sequence, rppg_features)
#   aligné par patient_id et horodatage.
# =============================================================================

import os
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder, RobustScaler
from sklearn.impute import KNNImputer
from typing import Optional, Dict, Tuple, List
import warnings
warnings.filterwarnings("ignore")

# Import de la configuration centrale
from config import (
    TRAIN_CFG, TEMPORAL_CFG, CLINICAL_CFG, RPPG_CFG,
    NUMERICAL_FEATURES, CATEGORICAL_FEATURES,
    RPPG_FEATURES, TEMPORAL_FEATURES, TARGET_COLUMN,
    PATHS, DEVICE
)


# =============================================================================
# 1. PRÉPROCESSEUR DES DONNÉES CLINIQUES/TABULAIRES
# =============================================================================

class ClinicalPreprocessor:
    """
    Prétraitement complet des données tabulaires NHANES (Niveau SaMD).
    Gère :
      - Imputation des valeurs manquantes (KNN pour les numériques)
      - Encodage des catégorielles
      - Normalisation (RobustScaler — robuste aux outliers médicaux)
      - Feature engineering de base
    """

    def __init__(self, numerical_features: List[str], categorical_features: List[str]):
        self.numerical_features   = numerical_features
        self.categorical_features = categorical_features
        self.num_scaler   = RobustScaler()   # Résistant aux outliers cliniques
        self.knn_imputer  = KNNImputer(n_neighbors=5, weights="distance")
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.feature_names = []
        self.fitted = False

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Crée des features dérivées cliniquement pertinentes."""
        df = df.copy()
        if "bmi" in df.columns:
            df["bmi_category"] = pd.cut(
                df["bmi"],
                bins=[0, 18.5, 25, 30, 35, 100],
                labels=[0, 1, 2, 3, 4]
            ).astype(float)
        if "systolic_bp" in df.columns and "diastolic_bp" in df.columns:
            df["pulse_pressure"] = df["systolic_bp"] - df["diastolic_bp"]
        if "total_cholesterol" in df.columns and "hdl_cholesterol" in df.columns:
            df["non_hdl_cholesterol"] = df["total_cholesterol"] - df["hdl_cholesterol"]
        return df

    def fit(self, df: pd.DataFrame):
        """Fit UNIQUEMENT sur les données d'entraînement (Prévient le Data Leakage)."""
        df = self._engineer_features(df)
        
        # Encodage catégoriel
        for col in self.categorical_features:
            if col in df.columns:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str).fillna("unknown"))
                self.label_encoders[col] = le

        self.feature_names = [c for c in (self.numerical_features + self.categorical_features)
                             if c in df.columns]

        X = df[self.feature_names].values.astype(np.float32)
        
        # Fit Imputer et Scaler
        X_imputed = self.knn_imputer.fit_transform(X)
        self.num_scaler.fit(X_imputed)
        
        self.fitted = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """Transforme les données (validation/test/inférence)."""
        assert self.fitted, "Le préprocesseur doit être fitté d'abord."
        df = self._engineer_features(df)

        for col, le in self.label_encoders.items():
            if col in df.columns:
                df[col] = df[col].astype(str).fillna("unknown")
                known_classes = set(le.classes_)
                df[col] = df[col].apply(lambda x: x if x in known_classes else le.classes_[0])
                df[col] = le.transform(df[col])

        X = df[self.feature_names].values.astype(np.float32)
        X = self.knn_imputer.transform(X)
        X = self.num_scaler.transform(X)
        return X.astype(np.float32)

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        return self.fit(df).transform(df)

    @property
    def n_features(self) -> int:
        return len(self.feature_names) if self.fitted else 0


# =============================================================================
# 2. PRÉPROCESSEUR DES DONNÉES TEMPORELLES
# =============================================================================

class TemporalPreprocessor:
    """
    Prétraitement des séries temporelles (7 jours).
    Implémente un pipeline d'imputation robuste pour usage médical.
    """

    def __init__(self, seq_len: int, feature_dim: int, temporal_features: List[str]):
        self.seq_len          = seq_len
        self.feature_dim      = feature_dim
        self.temporal_features = temporal_features
        self.scaler           = StandardScaler()
        self.global_medians   = None
        self.fitted           = False

    def _pad_or_truncate(self, sequence: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        T, D = sequence.shape
        if T >= self.seq_len:
            seq_out  = sequence[-self.seq_len:]
            mask_out = np.zeros(self.seq_len, dtype=bool)
        else:
            pad_len  = self.seq_len - T
            seq_out  = np.vstack([np.zeros((pad_len, D), dtype=np.float32), sequence])
            mask_out = np.array([True] * pad_len + [False] * T, dtype=bool)
        return seq_out, mask_out

    def fit(self, sequences: List[np.ndarray]):
        """Fit sur le train set uniquement."""
        valid_sequences = [s for s in sequences if s.shape[0] > 0]
        if not valid_sequences:
            self.global_medians = np.zeros(self.feature_dim)
            self.fitted = True
            return self
            
        all_data = np.vstack(valid_sequences)
        self.scaler.fit(all_data)
        self.global_medians = np.nanmedian(all_data, axis=0)
        self.fitted = True
        return self

    def transform_one(self, sequence: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Inférence robuste avec FFill -> BFill -> Median Fallback."""
        assert self.fitted, "Le préprocesseur temporel doit être fitté."

        if sequence.shape[0] == 0:
            return np.zeros((self.seq_len, self.feature_dim), dtype=np.float32), np.ones(self.seq_len, dtype=bool)

        # Imputation robuste niveau médical
        df_seq = pd.DataFrame(sequence)
        df_seq = df_seq.ffill().bfill() # Forward then Backward fill
        
        # Fallback sur la médiane globale si la série est entièrement vide pour une feature
        for i in range(df_seq.shape[1]):
            if df_seq[i].isnull().all():
                df_seq[i] = self.global_medians[i]
            elif df_seq[i].isnull().any():
                df_seq[i] = df_seq[i].fillna(df_seq[i].median())
        
        # Dernier recours : 0.0 (déjà géré par LayerNorm/Mask mais pour la sécurité numérique)
        sequence_imputed = df_seq.fillna(0.0).values.astype(np.float32)

        seq_normalized = self.scaler.transform(sequence_imputed).astype(np.float32)
        seq_padded, mask = self._pad_or_truncate(seq_normalized)
        return seq_padded, mask

    def transform_batch(self, sequences: List[np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        seqs, masks = zip(*[self.transform_one(s) for s in sequences])
        return np.stack(seqs), np.stack(masks)


# =============================================================================
# 3. PRÉPROCESSEUR DES DONNÉES rPPG
# =============================================================================

class RPPGPreprocessor:
    """Prétraitement des features rPPG scalaires (Prévient le leakage)."""

    def __init__(self, rppg_features: List[str]):
        self.rppg_features = rppg_features
        self.scaler        = RobustScaler()
        self.col_medians   = None
        self.feature_names = []
        self.fitted        = False

    def fit(self, df: pd.DataFrame):
        """Fit sur le train set uniquement."""
        cols = [c for c in self.rppg_features if c in df.columns]
        X = df[cols].values.astype(np.float32)
        self.col_medians = np.nanmedian(X, axis=0)
        
        X_imputed = np.where(np.isnan(X), self.col_medians, X)
        self.scaler.fit(X_imputed)
        
        self.feature_names = cols
        self.fitted = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        assert self.fitted, "Le préprocesseur rPPG doit être fitté."
        X = df[self.feature_names].values.astype(np.float32)
        
        # Imputation via médianes apprises au fit
        for j in range(X.shape[1]):
            X[np.isnan(X[:, j]), j] = self.col_medians[j]
            
        return self.scaler.transform(X).astype(np.float32)

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        return self.fit(df).transform(df)


# =============================================================================
# 4. DATASET MULTIMODAL PRINCIPAL
# =============================================================================

class DiabetesMultimodalDataset(Dataset):
    def __init__(
        self,
        clinical_data:   np.ndarray,
        temporal_data:   np.ndarray,
        temporal_masks:  np.ndarray,
        rppg_data:       np.ndarray,
        labels:          np.ndarray,
        patient_ids:     Optional[List[str]] = None,
        glucose_values:  Optional[np.ndarray] = None,
        augment:         bool = False,
    ):
        self.clinical_data  = torch.tensor(clinical_data,  dtype=torch.float32)
        self.temporal_data  = torch.tensor(temporal_data,  dtype=torch.float32)
        self.temporal_masks = torch.tensor(temporal_masks, dtype=torch.bool)
        self.rppg_data      = torch.tensor(rppg_data,      dtype=torch.float32)
        self.labels         = torch.tensor(labels,         dtype=torch.float32)
        self.patient_ids    = patient_ids or [f"p_{i}" for i in range(len(labels))]
        self.glucose_values = torch.tensor(glucose_values if glucose_values is not None else np.zeros(len(labels)), dtype=torch.float32)
        self.augment = augment

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, idx: int) -> Dict:
        clinical = self.clinical_data[idx]
        temporal = self.temporal_data[idx]
        temp_mask = self.temporal_masks[idx]
        rppg     = self.rppg_data[idx]
        label    = self.labels[idx]

        if self.augment:
            clinical = clinical + torch.randn_like(clinical) * 0.01
            rppg = rppg + torch.randn_like(rppg) * 0.005

        return {
            "clinical"  : clinical,
            "temporal"  : temporal,
            "temp_mask" : temp_mask,
            "rppg"      : rppg,
            "label"     : label,
            "patient_id": self.patient_ids[idx],
            "glucose"   : self.glucose_values[idx],
        }


# =============================================================================
# 5. PIPELINE COMPLET — CORRECTION LEAKAGE
# =============================================================================

def build_full_pipeline(
    nhanes_csv:    str,
    temporal_dir:  Optional[str] = None,
    rppg_csv:      Optional[str] = None,
    test_size:     float = TRAIN_CFG.test_split,
    val_size:      float = TRAIN_CFG.val_split,
    random_state:  int   = TRAIN_CFG.seed,
) -> Dict:
    from sklearn.model_selection import train_test_split

    # 1. Chargement et Nettoyage
    df = pd.read_csv(nhanes_csv)
    if "patient_id" in df.columns:
        df = df.drop_duplicates(subset="patient_id", keep="last")
    df = df.dropna(subset=[TARGET_COLUMN])
    labels = df[TARGET_COLUMN].values
    patient_ids = df["patient_id"].tolist() if "patient_id" in df.columns else [f"p_{i}" for i in range(len(df))]
    glucose_raw = df["glucose_fasting_mg_dl"].values.astype(np.float32) if "glucose_fasting_mg_dl" in df.columns else np.zeros(len(df))

    # 2. Split Stratifié (AVANT tout fit)
    idx = np.arange(len(df))
    idx_trainval, idx_test = train_test_split(idx, test_size=test_size, stratify=labels, random_state=random_state)
    val_size_adj = val_size / (1 - test_size)
    idx_train, idx_val = train_test_split(idx_trainval, test_size=val_size_adj, stratify=labels[idx_trainval], random_state=random_state)

    # 3. Fit Clinique sur TRAIN uniquement
    clin_preprocessor = ClinicalPreprocessor(NUMERICAL_FEATURES, CATEGORICAL_FEATURES)
    clin_preprocessor.fit(df.iloc[idx_train])
    X_clinical_all = clin_preprocessor.transform(df)

    # 4. Temporal
    if temporal_dir and os.path.exists(temporal_dir):
        sequences_all = []
        for pid in patient_ids:
            fpath = os.path.join(temporal_dir, f"{pid}_temporal.csv")
            if os.path.exists(fpath):
                df_t = pd.read_csv(fpath).sort_values("timestamp")
                sequences_all.append(df_t[[c for c in TEMPORAL_FEATURES if c in df_t.columns]].values.astype(np.float32))
            else:
                sequences_all.append(np.zeros((0, len(TEMPORAL_FEATURES)), dtype=np.float32))
    else:
        sequences_all = [np.random.randn(TEMPORAL_CFG.seq_len, TEMPORAL_CFG.feature_dim).astype(np.float32) for _ in range(len(df))]

    temp_preprocessor = TemporalPreprocessor(TEMPORAL_CFG.seq_len, TEMPORAL_CFG.feature_dim, TEMPORAL_FEATURES)
    temp_preprocessor.fit([sequences_all[i] for i in idx_train])
    seqs_np, masks_np = temp_preprocessor.transform_batch(sequences_all)

    # 5. Fit rPPG sur TRAIN uniquement
    if rppg_csv and os.path.exists(rppg_csv):
        df_rppg = pd.read_csv(rppg_csv)
        df = df.merge(df_rppg[["patient_id"] + RPPG_FEATURES], on="patient_id", how="left")
    else:
        for feat in RPPG_FEATURES: df[feat] = np.random.randn(len(df))

    rppg_preprocessor = RPPGPreprocessor(RPPG_FEATURES)
    rppg_preprocessor.fit(df.iloc[idx_train])
    X_rppg_all = rppg_preprocessor.transform(df)

    # 6. Datasets & Loaders
    def make_ds(indices, aug=False):
        return DiabetesMultimodalDataset(X_clinical_all[indices], seqs_np[indices], masks_np[indices], X_rppg_all[indices], labels[indices], [patient_ids[i] for i in indices], glucose_raw[indices], aug)

    ds_train, ds_val, ds_test = make_ds(idx_train, True), make_ds(idx_val), make_ds(idx_test)

    # Weighted Sampler pour déséquilibre médical
    counts = np.bincount(labels[idx_train].astype(int))
    weights = 1.0 / counts
    samples_weights = torch.tensor([weights[int(y)] for y in labels[idx_train]], dtype=torch.float)
    sampler = WeightedRandomSampler(samples_weights, len(samples_weights), replacement=True)

    loaders = {
        "train": DataLoader(ds_train, batch_size=TRAIN_CFG.batch_size, sampler=sampler, num_workers=TRAIN_CFG.num_workers, pin_memory=True),
        "val"  : DataLoader(ds_val, batch_size=TRAIN_CFG.batch_size*2, shuffle=False, num_workers=TRAIN_CFG.num_workers),
        "test" : DataLoader(ds_test, batch_size=TRAIN_CFG.batch_size*2, shuffle=False, num_workers=TRAIN_CFG.num_workers)
    }

    return {
        "loaders": loaders, "n_clinical": X_clinical_all.shape[1],
        "datasets": {"train": ds_train, "val": ds_val, "test": ds_test},
        "X_clinical_all": X_clinical_all, "labels_all": labels,
        "idx_train": idx_train, "idx_val": idx_val, "idx_test": idx_test
    }


def build_dataloaders(ds_train, ds_val, ds_test=None, batch_size=32, num_workers=0, use_weighted_sampler=True):
    """Utilitaire pour la cross-validation."""
    if use_weighted_sampler:
        counts = np.bincount(ds_train.labels.numpy().astype(int))
        weights = 1.0 / counts
        sw = torch.tensor([weights[int(y)] for y in ds_train.labels], dtype=torch.float)
        sampler = WeightedRandomSampler(sw, len(sw), replacement=True)
    else: sampler = None
    
    return {
        "train": DataLoader(ds_train, batch_size=batch_size, sampler=sampler, shuffle=(sampler is None), num_workers=num_workers),
        "val"  : DataLoader(ds_val, batch_size=batch_size*2, shuffle=False, num_workers=num_workers),
        "test" : DataLoader(ds_test, batch_size=batch_size*2, shuffle=False, num_workers=num_workers) if ds_test else None
    }


class OOFCrossValidator:
    def __init__(self, n_folds=5, seed=42):
        self.skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)
    def get_oof_datasets(self, pipeline_data):
        X_clin, X_rppg = pipeline_data["X_clinical_all"], pipeline_data["datasets"]["train"].rppg_data.numpy()
        seqs, masks = pipeline_data["datasets"]["train"].temporal_data.numpy(), pipeline_data["datasets"]["train"].temporal_masks.numpy()
        labels, idx_tv = pipeline_data["labels_all"], np.concatenate([pipeline_data["idx_train"], pipeline_data["idx_val"]])
        
        folds = []
        for f, (tr, vl) in enumerate(self.skf.split(X_clin[idx_tv], labels[idx_tv])):
            abs_tr, abs_vl = idx_tv[tr], idx_tv[vl]
            ds_tr = DiabetesMultimodalDataset(X_clin[abs_tr], seqs[abs_tr] if abs_tr.max() < len(seqs) else np.zeros((len(abs_tr), seqs.shape[1], seqs.shape[2])), masks[abs_tr] if abs_tr.max() < len(masks) else np.ones((len(abs_tr), masks.shape[1]), dtype=bool), X_rppg[abs_tr], labels[abs_tr], augment=True)
            ds_vl = DiabetesMultimodalDataset(X_clin[abs_vl], seqs[abs_vl] if abs_vl.max() < len(seqs) else np.zeros((len(abs_vl), seqs.shape[1], seqs.shape[2])), masks[abs_vl] if abs_vl.max() < len(masks) else np.ones((len(abs_vl), masks.shape[1]), dtype=bool), X_rppg[abs_vl], labels[abs_vl], augment=False)
            folds.append((f, ds_tr, ds_vl))
        return folds
