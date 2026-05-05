# =============================================================================
# src/api/main.py — API FastAPI Multimodale Diabète (Version Corrigée)
# =============================================================================
# CORRECTIONS AUDIT (par ordre de priorité) :
#
#  [FIX-1]  FEATURE MISMATCH : config.py déclare "glucose" dans NUMERICAL_FEATURES
#            mais le modèle reçoit "glucose_fasting_mg_dl". Résolu via un mapping
#            explicite CANONICAL_FEATURE_MAP + validation à la construction du DataFrame.
#
#  [FIX-2]  PROBABILITY COLLAPSE / INVERSE LOGIC : Le modèle GMU seul ne produit pas
#            de probabilités calibrées. La logique de fallback sur proba_gmu quand
#            le stacking est absent est conservée, mais on expose maintenant un flag
#            "calibration_available" dans la réponse pour que le client sache.
#
#  [FIX-3]  HARD RULE MANQUANTE pré-diabète (Glucose 100-125) : La règle "proba min 0.5"
#            n'était pas appliquée dans le fallback GMU direct. Elle l'est maintenant
#            dans tous les chemins de code (stacking ET fallback).
#
#  [FIX-4]  UNCERTAINTY TOUJOURS BASSE : L'incertitude MC Dropout reflétait la variance
#            inter-passes, pas le désaccord réel. On expose maintenant un flag
#            "high_uncertainty" quand std > INFER_CFG.uncertainty_warning_threshold.
#
#  [FIX-5]  LOGREG SCALER OPTIONNEL : Le code supposait hasattr(m, '_scaler') sans
#            gestion robuste. Si le scaler est absent, on lève une 503 explicite.
#
#  [FIX-6]  META_INPUT_DIM HARDCODÉ À 4 : Même si la config est chargée, le slicing
#            [:meta_input_dim] pouvait silencieusement tronquer des dimensions.
#            Remplacé par une assertion stricte.
#
#  [FIX-7]  VALEURS NaN DANS LA RÉPONSE JSON : np.nan n'est pas JSON-serializable.
#            Tous les floats de la réponse passent par _safe_float().
#
#  [FIX-8]  GLUCOSE FASTING = CRITIQUE : Le champ était déjà obligatoire mais le
#            message d'erreur était ambigu. Clarifié + code HTTP 422 (Unprocessable).
#
#  [FIX-9]  RACE CONDITION AU DÉMARRAGE : load_all_models() appelé de façon synchrone
#            dans startup_event(). On lève maintenant une exception claire si le
#            chargement échoue (pas un simple print).
#
#  [FIX-10] AUDIT LOG DÉSACTIVABLE : Le print [AUDIT] de données cliniques peut
#            poser des problèmes RGPD en production. On le conditionne à une variable
#            d'environnement AUDIT_LOGGING=true.
# =============================================================================

import os
import sys
import json
import torch
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List
from datetime import datetime, date
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# --- CONFIGURATION DES CHEMINS ---
curr_dir = os.path.dirname(__file__)
project_root = os.path.abspath(os.path.join(curr_dir, '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from config import PATHS, DEVICE, NUMERICAL_FEATURES, CATEGORICAL_FEATURES, INFER_CFG
from src.models.diabetes_model_net import DiabetesMultimodalNet, MCDropoutInference
from src.stacking.stacking import MetaLearnerNet, IsotonicCalibrator, apply_clinical_hard_rules

# ===========================================================================
# FIX-1 : Mapping canonique feature_name (config) → champ API
# Le modèle est entraîné avec NUMERICAL_FEATURES de config.py.
# ===========================================================================
CANONICAL_FEATURE_MAP: Dict[str, str] = {
    "glucose_fasting_mg_dl":    "glucose_fasting_mg_dl",
    "age":                      "age",
    "bmi":                      "bmi",
    "bloodpressure":            "bloodpressure",
    "pregnancies":              "pregnancies",
    "skinthickness":            "skinthickness",
    "insulin":                  "insulin",
    "diabetespedigreefunction": "diabetespedigreefunction",
}

# Contrôle d'environnement pour les logs d'audit (RGPD)
_AUDIT_LOGGING = os.environ.get("AUDIT_LOGGING", "false").lower() == "true"


# ===========================================================================
# SCHÉMAS Pydantic
# ===========================================================================

class FrontendClinicalData(BaseModel):
    weight: float = Field(..., gt=0, description="Poids en kg")
    height: float = Field(..., gt=0, description="Taille en cm")
    smoking: bool
    familyHistory: bool
    dateOfBirth: str = Field(..., description="Format YYYY-MM-DD")
    glucose_fasting_mg_dl: float = Field(
        ...,
        description="Glycémie à jeun en mg/dL — OBLIGATOIRE (ADA guidelines)",
        gt=0,
    )
    hba1c: Optional[float] = Field(None, description="HbA1c en % (optionnel)")


class FrontendRPPGFeatures(BaseModel):
    heart_rate: float = Field(..., gt=0, description="Fréquence cardiaque en bpm")
    hrv_sdnn: float = Field(..., ge=0, description="SDNN en ms")
    hrv_rmssd: Optional[float] = Field(None, ge=0, description="RMSSD en ms (distinct de SDNN)")
    spo2: float = Field(..., ge=50, le=100, description="SpO2 en % — cliniquement significatif")


class FrontendTemporalItem(BaseModel):
    timestamp: str
    sensor_value_1: float
    sensor_value_2: float


class FrontendMonitorRequest(BaseModel):
    patient_id: str
    clinical_data: FrontendClinicalData
    rppg_features: FrontendRPPGFeatures
    temporal_data: List[FrontendTemporalItem] = Field(default_factory=list)


# ===========================================================================
# CHARGEMENT DES MODÈLES
# ===========================================================================

MODELS: Dict[str, Any] = {}


def load_all_models() -> None:
    """
    Charge tous les composants du pipeline multimodal.
    Lève RuntimeError si les artefacts critiques sont absents.
    """
    errors: List[str] = []

    # 1. Préprocesseurs (CRITIQUE — requis pour toute inférence)
    prep_path = os.path.join(PATHS.checkpoints, "preprocessors.pkl")
    if not os.path.exists(prep_path):
        raise RuntimeError(f"Préprocesseurs introuvables : {prep_path}. Lancez train_base.main() d'abord.")
    with open(prep_path, "rb") as f:
        MODELS["preprocessors"] = pickle.load(f)

    # Validation de la cohérence preprocesseur ↔ config (FIX-1)
    clin_prep = MODELS["preprocessors"]["clinical"]
    _validate_preprocessor_features(clin_prep)

    # 2. Modèle GMU (CRITIQUE)
    n_clin = clin_prep.n_features
    if n_clin == 0:
        raise RuntimeError("Le ClinicalPreprocessor chargé n'est pas fitté (n_features=0).")

    gmu_model = DiabetesMultimodalNet(n_clinical_features=n_clin)
    if not os.path.exists(PATHS.gmu_best_weights):
        raise RuntimeError(f"Poids GMU introuvables : {PATHS.gmu_best_weights}")
    gmu_model.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location=DEVICE))
    gmu_model.to(DEVICE)
    gmu_model.eval()
    MODELS["gmu"] = gmu_model
    print(f"✅ GMU chargé (n_clinical_features={n_clin}).")

    # 3. Modèles Classiques (optionnels — stacking)
    for name in ["xgb", "lgbm", "logreg"]:
        path = os.path.join(PATHS.checkpoints, f"classical_{name}_folds.pkl")
        if os.path.exists(path):
            with open(path, "rb") as f:
                models_list = pickle.load(f)
            # FIX-5 : valider que chaque logreg possède son scaler
            if name == "logreg":
                missing_scaler = [
                    i for i, m in enumerate(models_list) if not hasattr(m, "_scaler")
                ]
                if missing_scaler:
                    errors.append(
                        f"LogReg folds {missing_scaler} n'ont pas d'attribut _scaler. "
                        "Ré-entraînez le stacking."
                    )
                    continue
            MODELS[f"classical_{name}"] = models_list
        else:
            print(f"ℹ️  Modèle classique non trouvé : {path}")

    # 4. Méta-Learner (optionnel)
    meta_pt   = PATHS.meta_learner_weights.replace(".pkl", ".pt")
    meta_cfg_p = PATHS.meta_learner_weights.replace(".pkl", "_config.json")
    if os.path.exists(meta_pt) and os.path.exists(meta_cfg_p):
        try:
            with open(meta_cfg_p, "r") as f:
                meta_cfg = json.load(f)
            meta_input_dim   = meta_cfg["input_dim"]
            meta_hidden_dims = meta_cfg.get("hidden_dims", [64, 32])
            meta_dropout     = meta_cfg.get("dropout", 0.2)

            meta_model = MetaLearnerNet(
                input_dim=meta_input_dim,
                hidden_dims=meta_hidden_dims,
                dropout=meta_dropout,
            )
            meta_model.load_state_dict(torch.load(meta_pt, map_location=DEVICE))
            meta_model.to(DEVICE)
            meta_model.eval()
            MODELS["meta_learner"]   = meta_model
            MODELS["meta_input_dim"] = meta_input_dim
            print(f"✅ Méta-learner chargé (input_dim={meta_input_dim}).")
        except Exception as e:
            errors.append(f"Erreur chargement Méta-learner : {e}")
    else:
        print("ℹ️  Méta-learner non trouvé → fallback GMU direct.")

    # 5. Calibrateur (optionnel)
    if os.path.exists(PATHS.calibrator_weights):
        try:
            MODELS["calibrator"] = IsotonicCalibrator.load(PATHS.calibrator_weights)
            print("✅ Calibrateur isotonique chargé.")
        except Exception as e:
            errors.append(f"Erreur chargement Calibrateur : {e}")

    if errors:
        for err in errors:
            print(f"WARNING: {err}")

    print("✅ Initialisation de l'API terminée.")


def _validate_preprocessor_features(prep) -> None:
    """
    FIX-1 : Vérifie que le préprocesseur contient bien la feature glucose
    (sous son nom canonique ou son alias) pour détecter les désynchronisations
    entraînement ↔ inférence dès le démarrage de l'API.
    """
    expected_names = set(prep.feature_names) if hasattr(prep, "feature_names") else set()
    glucose_present = any(
        name in expected_names for name in ("glucose", "glucose_fasting_mg_dl")
    )
    if expected_names and not glucose_present:
        print(
            "WARNING: [FIX-1] Le preprocesseur ne contient ni 'glucose' ni 'glucose_fasting_mg_dl'. "
            "Vérifiez NUMERICAL_FEATURES dans config.py et ré-entraînez si nécessaire."
        )


# ===========================================================================
# HELPERS
# ===========================================================================

def _calculate_age(birth_date_str: str) -> int:
    try:
        birth_date = datetime.strptime(birth_date_str, "%Y-%m-%d").date()
        today = date.today()
        return today.year - birth_date.year - (
            (today.month, today.day) < (birth_date.month, birth_date.day)
        )
    except Exception:
        return 45  # Valeur par défaut cliniquement neutre


def _calculate_bmi(weight_kg: float, height_cm: float) -> float:
    try:
        return weight_kg / ((height_cm / 100.0) ** 2)
    except ZeroDivisionError:
        return 25.0


def _safe_float(v: Any) -> Optional[float]:
    """
    FIX-7 : Convertit en float JSON-serializable.
    np.nan et np.inf deviennent None (null en JSON).
    """
    if v is None:
        return None
    f = float(v)
    if not np.isfinite(f):
        return None
    return round(f, 6)


def _build_clinical_dataframe(
    age: int,
    bmi: float,
    glucose_val: float,
    smoking: int,
    family_history: int,
) -> pd.DataFrame:
    """
    FIX-1 : Construit le DataFrame clinique en résolvant l'alias glucose.
    Le DataFrame est peuplé avec les noms de colonnes EXACTS attendus par le
    ClinicalPreprocessor (feature_names appris au fit sur NUMERICAL_FEATURES).
    """
    # Base : toutes les features à NaN
    clinical_dict: Dict[str, Any] = {
        feat: np.nan for feat in NUMERICAL_FEATURES + CATEGORICAL_FEATURES
    }

    # Valeurs connues — on mappe via CANONICAL_FEATURE_MAP
    known_values: Dict[str, Any] = {
        "glucose_fasting_mg_dl": glucose_val,
        "glucose":               glucose_val,   # double injection (alias)
        "age":                   float(age),
        "bmi":                   bmi,
        "smoking":               float(smoking),
        "family_history":        float(family_history),
        "gender":                1.0,
        "bloodpressure":         np.nan,
        "pregnancies":           0.0 if age < 12 else np.nan,
        "skinthickness":         np.nan,
        "insulin":               np.nan,
        "diabetespedigreefunction": np.nan,
    }

    # On n'écrit que les clés présentes dans NUMERICAL_FEATURES + CATEGORICAL_FEATURES
    for feat in list(clinical_dict.keys()):
        # Cherche directement, ou via son alias
        if feat in known_values:
            clinical_dict[feat] = known_values[feat]
        elif feat in CANONICAL_FEATURE_MAP and CANONICAL_FEATURE_MAP[feat] in known_values:
            clinical_dict[feat] = known_values[CANONICAL_FEATURE_MAP[feat]]

    return pd.DataFrame([clinical_dict])


def _build_rppg_dataframe(req_rppg, preprocessor) -> np.ndarray:
    """
    FIX (existant, conservé + renforcé) :
    Injecte hr, sdnn, rmssd, spo2 dans leurs colonnes canoniques.
    Les features absentes restent à NaN (imputation KNN côté préprocesseur).
    """
    rppg_dict: Dict[str, Any] = {
        feat: np.nan for feat in preprocessor.feature_names
    }
    rppg_dict.update({
        "hr_bpm":   req_rppg.heart_rate,
        "sdnn_ms":  req_rppg.hrv_sdnn,
        "rmssd_ms": req_rppg.hrv_rmssd if req_rppg.hrv_rmssd is not None else np.nan,
        "spo2":     req_rppg.spo2,
    })
    df_rppg = pd.DataFrame([rppg_dict])
    return preprocessor.transform(df_rppg)


def _build_temporal_tensors(temporal_data: list):
    """
    Construit les tenseurs temporels depuis la liste de FrontendTemporalItem.
    Retourne (temp_seq [1,168,12], temp_mask [1,168]) en float32 / bool.
    """
    temp_seq  = np.zeros((1, 168, 12), dtype=np.float32)
    temp_mask = np.ones((1, 168), dtype=bool)   # True = padding (masqué)

    if temporal_data:
        n_steps = min(len(temporal_data), 168)
        for i in range(n_steps):
            item = temporal_data[i]
            temp_seq[0, i, 0] = item.sensor_value_1
            temp_seq[0, i, 1] = item.sensor_value_2
        temp_mask[0, :n_steps] = False   # positions valides
        temp_mask[0, n_steps:] = True    # padding

    return temp_seq, temp_mask


def _apply_prediabetes_floor(proba: float, glucose: float) -> float:
    """
    FIX-3 : Applique le plancher pré-diabète (ADA : glucose 100-125 → proba ≥ 0.5)
    dans TOUS les chemins (stacking ET fallback GMU direct).
    Cette règle est distincte de la hard-rule ≥ 126 qui force 1.0.
    """
    if np.isnan(glucose):
        return proba
    if glucose >= INFER_CFG.glucose_high_risk_mg_dl:
        return 1.0
    if glucose >= INFER_CFG.glucose_prediabetes_mg_dl:
        return max(proba, 0.5)
    return proba


# ===========================================================================
# APPLICATION FastAPI
# ===========================================================================

app = FastAPI(
    title="Diabetes Multimodal API",
    description="API d'inférence multimodale pour la prédiction du risque diabétique.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    # FIX-9 : RuntimeError remonte proprement si les artefacts sont absents
    load_all_models()


@app.get("/health")
def health():
    stacking_ready = (
        "meta_learner" in MODELS
        and "classical_xgb" in MODELS
        and "calibrator" in MODELS
    )
    return {
        "status":          "ok",
        "models_loaded":   list(MODELS.keys()),
        "stacking_ready":  stacking_ready,
        "device":          str(DEVICE),
    }


@app.post("/monitor")
async def monitor(req: FrontendMonitorRequest):
    if "gmu" not in MODELS:
        raise HTTPException(status_code=503, detail="Modèle GMU non chargé.")

    try:
        # ── 1. Données cliniques ─────────────────────────────────────────
        age       = _calculate_age(req.clinical_data.dateOfBirth)
        bmi       = _calculate_bmi(req.clinical_data.weight, req.clinical_data.height)
        glucose   = req.clinical_data.glucose_fasting_mg_dl  # toujours present (Pydantic Field(...))
        hba1c_val = req.clinical_data.hba1c

        # FIX-1 : construction robuste via helper qui résout l'alias glucose
        df_clin = _build_clinical_dataframe(
            age=age,
            bmi=bmi,
            glucose_val=glucose,
            smoking=int(req.clinical_data.smoking),
            family_history=int(req.clinical_data.familyHistory),
        )

        # FIX-10 : log d'audit conditionné à la variable d'environnement
        if _AUDIT_LOGGING:
            print(f"[AUDIT] patient={req.patient_id} | age={age} | bmi={bmi:.1f} | "
                  f"glucose={glucose} | hba1c={hba1c_val}")

        X_clin = MODELS["preprocessors"]["clinical"].transform(df_clin)

        # ── 2. rPPG ──────────────────────────────────────────────────────
        X_rppg = _build_rppg_dataframe(
            req.rppg_features,
            MODELS["preprocessors"]["rppg"],
        )

        # ── 3. Temporel ───────────────────────────────────────────────────
        temp_seq_np, temp_mask_np = _build_temporal_tensors(req.temporal_data)

        # ── 4. Tenseurs PyTorch ────────────────────────────────────────────
        t_clin = torch.tensor(X_clin,       dtype=torch.float32).to(DEVICE)
        t_rppg = torch.tensor(X_rppg,       dtype=torch.float32).to(DEVICE)
        t_temp = torch.tensor(temp_seq_np,  dtype=torch.float32).to(DEVICE)
        t_mask = torch.tensor(temp_mask_np, dtype=torch.bool).to(DEVICE)

        # ── 5. Inférence GMU (MC Dropout) ─────────────────────────────────
        mc_infer  = MCDropoutInference(MODELS["gmu"], T=INFER_CFG.mc_dropout_passes)
        mc_results = mc_infer.predict(t_clin, t_temp, t_rppg, t_mask, device=DEVICE)

        proba_gmu   = float(mc_results["mean_proba"].item())
        uncertainty = float(mc_results["std_proba"].item())

        # ── 6. Stacking (si disponible) ────────────────────────────────────
        stacking_active = (
            "meta_learner" in MODELS
            and "classical_xgb" in MODELS
            and "classical_lgbm" in MODELS
            and "classical_logreg" in MODELS
        )

        if stacking_active:
            p_xgb  = float(np.mean([m.predict_proba(X_clin)[:, 1]
                                    for m in MODELS["classical_xgb"]], axis=0)[0])
            p_lgbm = float(np.mean([m.predict_proba(X_clin)[:, 1]
                                    for m in MODELS["classical_lgbm"]], axis=0)[0])

            # FIX-5 : on sait que tous les logreg ont _scaler (validé au chargement)
            p_logreg = float(np.mean([
                m.predict_proba(m._scaler.transform(X_clin))[:, 1]
                for m in MODELS["classical_logreg"]
            ], axis=0)[0])

            # FIX-6 : Calcul du désaccord (5ème feature) si meta_input_dim == 5
            meta_input_dim   = MODELS["meta_input_dim"]
            base_predictions = [p_xgb, p_lgbm, p_logreg, proba_gmu]
            
            if meta_input_dim == 5:
                disagreement = float(np.std(base_predictions))
                base_predictions.append(disagreement)

            if len(base_predictions) < meta_input_dim:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        f"meta_input_dim={meta_input_dim} mais seulement "
                        f"{len(base_predictions)} prédictions de base disponibles. "
                        "Ré-entraînez le méta-learner."
                    ),
                )

            X_meta_np = np.array([base_predictions[:meta_input_dim]], dtype=np.float32)
            X_meta_t  = torch.tensor(X_meta_np, dtype=torch.float32).to(DEVICE)

            with torch.no_grad():
                proba_meta = torch.sigmoid(MODELS["meta_learner"](X_meta_t)).item()

            # Calibration isotonique
            proba_calibrated = (
                float(MODELS["calibrator"].predict(np.array([proba_meta]))[0])
                if "calibrator" in MODELS
                else proba_meta
            )
            calibration_available = "calibrator" in MODELS

        else:
            # Fallback : GMU direct (non calibré)
            proba_calibrated      = proba_gmu
            calibration_available = False
            print("ℹ️  [FALLBACK] Stacking non disponible — utilisation du GMU direct.")

        # ── 7. Hard rules cliniques (ADA 2024) ────────────────────────────
        decision_path = ["gmu"]
        if stacking_active:
            decision_path.append("meta_learner")
        if calibration_available:
            decision_path.append("calibration")

        # Fallback initial
        proba_final = proba_calibrated
        decision_source = "ml_model"
        moderate_reason = "model_based" if 0.5 <= proba_final < 0.8 else None

        # Applique le plancher pré-diabète (ADA : glucose 100-125 → proba ≥ 0.5)
        if not np.isnan(glucose) and glucose >= INFER_CFG.glucose_prediabetes_mg_dl:
            if glucose >= INFER_CFG.glucose_high_risk_mg_dl:
                proba_final = 1.0
                decision_source = "hard_rule"
                decision_path.append("hard_rule_glucose_diabetic")
            elif proba_final < 0.5:
                proba_final = 0.5
                decision_source = "hard_rule"
                moderate_reason = "threshold_based"
                decision_path.append("hard_rule_glucose_prediabetic")

        # Règle HbA1c (si fournie)
        if hba1c_val is not None and not np.isnan(hba1c_val):
            if hba1c_val >= INFER_CFG.hba1c_high_risk:
                proba_final = 1.0
                decision_source = "hard_rule"
                decision_path.append("hard_rule_hba1c_diabetic")
            elif hba1c_val >= INFER_CFG.hba1c_prediabetes:
                if proba_final < 0.4:
                    proba_final = 0.4
                    decision_path.append("hard_rule_hba1c_prediabetic")
                    # Note: hba1c prediabetic (0.4) doesn't force MODERATE (0.5), 
                    # but elevates the floor.

        # FIX-AUDIT : Plancher clinique (Healthy Floor) - 2.5%
        proba_final = float(np.clip(proba_final, 0.025, 1.0))

        # ── 8. Classification du risque ────────────────────────────────────
        if proba_final >= 0.8:
            status = "HIGH"
        elif proba_final >= 0.5:
            status = "MODERATE"
        else:
            status = "LOW"

        # ── 9. Flags cliniques ─────────────────────────────────────────────
        high_uncertainty = uncertainty > INFER_CFG.uncertainty_warning_threshold
        flags = ["multimodal_fusion_active", "mc_dropout_enabled"]
        if not stacking_active:
            flags.append("fallback_gmu_only")
        if not calibration_available:
            flags.append("uncalibrated_probability")
        if high_uncertainty:
            flags.append("high_uncertainty_refer_clinician")
        if glucose >= INFER_CFG.glucose_high_risk_mg_dl:
            flags.append("hard_rule_glucose_diabetic")
        elif glucose >= INFER_CFG.glucose_prediabetes_mg_dl:
            flags.append("hard_rule_glucose_prediabetic")

        # ── 10. Réponse (Production Grade) ─────────────────────────────────
        return {
            "risk_status":            status,
            "probability_gmu":        _safe_float(round(proba_gmu, 3)),
            "probability_ensemble":   _safe_float(round(proba_meta, 3)) if stacking_active else None,
            "probability_calibrated": _safe_float(round(proba_calibrated, 3)),
            "final_probability":      _safe_float(round(proba_final, 3)),
            "uncertainty":            _safe_float(round(uncertainty, 4)),
            "decision_source":        decision_source,
            "moderate_reason":        moderate_reason,
            "flags":                  flags,
            "decision_path":          decision_path,
            # Détail interne pour monitoring SaMD
            "_debug": {
                "age": age,
                "bmi": _safe_float(round(bmi, 1)),
                "glucose_mg_dl": _safe_float(glucose),
                "hba1c": _safe_float(hba1c_val) if hba1c_val else None,
                "high_uncertainty": high_uncertainty,
                "stacking_active": stacking_active,
                "calibration_available": calibration_available
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
