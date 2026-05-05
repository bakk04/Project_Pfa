# =============================================================================
# colab_launcher.py — Interface de Lancement Google Colab (Production SaMD)
# =============================================================================
# Ce script contient les cellules prêtes à l'emploi pour un notebook Colab.
# Il assure le montage sécurisé du Drive et l'exécution du pipeline SOTA.
# =============================================================================

# ╔══════════════════════════════════════════════════════════╗
# ║  CELLULE 1 — Configuration Environnement & Drive         ║
# ╚══════════════════════════════════════════════════════════╝
"""
import os
import sys
from google.colab import drive

# 1. Montage du Google Drive
drive.mount('/content/drive')

# 2. Définition du répertoire de travail (Adapter si nécessaire)
PROJECT_PATH = '/content/drive/MyDrive/diabetes_model'
os.makedirs(PROJECT_PATH, exist_ok=True)
sys.path.insert(0, PROJECT_PATH)

# 3. Installation des dépendances critiques
!pip install pytorch-tabnet optuna lightgbm xgboost --quiet
"""

# ╔══════════════════════════════════════════════════════════╗
# ║  CELLULE 2 — Lancement de l'Entraînement Base (GMU)      ║
# ╚══════════════════════════════════════════════════════════╝
"""
import torch
from src.training.train_base import main as train_main

# Vérification du device (GPU fortement recommandé pour SaMD)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Utilisation du Device : {device}")

# Exécution du pipeline d'entraînement deep learning
train_output = train_main()
"""

# ╔══════════════════════════════════════════════════════════╗
# ║  CELLULE 3 — Stacking, Calibration & Validation Finale  ║
# ╚══════════════════════════════════════════════════════════╝
"""
from src.stacking.stacking import run_stacking_pipeline

# Exécution de la couche d'ensemble, calibration isotonique et hard rules
stack_output = run_stacking_pipeline(train_output)

print("\n" + "="*60)
print("  PROCESSUS DE CERTIFICATION TECHNIQUE TERMINÉ")
print("="*60)
"""

# ╔══════════════════════════════════════════════════════════╗
# ║  CELLULE 4 — Diagnostic & Résumé de Configuration       ║
# ╚══════════════════════════════════════════════════════════╝
"""
from config import print_config_summary
print_config_summary()
"""
