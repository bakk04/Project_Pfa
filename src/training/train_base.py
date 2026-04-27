# =============================================================================
# train_base.py — Entraînement PyTorch du Réseau GMU (Modèle Profond)
# =============================================================================
# Ce script gère :
#   1. La boucle d'entraînement complète (epochs, batches)
#   2. La loss composite : BCE + régularisation TabNet (entropy)
#   3. Le scheduler CosineAnnealingWarmRestarts avec warmup linéaire
#   4. L'early stopping sur AUC de validation
#   5. La sauvegarde des meilleurs poids sur Google Drive
#   6. L'extraction des embeddings OOF pour le stacking
#   7. Le logging des métriques (AUC, F1, ECE, Loss)
# =============================================================================

import os
import time
import json
import pickle
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts, LinearLR, SequentialLR
from torch.utils.data import DataLoader
from sklearn.metrics import (
    roc_auc_score, f1_score, average_precision_score,
    confusion_matrix, classification_report, brier_score_loss
)
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings("ignore")

# Imports du projet
from config import TRAIN_CFG, INFER_CFG, PATHS, DEVICE, EMBED
from models import DiabetesMultimodalNet, MCDropoutInference
from pipeline import (
    build_full_pipeline, OOFCrossValidator,
    build_dataloaders, DiabetesMultimodalDataset
)


# =============================================================================
# 1. MÉTRIQUES D'ÉVALUATION
# =============================================================================

def expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    """
    Expected Calibration Error (ECE) — mesure la calibration probabiliste.
    ECE ≈ 0 : les probabilités reflètent parfaitement la fréquence réelle.
    """
    bins      = np.linspace(0.0, 1.0, n_bins + 1)
    bin_lowers = bins[:-1]
    bin_uppers = bins[1:]
    ece = 0.0
    for lb, ub in zip(bin_lowers, bin_uppers):
        mask = (y_prob >= lb) & (y_prob < ub)
        if mask.sum() == 0:
            continue
        avg_conf = y_prob[mask].mean()
        avg_acc  = y_true[mask].mean()
        ece     += (mask.sum() / len(y_true)) * abs(avg_acc - avg_conf)
    return float(ece)


def compute_metrics(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float = INFER_CFG.decision_threshold
) -> Dict[str, float]:
    """Calcule toutes les métriques de classification."""
    y_pred = (y_prob >= threshold).astype(int)
    cm     = confusion_matrix(y_true, y_pred)

    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)
    specificity = tn / (tn + fp + 1e-8)
    sensitivity = tp / (tp + fn + 1e-8)  # Recall / Sensibilité

    return {
        "auc"         : roc_auc_score(y_true, y_prob),
        "auprc"       : average_precision_score(y_true, y_prob),
        "f1"          : f1_score(y_true, y_pred, zero_division=0),
        "sensitivity" : sensitivity,
        "specificity" : specificity,
        "brier"       : brier_score_loss(y_true, y_prob),
        "ece"         : expected_calibration_error(y_true, y_prob),
    }


# =============================================================================
# 2. LOSS COMPOSITE (BCE + Régularisation TabNet)
# =============================================================================

class CompositeLoss(nn.Module):
    """
    Loss = BCE_with_logits + λ_entropy * TabNet_entropy_loss
    La régularisation d'entropie encourage la sparsité dans la sélection de features.
    """

    def __init__(self, pos_weight: Optional[torch.Tensor] = None, entropy_weight: float = 1e-3):
        super().__init__()
        self.bce          = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
        self.entropy_weight = entropy_weight

    def forward(
        self,
        logit: torch.Tensor,
        target: torch.Tensor,
        entropy_loss: torch.Tensor,
    ) -> Tuple[torch.Tensor, float, float]:
        bce_loss  = self.bce(logit, target)
        total     = bce_loss + self.entropy_weight * entropy_loss
        return total, bce_loss.item(), (self.entropy_weight * entropy_loss).item()


# =============================================================================
# 3. EARLY STOPPING
# =============================================================================

class EarlyStopping:
    """
    Arrêt anticipé sur la métrique de validation (typiquement AUC).
    Sauvegarde les meilleurs poids automatiquement.
    """

    def __init__(
        self,
        patience: int   = TRAIN_CFG.patience,
        mode: str       = TRAIN_CFG.mode,
        delta: float    = 1e-5,
        save_path: str  = PATHS.gmu_best_weights,
    ):
        self.patience   = patience
        self.mode       = mode
        self.delta      = delta
        self.save_path  = save_path
        self.counter    = 0
        self.best_score = None
        self.stop       = False

    def __call__(self, score: float, model: nn.Module) -> bool:
        """Retourne True si l'entraînement doit s'arrêter."""
        if self.best_score is None:
            self.best_score = score
            self._save(model)
            return False

        if self.mode == "max":
            improved = score > self.best_score + self.delta
        else:
            improved = score < self.best_score - self.delta

        if improved:
            self.best_score = score
            self._save(model)
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.stop = True

        return self.stop

    def _save(self, model: nn.Module):
        torch.save(model.state_dict(), self.save_path)
        print(f"  💾 Meilleurs poids sauvegardés → {self.save_path} (score: {self.best_score:.4f})")


# =============================================================================
# 4. SCHEDULER AVEC WARMUP LINÉAIRE
# =============================================================================

def build_scheduler(
    optimizer: optim.Optimizer,
    warmup_epochs: int  = TRAIN_CFG.warmup_epochs,
    T_0: int            = TRAIN_CFG.T_0,
    T_mult: int         = TRAIN_CFG.T_mult,
    eta_min: float      = TRAIN_CFG.eta_min,
    steps_per_epoch: int = 1,
) -> optim.lr_scheduler._LRScheduler:
    """
    Combine un warmup linéaire avec CosineAnnealingWarmRestarts.
    Phase 1 : LR augmente linéairement de 0 → lr_max sur warmup_epochs
    Phase 2 : CosineAnnealingWarmRestarts classique
    """
    warmup = LinearLR(
        optimizer,
        start_factor=0.01,
        end_factor=1.0,
        total_iters=warmup_epochs,
    )
    cosine = CosineAnnealingWarmRestarts(
        optimizer,
        T_0=T_0,
        T_mult=T_mult,
        eta_min=eta_min,
    )
    scheduler = SequentialLR(
        optimizer,
        schedulers=[warmup, cosine],
        milestones=[warmup_epochs],
    )
    return scheduler


# =============================================================================
# 5. BOUCLE D'ENTRAÎNEMENT D'UNE EPOCH
# =============================================================================

def train_one_epoch(
    model: DiabetesMultimodalNet,
    loader: DataLoader,
    optimizer: optim.Optimizer,
    loss_fn: CompositeLoss,
    device: torch.device,
    grad_clip: float = TRAIN_CFG.grad_clip,
    scheduler: Optional[object] = None,
) -> Dict[str, float]:
    """
    Exécute une epoch complète d'entraînement.
    Retourne les métriques moyennes de l'epoch.
    """
    model.train()
    total_loss   = 0.0
    total_bce    = 0.0
    total_entropy = 0.0
    all_logits   = []
    all_labels   = []
    n_batches    = len(loader)

    for batch_idx, batch in enumerate(loader):
        # -- Transfert sur le device --
        clinical  = batch["clinical"].to(device)
        temporal  = batch["temporal"].to(device)
        rppg      = batch["rppg"].to(device)
        temp_mask = batch["temp_mask"].to(device)
        labels    = batch["label"].to(device)

        # -- Forward pass --
        optimizer.zero_grad()
        out    = model(clinical, temporal, rppg, temp_mask)
        logit  = out["logit"]
        ent    = out["entropy_loss"]

        # -- Loss --
        loss, bce_val, ent_val = loss_fn(logit, labels, ent)

        # -- Backward pass --
        loss.backward()

        # Gradient clipping (stabilité entraînement Transformer)
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=grad_clip)

        optimizer.step()

        # Accumulation des métriques
        total_loss    += loss.item()
        total_bce     += bce_val
        total_entropy += ent_val

        # Collecte des prédictions (pour AUC epoch)
        all_logits.extend(logit.detach().cpu().numpy().tolist())
        all_labels.extend(labels.cpu().numpy().tolist())

        # Log intermédiaire (tous les N batches)
        if (batch_idx + 1) % TRAIN_CFG.log_every_n_steps == 0:
            print(f"    Batch {batch_idx+1}/{n_batches} | "
                  f"Loss: {loss.item():.4f} | BCE: {bce_val:.4f} | Ent: {ent_val:.4f}")

    # Métriques de l'epoch
    y_prob = torch.sigmoid(torch.tensor(all_logits)).numpy()
    y_true = np.array(all_labels)

    try:
        auc = roc_auc_score(y_true, y_prob)
    except Exception:
        auc = 0.5  # Cas dégénéré (tous même label dans le batch)

    return {
        "loss"    : total_loss / n_batches,
        "bce"     : total_bce  / n_batches,
        "entropy" : total_entropy / n_batches,
        "auc"     : auc,
    }


# =============================================================================
# 6. BOUCLE DE VALIDATION
# =============================================================================

@torch.no_grad()
def validate(
    model: DiabetesMultimodalNet,
    loader: DataLoader,
    loss_fn: CompositeLoss,
    device: torch.device,
) -> Dict[str, float]:
    """
    Évalue le modèle sur le set de validation.
    Utilise le mode déterministe (MCDropout désactivé conceptuellement,
    mais pour validation on fait une seule passe pour la vitesse).
    """
    model.eval()
    total_loss  = 0.0
    all_logits  = []
    all_labels  = []
    all_glucose = []

    for batch in loader:
        clinical  = batch["clinical"].to(device)
        temporal  = batch["temporal"].to(device)
        rppg      = batch["rppg"].to(device)
        temp_mask = batch["temp_mask"].to(device)
        labels    = batch["label"].to(device)
        glucose   = batch["glucose"]

        out   = model(clinical, temporal, rppg, temp_mask)
        logit = out["logit"]
        ent   = out["entropy_loss"]

        loss, _, _ = loss_fn(logit, labels, ent)
        total_loss += loss.item()

        all_logits.extend(logit.cpu().numpy().tolist())
        all_labels.extend(labels.cpu().numpy().tolist())
        all_glucose.extend(glucose.numpy().tolist())

    y_prob  = torch.sigmoid(torch.tensor(all_logits)).numpy()
    y_true  = np.array(all_labels)
    glucose = np.array(all_glucose)

    metrics = compute_metrics(y_true, y_prob)
    metrics["loss"] = total_loss / len(loader)

    # Compter les corrections par hard rules cliniques
    hard_rule_mask = glucose >= INFER_CFG.glucose_high_risk_mg_dl
    metrics["hard_rule_activations"] = int(hard_rule_mask.sum())

    return metrics, y_prob, y_true


# =============================================================================
# 7. ENTRAÎNEMENT PRINCIPAL DU MODÈLE GMU
# =============================================================================

def train_gmu_model(
    pipeline_data: Dict,
    n_clinical_features: int,
    epochs: int          = TRAIN_CFG.epochs,
    batch_size: int      = TRAIN_CFG.batch_size,
    lr: float            = TRAIN_CFG.lr,
    weight_decay: float  = TRAIN_CFG.weight_decay,
    device: torch.device = DEVICE,
    save_path: str       = PATHS.gmu_best_weights,
    entropy_weight: float = 1e-3,
) -> Dict:
    """
    Entraîne le réseau GMU complet de bout en bout.

    Args:
        pipeline_data     : Dictionnaire retourné par build_full_pipeline()
        n_clinical_features: Nombre de features cliniques après preprocessing
        ...

    Retourne :
        {
            'model'       : modèle entraîné
            'history'     : dict des métriques par epoch
            'best_auc'    : meilleur AUC de validation
        }
    """
    print("\n" + "="*60)
    print("  ENTRAÎNEMENT DU RÉSEAU GMU MULTIMODAL")
    print("="*60)

    # --- DataLoaders ---
    loaders = pipeline_data["loaders"]
    train_loader = loaders["train"]
    val_loader   = loaders["val"]

    # --- Modèle ---
    model = DiabetesMultimodalNet(
        n_clinical_features=n_clinical_features,
        return_embeddings=True,
    ).to(device)

    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Paramètres entraînables : {n_params:,}")

    # --- Loss : pondération de classe pour le déséquilibre ---
    y_train = pipeline_data["labels_all"][pipeline_data["idx_train"]]
    n_pos   = y_train.sum()
    n_neg   = len(y_train) - n_pos
    pos_weight = torch.tensor([n_neg / (n_pos + 1e-8)], dtype=torch.float32).to(device)
    print(f"Classe 0 (non-diabétique) : {n_neg} | Classe 1 (diabétique) : {n_pos}")
    print(f"pos_weight BCE            : {pos_weight.item():.2f}")

    loss_fn = CompositeLoss(pos_weight=pos_weight, entropy_weight=entropy_weight)

    # --- Optimiseur ---
    optimizer = optim.AdamW(
        model.parameters(),
        lr=lr,
        weight_decay=weight_decay,
        betas=TRAIN_CFG.betas,
    )

    # --- Scheduler ---
    scheduler = build_scheduler(
        optimizer,
        warmup_epochs=TRAIN_CFG.warmup_epochs,
        T_0=TRAIN_CFG.T_0,
        T_mult=TRAIN_CFG.T_mult,
        eta_min=TRAIN_CFG.eta_min,
    )

    # --- Early Stopping ---
    early_stopper = EarlyStopping(
        patience=TRAIN_CFG.patience,
        mode=TRAIN_CFG.mode,
        save_path=save_path,
    )

    # --- Historique ---
    history = {
        "train_loss": [], "train_auc": [],
        "val_loss":   [], "val_auc":   [],
        "val_auprc":  [], "val_f1":    [],
        "val_sensitivity": [], "val_specificity": [],
        "val_ece":    [], "lr":         [],
    }

    print(f"\nDébut entraînement : {epochs} epochs max | Device : {device}")
    print("-"*60)

    t_start = time.time()

    for epoch in range(1, epochs + 1):
        t_epoch = time.time()
        print(f"\n[Epoch {epoch}/{epochs}]")

        # --- Train ---
        train_metrics = train_one_epoch(
            model, train_loader, optimizer, loss_fn, device
        )

        # --- Validation ---
        val_metrics, val_prob, val_true = validate(
            model, val_loader, loss_fn, device
        )

        # --- Scheduler step ---
        scheduler.step()
        current_lr = optimizer.param_groups[0]["lr"]

        # --- Logging ---
        epoch_time = time.time() - t_epoch
        print(f"  Train → Loss: {train_metrics['loss']:.4f} | AUC: {train_metrics['auc']:.4f}")
        print(f"  Val   → Loss: {val_metrics['loss']:.4f}  | AUC: {val_metrics['auc']:.4f} | "
              f"AUPRC: {val_metrics['auprc']:.4f} | F1: {val_metrics['f1']:.4f}")
        print(f"  Sens: {val_metrics['sensitivity']:.3f} | Spec: {val_metrics['specificity']:.3f} | "
              f"ECE: {val_metrics['ece']:.4f} | "
              f"Hard Rules: {val_metrics['hard_rule_activations']} | "
              f"LR: {current_lr:.2e} | {epoch_time:.1f}s")

        # Mise à jour de l'historique
        history["train_loss"].append(train_metrics["loss"])
        history["train_auc"].append(train_metrics["auc"])
        history["val_loss"].append(val_metrics["loss"])
        history["val_auc"].append(val_metrics["auc"])
        history["val_auprc"].append(val_metrics["auprc"])
        history["val_f1"].append(val_metrics["f1"])
        history["val_sensitivity"].append(val_metrics["sensitivity"])
        history["val_specificity"].append(val_metrics["specificity"])
        history["val_ece"].append(val_metrics["ece"])
        history["lr"].append(current_lr)

        # --- Early Stopping ---
        if early_stopper(val_metrics["auc"], model):
            print(f"\n⚠️  Early stopping déclenché à l'epoch {epoch}.")
            break

    total_time = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"  Entraînement terminé en {total_time/60:.1f} min")
    print(f"  Meilleur AUC val : {early_stopper.best_score:.4f}")
    print(f"{'='*60}\n")

    # Charger les meilleurs poids
    model.load_state_dict(torch.load(save_path, map_location=device))
    model.eval()

    # Sauvegarde de l'historique
    history_path = os.path.join(PATHS.logs, "gmu_history.json")
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    print(f"📊 Historique sauvegardé → {history_path}")

    return {
        "model"    : model,
        "history"  : history,
        "best_auc" : early_stopper.best_score,
    }


# =============================================================================
# 8. EXTRACTION DES EMBEDDINGS OOF (pour le Stacking)
# =============================================================================

def extract_oof_embeddings(
    pipeline_data: Dict,
    n_clinical_features: int,
    device: torch.device = DEVICE,
    n_folds: int         = TRAIN_CFG.n_folds,
    epochs_per_fold: int = 30,   # Moins d'epochs par fold (entraînement OOF)
    lr: float            = TRAIN_CFG.lr,
) -> Dict[str, np.ndarray]:
    """
    Entraîne le modèle GMU sur chaque fold et extrait les embeddings OOF.

    Pour chaque fold k :
      1. Entraîne le GMU sur les folds 1..K-1 (hors fold k)
      2. Prédit sur le fold k → embedding [n_val_k, 256] + proba [n_val_k]

    Retourne :
    {
        'embeddings_oof' : [N_train, 256] — embeddings pour le méta-learner
        'probas_oof'     : [N_train]      — probabilités OOF du GMU
        'labels_oof'     : [N_train]      — labels vrais
    }
    """
    print("\n" + "="*60)
    print("  EXTRACTION DES EMBEDDINGS OOF (GMU)")
    print("="*60)

    oof_cv     = OOFCrossValidator(n_folds=n_folds)
    fold_data  = oof_cv.get_oof_datasets(pipeline_data)

    all_embeddings = []
    all_probas     = []
    all_labels     = []
    all_indices    = []

    for fold_idx, ds_train_fold, ds_val_fold in fold_data:
        print(f"\n--- Fold {fold_idx+1}/{n_folds} ---")

        # DataLoaders pour ce fold
        fold_loaders = build_dataloaders(
            ds_train_fold, ds_val_fold,
            batch_size=TRAIN_CFG.batch_size,
            num_workers=TRAIN_CFG.num_workers,
        )

        # Modèle frais pour ce fold
        model_fold = DiabetesMultimodalNet(
            n_clinical_features=n_clinical_features,
            return_embeddings=True,
        ).to(device)

        # Loss avec pondération de classe
        y_fold_train = ds_train_fold.labels.numpy()
        n_pos = y_fold_train.sum()
        n_neg = len(y_fold_train) - n_pos
        pos_w = torch.tensor([n_neg / (n_pos + 1e-8)]).to(device)
        loss_fn = CompositeLoss(pos_weight=pos_w)

        optimizer = optim.AdamW(model_fold.parameters(), lr=lr, weight_decay=TRAIN_CFG.weight_decay)
        scheduler = build_scheduler(optimizer, warmup_epochs=3, T_0=10)

        early_stopper = EarlyStopping(
            patience=5,
            save_path=os.path.join(PATHS.checkpoints, f"gmu_fold{fold_idx+1}.pt"),
        )

        # Entraînement du fold
        for epoch in range(1, epochs_per_fold + 1):
            train_one_epoch(model_fold, fold_loaders["train"], optimizer, loss_fn, device)
            scheduler.step()
            val_m, _, _ = validate(model_fold, fold_loaders["val"], loss_fn, device)
            if early_stopper(val_m["auc"], model_fold):
                break

        print(f"  Fold {fold_idx+1} meilleur AUC val : {early_stopper.best_score:.4f}")

        # Charger les meilleurs poids du fold
        model_fold.load_state_dict(
            torch.load(os.path.join(PATHS.checkpoints, f"gmu_fold{fold_idx+1}.pt"),
                       map_location=device)
        )
        model_fold.eval()

        # --- Extraction des embeddings sur le fold de validation ---
        fold_embeddings = []
        fold_probas     = []
        fold_labels     = []

        val_loader_oof = DataLoader(
            ds_val_fold, batch_size=128, shuffle=False,
            num_workers=TRAIN_CFG.num_workers, pin_memory=True
        )

        with torch.no_grad():
            for batch in val_loader_oof:
                clinical  = batch["clinical"].to(device)
                temporal  = batch["temporal"].to(device)
                rppg      = batch["rppg"].to(device)
                temp_mask = batch["temp_mask"].to(device)

                out   = model_fold(clinical, temporal, rppg, temp_mask)
                logit = out["logit"]
                emb   = out["embedding"]
                prob  = torch.sigmoid(logit)

                fold_embeddings.append(emb.cpu().numpy())
                fold_probas.append(prob.cpu().numpy())
                fold_labels.append(batch["label"].numpy())

        fold_embeddings = np.vstack(fold_embeddings)
        fold_probas     = np.concatenate(fold_probas)
        fold_labels     = np.concatenate(fold_labels)

        all_embeddings.append(fold_embeddings)
        all_probas.append(fold_probas)
        all_labels.append(fold_labels)

        oof_auc = roc_auc_score(fold_labels, fold_probas)
        print(f"  OOF AUC Fold {fold_idx+1} : {oof_auc:.4f}")

    # Concaténation de tous les folds
    oof_embeddings = np.vstack(all_embeddings)    # [N_train, 256]
    oof_probas     = np.concatenate(all_probas)   # [N_train]
    oof_labels     = np.concatenate(all_labels)   # [N_train]

    global_oof_auc = roc_auc_score(oof_labels, oof_probas)
    print(f"\n✅ OOF AUC Global (GMU) : {global_oof_auc:.4f}")
    print(f"   Embeddings OOF shape : {oof_embeddings.shape}")

    # Sauvegarde
    oof_path = os.path.join(PATHS.oof_preds, "gmu_oof.pkl")
    with open(oof_path, "wb") as f:
        pickle.dump({
            "embeddings": oof_embeddings,
            "probas"    : oof_probas,
            "labels"    : oof_labels,
        }, f)
    print(f"💾 Embeddings OOF sauvegardés → {oof_path}")

    return {
        "embeddings_oof": oof_embeddings,
        "probas_oof"    : oof_probas,
        "labels_oof"    : oof_labels,
    }


# =============================================================================
# 9. ÉVALUATION FINALE SUR LE SET DE TEST
# =============================================================================

def evaluate_test_set(
    model: DiabetesMultimodalNet,
    test_loader: DataLoader,
    device: torch.device = DEVICE,
    mc_passes: int       = INFER_CFG.mc_dropout_passes,
) -> Dict:
    """
    Évaluation finale avec Monte Carlo Dropout sur le set de test.
    """
    print("\n" + "="*60)
    print("  ÉVALUATION FINALE (MC DROPOUT) SUR LE SET DE TEST")
    print("="*60)

    mc_infer = MCDropoutInference(model, T=mc_passes)

    all_mean_prob = []
    all_std_prob  = []
    all_labels    = []
    all_glucose   = []

    for batch in test_loader:
        clinical  = batch["clinical"]
        temporal  = batch["temporal"]
        rppg      = batch["rppg"]
        temp_mask = batch["temp_mask"]
        labels    = batch["label"].numpy()
        glucose   = batch["glucose"].numpy()

        mc_out = mc_infer.predict(clinical, temporal, rppg, temp_mask, device=device)

        all_mean_prob.extend(mc_out["mean_proba"].cpu().numpy().tolist())
        all_std_prob.extend(mc_out["std_proba"].cpu().numpy().tolist())
        all_labels.extend(labels.tolist())
        all_glucose.extend(glucose.tolist())

    y_prob  = np.array(all_mean_prob)
    y_std   = np.array(all_std_prob)
    y_true  = np.array(all_labels)
    glucose = np.array(all_glucose)

    # Application des hard rules cliniques
    hard_rule_mask  = glucose >= INFER_CFG.glucose_high_risk_mg_dl
    y_prob_corrected = y_prob.copy()
    y_prob_corrected[hard_rule_mask] = 1.0  # Forcer HIGH RISK
    n_corrected = int(hard_rule_mask.sum())

    metrics_raw       = compute_metrics(y_true, y_prob)
    metrics_corrected = compute_metrics(y_true, y_prob_corrected)

    print(f"\n📊 Métriques SANS hard rules :")
    for k, v in metrics_raw.items():
        print(f"   {k:20s}: {v:.4f}")

    print(f"\n📊 Métriques AVEC hard rules (n={n_corrected} corrections) :")
    for k, v in metrics_corrected.items():
        print(f"   {k:20s}: {v:.4f}")

    print(f"\n📊 Incertitude MC Dropout :")
    print(f"   Incertitude moyenne  : {y_std.mean():.4f} ± {y_std.std():.4f}")
    high_unc = (y_std > INFER_CFG.uncertainty_warning_threshold).sum()
    print(f"   Samples haute incert.: {high_unc}/{len(y_std)} "
          f"({100*high_unc/len(y_std):.1f}%) [seuil: {INFER_CFG.uncertainty_warning_threshold}]")

    results = {
        "metrics_raw"      : metrics_raw,
        "metrics_corrected": metrics_corrected,
        "y_prob"           : y_prob,
        "y_std"            : y_std,
        "y_true"           : y_true,
        "n_hard_rule_corrections": n_corrected,
    }

    # Sauvegarde des résultats
    results_path = os.path.join(PATHS.logs, "test_results.json")
    with open(results_path, "w") as f:
        json.dump({
            "metrics_raw"      : metrics_raw,
            "metrics_corrected": metrics_corrected,
            "n_hard_rule_corrections": n_corrected,
            "mc_uncertainty_mean": float(y_std.mean()),
        }, f, indent=2)
    print(f"\n💾 Résultats test sauvegardés → {results_path}")

    return results


# =============================================================================
# 10. SCRIPT PRINCIPAL (Point d'entrée Colab)
# =============================================================================

def main():
    """
    Point d'entrée principal pour Google Colab.

    Exemple d'utilisation dans Colab :
    ─────────────────────────────────
    # Cellule 1 : Montage Google Drive
    from google.colab import drive
    drive.mount('/content/drive')

    # Cellule 2 : Installation des dépendances
    !pip install pytorch-tabnet optuna lightgbm xgboost --quiet

    # Cellule 3 : Lancement
    from train_base import main
    main()
    ─────────────────────────────────
    """
    import random
    # --- Reproductibilité ---
    torch.manual_seed(TRAIN_CFG.seed)
    np.random.seed(TRAIN_CFG.seed)
    random.seed(TRAIN_CFG.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(TRAIN_CFG.seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark     = False

    # --- Configuration ---
    from config import print_config_summary
    print_config_summary()

    # --- Pipeline de données ---
    # Adapter les chemins selon votre organisation Google Drive
    NHANES_CSV    = os.path.join(PATHS.data, "nhanes_diabetes.csv")
    TEMPORAL_DIR  = os.path.join(PATHS.data, "temporal")
    RPPG_CSV      = os.path.join(PATHS.data, "rppg_features.csv")

    print(f"\n📂 Chargement des données depuis : {PATHS.data}")

    # Vérification de l'existence des données
    if not os.path.exists(NHANES_CSV):
        print(f"⚠️  Fichier NHANES non trouvé : {NHANES_CSV}")
        print("   Génération de données synthétiques pour démonstration...")
        _generate_synthetic_data(NHANES_CSV, TEMPORAL_DIR, RPPG_CSV)

    pipeline_data = build_full_pipeline(
        nhanes_csv   = NHANES_CSV,
        temporal_dir = TEMPORAL_DIR,
        rppg_csv     = RPPG_CSV,
    )
    n_clinical = pipeline_data["n_clinical"]

    # --- Entraînement du modèle GMU ---
    result = train_gmu_model(
        pipeline_data       = pipeline_data,
        n_clinical_features = n_clinical,
        device              = DEVICE,
    )
    model   = result["model"]
    history = result["history"]

    # --- Évaluation finale sur le test set ---
    test_results = evaluate_test_set(
        model       = model,
        test_loader = pipeline_data["loaders"]["test"],
        device      = DEVICE,
    )

    # --- Extraction des embeddings OOF (pour stacking.py) ---
    print("\n📦 Extraction des embeddings OOF pour le stacking...")
    oof_data = extract_oof_embeddings(
        pipeline_data       = pipeline_data,
        n_clinical_features = n_clinical,
        device              = DEVICE,
        n_folds             = TRAIN_CFG.n_folds,
        epochs_per_fold     = 25,
    )

    print("\n✅ train_base.py — Pipeline complet terminé.")
    print(f"   Meilleur AUC val      : {result['best_auc']:.4f}")
    print(f"   AUC test (avec rules) : {test_results['metrics_corrected']['auc']:.4f}")
    print(f"   Poids sauvegardés     : {PATHS.gmu_best_weights}")

    return {
        "model"        : model,
        "history"      : history,
        "test_results" : test_results,
        "oof_data"     : oof_data,
        "pipeline_data": pipeline_data,
        "n_clinical"   : n_clinical,
    }


def _generate_synthetic_data(nhanes_csv: str, temporal_dir: str, rppg_csv: str, N: int = 1000):
    """Génère des données synthétiques pour tester le pipeline sur Colab."""
    import pandas as pd
    from config import NUMERICAL_FEATURES, CATEGORICAL_FEATURES, RPPG_FEATURES, TARGET_COLUMN

    os.makedirs(temporal_dir, exist_ok=True)

    # NHANES synthétique
    df = pd.DataFrame({"patient_id": [f"P{i:04d}" for i in range(N)]})
    for feat in NUMERICAL_FEATURES:
        df[feat] = np.abs(np.random.randn(N) * 20 + 50)
    for feat in CATEGORICAL_FEATURES:
        df[feat] = np.random.randint(0, 3, N)
    df["glucose_fasting_mg_dl"] = np.abs(np.random.randn(N) * 35 + 95)
    df[TARGET_COLUMN] = ((df["bmi"] > 30) & (df["glucose_fasting_mg_dl"] > 110)).astype(int)
    df.to_csv(nhanes_csv, index=False)
    print(f"   ✅ NHANES synthétique créé : {nhanes_csv} ({N} patients)")

    # rPPG synthétique
    df_rppg = pd.DataFrame({"patient_id": df["patient_id"]})
    for feat in RPPG_FEATURES:
        df_rppg[feat] = np.abs(np.random.randn(N) * 5 + 70)
    df_rppg.to_csv(rppg_csv, index=False)
    print(f"   ✅ rPPG synthétique créé   : {rppg_csv}")

    # Temporelles synthétiques (50 patients pour limiter le temps)
    from config import TEMPORAL_FEATURES, TEMPORAL_CFG
    for pid in df["patient_id"].values[:50]:
        T = np.random.randint(100, TEMPORAL_CFG.seq_len)
        df_t = pd.DataFrame(
            np.random.randn(T, len(TEMPORAL_FEATURES)),
            columns=TEMPORAL_FEATURES
        )
        df_t["timestamp"] = pd.date_range("2024-01-01", periods=T, freq="H")
        df_t.to_csv(os.path.join(temporal_dir, f"{pid}_temporal.csv"), index=False)
    print(f"   ✅ Données temporelles créées pour 50 patients dans {temporal_dir}/")


if __name__ == "__main__":
    main()