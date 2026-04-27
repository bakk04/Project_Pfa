import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, ConfigDict
import uvicorn
import shap

# --- FIX CRITIQUE POUR JOBLIB ---
# 1. Résolution des chemins
curr_dir = os.path.dirname(__file__)
project_root = os.path.abspath(os.path.join(curr_dir, '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import __main__

# 2. Définition des wrappers indispensables
class CalibratedEnsemble:
    _estimator_type = "regressor"
    def __init__(self, base_ensemble, calibrator):
        self.base = base_ensemble
        self.calibrator = calibrator
        self.estimators_ = base_ensemble.estimators_
    def predict(self, X) -> np.ndarray:
        raw = self.base.predict(X)
        return np.clip(self.calibrator.predict(raw), 0.0, 100.0)

# On injecte CalibratedEnsemble dans __main__ ET dans le module courant
__main__.CalibratedEnsemble = CalibratedEnsemble

import types

# 3. Importations des classes du projet et injection dans __main__
try:
    from src.stacking.stacking import ClinicalStackingEnsemble
    from src.pipeline.model_pipeline import ClinicalFeatureEngineer, ClinicalBoundsClipper
    import src.pipeline.model_pipeline as mp
    
    # Compatibilité avec le nom FeatureEngineer
    mp.FeatureEngineer = ClinicalFeatureEngineer
    __main__.FeatureEngineer = ClinicalFeatureEngineer
    
    # On force l'accessibilité pour joblib
    __main__.ClinicalStackingEnsemble = ClinicalStackingEnsemble
    __main__.ClinicalFeatureEngineer = ClinicalFeatureEngineer
    __main__.ClinicalBoundsClipper = ClinicalBoundsClipper
except ImportError as e:
    print(f"[ERREUR] Composants src.* manquants : {e}")

# 4. Fallback pour MAPIE et TFT
try:
    from mapie.regression import MapieRegressor
    __main__.MapieRegressor = MapieRegressor
except ImportError:
    class MapieRegressor:
        def __init__(self, *args, **kwargs): pass
    __main__.MapieRegressor = MapieRegressor
    
    # Empêcher ModuleNotFoundError
    if 'mapie' not in sys.modules:
        sys.modules['mapie'] = types.ModuleType('mapie')
        sys.modules['mapie.regression'] = types.ModuleType('mapie.regression')
        sys.modules['mapie.regression'].MapieRegressor = MapieRegressor

try:
    from src.pipeline.temporal_pipeline import TemporalFusionRegressor, TFTBlock
    import src.pipeline.temporal_pipeline as tp
    
    # FIX: Si torch est absent, TFTBlock est assigné à None ce qui provoque
    # TypeError: NoneType.__new__(X) lors de joblib.load
    if TFTBlock is None:
        class TFTBlock:
            def __init__(self, *args, **kwargs): pass
        tp.TFTBlock = TFTBlock

    __main__.TemporalFusionRegressor = TemporalFusionRegressor
    __main__.TFTBlock = tp.TFTBlock
except ImportError:
    # Dummy classes pour éviter ImportError
    class TFTBlock:
        def __init__(self, *args, **kwargs): pass
    class TemporalFusionRegressor:
        _estimator_type = "regressor"
        def __init__(self, *args, **kwargs): pass
        
    __main__.TFTBlock = TFTBlock
    __main__.TemporalFusionRegressor = TemporalFusionRegressor
    
    if 'src.pipeline.temporal_pipeline' not in sys.modules:
        sys.modules['src.pipeline.temporal_pipeline'] = types.ModuleType('src.pipeline.temporal_pipeline')
    sys.modules['src.pipeline.temporal_pipeline'].TFTBlock = TFTBlock
    sys.modules['src.pipeline.temporal_pipeline'].TemporalFusionRegressor = TemporalFusionRegressor

# --- FIN DU FIX ---

METABOLIC_PIPELINE = None
CONFORMAL_MODEL = None
MODEL_PATH = os.path.join(project_root, 'models', 'metabolic_model.joblib')

@asynccontextmanager
async def lifespan(app: FastAPI):
    global METABOLIC_PIPELINE, CONFORMAL_MODEL
    try:
        if os.path.exists(MODEL_PATH):
            # Utilisation de joblib.load qui va chercher dans __main__
            METABOLIC_PIPELINE = joblib.load(MODEL_PATH)
            print(f"[SaMD INFO] Modèle principal chargé : {MODEL_PATH}")
            
            # Recherche du modèle conforme
            models_dir = os.path.join(project_root, 'models')
            runs = sorted([d for d in os.listdir(models_dir) if os.path.isdir(os.path.join(models_dir, d)) and 'T' in d], reverse=True)
            for run in runs:
                conf_p = os.path.join(models_dir, run, "metabolic_risk_conformal_v3.1.joblib")
                if os.path.exists(conf_p):
                    try:
                        CONFORMAL_MODEL = joblib.load(conf_p)
                        print(f"[SaMD INFO] Modèle Conforme détecté : {conf_p}")
                    except:
                        print(f"[SaMD WARNING] Impossible de charger le modèle conforme à {conf_p}")
                    break
        else:
            print(f"[ERREUR] Modèle introuvable : {MODEL_PATH}")
    except Exception as e:
        print(f"[FATAL] Erreur de chargement des modèles : {str(e)}")
        import traceback
        traceback.print_exc()
    
    yield
    METABOLIC_PIPELINE = None
    CONFORMAL_MODEL = None

app = FastAPI(
    title="SaMD Diabetes Risk API v3.1",
    description="API de prédiction continue du risque diabétique",
    version="3.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _risk_labels(score: float) -> Tuple[str, str]:
    """(libellé FR, clé UI anglaise) — mêmes seuils que l'existant, logique inchangée."""
    if score <= 25:
        return "Faible", "low"
    if score <= 50:
        return "Modéré", "moderate"
    if score <= 75:
        return "Élevé", "high"
    return "Très élevé", "very_high"


class MetabolicInferenceRequest(BaseModel):
    """
    Schéma unifié transport (Edge rPPG + profil). Les champs non utilisés par le pipeline
    (hrv_sdnn, signal_quality_index, bvp_raw) sont acceptés pour traçabilité et ne sont
    pas injectés dans to_dataframe() — la logique ML reste identique.
    """
    model_config = ConfigDict(extra="ignore")

    heart_rate: Optional[float] = Field(None, description="BPM (idéalement hrRaw edge)")
    # Bornes larges côté transport : le gate clinique (inference_gate) reste strict pour le modèle.
    hrv_rmssd: Optional[float] = Field(None, ge=0, le=800)
    hrv_sdnn: float = Field(0.0, ge=0, le=3000)
    signal_quality_index: float = Field(0.0, ge=0, le=1.001)
    steps_per_day: float = Field(..., ge=1, le=40000)
    sleep_minutes: float = Field(..., ge=60, le=720)
    age: float = Field(..., ge=18, le=110)
    gender: int = Field(..., description="0: Homme, 1: Femme")
    bmi: float = Field(..., ge=10, le=60)
    bvp_raw: Optional[List[float]] = Field(None, description="Trace optionnelle — non passée au modèle")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: int) -> int:
        if v not in (0, 1):
            raise ValueError("Le genre doit être 0 ou 1.")
        return v

    def inference_gate(self) -> Tuple[bool, str]:
        """Pré-contrôle aligné sur les bornes du modèle — sans modifier les valeurs edge."""
        if self.heart_rate is None or not (40.0 < self.heart_rate < 200.0):
            return False, "HEART_RATE_OUT_OF_MODEL_RANGE"
        if self.hrv_rmssd is None or not (5.0 < self.hrv_rmssd < 150.0):
            return False, "HRV_RMSSD_OUT_OF_MODEL_RANGE"
        return True, ""

    def to_dataframe(self) -> pd.DataFrame:
        """Identique au contrat historique PatientData → colonnes pipeline."""
        assert self.heart_rate is not None and self.hrv_rmssd is not None
        return pd.DataFrame([{
            "heart_rate_baseline": self.heart_rate,
            "hrv_rmssd_7d_trend": self.hrv_rmssd,
            "sleep_minutes_avg": self.sleep_minutes,
            "activity_steps_avg": self.steps_per_day,
            "age": self.age,
            "weight_bmi_index": self.bmi,
            "gender": self.gender
        }])


# Alias historique pour scripts / clients stricts
PatientData = MetabolicInferenceRequest

@app.get("/health")
async def health_check():
    return {
        "status": "Healthy",
        "model_loaded": METABOLIC_PIPELINE is not None,
        "conformal_active": CONFORMAL_MODEL is not None
    }

@app.post("/predict")
def predict_risk(data: MetabolicInferenceRequest):
    if METABOLIC_PIPELINE is None:
        raise HTTPException(status_code=503, detail="Modèle non disponible.")
    ok_gate, code = data.inference_gate()
    if not ok_gate:
        return {
            "ok": False,
            "skipped": True,
            "code": code,
            "inference_at": datetime.now(timezone.utc).isoformat(),
            "echo": {
                "heart_rate": data.heart_rate,
                "hrv_rmssd": data.hrv_rmssd,
                "hrv_sdnn": data.hrv_sdnn,
                "signal_quality_index": data.signal_quality_index,
            },
        }
    try:
        X = data.to_dataframe()
        risk_score = float(METABOLIC_PIPELINE.predict(X)[0])
        lower, upper = risk_score - 4.4, risk_score + 4.4

        if CONFORMAL_MODEL is not None:
            try:
                res = CONFORMAL_MODEL.predict(X, alpha=0.05)
                pis = res[1] if isinstance(res, tuple) else res
                lower = float(pis[0, 0, 0]) if pis.ndim == 3 else float(pis[0, 0])
                upper = float(pis[0, 1, 0]) if pis.ndim == 3 else float(pis[0, 1])
            except Exception:
                pass

        cat_fr, cat_key = _risk_labels(risk_score)
        lo = round(max(0.0, lower), 2)
        hi = round(min(100.0, upper), 2)
        return {
            "ok": True,
            "skipped": False,
            "risk_score": round(risk_score, 2),
            "confidence_interval_95": {"lower": lo, "upper": hi},
            "ci_width": round(max(0.0, hi - lo), 2),
            "category": cat_fr,
            "risk_category_key": cat_key,
            "inference_at": datetime.now(timezone.utc).isoformat(),
            "echo": {
                "heart_rate": data.heart_rate,
                "hrv_rmssd": data.hrv_rmssd,
                "hrv_sdnn": data.hrv_sdnn,
                "signal_quality_index": data.signal_quality_index,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur d'inférence : {str(e)}")

@app.post("/explain")
def explain_risk(data: MetabolicInferenceRequest):
    if METABOLIC_PIPELINE is None:
        raise HTTPException(status_code=503, detail="Pipeline inaccessible.")
    ok_gate, code = data.inference_gate()
    if not ok_gate:
        raise HTTPException(status_code=400, detail=f"Jeu de données non inférable : {code}")
    try:
        X = data.to_dataframe()
        base_learner_pipeline = METABOLIC_PIPELINE.base.estimators_[0][1]
        preprocessor = base_learner_pipeline[:-1]
        gbm_model = base_learner_pipeline.named_steps["estimator"]
        X_transformed = preprocessor.transform(X)
        
        feature_engineer = preprocessor.named_steps.get("feature_engineer")
        if hasattr(feature_engineer, "get_feature_names_out"):
            feature_names = feature_engineer.get_feature_names_out()
        else:
            feature_names = list(X.columns)

        explainer = shap.TreeExplainer(gbm_model)
        shap_values = explainer.shap_values(X_transformed)
        vals = shap_values[0] if isinstance(shap_values, list) else shap_values
        row_vals = vals[0] if vals.ndim > 1 else vals
        
        return {
            "shap_values": {name: round(float(val), 4) for name, val in zip(feature_names, row_vals)},
            "base_value": float(explainer.expected_value)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Échec SHAP : {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
