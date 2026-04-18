"""
stacking.py — Clinical Stacking Ensemble
=========================================
Two-level stacking:
  Level 0 : LightGBM + TFT (diverse learners)
  Level 1 : Logistic Regression meta-learner (interpretable)
"""

import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler


class ClinicalStackingEnsemble(ClassifierMixin, BaseEstimator):
    """
    Production-grade stacking ensemble with out-of-fold meta-features.
    Uses cross-val predictions to avoid data leakage.
    """
    _estimator_type = "classifier"

    def __sklearn_tags__(self):
        from sklearn.utils._tags import Tags, ClassifierTags, TargetTags
        tags = super().__sklearn_tags__()
        tags.estimator_type = "classifier"
        tags.classifier_tags = ClassifierTags()
        tags.target_tags.required = True
        return tags

    def __init__(self, estimators, final_estimator_type="logistic", cv=5, random_state=42):
        self.estimators = estimators
        self.final_estimator_type = final_estimator_type
        self.cv = cv
        self.random_state = random_state
        self.estimators_ = []
        self.meta_learner_ = None
        self.classes_ = np.array([0, 1])

    def _get_meta_learner(self):
        if self.final_estimator_type == "logistic":
            return LogisticRegression(C=1.0, max_iter=1000, random_state=self.random_state)
        raise ValueError(f"Unknown final_estimator_type: {self.final_estimator_type}")

    def fit(self, X, y):
        # Convert y to array for safe indexing
        y = np.asarray(y)
        
        # Helper for slicing that preserves DataFrame if present
        def get_slice(data, idx):
            return data.iloc[idx] if hasattr(data, "iloc") else data[idx]

        kf = StratifiedKFold(n_splits=self.cv, shuffle=True, random_state=self.random_state)
        meta_features = np.zeros((len(X), len(self.estimators)))

        # ── Level 0 — Out-of-fold predictions ──────────────
        for j, (name, estimator) in enumerate(self.estimators):
            cloned = clone(estimator)
            # StratifiedKFold works on X even if it's a DataFrame
            for train_idx, val_idx in kf.split(X, y):
                X_train_fold = get_slice(X, train_idx)
                y_train_fold = y[train_idx]
                X_val_fold   = get_slice(X, val_idx)
                
                cloned.fit(X_train_fold, y_train_fold)
                meta_features[val_idx, j] = cloned.predict_proba(X_val_fold)[:, 1]

        # ── Level 0 — Final fit on full data ────────────────
        self.estimators_ = []
        for name, estimator in self.estimators:
            fitted = clone(estimator)
            fitted.fit(X, y)
            self.estimators_.append((name, fitted))

        # ── Level 1 — Meta-learner ───────────────────────────
        self.meta_learner_ = self._get_meta_learner()
        self.meta_learner_.fit(meta_features, y)

        return self

    def predict_proba(self, X):
        meta_features = np.column_stack([
            est.predict_proba(X)[:, 1]
            for _, est in self.estimators_
        ])
        return self.meta_learner_.predict_proba(meta_features)

    def predict(self, X):
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)

    def named_steps(self):
        return {name: est for name, est in self.estimators_}