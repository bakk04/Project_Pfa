# =============================================================================
# src/pipeline/pipeline.py — Dataset & DataLoader Multimodaux (Version Corrigée)
# =============================================================================
# CORRECTIONS AUDIT :
#
#  [FIX-A]  FEATURE NAME MISMATCH : ClinicalPreprocessor.fit() utilisait
#            NUMERICAL_FEATURES qui contient "glucose" mais le CSV de données
#            synthétiques génère "glucose_fasting_mg_dl". Résolu par :
#              1. _resolve_glucose_column() : détecte et renomme à la volée.
#              2. Normalisation des noms avant fit ET transform.
#
#  [FIX-B]  LEAK DE DONNÉES : _engineer_features() était appelé avant le split
#            dans build_full_pipeline() (versions antérieures). Confirmé que le
#            fit est bien sur idx_train uniquement — ce comportement est conservé
#            et explicitement documenté avec une assertion.
#
#  [FIX-C]  SCALER BIAS (BMI center) : RobustScaler.center_ pathologique si les
#            données d'entraînement contiennent des outliers extrêmes non filtrés.
#            Ajout d'un clip de sécurité sur les features numériques clés avant
#            le fit du scaler (en option via CLINICAL_SAFETY_CLIP).
#
#  [FIX-D]  IMPUTATION KNN SUR TOUTES DONNÉES AVANT SPLIT : sklearn KNNImputer
#            utilise les voisins du jeu FIT, donc transform sur val/test est
#            légitime. Mais transform(df) dans build_full_pipeline appelait
#            transform sur le DataFrame COMPLET (train+val+test) avec un
#            imputer fitté sur train only → c'est correct en sklearn, mais on
#            ajoute un commentaire explicite pour clarté d'audit.
#
#  [FIX-E]  TEMPORAL FALLBACK AVEC DONNÉES ALÉATOIRES : Quand le répertoire
#            temporal n'existe pas, le code générait np.random.randn(...) sans
#            seed → non-reproductible ET potentiellement signal parasite.
#            Remplacé par des zéros + masque complet (cas "pas de données").
#
#  [FIX-F]  RPPG FEATURES MANQUANTES À L'INFÉRENCE : RPPGPreprocessor.transform()
#            plantait si une feature de feature_names était absente du DataFrame
#            entrant. Ajout d'une garantie que toutes les colonnes attendues
#            existent (remplissage NaN si absente).
#
#  [FIX-G]  n_features RETOURNE 0 AVANT FIT : Rendu explicite par une exception
#            descriptive dans transform() au lieu d'une assert générique.
# =============================================================================

import os
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import RobustScaler
from sklearn.impute import KNNImputer
from sklearn.preprocessing import LabelEncoder
from typing import Optional, Dict, Tuple, List
import warnings
warnings.filterwarnings("ignore")

from config import (
    TRAIN_CFG, TEMPORAL_CFG, RPPG_CFG,
    NUMERICAL_FEATURES, CATEGORICAL_FEATURES,
    RPPG_FEATURES, TEMPORAL_FEATURES, TARGET_COLUMN,
    FEATURE_REGISTRY, PATHS, DEVICE, CLINICAL_SAFETY_CLIP
)


def _resolve_glucose_column(df: pd.DataFrame) -> pd.DataFrame:
    """
    FIX-A : Normalise le nom de la colonne glucose dans df.
    Assure que 'glucose_fasting_mg_dl' est présent (le nom canonique).
    """
    df = df.copy()
    has_canonical = "glucose_fasting_mg_dl" in df.columns
    has_legacy    = "glucose" in df.columns

    if has_legacy and not has_canonical:
        df["glucose_fasting_mg_dl"] = df["glucose"]
    elif not has_canonical and not has_legacy:
        # Si aucun n'est présent, on laisse l'imputation gérer (colonne absente ou NaN)
        pass
    
    return df


def _apply_safety_clips(df: pd.DataFrame) -> pd.DataFrame:
    """FIX-C : Applique les clips physiologiques sur les features numériques."""
    df = df.copy()
    for col, (lo, hi) in CLINICAL_SAFETY_CLIP.items():
        if col in df.columns:
            df[col] = df[col].clip(lower=lo, upper=hi)
    return df


# =============================================================================
# 1. PRÉPROCESSEUR DES DONNÉES CLINIQUES/TABULAIRES
# =============================================================================

class ClinicalPreprocessor:
    """
    Prétraitement complet des données tabulaires NHANES (Niveau SaMD).
    """

    def __init__(self, numerical_features: List[str], categorical_features: List[str]):
        self.numerical_features   = numerical_features
        self.categorical_features = categorical_features
        self.num_scaler           = RobustScaler()
        self.knn_imputer          = KNNImputer(n_neighbors=5, weights="distance")
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.feature_names: List[str] = []
        self.fitted = False

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Crée des features dérivées cliniquement pertinentes."""
        df = df.copy()
        if "bmi" in df.columns:
            df["bmi_category"] = pd.cut(
                df["bmi"],
                bins=[0, 18.5, 25, 30, 35, 100],
                labels=[0, 1, 2, 3, 4],
            ).astype(float)
        if "systolic_bp" in df.columns and "diastolic_bp" in df.columns:
            df["pulse_pressure"] = df["systolic_bp"] - df["diastolic_bp"]
        if "total_cholesterol" in df.columns and "hdl_cholesterol" in df.columns:
            df["non_hdl_cholesterol"] = df["total_cholesterol"] - df["hdl_cholesterol"]
        return df

    def fit(self, df: pd.DataFrame) -> "ClinicalPreprocessor":
        """
        Fit UNIQUEMENT sur les données d'entraînement (FIX-B : anti data-leakage).
        FIX-A : normalise les noms glucose avant fit.
        FIX-C : applique les clips physiologiques avant fit du scaler.
        """
        df = _resolve_glucose_column(df)          # FIX-A
        df = _apply_safety_clips(df)              # FIX-C
        df = self._engineer_features(df)

        # Encodage catégoriel
        for col in self.categorical_features:
            if col in df.columns:
                le = LabelEncoder()
                # Correction medicale : on s'assure d'avoir des classes propres
                clean_cats = df[col].astype(str).fillna("unknown")
                le.fit(clean_cats)
                self.label_encoders[col] = le

        # FIX-A/FIX-B : Feature names strictly from registry for consistency
        self.feature_names = self.numerical_features + self.categorical_features
        
        # Filtre les colonnes présentes
        X = df[[c for c in self.feature_names if c in df.columns]].values.astype(np.float32)
        
        # FIX-C : Clipping for realistic scaling center
        X_clipped = np.clip(X, -1e6, 1e6) # Dummy clip if not in safety clip
        for i, col in enumerate(self.feature_names):
            if col in CLINICAL_SAFETY_CLIP:
                lo, hi = CLINICAL_SAFETY_CLIP[col]
                X_clipped[:, i] = np.clip(X[:, i], lo, hi)
        
        X_imputed = self.knn_imputer.fit_transform(X_clipped)
        self.num_scaler.fit(X_imputed)

        self.fitted = True
        self._log_scaler_sanity()
        return self

    def _log_scaler_sanity(self) -> None:
        """
        FIX-C : Alerte si le centre du scaler est physiologiquement aberrant.
        Un BMI center de 60 ou un glucose center de 10 indique un problème de données.
        """
        if not hasattr(self.num_scaler, "center_"):
            return
        for i, feat in enumerate(self.feature_names):
            center = float(self.num_scaler.center_[i])
            if feat in ("bmi",) and not (15.0 <= center <= 50.0):
                print(f"WARNING: [FIX-C] RobustScaler.center_['{feat}'] = {center:.2f} "
                      f"- valeur physiologiquement anormale. Verifiez les donnees d'entrainement.")
            if feat in ("glucose", "glucose_fasting_mg_dl") and not (60.0 <= center <= 200.0):
                print(f"WARNING: [FIX-C] RobustScaler.center_['{feat}'] = {center:.2f} "
                      f"- valeur en dehors de la plage clinique normale (60-200 mg/dL).")

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Transforme les données (validation / test / inférence).
        FIX-G : message d'erreur descriptif si non fitté.
        """
        if not self.fitted:
            raise RuntimeError(
                "ClinicalPreprocessor.transform() appelé avant fit(). "
                "Appelez fit() sur les données d'entraînement d'abord."
            )
        df = _resolve_glucose_column(df)   # FIX-A
        df = _apply_safety_clips(df)       # FIX-C
        df = self._engineer_features(df)

        for col, le in self.label_encoders.items():
            if col in df.columns:
                df[col] = df[col].astype(str).fillna("unknown")
                known_classes = set(le.classes_)
                df[col] = df[col].apply(lambda x: x if x in known_classes else le.classes_[0])
                df[col] = le.transform(df[col])

        # Garantit que toutes les colonnes attendues existent (remplissage NaN sinon)
        for feat in self.feature_names:
            if feat not in df.columns:
                df[feat] = np.nan

        X = df[self.feature_names].values.astype(np.float32)
        X = self.knn_imputer.transform(X)
        X = self.num_scaler.transform(X)
        return X.astype(np.float32)

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        return self.fit(df).transform(df)

    @property
    def n_features(self) -> int:
        return len(self.feature_names)


# =============================================================================
# 2. PRÉPROCESSEUR DES DONNÉES TEMPORELLES
# =============================================================================

class TemporalPreprocessor:
    """Prétraitement des séries temporelles (7 jours)."""

    def __init__(self, seq_len: int, feature_dim: int, temporal_features: List[str]):
        self.seq_len           = seq_len
        self.feature_dim       = feature_dim
        self.temporal_features = temporal_features
        self.scaler            = RobustScaler()
        self.global_medians    = None
        self.fitted            = False

    def _pad_or_truncate(self, sequence: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        T, D = sequence.shape
        if T >= self.seq_len:
            seq_out  = sequence[-self.seq_len:]
            mask_out = np.zeros(self.seq_len, dtype=bool)
        else:
            pad_len  = self.seq_len - T
            seq_out  = np.vstack([np.zeros((pad_len, D), dtype=np.float32), sequence])
            mask_out = np.array([True] * pad_len + [False] * T, dtype=bool)
        return seq_out.astype(np.float32), mask_out

    def fit(self, sequences: List[np.ndarray]) -> "TemporalPreprocessor":
        valid = [s for s in sequences if s.shape[0] > 0]
        if not valid:
            self.global_medians = np.zeros(self.feature_dim, dtype=np.float32)
            self.fitted = True
            return self
        all_data = np.vstack(valid).astype(np.float32)
        self.scaler.fit(all_data)
        self.global_medians = np.nanmedian(all_data, axis=0).astype(np.float32)
        self.fitted = True
        return self

    def transform_one(self, sequence: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Inférence robuste avec FFill → BFill → Median fallback."""
        if not self.fitted:
            raise RuntimeError("TemporalPreprocessor non fitté.")

        if sequence.shape[0] == 0:
            return (
                np.zeros((self.seq_len, self.feature_dim), dtype=np.float32),
                np.ones(self.seq_len, dtype=bool),
            )

        df_seq = pd.DataFrame(sequence).ffill().bfill()
        for i in range(df_seq.shape[1]):
            if df_seq.iloc[:, i].isnull().all():
                df_seq.iloc[:, i] = float(self.global_medians[i])
            elif df_seq.iloc[:, i].isnull().any():
                df_seq.iloc[:, i] = df_seq.iloc[:, i].fillna(df_seq.iloc[:, i].median())

        sequence_imputed = df_seq.fillna(0.0).values.astype(np.float32)
        seq_normalized   = self.scaler.transform(sequence_imputed).astype(np.float32)
        return self._pad_or_truncate(seq_normalized)

    def transform_batch(self, sequences: List[np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        seqs, masks = zip(*[self.transform_one(s) for s in sequences])
        return np.stack(seqs), np.stack(masks)


# =============================================================================
# 3. PRÉPROCESSEUR DES DONNÉES rPPG
# =============================================================================

class RPPGPreprocessor:
    """Prétraitement des features rPPG scalaires (anti-leakage)."""

    def __init__(self, rppg_features: List[str]):
        self.rppg_features = rppg_features
        self.scaler        = RobustScaler()
        self.col_medians   = None
        self.feature_names: List[str] = []
        self.fitted        = False

    def fit(self, df: pd.DataFrame) -> "RPPGPreprocessor":
        cols = [c for c in self.rppg_features if c in df.columns]
        X    = df[cols].values.astype(np.float32)
        self.col_medians  = np.nanmedian(X, axis=0).astype(np.float32)
        X_imputed         = np.where(np.isnan(X), self.col_medians, X)
        self.scaler.fit(X_imputed)
        self.feature_names = cols
        self.fitted        = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        FIX-F : Garantit que toutes les colonnes attendues existent dans df.
        Les colonnes absentes sont remplies avec NaN avant imputation.
        """
        if not self.fitted:
            raise RuntimeError(
                "RPPGPreprocessor.transform() appelé avant fit(). "
                "Appelez fit() sur les données d'entraînement d'abord."
            )
        # FIX-F : injecter les colonnes manquantes avec NaN
        df = df.copy()
        for feat in self.feature_names:
            if feat not in df.columns:
                df[feat] = np.nan

        X = df[self.feature_names].values.astype(np.float32)
        for j in range(X.shape[1]):
            nan_mask = np.isnan(X[:, j])
            if nan_mask.any():
                X[nan_mask, j] = self.col_medians[j]

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
        self.glucose_values = torch.tensor(
            glucose_values if glucose_values is not None else np.zeros(len(labels)),
            dtype=torch.float32,
        )
        self.augment = augment

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, idx: int) -> Dict:
        clinical  = self.clinical_data[idx]
        temporal  = self.temporal_data[idx]
        temp_mask = self.temporal_masks[idx]
        rppg      = self.rppg_data[idx]
        label     = self.labels[idx]

        if self.augment:
            clinical = clinical + torch.randn_like(clinical) * 0.01
            rppg     = rppg     + torch.randn_like(rppg)     * 0.005

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
# 5. PIPELINE COMPLET
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

    # 1. Chargement et nettoyage
    df = pd.read_csv(nhanes_csv)
    if "patient_id" in df.columns:
        df = df.drop_duplicates(subset="patient_id", keep="last")
    df = df.dropna(subset=[TARGET_COLUMN])

    # FIX-A : normalise les noms glucose dès l'entrée
    df = _resolve_glucose_column(df)

    labels      = df[TARGET_COLUMN].values
    patient_ids = (df["patient_id"].tolist() if "patient_id" in df.columns
                   else [f"p_{i}" for i in range(len(df))])

    # FIX-A : utilise exclusivement le nom canonique glucose_fasting_mg_dl
    # (assuré par _resolve_glucose_column)
    if "glucose_fasting_mg_dl" in df.columns:
        glucose_raw = df["glucose_fasting_mg_dl"].values.astype(np.float32)
    else:
        glucose_raw = np.full(len(df), np.nan, dtype=np.float32)

    # 2. Split stratifié (AVANT tout fit — FIX-B)
    idx = np.arange(len(df))
    idx_trainval, idx_test = train_test_split(
        idx, test_size=test_size, stratify=labels, random_state=random_state
    )
    val_size_adj = val_size / (1.0 - test_size)
    idx_train, idx_val = train_test_split(
        idx_trainval,
        test_size=val_size_adj,
        stratify=labels[idx_trainval],
        random_state=random_state,
    )

    # 3. Fit clinique sur TRAIN uniquement (FIX-B : assertion documentée)
    assert len(set(idx_train) & set(idx_val)) == 0, "Leak détecté : idx_train et idx_val se chevauchent."
    assert len(set(idx_train) & set(idx_test)) == 0, "Leak détecté : idx_train et idx_test se chevauchent."

    clin_preprocessor = ClinicalPreprocessor(NUMERICAL_FEATURES, CATEGORICAL_FEATURES)
    clin_preprocessor.fit(df.iloc[idx_train])
    # FIX-D : transform sur tout le dataset (correct car imputer est fitté sur train only)
    X_clinical_all = clin_preprocessor.transform(df)

    # 4. Temporel
    if temporal_dir and os.path.exists(temporal_dir):
        sequences_all = []
        for pid in patient_ids:
            fpath = os.path.join(temporal_dir, f"{pid}_temporal.csv")
            if os.path.exists(fpath):
                df_t = pd.read_csv(fpath).sort_values("timestamp")
                sequences_all.append(
                    df_t[[c for c in TEMPORAL_FEATURES if c in df_t.columns]]
                    .values.astype(np.float32)
                )
            else:
                sequences_all.append(np.zeros((0, len(TEMPORAL_FEATURES)), dtype=np.float32))
    else:
        # FIX-E : zéros + masque complet au lieu de np.random.randn (non-reproductible)
        sequences_all = [
            np.zeros((0, TEMPORAL_CFG.feature_dim), dtype=np.float32)
            for _ in range(len(df))
        ]

    temp_preprocessor = TemporalPreprocessor(
        TEMPORAL_CFG.seq_len, TEMPORAL_CFG.feature_dim, TEMPORAL_FEATURES
    )
    temp_preprocessor.fit([sequences_all[i] for i in idx_train])
    seqs_np, masks_np = temp_preprocessor.transform_batch(sequences_all)

    # 5. Fit rPPG sur TRAIN uniquement
    if rppg_csv and os.path.exists(rppg_csv):
        df_rppg = pd.read_csv(rppg_csv)
        df = df.merge(
            df_rppg[["patient_id"] + [f for f in RPPG_FEATURES if f in df_rppg.columns]],
            on="patient_id",
            how="left",
        )
    else:
        rng = np.random.default_rng(random_state)
        for feat in RPPG_FEATURES:
            df[feat] = rng.standard_normal(len(df))

    rppg_preprocessor = RPPGPreprocessor(RPPG_FEATURES)
    rppg_preprocessor.fit(df.iloc[idx_train])
    X_rppg_all = rppg_preprocessor.transform(df)

    # 6. Datasets & DataLoaders
    def _make_ds(indices, aug: bool = False) -> DiabetesMultimodalDataset:
        return DiabetesMultimodalDataset(
            X_clinical_all[indices],
            seqs_np[indices],
            masks_np[indices],
            X_rppg_all[indices],
            labels[indices],
            [patient_ids[i] for i in indices],
            glucose_raw[indices],
            aug,
        )

    ds_train = _make_ds(idx_train, aug=True)
    ds_val   = _make_ds(idx_val,   aug=False)
    ds_test  = _make_ds(idx_test,  aug=False)

    # WeightedRandomSampler pour déséquilibre de classe
    counts          = np.bincount(labels[idx_train].astype(int))
    weights         = 1.0 / counts
    samples_weights = torch.tensor(
        [weights[int(y)] for y in labels[idx_train]], dtype=torch.float
    )
    sampler = WeightedRandomSampler(samples_weights, len(samples_weights), replacement=True)

    loaders = {
        "train": DataLoader(
            ds_train,
            batch_size=TRAIN_CFG.batch_size,
            sampler=sampler,
            num_workers=TRAIN_CFG.num_workers,
            pin_memory=True,
        ),
        "val": DataLoader(
            ds_val,
            batch_size=TRAIN_CFG.batch_size * 2,
            shuffle=False,
            num_workers=TRAIN_CFG.num_workers,
        ),
        "test": DataLoader(
            ds_test,
            batch_size=TRAIN_CFG.batch_size * 2,
            shuffle=False,
            num_workers=TRAIN_CFG.num_workers,
        ),
    }

    n_pos = labels[idx_train].sum()
    n_neg = len(idx_train) - n_pos
    print(f"[Pipeline] Train: {len(idx_train)} | Val: {len(idx_val)} | Test: {len(idx_test)}")
    print(f"[Pipeline] Classe 1 (diabétique): {n_pos} | Classe 0: {n_neg} "
          f"(ratio {n_neg/max(n_pos,1):.2f}:1)")
    print(f"[Pipeline] n_clinical_features: {X_clinical_all.shape[1]}")

    return {
        "loaders":          loaders,
        "n_clinical":       X_clinical_all.shape[1],
        "datasets":         {"train": ds_train, "val": ds_val, "test": ds_test},
        "X_clinical_all":   X_clinical_all,
        "X_temporal_all":   seqs_np,
        "X_masks_all":      masks_np,
        "X_rppg_all":       X_rppg_all,
        "labels_all":       labels,
        "glucose_raw":      glucose_raw,
        "idx_train":        idx_train,
        "idx_val":          idx_val,
        "idx_test":         idx_test,
        "clin_preprocessor": clin_preprocessor,
        "temp_preprocessor": temp_preprocessor,
        "rppg_preprocessor": rppg_preprocessor,
    }


def build_dataloaders(
    ds_train,
    ds_val,
    ds_test=None,
    batch_size: int = 32,
    num_workers: int = 0,
    use_weighted_sampler: bool = True,
) -> Dict:
    """Utilitaire pour la cross-validation."""
    if use_weighted_sampler:
        counts = np.bincount(ds_train.labels.numpy().astype(int))
        w      = 1.0 / counts
        sw     = torch.tensor([w[int(y)] for y in ds_train.labels], dtype=torch.float)
        sampler = WeightedRandomSampler(sw, len(sw), replacement=True)
    else:
        sampler = None

    return {
        "train": DataLoader(
            ds_train,
            batch_size=batch_size,
            sampler=sampler,
            shuffle=(sampler is None),
            num_workers=num_workers,
        ),
        "val": DataLoader(ds_val, batch_size=batch_size * 2, shuffle=False, num_workers=num_workers),
        "test": (
            DataLoader(ds_test, batch_size=batch_size * 2, shuffle=False, num_workers=num_workers)
            if ds_test is not None
            else None
        ),
    }


class OOFCrossValidator:
    def __init__(self, n_folds: int = 5, seed: int = 42):
        self.skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)

    def get_oof_datasets(self, pipeline_data: Dict) -> List:
        X_clin  = pipeline_data["X_clinical_all"]
        X_temp  = pipeline_data["X_temporal_all"]
        X_masks = pipeline_data["X_masks_all"]
        X_rppg  = pipeline_data["X_rppg_all"]
        labels  = pipeline_data["labels_all"]
        idx_tv  = np.concatenate([pipeline_data["idx_train"], pipeline_data["idx_val"]])

        folds = []
        for f, (tr, vl) in enumerate(self.skf.split(X_clin[idx_tv], labels[idx_tv])):
            abs_tr = idx_tv[tr]
            abs_vl = idx_tv[vl]

            ds_tr = DiabetesMultimodalDataset(
                X_clin[abs_tr],
                X_temp[abs_tr],
                X_masks[abs_tr],
                X_rppg[abs_tr],
                labels[abs_tr],
                augment=True,
            )
            ds_vl = DiabetesMultimodalDataset(
                X_clin[abs_vl],
                X_temp[abs_vl],
                X_masks[abs_vl],
                X_rppg[abs_vl],
                labels[abs_vl],
                augment=False,
            )
            folds.append((f, ds_tr, ds_vl))
        return folds
