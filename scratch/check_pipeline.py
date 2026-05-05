import sys
import os
sys.path.insert(0, os.getcwd())
from src.pipeline.pipeline import build_full_pipeline
from config import PATHS

nhanes_csv = os.path.join("data", "nhanes_clinical_cohort.csv")
pipeline_data = build_full_pipeline(nhanes_csv)
X = pipeline_data["X_clinical_all"]
print(f"X_clinical_all shape: {X.shape}")
print(f"n_clinical: {pipeline_data['n_clinical']}")
