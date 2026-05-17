# -*- coding: utf-8 -*-
"""Modèles Pydantic imbriqués pour l'API Microgrid."""

from typing import Optional, List
from pydantic import BaseModel


# ══════════════════════════════════════════════════════════════════════════════
# SOUS-MODÈLES TECHNIQUES
# ══════════════════════════════════════════════════════════════════════════════

class SolarSpecs(BaseModel):
    """Spécifications du système photovoltaïque."""
    capex: float = 600.0            # €/kW
    inverter_capex: float = 150.0   # €/kW
    lifetime: int = 25              # années
    inverter_lifetime: int = 10     # années
    degradation: float = 0.005      # 0.5 %/an
    temp_coeff: float = -0.004      # γ — coeff. température puissance (/°C)
    tilt: float = 30.0              # ° inclinaison (0=horizontal, 90=façade)
    azimuth: float = 0.0            # ° orientation (0=Sud, −90=Est, 90=Ouest, convention PVGIS)
    albedo: float = 0.2             # albédo du sol (réflexion diffuse)
    tracking: str = "fixed"         # "fixed" | "mono_h" (axe N-S) | "dual" (2 axes)
    max_kw: float = 200.0           # kWc — contrainte de surface


class WindSpecs(BaseModel):
    """Spécifications du système éolien."""
    capex: float = 1500.0           # €/kW
    lifetime: int = 20              # années
    hub_height: float = 80.0        # m — hauteur moyeu
    roughness_length: float = 0.03  # m — rugosité terrain z0
    max_kw: float = 200.0           # kW — contrainte de surface


class HydroSpecs(BaseModel):
    """Spécifications du système hydroélectrique (fil de l'eau)."""
    capex: float = 2500.0           # €/kW
    lifetime: int = 30              # années
    flow: float = 1.0               # facteur de débit (sans dimension)
    max_kw: float = 0.0             # kW — contrainte de débit réel du site (0 = pas de limite)


class StorageSpecs(BaseModel):
    """Spécifications du stockage par batterie (BESS)."""
    capex: float = 300.0            # €/kWh
    inverter_capex: float = 150.0   # €/kW
    lifetime: int = 10              # années
    inverter_lifetime: int = 10     # années
    eff_ch: float = 0.95            # rendement charge
    eff_dis: float = 0.95           # rendement décharge
    min_soc: float = 0.20           # état de charge minimum
    cycle_cost: float = 0.05        # €/kWh cyclé


class HPSpecs(BaseModel):
    """Spécifications de la pompe à chaleur."""
    capex: float = 800.0            # €/kW
    lifetime: int = 15              # années
    cop: float = 3.0                # COP nominal à 7°C extérieur
    supply_temp: float = 35.0       # °C — T° distribution chauffage (35 plancher, 55 radiateurs)


class BoilerSpecs(BaseModel):
    """Spécifications de la chaudière gaz."""
    capex: float = 150.0            # €/kW
    lifetime: int = 15              # années
    eff: float = 0.90               # rendement thermique


class TESspecs(BaseModel):
    """Spécifications du stockage thermique (ballon d'eau chaude)."""
    capex: float = 50.0             # €/kWh
    lifetime: int = 20              # années


class ThermalSpecs(BaseModel):
    """Configuration du système thermique."""
    thermal_ratio: float = 0.0      # fraction thermique de la charge
    hp: HPSpecs = HPSpecs()
    boiler: BoilerSpecs = BoilerSpecs()
    tes: TESspecs = TESspecs()


class GasSpecs(BaseModel):
    """Spécifications du groupe électrogène gaz."""
    fuel_price: float = 0.20        # €/kWh PCI
    lifetime: int = 15              # années
    ramp_limit_kw: float = 0.0      # 0 = pas de limite
    use_milp: bool = False          # active les variables binaires
    min_load_pct: float = 0.30      # charge minimale (% de max_gas_kw)
    startup_cost: float = 5.0       # €/démarrage
    max_kw: float = 10000.0         # kW — 0 = source désactivée


class GridConfig(BaseModel):
    """Configuration du raccordement réseau."""
    connected: bool = False
    use_spot_market: bool = False
    sell_price: float = 0.10        # €/kWh
    peak_price: float = 0.25        # €/kWh (HP 8h-20h)
    offpeak_price: float = 0.12     # €/kWh (HC)
    demand_charge: float = 10.0     # €/kW/mois


class EconomicConfig(BaseModel):
    """Paramètres économiques et de simulation."""
    discount_rate: float = 0.05     # taux d'actualisation
    grid_inflation: float = 0.04    # inflation électricité
    gas_inflation: float = 0.02     # inflation gaz
    om_inflation: float = 0.02      # inflation O&M
    voll: float = 5.0               # value of lost load (€/kWh)
    cable_capex: float = 150.0      # €/kW (câblage réseau)
    run_sensitivity: bool = False   # active le diagramme Tornado
    forecast_error: float = 0.0     # erreur de prévision (±)
    p90_mode: bool = False          # mode P90 (charge +10 %, EnR −15 %)
    seasonality: float = 0.30       # amplitude saisonnière hiver
    max_flex: float = 0.0           # flexibilité de la demande
    max_annual_co2_t: float = 0.0   # 0 = pas de contrainte carbone
    commercial_power: float = 0.0   # kW — charge commerciale jour
    num_evs: int = 0                # nombre de véhicules électriques
    v2g_enabled: bool = False       # vehicle-to-grid
    tmy_start_year: int = 2013      # première année NASA POWER
    tmy_end_year: int = 2022        # dernière année NASA POWER
    use_8760h: bool = False         # DEPRECATED — utiliser `resolution` à la place
    resolution: str = "288h"        # "288h" | "672h" | "8760h"
    stochastic: bool = False        # analyse P90 multi-années (M5)
    extreme_events: bool = False    # stress-test événements extrêmes (M6)
    n1_reserve: bool = False        # contrainte N-1 (perte du plus gros producteur)


# ══════════════════════════════════════════════════════════════════════════════
# MODÈLE PARENT
# ══════════════════════════════════════════════════════════════════════════════

class EcoParams(BaseModel):
    """Paramètres économiques et techniques du microgrid (modèle racine)."""
    solar: SolarSpecs = SolarSpecs()
    wind: WindSpecs = WindSpecs()
    hydro: HydroSpecs = HydroSpecs()
    storage: StorageSpecs = StorageSpecs()
    thermal: ThermalSpecs = ThermalSpecs()
    gas: GasSpecs = GasSpecs()
    grid: GridConfig = GridConfig()
    economic: EconomicConfig = EconomicConfig()


# ══════════════════════════════════════════════════════════════════════════════
# DONNÉES D'ENTRÉE API
# ══════════════════════════════════════════════════════════════════════════════

class TimeseriesData(BaseModel):
    """Données de charge et production renouvelable pour l'optimisation."""
    load: List[float]
    wind_1kw: List[float]
    hydro_1kw: List[float]
    params: EcoParams
    lat: Optional[float] = 48.85
    lon: Optional[float] = 2.35


class SimulateRequest(BaseModel):
    """Paramétrage personnel : capacités fixées manuellement, dispatch optimisé."""
    params: EcoParams
    load: List[float] = []
    wind_1kw: List[float] = []
    hydro_1kw: List[float] = []
    lat: float = 48.85
    lon: float = 2.35
    solar_kw: float = 0.0
    solar_inv_kw: float = 0.0
    wind_kw: float = 0.0
    hydro_kw: float = 0.0
    bess_kwh: float = 0.0
    bess_kw: float = 0.0
    gas_kw: float = 0.0
    hp_kw: float = 0.0
    boiler_kw: float = 0.0
    tes_kwh: float = 0.0
    grid_kw: float = 0.0
