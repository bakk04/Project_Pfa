import os
import sys
import torch

# Ensure project root is in path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.training.train_base import main as train_base_main
from src.stacking.stacking import run_stacking_pipeline

def run_full_retrain():
    print("\n" + "#"*60)
    print("### DÉBUT DU RE-TRAINING COMPLET DU SYSTÈME (GMU + STACKING) ###")
    print("#"*60 + "\n")

    # 1. Train Base GMU Model and get OOF embeddings
    print(">>> ÉTAPE 1 : Entraînement du modèle GMU et extraction OOF...")
    train_results = train_base_main()
    
    # 2. Train Stacking Ensemble
    print("\n>>> ÉTAPE 2 : Entraînement du Stacking Ensemble (XGB, LGBM, Meta-Learner)...")
    stacking_results = run_stacking_pipeline(train_results)

    print("\n" + "#"*60)
    print("### SYSTÈME RÉ-ENTRAÎNÉ AVEC SUCCÈS ###")
    print(f"Meilleur AUC GMU      : {train_results['best_auc']:.4f}")
    print(f"AUC Final (Ensemble)  : {stacking_results['final_results']['test_auc_ensemble']:.4f}")
    print("#"*60 + "\n")

if __name__ == "__main__":
    run_full_retrain()
