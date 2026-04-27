import os
import numpy as np
import pandas as pd

class ClinicalDataGenerator:
    """
    Simulateur de cohorte physiologique pour l'entraînement de modèles de stratification 
    du risque métabolique (Systèmes SaMD).
    
    L'approche repose sur un modèle d'effets structurels pour contraindre
    les variables aléatoires à respecter des relations physiologiques décrites 
    dans la littérature médicale.
    """
    def __init__(self, n_samples: int = 2500, random_state: int = 42):
        self.n_samples = n_samples
        self.rng = np.random.default_rng(seed=random_state)

    def generate(self) -> pd.DataFrame:
        """
        Génère un espace de caractéristiques multivarié respectant les covariances physiologiques.
        L'architecture causale induit les corrélations cibles sur [HRV, HR, BMI, Age, Activité].
        """
        # Variables indépendantes (Exogènes)
        age = self.rng.uniform(30.0, 85.0, self.n_samples)
        gender = self.rng.binomial(1, 0.5, self.n_samples)
        
        # Variables dépendantes (Endogènes modifiées)
        # BMI: Augmente structurellement avec l'âge (sarcopénie/ralentissement métabolique)
        bmi_base = self.rng.normal(24.0, 3.5, self.n_samples)
        weight_bmi_index = np.clip(bmi_base + (age - 30) * 0.1, 16.0, 45.0)
        
        # Activité physique (steps): Déclin avec l'âge et le BMI
        activity_base = self.rng.normal(8000.0, 2500.0, self.n_samples)
        activity_steps_avg = np.clip(activity_base - (age - 30) * 50.0 - (weight_bmi_index - 24) * 100.0, 500.0, 20000.0)
        
        # Sommeil: Variance homoscédastique + effet marginal de la dépense énergétique
        sleep_base = self.rng.normal(420.0, 60.0, self.n_samples)
        sleep_minutes_avg = np.clip(sleep_base + (activity_steps_avg - 8000) * 0.005, 240.0, 600.0)
        
        # HRV (RMSSD en ms): Diminue fortement avec l'âge et BMI élevé, augmente avec l'activité
        hrv_base = self.rng.normal(55.0, 10.0, self.n_samples)
        hrv_rmssd_7d_trend = np.clip(
            hrv_base - (age - 30) * 0.4 - (weight_bmi_index - 24) * 0.8 + (activity_steps_avg - 8000) * 0.002, 
            10.0, 120.0
        )
        
        # HR Baseline (BPM): Inversement corrélé à l'activité, positivement au BMI
        hr_base = self.rng.normal(70.0, 7.0, self.n_samples)
        heart_rate_baseline = np.clip(
            hr_base - (activity_steps_avg - 8000) * 0.001 + (weight_bmi_index - 24) * 0.3, 
            40.0, 120.0
        )
        
        # Génération du signal cible: Risque Métabolique (Espace Logit continu)
        risk_logit = (
            (weight_bmi_index - 25) * 0.15 +
            (age - 50) * 0.05 +
            (heart_rate_baseline - 70) * 0.08 -
            (hrv_rmssd_7d_trend - 40) * 0.05 -
            (activity_steps_avg - 8000) * 0.0002
        )
        
        # Bruit non-corrélé (variance résiduelle)
        risk_logit += self.rng.normal(0, 0.4, self.n_samples)
        
        # Mapping non-linéaire via Sigmoïde pour obtenir une probabilité calibrée [0, 100]
        risk_score = 100.0 / (1.0 + np.exp(-risk_logit))
        
        df = pd.DataFrame({
            'heart_rate_baseline': np.round(heart_rate_baseline, 1),
            'hrv_rmssd_7d_trend': np.round(hrv_rmssd_7d_trend, 2),
            'sleep_minutes_avg': np.round(sleep_minutes_avg, 1),
            'activity_steps_avg': np.round(activity_steps_avg, 0),
            'age': np.round(age, 1),
            'weight_bmi_index': np.round(weight_bmi_index, 2),
            'gender': gender,
            'risk_score': np.round(risk_score, 2)
        })
        
        # Injection contrôlée de bruit (Missing values et Capteur Outliers)
        return self._inject_artifacts(df)
        
    def _inject_artifacts(self, df: pd.DataFrame, nan_ratio: float = 0.02, outlier_ratio: float = 0.01) -> pd.DataFrame:
        """
        Injecte aléatoirement des perturbations dans les variables de télémétrie 
        pour tester la résilience du preprocessing.
        """
        df_dirty = df.copy()
        n_rows = len(df_dirty)
        cols_for_nans = ['hrv_rmssd_7d_trend', 'sleep_minutes_avg', 'activity_steps_avg']
        cols_for_outliers = ['heart_rate_baseline', 'weight_bmi_index']
        
        # MCAR (Missing Completely At Random)
        for col in cols_for_nans:
            mask = self.rng.random(n_rows) < nan_ratio
            df_dirty.loc[mask, col] = np.nan
            
        # Outliers multiplicatifs temporels
        for col in cols_for_outliers:
            mask = self.rng.random(n_rows) < outlier_ratio
            scale = self.rng.uniform(1.5, 2.5, mask.sum())
            df_dirty.loc[mask, col] = df_dirty.loc[mask, col] * scale
            
        return df_dirty

if __name__ == '__main__':
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data'))
    os.makedirs(data_dir, exist_ok=True)
    
    generator = ClinicalDataGenerator(n_samples=2500)
    dataset = generator.generate()
    
    filepath = os.path.join(data_dir, 'synthetic_metabolic_data.csv')
    dataset.to_csv(filepath, index=False)
    
    print(f"[INFO] Tenseur de caractéristiques généré : {dataset.shape}")
    print(f"[INFO] Cohorte syntéthique sauvegardée vers : {filepath}")
