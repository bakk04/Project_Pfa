import os
import sys
project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    print("Importing config...")
    import config
    print("Importing pipeline...")
    from src.pipeline import pipeline
    print("Importing train_base...")
    from src.training import train_base
    print("Importing stacking...")
    from src.stacking import stacking
    print("ALL IMPORTS SUCCESSFUL")
except Exception as e:
    print(f"IMPORT FAILED: {e}")
    import traceback
    traceback.print_exc()
