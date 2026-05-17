# -*- coding: utf-8 -*-
"""Constantes partagées du projet Microgrid."""

from dataclasses import dataclass, field
from typing import List

# ── Calendrier ────────────────────────────────────────────────────────────────
DAYS_M = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
N_HOURS = 288      # 12 mois × 24 h (jour-type)
N_HOURS_672 = 672   # 4 saisons × 7 jours × 24 h
N_HOURS_8760 = 8760  # année complète horaire

# Bornes mensuelles pour 8760h (heures cumulées, année non-bissextile)
MONTH_BOUNDS_8760 = [0, 744, 1416, 2160, 2880, 3624, 4344, 5088, 5832, 6552, 7296, 8016, 8760]
MONTH_DAYS_8760 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

# ── Prix spot horaires (€/kWh) ───────────────────────────────────────────────
SPOT_PRICES_24H = [
    0.08, 0.07, 0.06, 0.06, 0.07, 0.09, 0.15, 0.20,
    0.18, 0.12, 0.05, 0.02, 0.01, 0.02, 0.05, 0.10,
    0.15, 0.25, 0.35, 0.30, 0.20, 0.15, 0.12, 0.09,
]

# ── Facteurs d'émissions CO₂ ──────────────────────────────────────────────────
CO2_GAS_KG_KWH  = 0.500   # kg CO₂ / kWh gaz (PCI)
CO2_GRID_KG_KWH = 0.060   # kg CO₂ / kWh électricité réseau (mix moyen FR)

# ── Rendement électrique du moteur gaz ────────────────────────────────────────
GAS_ELEC_EFF = 0.35

# ── Empreinte carbone embarquée (kg CO₂ / kW ou kWh installé) ─────────────────
EMBODIED = {
    "solar":  800,
    "wind":   600,
    "hydro": 1200,
    "bess":   100,
    "inv":     50,
    "gas":    200,
    "boiler": 100,
    "hp":     150,
    "tes":     30,
}

# ── Modèle thermique (M3) ───────────────────────────────────────────────────
NOCT = 45.0              # °C, température nominale de cellule (800 W/m², 20°C ambiant)
T_STC = 25.0             # °C, température de référence STC
G_NOCT = 800.0           # W/m², irradiance aux conditions NOCT
T_COP_REF = 7.0          # °C, température extérieure de référence pour le COP nominal
COP_MAX = 8.0            # COP plafond (évite valeurs irréalistes par temps chaud)
BOILER_EFF_GAIN = 0.04   # gain max d'efficacité par condensation (de 0.90 à 0.94)
BOILER_T_REF_HIGH = 20.0 # °C, température extérieure pour efficacité nominale chaudière
BOILER_T_DELTA = 40.0    # °C, plage de température pour la courbe chaudière (20°C → -20°C)

# ── Dégradation BESS (capacity fade) ──────────────────────────────────────────
BESS_CALENDAR_DEG = 0.01   # 1 % / an de perte calendaire
BESS_CYCLE_DEG = 0.0005    # 0.05 % / cycle équivalent de perte cyclique
BESS_DEG_FLOOR = 0.70      # capacité minimum avant remplacement (70 %)

# ── Rayonnement & géométrie solaire (M4) ────────────────────────────────────
G_SC = 1367.0            # W/m², constante solaire
GROUND_ALBEDO = 0.2      # albédo du sol par défaut

# ══════════════════════════════════════════════════════════════════════════════
# ResolutionConfig — Abstraction des résolutions temporelles
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class PeriodDef:
    """Définition d'une période (mois ou saison) dans la résolution."""
    name: str          # "Janvier", "Hiver", etc.
    start_h: int       # première heure dans le profil
    length_h: int      # 24 (jour) ou 168 (semaine)
    day_count: int     # jours calendaires représentés
    season_coeff: float = 0.0  # coef saisonnier (mult = 1 + coeff × S)


@dataclass
class ResolutionConfig:
    """Configuration complète d'une résolution temporelle."""
    key: str                     # "288h" | "672h" | "8760h"
    n_hours: int                 # pas de temps total
    num_periods: int             # nombre de périodes distinctes
    period_length_h: int         # heures par période
    periods: List[PeriodDef]     # définitions des périodes
    milp_supported: bool = True
    time_limit_milp: int = 120
    time_limit_lp: int = 60

    def weight(self, t: int) -> float:
        """Poids d'annualisation pour l'heure t (somme ≈ 8760)."""
        p = self.period_of(t)
        if p < len(self.periods):
            pd = self.periods[p]
            return pd.day_count / (pd.length_h / 24)
        return 1.0

    def period_of(self, t: int) -> int:
        """Index de la période (mois ou saison) pour l'heure t."""
        return t // self.period_length_h

    def hour_in_period(self, t: int) -> int:
        """Heure dans la période (0..period_length_h-1)."""
        return t % self.period_length_h

    def month_of(self, t: int) -> int:
        """Index du mois (0-11) pour compatibilité (288h). Équivalent à period_of."""
        return self.period_of(t)

    def season_multipliers(self, S: float) -> List[float]:
        """Multiplicateurs de charge par période pour une saisonnalité S."""
        return [1.0 + pd.season_coeff * S for pd in self.periods]


# ── Instances pré-construites ─────────────────────────────────────────────────

RES_288 = ResolutionConfig(
    key="288h", n_hours=288, num_periods=12, period_length_h=24,
    periods=[
        PeriodDef("Janvier",    0,   24, 31, 1.0),
        PeriodDef("Février",   24,   24, 28, 1.0),
        PeriodDef("Mars",      48,   24, 31, 0.5),
        PeriodDef("Avril",     72,   24, 30, 0.2),
        PeriodDef("Mai",       96,   24, 31, 0.0),
        PeriodDef("Juin",     120,   24, 30, 0.0),
        PeriodDef("Juillet",  144,   24, 31, 0.0),
        PeriodDef("Août",     168,   24, 31, 0.0),
        PeriodDef("Septembre",192,   24, 30, 0.0),
        PeriodDef("Octobre",  216,   24, 31, 0.3),
        PeriodDef("Novembre", 240,   24, 30, 0.7),
        PeriodDef("Décembre", 264,   24, 31, 1.0),
    ],
    milp_supported=True, time_limit_milp=120, time_limit_lp=60,
)

# Jours par saison météo
DAYS_PER_SEASON = [90, 92, 92, 91]  # Hiver, Printemps, Été, Automne

RES_672 = ResolutionConfig(
    key="672h", n_hours=672, num_periods=4, period_length_h=168,
    periods=[
        PeriodDef("Déc–Fév",       0, 168, DAYS_PER_SEASON[0], 1.0),
        PeriodDef("Mars–Mai",    168, 168, DAYS_PER_SEASON[1], 0.2),
        PeriodDef("Juin–Août",   336, 168, DAYS_PER_SEASON[2], 0.0),
        PeriodDef("Sept–Nov",    504, 168, DAYS_PER_SEASON[3], 0.7),
    ],
    milp_supported=True, time_limit_milp=180, time_limit_lp=90,
)


def get_resolution_config(resolution: str) -> ResolutionConfig:
    """Retourne la config correspondant à la clé de résolution."""
    if resolution == "672h":
        return RES_672
    if resolution == "8760h":
        return RES_288  # 8760h utilise son propre solveur ; fallback pour _financial_loop
    return RES_288  # défaut
