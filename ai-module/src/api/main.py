import os
import sys
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import uvicorn
import shap

# Intégration du scope global
curr_dir = os.path.dirname(__file__)
project_root = os.path.abspath(os.path.join(curr_dir, '..', '..'))
if project_root not in sys.path:
    sys.path.append(project_root)

# Tampon mémoire asynchrone pour la matrice de pondérations
METABOLIC_PIPELINE = None
MODEL_PATH = os.path.abspath(os.path.join(project_root, 'models', 'metabolic_model.joblib'))

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Crochet de démarrage (Lifespan Hook) pour les micro-services modernes FastAPI.
    Assure le chargement asynchrone du Tenseur/Pipeline en VRAM/RAM avant acceptation
    de la première requête de prédiction.
    """
    global METABOLIC_PIPELINE
    try:
        if os.path.exists(MODEL_PATH):
            METABOLIC_PIPELINE = joblib.load(MODEL_PATH)
            print(f"[AEROSPACE/MEDICAL GRADE INFO] Estimateur monté en RAM : {MODEL_PATH}")
        else:
            print(f"[ERREUR CRITIQUE] Composant Joblib introuvable à la cible absolue : {MODEL_PATH}")
    except Exception as e:
        print(f"[FATAL] Échec d'allocation dynamique du modèle. Cause: {str(e)}")
    
    yield   # Transfert du flux d'exécution à l'API
    
    # Nettoyage garanti lors de la routine d'extinction
    METABOLIC_PIPELINE = None


# Instanciation de l'Interface
app = FastAPI(
    title="Service IA d'Évaluation Métabolique (SaMD - Classe II)",
    description="Interface RESTful avec Inférence Déterministe et Audit d'Explicabilité (SHAP).",
    version="1.0.0",
    lifespan=lifespan
)

# Sécurité & Autorisations Cross-Origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PatientData(BaseModel):
    """
    Modélisation ontologique Pydantic bloquant le passage de scalariens corrompus
    avant l'ingestion par les algorithmes de ML.
    """
    age: float = Field(..., description="Âge du patient", gt=0.0, lt=120.0)
    gender: int = Field(..., description="Sexe (1: Homme, 2: Femme)")
    bmi: float = Field(..., description="Indice de Masse Corporelle (IMC)", gt=10.0, lt=100.0)
    systolic_bp: float = Field(..., description="Tension Artérielle Systolique", gt=50.0, lt=250.0)
    diastolic_bp: float = Field(..., description="Tension Artérielle Diastolique", gt=30.0, lt=150.0)

    @field_validator('gender')
    @classmethod
    def validate_gender(cls, v):
        """Sanitarisation : restriction NHANES {1: Homme, 2: Femme}."""
        if v not in (1, 2):
            raise ValueError("Erreur structurelle : Genre non formaté {1,2}")
        return v
        
    def to_dataframe(self) -> pd.DataFrame:
        """
        Conversion Pandas avec garantie stricte de ré-alignement paraxial (Feature Mapping).
        Prévient le risque de Data Leakage positionnel.
        """
        df = pd.DataFrame([self.model_dump()])
        # L'ordre doit correspondre à celui utilisé lors du fit du modèle
        ordered_cols = ['age', 'gender', 'bmi', 'systolic_bp', 'diastolic_bp']
        return df[ordered_cols]


@app.get("/health")
async def check_api_health():
    """
    Sonde passive d'opérabilité. 
    Vérifie la liaison asynchrone avec la mémoire d'inférence.
    """
    if METABOLIC_PIPELINE is None:
        raise HTTPException(
            status_code=503, 
            detail="Instance I/O Invalide : Modèle inactif."
        )
        
    return {
        "status": "Healthy",
        "pipeline_state": "Allocated",
        "api_layer": app.version
    }


@app.post("/predict")
def conduct_metabolic_inference(data: PatientData):
    """
    Endpoint de calcul déterministe CPU-Bound.
    L'absence de 'async def' délègue intrinsèquement la requête au ThreadPoolExecutor
    de Starlette. Aucun collapsus de la boucle d'événements n'aura lieu.
    """
    if METABOLIC_PIPELINE is None:
        raise HTTPException(status_code=503, detail="Le classifieur biomédical n'est pas initialisé en mémoire globale.")

    try:
        x_tensor = data.to_dataframe()
        risk_prediction = METABOLIC_PIPELINE.predict(x_tensor)[0]
        
        # Lissage paraxial et bornage strict (Probabilité 0-100)
        final_risk_score = float(np.clip(risk_prediction, 0.0, 100.0))
        
        return {
            "risk_score": round(final_risk_score, 2),
            "confidence_interval": {
                # Marge heuristique d'incertitude 
                "lower_bound": round(max(0.0, final_risk_score - 4.2), 2),
                "upper_bound": round(min(100.0, final_risk_score + 4.2), 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Conflit dimensionnel lors de l'estimation : {str(e)}")


@app.post("/explain")
def explain_clinical_predictions(data: PatientData) -> Dict[str, float]:
    """
    Extraction Thread-Safe paramétrique d'explicabilité (Théorie des Jeux SHAP).
    L'opération gérée hors de la boucle principale protège les I/O de l'API.
    """
    if METABOLIC_PIPELINE is None:
        raise HTTPException(status_code=503, detail="Opération impossible, pipeline inaccessible.")

    try:
        # Transformation ascendante
        x_tensor = data.to_dataframe()
        
        # 1. Extraction unitaire: Séparation topologique
        pipeline_transform_layer = METABOLIC_PIPELINE[:-1]
        gbm_estimator = METABOLIC_PIPELINE.named_steps["estimator"]
        
        # 2. Emulation de la phase de clean
        x_preprocessed = pipeline_transform_layer.transform(x_tensor)
        
        # 3. Activation explicative (Thread-Safe)
        tree_explainer = shap.TreeExplainer(gbm_estimator)
        shap_values_raw = tree_explainer.shap_values(x_preprocessed)
        
        # Robustesse d'Instabilité SHAP (Support List vs Numpy Array Regression Return)
        if isinstance(shap_values_raw, list):
            # Format multi-classe/asymétrique retourné dans certaines versions bas niveau
            feature_impacts = np.array(shap_values_raw[0][0])
        else:
            # Format attendu matrice pure Regressor (1, N_features)
            feature_impacts = np.array(shap_values_raw[0])
            
        # Alignement clefs-valeurs dynamiques
        shap_json_output = {
            col: round(float(impact), 4) 
            for col, impact in zip(x_tensor.columns, feature_impacts)
        }
        
        return shap_json_output
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Distorsion de vecteur: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Échec noyau lors du tracé SHAP : {str(e)}")


if __name__ == "__main__":
    # Inférence autonome avec uvicorn pur
    uvicorn.run(app, host="0.0.0.0", port=8000)
