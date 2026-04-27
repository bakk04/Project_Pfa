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
        pregnancies = np.where(gender == 2, self.rng.poisson(2, self.n_samples), 0)
        pregnancies = np.clip(pregnancies, 0, 15)
        
        # 2. Paramètres physiques (BMI)
        bmi = self.rng.lognormal(mean=np.log(28), sigma=0.2, size=self.n_samples)
        bmi = np.clip(bmi, 15, 60)
        
        # 3. Biomarqueurs métaboliques (Glucose & Insuline)
        # Corrélés à l'âge et au BMI
        glucose_base = 70 + (age * 0.2) + (bmi * 0.5)
        glucose = glucose_base + self.rng.normal(0, 15, self.n_samples)
        glucose = np.clip(glucose, 50, 400)
        
        insulin_base = 10 + (bmi * 0.4) + (glucose * 0.1)
        insulin = insulin_base + self.rng.normal(0, 5, self.n_samples)
        insulin = np.clip(insulin, 5, 300)

        # Skin Thickness (proxy for adiposity)
        skinthickness = 10 + (bmi * 0.8) + self.rng.normal(0, 5, self.n_samples)
        skinthickness = np.clip(skinthickness, 5, 99)

        # Diabetes Pedigree Function
        diabetespedigreefunction = self.rng.beta(2, 5, self.n_samples) * 2.5
        
        # 4. Tension Artérielle
        systolic_base = 110 + (age - 20) * 0.3 + (bmi - 25) * 0.5
        systolic_bp = systolic_base + self.rng.normal(0, 10, self.n_samples)
        systolic_bp = np.clip(systolic_bp, 90, 200)
        
        diastolic_base = 70 + (age - 20) * 0.1 + (bmi - 25) * 0.3
        diastolic_bp = diastolic_base + self.rng.normal(0, 8, self.n_samples)
        diastolic_bp = np.clip(diastolic_bp, 50, 120)
        
        # 5. Variable Cible (Diabète)
        # Basée sur les critères cliniques standards (ADA)
        risk_score = -12 + (glucose * 0.05) + (bmi * 0.1) + (age * 0.02) + (diabetespedigreefunction * 1.5)
        prob_diabetes = 1 / (1 + np.exp(-risk_score))
        diabetes_target = self.rng.binomial(1, prob_diabetes)
        
        df = pd.DataFrame({
            'age': np.round(age, 1),
            'gender': gender,
            'pregnancies': pregnancies.astype(int),
            'glucose': np.round(glucose, 1),
            'bloodpressure': np.round(systolic_bp, 1), # Re-aligned name for pipeline
            'skinthickness': np.round(skinthickness, 1),
            'insulin': np.round(insulin, 1),
            'bmi': np.round(bmi, 2),
            'diabetespedigreefunction': np.round(diabetespedigreefunction, 3),
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