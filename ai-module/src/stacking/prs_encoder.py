"""
prs_encoder.py — Polygenic Risk Score Integration
===================================================
Merges genomic PRS scores into clinical feature set.
PRS file expected: CSV with columns [patient_id, prs_t2d, prs_bmi, prs_hba1c]
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from pathlib import Path


class PolygenicRiskEncoder:
    """
    Integrates Polygenic Risk Scores (PRS) into clinical tabular data.
    PRS are standardized relative to population mean/std before merging.
    """

    PRS_COLUMNS = ["prs_t2d", "prs_bmi", "prs_hba1c"]

    def __init__(self, id_col: str = "patient_id"):
        self.id_col = id_col
        self.scaler = StandardScaler()

    def merge(self, df_clinical: pd.DataFrame, prs_path: Path) -> pd.DataFrame:
        """
        Merge PRS scores into clinical dataframe.
        If PRS file not found or columns missing, returns df unchanged.
        """
        try:
            df_prs = pd.read_csv(prs_path)
            available_prs = [c for c in self.PRS_COLUMNS if c in df_prs.columns]

            if not available_prs:
                return df_clinical

            # Standardize PRS scores
            df_prs[available_prs] = self.scaler.fit_transform(df_prs[available_prs])

            # Merge on patient_id if available, else by index
            if self.id_col in df_clinical.columns and self.id_col in df_prs.columns:
                merged = df_clinical.merge(df_prs[[self.id_col] + available_prs], on=self.id_col, how="left")
            else:
                for col in available_prs:
                    df_clinical[col] = df_prs[col].values[:len(df_clinical)] if len(df_prs) >= len(df_clinical) else np.nan
                merged = df_clinical

            # Fill missing PRS with population mean (0 after standardization)
            merged[available_prs] = merged[available_prs].fillna(0.0)
            return merged

        except Exception as e:
            print(f"[PRS Warning] Could not load PRS data: {e}. Continuing without PRS.")
            return df_clinical