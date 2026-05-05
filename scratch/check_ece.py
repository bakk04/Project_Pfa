import torch
import numpy as np
from comprehensive_audit import ClinicalAuditEngine

engine = ClinicalAuditEngine()
engine.load_components()

def compute_ece(probs, labels, n_bins=10):
    bins = np.linspace(0., 1., n_bins + 1)
    binids = np.digitize(probs, bins) - 1
    
    bin_sums = np.bincount(binids, weights=probs, minlength=len(bins))
    bin_true = np.bincount(binids, weights=labels, minlength=len(bins))
    bin_total = np.bincount(binids, minlength=len(bins))
    
    nonzero = bin_total > 0
    prob_pred = bin_sums[nonzero] / bin_total[nonzero]
    prob_true = bin_true[nonzero] / bin_total[nonzero]
    
    ece = np.sum(np.abs(prob_pred - prob_true) * (bin_total[nonzero] / len(probs)))
    return ece

# Restore old weights to get baseline ECE
old_w = torch.tensor([[ 2.2902,  7.4487,  1.1448,  0.8336, -0.9360]])
engine.models["meta_learner"].net.weight.data = old_w
engine.run_part2()
base_ece = compute_ece(engine.test_probs, np.array([lbl for batch in engine.pipe_data["datasets"]["test"] for lbl in [batch["label"].numpy()]]))
base_auc = engine.metrics["auc"]
print(f"Base AUC: {base_auc:.4f}, Base ECE: {base_ece:.4f}")

# Apply new weights
new_w = torch.tensor([[ 2.0, 6.0, 0.8, 1.0, -1.5]])
engine.models["meta_learner"].net.weight.data = new_w
engine.run_part2()
new_ece = compute_ece(engine.test_probs, np.array([lbl for batch in engine.pipe_data["datasets"]["test"] for lbl in [batch["label"].numpy()]]))
new_auc = engine.metrics["auc"]
print(f"New AUC: {new_auc:.4f}, New ECE: {new_ece:.4f}")
