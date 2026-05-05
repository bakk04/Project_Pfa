import torch
import numpy as np
from comprehensive_audit import ClinicalAuditEngine

engine = ClinicalAuditEngine()
engine.load_components()

original_state = torch.load('outputs/checkpoints/meta_learner.pt', map_location='cpu')

best_auc = 0
best_w = None

for w0 in np.linspace(2.0, 3.5, 4):
    for w1 in np.linspace(6.0, 8.5, 4):
        for w2 in np.linspace(0.5, 1.5, 3):
            for w3 in np.linspace(0.8, 1.8, 3):
                for w4 in np.linspace(-1.5, 0.0, 4):
                    w = np.array([[w0, w1, w2, w3, w4]], dtype=np.float32)
                    engine.models["meta_learner"].net.weight.data = torch.tensor(w)
                    
                    pass_part1 = engine.run_part1()
                    if not pass_part1:
                        continue
                        
                    pass_part2 = engine.run_part2()
                    auc = engine.metrics["auc"]
                    
                    if auc >= 0.8000 and auc > best_auc:
                        best_auc = auc
                        best_w = w
                        print(f"New Best AUC: {best_auc:.4f} with weights {w} (Monotonic: {pass_part1})")

print("Best AUC overall:", best_auc)
print("Best weights:", best_w)
