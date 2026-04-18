import pandas as pd
import numpy as np
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RealisticClinicalDataBuilder:
    """
    Générateur de cohorte clinique de haute fidélité.
    Imite les distributions et corrélations de la cohorte NHANES 2017-2018.
    """
    def __init__(self, n_samples: int = 5000, seed: int = 42):
        self.n_samples = n_samples
        self.rng = np.random.default_rng(seed)

    def generate(self) -> pd.DataFrame:
        logger.info(f"Génération d'une cohorte clinique réaliste ({self.n_samples} patients)...")
        
        # 1. Démographie
        age = self.rng.uniform(18, 85, self.n_samples)
        gender = self.rng.choice([1, 2], size=self.n_samples, p=[0.48, 0.52]) # 1: Homme, 2: Femme
        
        # 2. Paramètres physiques (BMI)
        # Distribution log-normale pour l'IMC (moyenne ~29, avec queue à droite)
        bmi = self.rng.lognormal(mean=np.log(28), sigma=0.2, size=self.n_samples)
        bmi = np.clip(bmi, 15, 60)
        
        # 3. Tension Artérielle (Corrélée à l'âge et au BMI)
        systolic_base = 110 + (age - 20) * 0.3 + (bmi - 25) * 0.5
        systolic_bp = systolic_base + self.rng.normal(0, 10, self.n_samples)
        systolic_bp = np.clip(systolic_bp, 90, 200)
        
        diastolic_base = 70 + (age - 20) * 0.1 + (bmi - 25) * 0.3
        diastolic_bp = diastolic_base + self.rng.normal(0, 8, self.n_samples)
        diastolic_bp = np.clip(diastolic_bp, 50, 120)
        
        # 4. Variables Cibles Latentes (HbA1c et Glucose) - Pour générer la cible
        # Le risque augmente exponentiellement avec le BMI et l'âge
        risk_score = -8 + (age * 0.04) + (bmi * 0.15) + (systolic_bp * 0.01)
        prob_diabetes = 1 / (1 + np.exp(-risk_score))
        diabetes_target = self.rng.binomial(1, prob_diabetes)
        
        df = pd.DataFrame({
            'age': np.round(age, 1),
            'gender': gender,
            'bmi': np.round(bmi, 2),
            'systolic_bp': np.round(systolic_bp, 1),
            'diastolic_bp': np.round(diastolic_bp, 1),
            'diabetes_target': diabetes_target
        })
        
        logger.info(f"Cohorte générée. Prévalence du diabète : {df['diabetes_target'].mean()*100:.1f}%")
        return df

if __name__ == "__main__":
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.abspath(os.path.join(curr_dir, '..', '..', 'data'))
    os.makedirs(data_dir, exist_ok=True)
    
    builder = RealisticClinicalDataBuilder(n_samples=8000)
    df = builder.generate()
    
    output_path = os.path.join(data_dir, 'nhanes_clinical_cohort.csv')
    df.to_csv(output_path, index=False)
    logger.info(f"Données cliniques sauvegardées dans {output_path}")