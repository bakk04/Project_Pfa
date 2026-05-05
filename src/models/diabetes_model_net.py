# =============================================================================
# models.py — Architecture PyTorch Complète : Branches + GMU + MC Dropout
# =============================================================================
# Ce fichier implémente :
#   1. ClinicalBranch   : TabNet + ResNet-MLP → h_clin [256]
#   2. TemporalBranch   : Temporal Transformer → h_temp [256]
#   3. RPPGBranch       : 1D-CNN + Projection → h_rppg [256]
#   4. GatedMultimodalUnit (GMU) : Fusion adaptative des 3 branches
#   5. DiabetesMultimodalNet : Réseau complet avec MC Dropout
# =============================================================================

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple, Dict

from config import (
    EMBED, GMU_CFG, CLINICAL_CFG, TEMPORAL_CFG, RPPG_CFG,
    INFER_CFG, DEVICE
)


# =============================================================================
# UTILITAIRES COMMUNS
# =============================================================================

class MCDropout(nn.Module):
    """
    Dropout actif aussi en mode eval() — clé du Monte Carlo Dropout.
    Remplace nn.Dropout standard pour l'estimation d'incertitude.
    """
    def __init__(self, p: float = 0.3):
        super().__init__()
        self.p = p

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # training=True force le dropout même en eval() → stochasticité MC
        return F.dropout(x, p=self.p, training=True)


class ResidualBlock(nn.Module):
    """
    Bloc résiduel générique : Linear → BN → GELU → MCDropout → Linear + skip.
    Utilise MCDropout (actif en eval) pour une couverture complète de l'incertitude
    épistémique lors des passes Monte Carlo.
    """
    def __init__(self, dim: int, dropout: float = 0.3, use_bn: bool = True):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, dim),
            nn.BatchNorm1d(dim) if use_bn else nn.Identity(),
            nn.GELU(),
            MCDropout(dropout),   # FIX: MCDropout actif même en eval() → meilleure estimation d'incertitude
            nn.Linear(dim, dim),
        )
        self.norm = nn.LayerNorm(dim)
        self.drop = MCDropout(dropout)   # FIX: idem ici

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.norm(x + self.drop(self.net(x)))


# =============================================================================
# 1. BRANCHE CLINIQUE — TabNet + ResNet-MLP
# =============================================================================

class TabNetAttentiveTransformer(nn.Module):
    """
    Implémentation PyTorch native du mécanisme d'attention TabNet.
    (Arik & Pfister, 2021 — "TabNet: Attentive Interpretable Tabular Learning")

    À chaque step, un masque sparsemax sélectionne les features pertinentes.
    Cela produit un embedding interprétable + une régularisation d'entropie.
    """

    def __init__(
        self,
        input_dim: int,
        n_d: int = 64,        # Dimension de la couche décisionnelle
        n_a: int = 64,        # Dimension de la couche d'attention
        n_steps: int = 5,     # Nombre d'étapes de feature selection
        gamma: float = 1.5,   # Relaxation (>1 → features peuvent être re-sélectionnées)
        momentum: float = 0.02,
        epsilon: float = 1e-15,
    ):
        super().__init__()
        self.input_dim = input_dim
        self.n_d       = n_d
        self.n_a       = n_a
        self.n_steps   = n_steps
        self.gamma     = gamma
        self.epsilon   = epsilon

        # BN initial sur les features brutes
        self.initial_bn = nn.BatchNorm1d(input_dim, momentum=momentum, eps=epsilon)

        # Shared layers : produce 2 * (n_d + n_a) for GLU -> n_d + n_a
        self.shared_fc   = nn.Linear(input_dim, 2 * (n_d + n_a), bias=False)
        self.shared_bn   = nn.BatchNorm1d(2 * (n_d + n_a), momentum=momentum, eps=epsilon)
        self.glu         = nn.GLU(dim=-1)

        # Step-specific layers
        self.step_fcs  = nn.ModuleList([
            nn.Linear(n_d + n_a, 2 * (n_d + n_a), bias=False) for _ in range(n_steps)
        ])
        self.step_bns  = nn.ModuleList([
            nn.BatchNorm1d(2 * (n_d + n_a), momentum=momentum, eps=epsilon) for _ in range(n_steps)
        ])

        # Attention transformers (pour générer les masques)
        self.att_fcs   = nn.ModuleList([
            nn.Linear(n_d + n_a, input_dim, bias=False) for _ in range(n_steps)
        ])
        self.att_bns   = nn.ModuleList([
            nn.BatchNorm1d(input_dim, momentum=momentum, eps=epsilon) for _ in range(n_steps)
        ])

        self.scale = math.sqrt(0.5)

    def _sparsemax(self, x: torch.Tensor) -> torch.Tensor:
        """Sparsemax implementation."""
        sorted_x, _ = torch.sort(x, descending=True, dim=-1)
        cumsum       = torch.cumsum(sorted_x, dim=-1)
        k_range      = torch.arange(1, x.size(-1) + 1, device=x.device, dtype=x.dtype)
        support      = sorted_x * k_range > (cumsum - 1)
        k_max        = support.sum(dim=-1, keepdim=True).clamp(min=1)
        tau          = (cumsum.gather(-1, (k_max - 1).clamp(min=0)) - 1) / k_max.float()
        return torch.clamp(x - tau, min=0)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        B = x.size(0)
        x_bn = self.initial_bn(x)

        # Initialisation des priors
        prior_scales = torch.ones(B, self.input_dim, device=x.device)
        
        # Premier passage dans les shared layers
        # [B, input_dim] -> [B, 2*(n_d+n_a)] -> GLU -> [B, n_d+n_a]
        h_shared = self.glu(self.shared_bn(self.shared_fc(x_bn))) * self.scale
        
        output_agg   = torch.zeros(B, self.n_d, device=x.device)
        entropy_loss = torch.tensor(0.0, device=x.device)

        h_prev = h_shared  # Dimension [B, 128] if n_d=64, n_a=64

        # Diagnostic check to catch the mismatch before the linear layer
        if h_prev.shape[1] != (self.n_d + self.n_a):
            raise ValueError(
                f"TABNET DIMENSION ERROR: h_prev has {h_prev.shape[1]} features, "
                f"but layers expect {self.n_d + self.n_a}. "
                "PLEASE RESTART YOUR COLAB SESSION (Runtime -> Restart session)!"
            )

        for step in range(self.n_steps):
            # 1. Attention Transformer
            # att_fcs[step] est Linear(n_d+n_a, input_dim) -> Linear(128, 32)
            att_input = self.att_bns[step](self.att_fcs[step](h_prev))
            att_input = att_input * prior_scales
            mask      = self._sparsemax(att_input)

            # Update priors
            prior_scales = prior_scales * (self.gamma - mask)

            # 2. Feature Transformer
            masked_x  = mask * x_bn
            # Shared part
            h_step = self.glu(self.shared_bn(self.shared_fc(masked_x))) * self.scale
            # Step-specific part
            h_step = self.glu(self.step_bns[step](self.step_fcs[step](h_step))) * self.scale

            # Accumulation (on prend les n_d premières features pour la décision)
            output_agg = output_agg + h_step[:, :self.n_d]
            
            # h_prev pour le prochain step (dimension n_d + n_a)
            h_prev = h_step

            # Entropy regularization
            entropy_loss += (-mask * torch.log(mask + self.epsilon)).sum(dim=-1).mean()

        return output_agg, entropy_loss / self.n_steps


class ClinicalBranch(nn.Module):
    """
    Branche 1 — Données cliniques/tabulaires.
    Architecture : TabNet → ResNet-MLP → h_clin [256]
    """

    def __init__(
        self,
        input_dim: int   = CLINICAL_CFG.input_dim,
        tabnet_n_d: int  = CLINICAL_CFG.tabnet_n_d,
        tabnet_n_a: int  = CLINICAL_CFG.tabnet_n_a,
        n_steps: int     = CLINICAL_CFG.tabnet_n_steps,
        gamma: float     = CLINICAL_CFG.tabnet_gamma,
        hidden_dims      = CLINICAL_CFG.resnet_hidden_dims,
        dropout: float   = CLINICAL_CFG.resnet_dropout,
        output_dim: int  = EMBED.clinical,
    ):
        super().__init__()
        self.output_dim = output_dim

        # --- TabNet ---
        self.tabnet = TabNetAttentiveTransformer(
            input_dim=input_dim,
            n_d=tabnet_n_d,
            n_a=tabnet_n_a,
            n_steps=n_steps,
            gamma=gamma,
        )

        # --- Projection TabNet → première couche ResNet ---
        self.proj_in = nn.Sequential(
            nn.Linear(tabnet_n_d, hidden_dims[0]),
            nn.LayerNorm(hidden_dims[0]),
            nn.GELU(),
        )

        # --- Blocs Résiduels ---
        self.res_blocks = nn.ModuleList()
        for i, dim in enumerate(hidden_dims):
            self.res_blocks.append(ResidualBlock(dim, dropout=dropout))
            # Projection entre blocs si dimensions différentes
            if i < len(hidden_dims) - 1 and dim != hidden_dims[i + 1]:
                self.res_blocks.append(nn.Linear(dim, hidden_dims[i + 1]))

        # --- Projection finale vers output_dim ---
        self.proj_out = nn.Sequential(
            nn.Linear(hidden_dims[-1], output_dim),
            nn.LayerNorm(output_dim),
        )

        self.mc_drop = MCDropout(dropout)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        x : [B, input_dim]
        Retourne : (h_clin [B, 256], entropy_loss scalaire)
        """
        tab_out, entropy_loss = self.tabnet(x)  # [B, n_d]
        h = self.proj_in(tab_out)               # [B, hidden_dims[0]]

        for block in self.res_blocks:
            h = block(h)

        h = self.mc_drop(h)
        h_clin = self.proj_out(h)               # [B, 256]
        return h_clin, entropy_loss


# =============================================================================
# 2. BRANCHE TEMPORELLE — Temporal Transformer
# =============================================================================

class PositionalEncoding(nn.Module):
    """
    Encodage positionnel sinusoïdal (Vaswani et al., 2017).
    Injecte l'information temporelle dans les embeddings.
    """

    def __init__(self, d_model: int, max_len: int = 512, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        # Matrice PE pré-calculée
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        pe = pe.unsqueeze(0)  # [1, max_len, d_model]
        self.register_buffer("pe", pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x : [B, T, d_model]"""
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)


class TemporalBranch(nn.Module):
    """
    Branche 2 — Données temporelles (séries de 7 jours, API Terra/Vital).
    Architecture : Projection → Positional Encoding → Transformer Encoder → Agrégation → h_temp [256]
    """

    def __init__(
        self,
        feature_dim: int = TEMPORAL_CFG.feature_dim,
        d_model: int     = TEMPORAL_CFG.d_model,
        n_heads: int     = TEMPORAL_CFG.n_heads,
        n_layers: int    = TEMPORAL_CFG.n_layers,
        d_ff: int        = TEMPORAL_CFG.d_ff,
        dropout: float   = TEMPORAL_CFG.dropout,
        max_seq_len: int = TEMPORAL_CFG.max_seq_len,
        aggregation: str = TEMPORAL_CFG.aggregation,
        proj_dim: int    = EMBED.temporal,
    ):
        super().__init__()
        self.aggregation = aggregation
        self.d_model     = d_model

        # --- Projection de l'espace features vers d_model ---
        self.input_proj = nn.Sequential(
            nn.Linear(feature_dim, d_model),
            nn.LayerNorm(d_model),
        )

        # --- [CLS] token pour l'agrégation type BERT ---
        self.cls_token = nn.Parameter(torch.randn(1, 1, d_model) * 0.02)

        # --- Positional Encoding ---
        self.pos_enc = PositionalEncoding(d_model, max_len=max_seq_len + 1, dropout=dropout)

        # --- Transformer Encoder (blocs d'attention multi-têtes) ---
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=d_ff,
            dropout=dropout,
            activation="gelu",
            batch_first=True,  # [B, T, D] (PyTorch ≥1.9)
            norm_first=True,   # Pre-LayerNorm (plus stable à l'entraînement)
        )
        self.transformer = nn.TransformerEncoder(
            encoder_layer,
            num_layers=n_layers,
            norm=nn.LayerNorm(d_model),
        )

        # --- Projection vers dimension commune ---
        self.proj_out = nn.Sequential(
            nn.Linear(d_model, proj_dim),
            nn.LayerNorm(proj_dim),
        )

        self.mc_drop = MCDropout(dropout)

    def forward(
        self,
        x: torch.Tensor,
        src_key_padding_mask: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        x    : [B, seq_len, feature_dim]
        mask : [B, seq_len] — True = position paddée (ignorée par l'attention)
        Retourne : h_temp [B, 256]
        """
        B, T, _ = x.shape

        # Projection features → d_model
        h = self.input_proj(x)  # [B, T, d_model]

        # Ajout du [CLS] token en début de séquence
        cls = self.cls_token.expand(B, -1, -1)  # [B, 1, d_model]
        h   = torch.cat([cls, h], dim=1)        # [B, T+1, d_model]

        # Étendre le masque pour le [CLS] token (jamais masqué)
        if src_key_padding_mask is not None:
            cls_mask = torch.zeros(B, 1, dtype=torch.bool, device=x.device)
            src_key_padding_mask = torch.cat([cls_mask, src_key_padding_mask], dim=1)

        # Positional Encoding
        h = self.pos_enc(h)

        # Transformer Encoder
        h = self.transformer(h, src_key_padding_mask=src_key_padding_mask)

        # Agrégation de la séquence → vecteur
        if self.aggregation == "cls_token":
            # Utiliser le [CLS] token (position 0)
            h_agg = h[:, 0, :]
        elif self.aggregation == "mean_pool":
            # Moyenne sur les tokens non-paddés uniquement
            if src_key_padding_mask is not None:
                valid_mask = ~src_key_padding_mask  # [B, T+1]
                valid_mask = valid_mask.unsqueeze(-1).float()
                h_agg = (h * valid_mask).sum(dim=1) / valid_mask.sum(dim=1).clamp(min=1)
            else:
                h_agg = h.mean(dim=1)
        else:  # "last" — dernier token valide
            h_agg = h[:, -1, :]

        h_agg    = self.mc_drop(h_agg)
        h_temp   = self.proj_out(h_agg)  # [B, 256]
        return h_temp


# =============================================================================
# 3. BRANCHE rPPG — 1D-CNN Shallow + Projection
# =============================================================================

class RPPGBranch(nn.Module):
    """
    Branche 3 — Features rPPG scalaires (HR, RMSSD, LF/HF, PSD...).
    Architecture : 1D-CNN Shallow → h_raw [128] → Linear → h_rppg [256]

    Note : Les features rPPG sont des scalaires (pas une séquence temporelle).
    On les traite comme un signal 1D de longueur 1 avec D canaux,
    puis on applique des convolutions pointwise pour extraire des patterns.
    Alternativement, si disponible, le signal rPPG brut (1D) peut être injecté.
    """

    def __init__(
        self,
        input_dim: int    = RPPG_CFG.input_dim,
        conv_layers       = RPPG_CFG.conv_layers,
        use_batch_norm: bool = RPPG_CFG.use_batch_norm,
        raw_output_dim: int  = EMBED.rppg_raw,
        proj_dim: int        = EMBED.rppg_proj,
    ):
        super().__init__()
        self.input_dim     = input_dim
        self.raw_output_dim = raw_output_dim

        # --- Construction des couches Conv1D ---
        # Les features scalaires sont reshapées en [B, input_dim, 1]
        # (un "signal" de longueur 1 avec input_dim canaux)
        # Les convolutions extraient des interactions entre features
        layers = []
        in_channels = input_dim
        for out_channels, kernel_size in conv_layers:
            # Padding "same" pour conserver la longueur
            padding = kernel_size // 2
            layers.append(nn.Conv1d(
                in_channels, out_channels, kernel_size, padding=padding, bias=False
            ))
            if use_batch_norm:
                layers.append(nn.BatchNorm1d(out_channels))
            layers.append(nn.GELU())
            in_channels = out_channels

        self.conv_net = nn.Sequential(*layers)

        # Adaptive pooling pour obtenir une sortie de taille fixe
        self.adaptive_pool = nn.AdaptiveAvgPool1d(1)  # [B, last_ch, 1] → [B, last_ch]

        # --- MLP après CNN ---
        last_ch = conv_layers[-1][0]
        self.mlp = nn.Sequential(
            nn.Linear(last_ch, raw_output_dim),
            nn.LayerNorm(raw_output_dim),
            nn.GELU(),
            nn.Dropout(0.3),
        )

        # --- Projection vers dimension commune [128 → 256] ---
        self.proj = nn.Sequential(
            nn.Linear(raw_output_dim, proj_dim),
            nn.LayerNorm(proj_dim),
        )

        self.mc_drop = MCDropout(0.3)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        x : [B, input_dim] — features rPPG scalaires
        Retourne : h_rppg [B, 256]
        """
        # Reshape pour Conv1D : [B, input_dim, 1]
        h = x.unsqueeze(-1)          # [B, n_rppg, 1]

        h = self.conv_net(h)          # [B, last_ch, L]
        h = self.adaptive_pool(h)     # [B, last_ch, 1]
        h = h.squeeze(-1)             # [B, last_ch]

        h = self.mlp(h)               # [B, 128] = h_rppg_raw
        h = self.mc_drop(h)
        h_rppg = self.proj(h)         # [B, 256] = h_rppg_proj
        return h_rppg


# =============================================================================
# 4. GATED MULTIMODAL UNIT (GMU)
# =============================================================================

class GatedMultimodalUnit(nn.Module):
    """
    Unité de Fusion Multimodale avec Gating Adaptatif.

    Fusionne les représentations h_clin, h_temp, h_rppg via des portes apprises.
    L'idée centrale : chaque modalité contribue proportionnellement à
    sa pertinence pour ce sample spécifique.

    Équations :
        concat_h = [h_clin ; h_temp ; h_rppg]         # [B, 768]
        g_i      = sigmoid(W_g_i * concat_h + b_i)    # [B, 256] pour i ∈ {1,2,3}
        z        = Σ g_i ⊙ h_i                        # [B, 256] — fusion pondérée
        z_norm   = LayerNorm(z + Dropout(z))           # Normalisation + résidu
        z_res    = z_norm + h_clin                     # Connexion résiduelle clinique
    """

    def __init__(
        self,
        input_dim: int   = GMU_CFG.input_dim,    # 768 (concat des 3 branches)
        branch_dim: int  = GMU_CFG.branch_dim,   # 256 (dimension de chaque branche)
        n_branches: int  = GMU_CFG.n_branches,   # 3
        dropout: float   = GMU_CFG.dropout,
        use_layer_norm   = GMU_CFG.use_layer_norm,
        use_residual     = GMU_CFG.use_residual,
        output_dim: int  = GMU_CFG.output_dim,   # 256
    ):
        super().__init__()
        self.branch_dim  = branch_dim
        self.n_branches  = n_branches
        self.use_residual = use_residual

        # Couches de gating — une par branche
        # Chaque porte prend la concaténation complète en entrée
        self.gates = nn.ModuleList([
            nn.Sequential(
                nn.Linear(input_dim, branch_dim, bias=True),
                # Pas de sigmoid ici : on l'applique explicitement pour la lisibilité
            )
            for _ in range(n_branches)
        ])

        # Normalisation post-fusion
        self.layer_norm = nn.LayerNorm(branch_dim) if use_layer_norm else nn.Identity()
        self.dropout    = MCDropout(dropout)  # MCDropout pour incertitude

        # Projection finale (si output_dim ≠ branch_dim)
        if output_dim != branch_dim:
            self.proj_out = nn.Linear(branch_dim, output_dim)
        else:
            self.proj_out = nn.Identity()

    def forward(
        self,
        h_clin: torch.Tensor,   # [B, 256]
        h_temp: torch.Tensor,   # [B, 256]
        h_rppg: torch.Tensor,   # [B, 256]
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Retourne :
          - z     : [B, output_dim] — vecteur fusionné normalisé
          - gates : [B, n_branches, branch_dim] — portes (pour visualisation/interp.)
        """
        branches = [h_clin, h_temp, h_rppg]

        # Concaténation pour le calcul des portes
        h_concat = torch.cat(branches, dim=-1)  # [B, 768]

        # Calcul des portes (logits)
        gate_logits = []
        for gate_layer in self.gates:
            g = gate_layer(h_concat)  # [B, 256]
            gate_logits.append(g)

        # Softmax pour s'assurer que la somme des poids vaut 1 et qu'aucune modalité n'écrase les autres
        gates_stacked = torch.stack(gate_logits, dim=1)  # [B, 3, 256]
        gates_softmax = F.softmax(gates_stacked, dim=1)

        gate_values = [gates_softmax[:, i, :] for i in range(self.n_branches)]

        # Fusion pondérée : z = Σ g_i ⊙ h_i
        z = sum(g * h for g, h in zip(gate_values, branches))  # [B, 256]

        # Normalisation : LayerNorm + Dropout
        z = self.dropout(z)
        z = self.layer_norm(z)

        # Projection finale
        z = self.proj_out(z)

        return z, gates_softmax


# =============================================================================
# 5. TÊTE DE CLASSIFICATION FINALE
# =============================================================================

class ClassificationHead(nn.Module):
    """
    Tête de classification finale sur le vecteur fusionné z.
    Produit des logits (avant sigmoid) pour BCEWithLogitsLoss.
    """

    def __init__(self, input_dim: int = EMBED.gmu_out, dropout: float = 0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.LayerNorm(128),
            nn.GELU(),
            MCDropout(dropout),
            nn.Linear(128, 64),
            nn.GELU(),
            MCDropout(dropout),
            nn.Linear(64, 1),  # Logit binaire
        )

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        """z : [B, 256] → logits [B, 1]"""
        return self.net(z).squeeze(-1)  # [B]


# =============================================================================
# 6. RÉSEAU COMPLET : DiabetesMultimodalNet
# =============================================================================

class DiabetesMultimodalNet(nn.Module):
    """
    Réseau de prédiction du diabète multi-modal complet.

    Flux :
        clinical_features  → ClinicalBranch  → h_clin [256]
        temporal_sequence  → TemporalBranch  → h_temp [256]
        rppg_features      → RPPGBranch      → h_rppg [256]
             ↓                    ↓                 ↓
                    GatedMultimodalUnit (GMU)
                           ↓
                    z [256] (fusionné)
                           ↓
                   ClassificationHead
                           ↓
                    logit (scalaire)
    """

    def __init__(
        self,
        n_clinical_features: int = CLINICAL_CFG.input_dim,
        return_embeddings: bool  = False,  # Retourner z pour le stacking
    ):
        super().__init__()
        self.return_embeddings = return_embeddings

        # --- Les 3 branches ---
        self.clinical_branch = ClinicalBranch(input_dim=n_clinical_features)
        self.temporal_branch = TemporalBranch()
        self.rppg_branch     = RPPGBranch()

        # --- GMU ---
        self.gmu = GatedMultimodalUnit()

        # --- Tête de classification ---
        self.head = ClassificationHead()

        # Initialisation des poids
        self._init_weights()

    def _init_weights(self):
        """Initialisation Xavier/He pour une meilleure convergence."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
            elif isinstance(module, nn.Conv1d):
                nn.init.kaiming_normal_(module.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(module, (nn.BatchNorm1d, nn.LayerNorm)):
                nn.init.ones_(module.weight)
                nn.init.zeros_(module.bias)

    def forward(
        self,
        clinical: torch.Tensor,
        temporal: torch.Tensor,
        rppg: torch.Tensor,
        temp_mask: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        """
        clinical  : [B, n_clinical_features]
        temporal  : [B, seq_len, feature_dim]
        rppg      : [B, n_rppg_features]
        temp_mask : [B, seq_len] — True = paddé

        Retourne un dictionnaire :
        {
            'logit'        : [B]      — logit de sortie
            'embedding'    : [B, 256] — vecteur z (si return_embeddings=True)
            'gates'        : [B, 3, 256] — portes GMU
            'entropy_loss' : scalaire  — régularisation TabNet
        }
        """
        # ------------------------------------------------------------------
        # Calcul des embeddings de chaque branche
        # ------------------------------------------------------------------
        h_clin, entropy_loss = self.clinical_branch(clinical)  # [B, 256], scalaire
        h_temp               = self.temporal_branch(temporal, src_key_padding_mask=temp_mask)  # [B, 256]
        h_rppg               = self.rppg_branch(rppg)          # [B, 256]

        # ------------------------------------------------------------------
        # Fusion via GMU
        # ------------------------------------------------------------------
        z, gates = self.gmu(h_clin, h_temp, h_rppg)  # [B, 256], [B, 3, 256]

        # ------------------------------------------------------------------
        # Classification finale
        # ------------------------------------------------------------------
        logit = self.head(z)  # [B]

        out = {
            "logit"        : logit,
            "gates"        : gates,
            "entropy_loss" : entropy_loss,
        }
        if self.return_embeddings:
            out["embedding"] = z.detach()  # Détaché pour le stacking

        return out

    def get_embedding(
        self,
        clinical: torch.Tensor,
        temporal: torch.Tensor,
        rppg: torch.Tensor,
        temp_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """
        Extrait uniquement le vecteur fusionné z [B, 256].
        Utilisé pour le stacking (entrée du méta-learner).
        """
        old_flag = self.return_embeddings
        self.return_embeddings = True
        out = self.forward(clinical, temporal, rppg, temp_mask)
        self.return_embeddings = old_flag
        return out["embedding"]  # [B, 256]


# =============================================================================
# 7. INFÉRENCE MONTE CARLO DROPOUT
# =============================================================================

class MCDropoutInference:
    """
    Estimateur d'incertitude par Monte Carlo Dropout.

    Effectue T passes forward avec Dropout actif (en mode eval) et retourne :
      - mean_proba : moyenne des probabilités sur T passes
      - std_proba  : écart-type (incertitude épistémique)
    """

    def __init__(self, model: DiabetesMultimodalNet, T: int = INFER_CFG.mc_dropout_passes):
        self.model = model
        self.T     = T

    @torch.no_grad()
    def predict(
        self,
        clinical: torch.Tensor,
        temporal: torch.Tensor,
        rppg: torch.Tensor,
        temp_mask: Optional[torch.Tensor] = None,
        device: torch.device = DEVICE,
    ) -> Dict[str, torch.Tensor]:
        """
        Effectue T passes stochastiques et agrège les prédictions.

        Retourne :
        {
            'mean_proba' : [B]      — probabilité moyenne
            'std_proba'  : [B]      — incertitude (écart-type)
            'mean_logit' : [B]      — logit moyen
            'all_probas' : [T, B]   — toutes les probabilités (pour analyse)
        }
        """
        # Le modèle est en eval() mais MCDropout force training=True dans dropout
        self.model.eval()

        clinical  = clinical.to(device)
        temporal  = temporal.to(device)
        rppg      = rppg.to(device)
        if temp_mask is not None:
            temp_mask = temp_mask.to(device)

        all_logits = []
        for _ in range(self.T):
            out = self.model(clinical, temporal, rppg, temp_mask)
            all_logits.append(out["logit"])

        # Stack : [T, B]
        all_logits  = torch.stack(all_logits, dim=0)
        all_probas  = torch.sigmoid(all_logits)

        mean_proba  = all_probas.mean(dim=0)   # [B]
        std_proba   = all_probas.std(dim=0)    # [B]
        mean_logit  = all_logits.mean(dim=0)   # [B]

        return {
            "mean_proba" : mean_proba,
            "std_proba"  : std_proba,
            "mean_logit" : mean_logit,
            "all_probas" : all_probas,
        }


# =============================================================================
# TEST RAPIDE DES MODULES
# =============================================================================

if __name__ == "__main__":
    print("[models.py] Test de l'architecture complète...\n")

    B = 8    # Batch size
    from config import TEMPORAL_CFG, RPPG_CFG

    # Données synthétiques
    clinical  = torch.randn(B, 47)                                     # [B, 47]
    temporal  = torch.randn(B, TEMPORAL_CFG.seq_len, TEMPORAL_CFG.feature_dim)  # [B, 168, 12]
    rppg      = torch.randn(B, RPPG_CFG.input_dim)                     # [B, 8]
    temp_mask = torch.zeros(B, TEMPORAL_CFG.seq_len, dtype=torch.bool) # Pas de padding

    # Test branches individuelles
    clin_branch = ClinicalBranch(input_dim=47)
    h_clin, ent = clin_branch(clinical)
    print(f"✅ ClinicalBranch  : {clinical.shape} → h_clin {h_clin.shape} | entropy: {ent:.4f}")

    temp_branch = TemporalBranch()
    h_temp = temp_branch(temporal, temp_mask)
    print(f"✅ TemporalBranch  : {temporal.shape} → h_temp {h_temp.shape}")

    rppg_branch = RPPGBranch()
    h_rppg = rppg_branch(rppg)
    print(f"✅ RPPGBranch      : {rppg.shape} → h_rppg {h_rppg.shape}")

    # Test GMU
    gmu = GatedMultimodalUnit()
    z, gates = gmu(h_clin, h_temp, h_rppg)
    print(f"✅ GMU             : (h_clin, h_temp, h_rppg) → z {z.shape} | gates {gates.shape}")

    # Test réseau complet
    model = DiabetesMultimodalNet(n_clinical_features=47, return_embeddings=True)
    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\n✅ DiabetesMultimodalNet : {n_params:,} paramètres entraînables")

    out = model(clinical, temporal, rppg, temp_mask)
    print(f"  logit shape     : {out['logit'].shape}")
    print(f"  embedding shape : {out['embedding'].shape}")
    print(f"  gates shape     : {out['gates'].shape}")
    print(f"  entropy_loss    : {out['entropy_loss'].item():.4f}")

    # Test MC Dropout
    mc_infer = MCDropoutInference(model, T=10)
    mc_out   = mc_infer.predict(clinical, temporal, rppg, temp_mask, device=torch.device("cpu"))
    print(f"\n✅ MC Dropout (T=10) :")
    print(f"  mean_proba : {mc_out['mean_proba'].shape} → {mc_out['mean_proba'][:3].detach().numpy().round(3)}")
    print(f"  std_proba  : {mc_out['std_proba'].shape}  → {mc_out['std_proba'][:3].detach().numpy().round(3)}")

    print("\n[models.py] ✅ Tous les tests passés.")