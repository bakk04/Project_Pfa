import torch
import shutil

file_paths = ['outputs/checkpoints/meta_learner.pt', 'DiabetesMultimodal/checkpoints/meta_learner.pt']
w = torch.tensor([[ 2.0, 6.8333335, 0.5, 0.8, -1.0 ]])

for file_path in file_paths:
    try:
        state = torch.load(file_path, map_location='cpu')
        state['net.weight'] = w
        torch.save(state, file_path)
        print("Updated meta_learner weights successfully to:", w, "in", file_path)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
