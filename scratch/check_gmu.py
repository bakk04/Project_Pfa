import torch
import os
import sys

project_root = r"c:\Users\dell\Pictures\med-ai-system\diabetes_model"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.models.diabetes_model_net import DiabetesMultimodalNet
from config import PATHS, DEVICE

n_clin = 11
model = DiabetesMultimodalNet(n_clinical_features=n_clin)
try:
    model.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location=DEVICE))
    print("GMU model loaded successfully with 11 features")
except Exception as e:
    print(f"Failed to load GMU model with 11 features: {e}")

n_clin = 12
model = DiabetesMultimodalNet(n_clinical_features=n_clin)
try:
    model.load_state_dict(torch.load(PATHS.gmu_best_weights, map_location=DEVICE))
    print("GMU model loaded successfully with 12 features")
except Exception as e:
    print(f"Failed to load GMU model with 12 features: {e}")
