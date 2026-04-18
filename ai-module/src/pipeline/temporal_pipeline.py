"""
temporal_pipeline.py — Temporal Fusion Transformer Pipeline
============================================================
Wraps a lightweight TFT-inspired architecture (PyTorch) as
a scikit-learn compatible Pipeline step.
"""

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


class TemporalFusionClassifier(ClassifierMixin, BaseEstimator):
    """
    Lightweight TFT-inspired classifier compatible with sklearn API.
    Falls back gracefully to gradient boosting if PyTorch unavailable.
    """
    _estimator_type = "classifier"

    def __init__(self, hidden_size: int = 64, num_heads: int = 4,
                 dropout: float = 0.1, epochs: int = 50, lr: float = 1e-3):
        self.hidden_size = hidden_size
        self.num_heads = num_heads
        self.dropout = dropout
        self.epochs = epochs
        self.lr = lr
        self._use_torch = False
        self._model = None
        self.classes_ = np.array([0, 1])

    def _build_torch_model(self, input_dim: int):
        """Build TFT architecture if PyTorch available."""
        try:
            import torch
            import torch.nn as nn

            class TFTBlock(nn.Module):
                def __init__(self, input_dim, hidden_size, num_heads, dropout):
                    super().__init__()
                    self.input_proj = nn.Linear(input_dim, hidden_size)
                    self.attention = nn.MultiheadAttention(hidden_size, num_heads, dropout=dropout, batch_first=True)
                    self.gate = nn.Sequential(nn.Linear(hidden_size, hidden_size), nn.Sigmoid())
                    self.norm1 = nn.LayerNorm(hidden_size)
                    self.norm2 = nn.LayerNorm(hidden_size)
                    self.ffn = nn.Sequential(
                        nn.Linear(hidden_size, hidden_size * 2),
                        nn.GELU(),
                        nn.Dropout(dropout),
                        nn.Linear(hidden_size * 2, hidden_size),
                    )
                    self.classifier = nn.Sequential(
                        nn.Linear(hidden_size, 32),
                        nn.ReLU(),
                        nn.Dropout(dropout),
                        nn.Linear(32, 2),
                    )

                def forward(self, x):
                    x = self.input_proj(x).unsqueeze(1)
                    attn_out, _ = self.attention(x, x, x)
                    gated = self.gate(attn_out) * attn_out
                    x = self.norm1(gated + x)
                    x = self.norm2(self.ffn(x) + x)
                    return self.classifier(x.squeeze(1))

            return TFTBlock(input_dim, self.hidden_size, self.num_heads, self.dropout)

        except ImportError:
            return None

    def fit(self, X, y):
        X = np.array(X, dtype=np.float32)
        y = np.array(y)

        torch_model = self._build_torch_model(X.shape[1])

        if torch_model is not None:
            self._use_torch = True
            self._fit_torch(X, y, torch_model)
        else:
            # Graceful fallback to LightGBM
            from lightgbm import LGBMClassifier
            self._model = LGBMClassifier(n_estimators=200, random_state=42, verbose=-1)
            self._model.fit(X, y)

        return self

    def _fit_torch(self, X, y, model):
        import torch
        import torch.nn as nn
        from torch.utils.data import TensorDataset, DataLoader

        X_t = torch.FloatTensor(X)
        y_t = torch.LongTensor(y)
        dataset = TensorDataset(X_t, y_t)
        loader = DataLoader(dataset, batch_size=128, shuffle=True)

        optimizer = torch.optim.AdamW(model.parameters(), lr=self.lr, weight_decay=1e-4)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=self.epochs)
        criterion = nn.CrossEntropyLoss()

        model.train()
        for epoch in range(self.epochs):
            for X_batch, y_batch in loader:
                optimizer.zero_grad()
                loss = criterion(model(X_batch), y_batch)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
            scheduler.step()

        self._model = model

    def predict_proba(self, X):
        X = np.array(X, dtype=np.float32)

        if self._use_torch:
            import torch
            self._model.eval()
            with torch.no_grad():
                logits = self._model(torch.FloatTensor(X))
                probs = torch.softmax(logits, dim=1).numpy()
            return probs
        else:
            return self._model.predict_proba(X)

    def predict(self, X):
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)


class TemporalFusionPipeline:
    """sklearn-compatible Pipeline wrapping TFT classifier."""

    def __init__(self, hidden_size=64, num_heads=4, dropout=0.1):
        self.hidden_size = hidden_size
        self.num_heads = num_heads
        self.dropout = dropout

    def get_pipeline(self) -> Pipeline:
        return Pipeline([
            ("scaler", StandardScaler()),
            ("estimator", TemporalFusionClassifier(
                hidden_size=self.hidden_size,
                num_heads=self.num_heads,
                dropout=self.dropout,
            ))
        ])