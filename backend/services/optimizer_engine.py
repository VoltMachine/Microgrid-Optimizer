# -*- coding: utf-8 -*-
"""
Moteur d'optimisation MILP — Construction du modèle PuLP, résolution,
extraction des résultats et boucle financière 25 ans.

Supporte les résolutions 288h (12 jours-types) et 672h (4 semaines-types)
via le paramètre ResolutionConfig. La 8760h est gérée par optimizer_8760.py.
"""

import copy
import random
from typing import Optional, List, Tuple

import pulp

from ..models.schemas import EcoParams, TimeseriesData, SimulateRequest
from ..utils.helpers import (
    DAYS_M, N_HOURS, SPOT_PRICES_24H,
    CO2_GAS_KG_KWH, CO2_GRID_KG_KWH, GAS_ELEC_EFF, EMBODIED,
    BESS_CALENDAR_DEG, BESS_CYCLE_DEG, BESS_DEG_FLOOR,
    ResolutionConfig, RES_288, get_resolution_config,
)
from .finance_utils import get_crf, calculate_irr


# ══════════════════════════════════════════════════════════════════════════════
# DÉCLARATION DES VARIABLES LP / MILP
# ══════════════════════════════════════════════════════════════════════════════

def _declare_variables(model: pulp.LpProblem, milp: bool,
                        peak_load: float, res: ResolutionConfig) -> dict:
    """Déclare toutes les variables de décision. Si milp=True, ajoute les binaires."""
    N = res.n_hours
    caps = {
        "cap_s":      pulp.LpVariable("Cap_S",      lowBound=0),
        "cap_s_inv":  pulp.LpVariable("Cap_SI",     lowBound=0),
        "cap_b":      pulp.LpVariable("Cap_B",      lowBound=0),
        "cap_b_inv":  pulp.LpVariable("Cap_BI",     lowBound=0),
        "cap_boiler": pulp.LpVariable("Cap_Boiler", lowBound=0),
        "cap_w":      pulp.LpVariable("Cap_W",      lowBound=0),
        "cap_h":      pulp.LpVariable("Cap_H",      lowBound=0),
        "cap_g":      pulp.LpVariable("Cap_G",      lowBound=0),
        "cap_hp":     pulp.LpVariable("Cap_HP",     lowBound=0),
        "cap_tes":    pulp.LpVariable("Cap_TES",    lowBound=0),
        "max_grid":   pulp.LpVariable("MaxG",       lowBound=0),
    }
    flows = {
        "p_s_ac":       pulp.LpVariable.dicts("S_AC",       range(N), lowBound=0),
        "p_w_ac":       pulp.LpVariable.dicts("W_AC",       range(N), lowBound=0),
        "p_h_ac":       pulp.LpVariable.dicts("H_AC",       range(N), lowBound=0),
        "p_b_ch":       pulp.LpVariable.dicts("B_CH",       range(N), lowBound=0),
        "p_b_dis":      pulp.LpVariable.dicts("B_DIS",      range(N), lowBound=0),
        "soc_b":        pulp.LpVariable.dicts("SOC",        range(N), lowBound=0),
        "soc_i":        pulp.LpVariable.dicts("SOC_I",      range(res.num_periods), lowBound=0),
        "p_tes_ch":     pulp.LpVariable.dicts("TES_CH",     range(N), lowBound=0),
        "p_tes_dis":    pulp.LpVariable.dicts("TES_DIS",    range(N), lowBound=0),
        "soc_tes":      pulp.LpVariable.dicts("SOC_TES",    range(N), lowBound=0),
        "soc_tes_i":    pulp.LpVariable.dicts("SOC_TES_I",  range(res.num_periods), lowBound=0),
        "shift_up":     pulp.LpVariable.dicts("ShiftUp",    range(N), lowBound=0),
        "shift_down":   pulp.LpVariable.dicts("ShiftDown",  range(N), lowBound=0),
        "p_gas":        pulp.LpVariable.dicts("Gas",        range(N), lowBound=0),
        "p_gas_th":     pulp.LpVariable.dicts("GasTh",      range(N), lowBound=0),
        "p_buy":        pulp.LpVariable.dicts("Buy",        range(N), lowBound=0),
        "p_sell":       pulp.LpVariable.dicts("Sell",       range(N), lowBound=0),
        "p_shed":       pulp.LpVariable.dicts("Shed",       range(N), lowBound=0),
        "p_therm_shed": pulp.LpVariable.dicts("Therm_Shed", range(N), lowBound=0),
        "p_hp_elec":    pulp.LpVariable.dicts("HP_Elec",    range(N), lowBound=0),
        "ev_charge":    pulp.LpVariable.dicts("EV_Charge",  range(N), lowBound=0),
        "ev_discharge": pulp.LpVariable.dicts("EV_Dis",     range(N), lowBound=0),
        "ev_soc":       pulp.LpVariable.dicts("EV_SOC",     range(N), lowBound=0),
    }

    milp_vars = {}
    if milp:
        milp_vars["b_bess_ch"] = pulp.LpVariable.dicts(
            "B_Mode", range(N), cat="Binary"
        )
        milp_vars["gas_on"]    = pulp.LpVariable.dicts(
            "Gas_On", range(N), cat="Binary"
        )
        milp_vars["gas_start"] = pulp.LpVariable.dicts(
            "Gas_Start", range(N), lowBound=0
        )
        milp_vars["M_bess"] = peak_load * 5.0
        milp_vars["M_gas"]  = peak_load * 3.0

    return {**caps, **flows, **milp_vars}


# ══════════════════════════════════════════════════════════════════════════════
# FONCTION OBJECTIF
# ══════════════════════════════════════════════════════════════════════════════

def _build_objective(model: pulp.LpProblem, v: dict, p: EcoParams,
                     milp: bool, res: ResolutionConfig,
                     actual_boiler_eff: Optional[List[float]] = None) -> None:
    """Fonction objectif : CAPEX annualisé + OPEX."""
    r = p.economic.discount_rate
    obj = (
        v["cap_s"]      * p.solar.capex           * get_crf(r, p.solar.lifetime)
        + v["cap_s_inv"]  * p.solar.inverter_capex * get_crf(r, p.solar.inverter_lifetime)
        + v["cap_b"]      * p.storage.capex           * get_crf(r, p.storage.lifetime)
        + v["cap_b_inv"]  * p.storage.inverter_capex  * get_crf(r, p.storage.inverter_lifetime)
        + v["cap_boiler"] * p.thermal.boiler.capex         * get_crf(r, p.thermal.boiler.lifetime)
        + v["cap_w"]      * p.wind.capex           * get_crf(r, p.wind.lifetime)
        + v["cap_h"]      * p.hydro.capex          * get_crf(r, p.hydro.lifetime)
        + v["cap_g"]      * 500                    * get_crf(r, p.gas.lifetime)
        + v["cap_hp"]     * p.thermal.hp.capex             * get_crf(r, p.thermal.hp.lifetime)
        + v["cap_tes"]    * p.thermal.tes.capex            * get_crf(r, p.thermal.tes.lifetime)
        + v["max_grid"]   * p.grid.demand_charge        * 12
    )
    for t in range(res.n_hours):
        h = t % 24
        w = res.weight(t)
        bp = (
            SPOT_PRICES_24H[h] if p.grid.use_spot_market
            else (p.grid.peak_price if 8 <= h <= 20 else p.grid.offpeak_price)
        )
        sp = (
            max(0.0, SPOT_PRICES_24H[h] - 0.02) if p.grid.use_spot_market
            else p.grid.sell_price
        )
        obj += (
            (v["p_gas"][t]    / GAS_ELEC_EFF) * p.gas.fuel_price
            + (v["p_gas_th"][t] / (actual_boiler_eff[t] if actual_boiler_eff else p.thermal.boiler.eff)) * p.gas.fuel_price
            + v["p_buy"][t]   * bp
            - v["p_sell"][t]  * sp
            + v["p_b_dis"][t] * p.storage.cycle_cost
            + v["p_shed"][t]  * p.economic.voll
            + v["p_therm_shed"][t] * 999
        ) * w

        if milp:
            obj += v["gas_start"][t] * p.gas.startup_cost * w

    model += obj


# ══════════════════════════════════════════════════════════════════════════════
# CONTRAINTES
# ══════════════════════════════════════════════════════════════════════════════

def _add_constraints(model: pulp.LpProblem, v: dict, p: EcoParams,
                     full_load: List[float], therm_load: List[float],
                     actual_solar: List[float], actual_wind: List[float],
                     annual_hydro: List[float], milp: bool,
                     res: ResolutionConfig,
                     actual_cop: Optional[List[float]] = None,
                     actual_boiler_eff: Optional[List[float]] = None) -> None:
    """Contraintes physiques et opérationnelles."""
    N = res.n_hours

    peak_original_load = max(full_load) if full_load else 1.0
    MAX_GRID_CAPACITY  = peak_original_load * 3.0
    EV_CAPACITY = p.economic.num_evs * 50.0
    EV_COMMUTE  = p.economic.num_evs * 10.0

    M_bess = v.get("M_bess", peak_original_load * 5.0)
    M_gas  = v.get("M_gas",  peak_original_load * 3.0)
    gas_min_kw = (
        p.gas.max_kw * p.gas.min_load_pct
        if milp and p.gas.max_kw > 0 else 0.0
    )

    # ── Contraintes par période ────────────────────────────────────────────────
    for m in range(res.num_periods):
        model += v["soc_i"][m]     <= v["cap_b"]
        model += v["soc_i"][m]     >= v["cap_b"] * p.storage.min_soc
        model += v["soc_tes_i"][m] <= v["cap_tes"]
        pd = res.periods[m]
        model += (
            pulp.lpSum(v["shift_up"][t]   for t in range(pd.start_h, pd.start_h + pd.length_h))
            == pulp.lpSum(v["shift_down"][t] for t in range(pd.start_h, pd.start_h + pd.length_h))
        )

    # Budget carbone
    if p.economic.max_annual_co2_t > 0:
        model += (
            pulp.lpSum(
                (
                    (v["p_gas"][t]    / GAS_ELEC_EFF) * CO2_GAS_KG_KWH
                    + (v["p_gas_th"][t] / (actual_boiler_eff[t] if actual_boiler_eff else p.thermal.boiler.eff)) * CO2_GAS_KG_KWH
                    + v["p_buy"][t]   * CO2_GRID_KG_KWH
                ) * res.weight(t)
                for t in range(N)
            )
            <= p.economic.max_annual_co2_t * 1000
        )

    # Contraintes de surface / terrain
    if p.solar.max_kw > 0:
        model += v["cap_s"] <= p.solar.max_kw
    if p.wind.max_kw > 0:
        model += v["cap_w"] <= p.wind.max_kw
    if p.hydro.max_kw > 0:
        model += v["cap_h"] <= p.hydro.max_kw
    if milp and p.gas.max_kw > 0:
        model += v["cap_g"] <= p.gas.max_kw
    elif not milp and p.gas.max_kw == 0:
        model += v["cap_g"] == 0  # gaz désactivé (frontend toggle off)

    # ── Contraintes horaires ──────────────────────────────────────────────────
    for t in range(N):
        h = t % 24
        period_idx = res.period_of(t)
        first_hour_of_period = res.hour_in_period(t) == 0
        last_hour_of_period  = res.hour_in_period(t) == res.period_length_h - 1

        # Flexibilité demande
        model += v["shift_down"][t] <= full_load[t] * p.economic.max_flex
        model += v["shift_up"][t]   <= peak_original_load * p.economic.max_flex
        actual_load_t = full_load[t] + v["shift_up"][t] - v["shift_down"][t]

        # Génération renouvelable
        model += v["p_s_ac"][t] <= v["cap_s"] * actual_solar[t]
        model += v["p_s_ac"][t] <= v["cap_s_inv"]
        model += v["p_w_ac"][t] <= v["cap_w"] * actual_wind[t]
        model += v["p_h_ac"][t] <= v["cap_h"] * (annual_hydro[t] * p.hydro.flow)

        # ── Véhicules électriques ─────────────────────────────────────────────
        if h >= 18 or h <= 7:
            model += v["ev_charge"][t] <= p.economic.num_evs * 7.0
            if p.economic.v2g_enabled:
                model += v["ev_discharge"][t] <= p.economic.num_evs * 7.0
            else:
                model += v["ev_discharge"][t] == 0

            if h == 18:
                model += (
                    v["ev_soc"][t]
                    == (EV_CAPACITY - EV_COMMUTE)
                    + v["ev_charge"][t] * 0.95
                    - v["ev_discharge"][t] / 0.95
                )
            elif t == 0:
                model += (
                    v["ev_soc"][t]
                    == EV_CAPACITY
                    + v["ev_charge"][t] * 0.95
                    - v["ev_discharge"][t] / 0.95
                )
            else:
                model += (
                    v["ev_soc"][t]
                    == v["ev_soc"][t - 1]
                    + v["ev_charge"][t] * 0.95
                    - v["ev_discharge"][t] / 0.95
                )
            if h == 7:
                model += v["ev_soc"][t] == EV_CAPACITY
        else:
            model += v["ev_charge"][t]    == 0
            model += v["ev_discharge"][t] == 0
            model += v["ev_soc"][t]       == 0

        # ── Bilan électrique ──────────────────────────────────────────────────
        model += (
            v["p_s_ac"][t] + v["p_w_ac"][t] + v["p_h_ac"][t]
            + v["p_b_dis"][t] + v["p_gas"][t] + v["p_buy"][t]
            + v["p_shed"][t] + v["ev_discharge"][t]
            ==
            actual_load_t + v["p_b_ch"][t] + v["p_sell"][t]
            + v["p_hp_elec"][t] + v["ev_charge"][t]
        )

        # ── Bilan thermique ───────────────────────────────────────────────────
        model += v["p_hp_elec"][t]  <= v["cap_hp"]
        model += v["p_gas_th"][t]   <= v["cap_boiler"]
        model += (
            v["p_gas_th"][t]
            + v["p_hp_elec"][t] * (actual_cop[t] if actual_cop else p.thermal.hp.cop)
            + v["p_tes_dis"][t]
            + v["p_therm_shed"][t]
            == therm_load[t] + v["p_tes_ch"][t]
        )

        # ── Réseau ────────────────────────────────────────────────────────────
        if p.grid.connected:
            model += v["p_buy"][t]  <= MAX_GRID_CAPACITY
            model += v["p_sell"][t] <= MAX_GRID_CAPACITY
            model += v["p_buy"][t]  <= v["max_grid"]
            model += v["p_sell"][t] <= v["max_grid"]
        else:
            model += v["p_buy"][t]  == 0
            model += v["p_sell"][t] == 0

        # ── Moteur gaz ────────────────────────────────────────────────────────
        model += v["p_gas"][t] <= v["cap_g"]

        if milp:
            gas_on = v["gas_on"][t]
            gas_st = v["gas_start"][t]

            model += v["p_gas"][t] <= M_gas * gas_on
            if gas_min_kw > 0:
                model += v["p_gas"][t] >= gas_min_kw * gas_on
            if t > 0:
                model += gas_st >= v["gas_on"][t] - v["gas_on"][t - 1]
            else:
                model += gas_st >= gas_on
            model += gas_st >= 0

        if p.gas.ramp_limit_kw > 0 and t > 0:
            model += v["p_gas"][t] - v["p_gas"][t - 1] <= p.gas.ramp_limit_kw
            model += v["p_gas"][t - 1] - v["p_gas"][t] <= p.gas.ramp_limit_kw

        # ── Réserve N-1 ───────────────────────────────────────────────────────
        if p.economic.n1_reserve:
            model += v["cap_g"] + v["cap_b_inv"] + v["max_grid"] + v["p_shed"][t] \
                     >= v["p_gas"][t] + v["p_b_dis"][t] + v["p_buy"][t] + v["p_s_ac"][t]
            model += v["cap_g"] + v["cap_b_inv"] + v["max_grid"] + v["p_shed"][t] \
                     >= v["p_gas"][t] + v["p_b_dis"][t] + v["p_buy"][t] + v["p_w_ac"][t]
            model += v["cap_g"] + v["cap_b_inv"] + v["max_grid"] + v["p_shed"][t] \
                     >= v["p_gas"][t] + v["p_b_dis"][t] + v["p_buy"][t] + v["p_h_ac"][t]
            if p.grid.connected:
                model += v["cap_g"] + v["cap_b_inv"] + v["max_grid"] + v["p_shed"][t] \
                         >= v["p_gas"][t] + v["p_b_dis"][t] + v["p_buy"][t] + v["max_grid"]

        # ── Batterie ──────────────────────────────────────────────────────────
        model += v["soc_b"][t] <= v["cap_b"]
        model += v["soc_b"][t] >= v["cap_b"] * p.storage.min_soc
        model += v["p_b_ch"][t]  <= v["cap_b_inv"]
        model += v["p_b_dis"][t] <= v["cap_b_inv"]

        if milp:
            model += v["p_b_ch"][t]  <= M_bess * v["b_bess_ch"][t]
            model += v["p_b_dis"][t] <= M_bess * (1 - v["b_bess_ch"][t])

        if first_hour_of_period:
            model += (
                v["soc_b"][t]
                == v["soc_i"][period_idx]
                + v["p_b_ch"][t]  * p.storage.eff_ch
                - v["p_b_dis"][t] / p.storage.eff_dis
            )
        else:
            model += (
                v["soc_b"][t]
                == v["soc_b"][t - 1]
                + v["p_b_ch"][t]  * p.storage.eff_ch
                - v["p_b_dis"][t] / p.storage.eff_dis
            )
        if last_hour_of_period:
            model += v["soc_b"][t] == v["soc_i"][period_idx]

        # ── TES (ballon d'eau chaude) ─────────────────────────────────────────
        model += v["soc_tes"][t] <= v["cap_tes"]
        model += v["p_tes_ch"][t]  <= v["cap_tes"] / 2
        model += v["p_tes_dis"][t] <= v["cap_tes"] / 2
        if first_hour_of_period:
            model += (
                v["soc_tes"][t]
                == v["soc_tes_i"][period_idx]
                + v["p_tes_ch"][t]  * 0.95
                - v["p_tes_dis"][t] / 0.95
            )
        else:
            model += (
                v["soc_tes"][t]
                == v["soc_tes"][t - 1]
                + v["p_tes_ch"][t]  * 0.95
                - v["p_tes_dis"][t] / 0.95
            )
        if last_hour_of_period:
            model += v["soc_tes"][t] == v["soc_tes_i"][period_idx]


# ══════════════════════════════════════════════════════════════════════════════
# EXTRACTION DES RÉSULTATS
# ══════════════════════════════════════════════════════════════════════════════

def _extract_results(v: dict, full_load: List[float], therm_load: List[float],
                     comm_load: List[float], actual_solar: List[float],
                     p: EcoParams, res: ResolutionConfig,
                     actual_boiler_eff: Optional[List[float]] = None) -> tuple:
    """Extrait les valeurs optimales et calcule les KPIs."""
    N = res.n_hours

    def val(var):
        return var.varValue if var.varValue is not None else 0.0

    caps = {
        "solar":     val(v["cap_s"]),
        "solar_inv": val(v["cap_s_inv"]),
        "bess":      val(v["cap_b"]),
        "bess_inv":  val(v["cap_b_inv"]),
        "wind":      val(v["cap_w"]),
        "hydro":     val(v["cap_h"]),
        "gas":       val(v["cap_g"]),
        "max_grid":  val(v["max_grid"]),
        "hp":        val(v["cap_hp"]),
        "tes":       val(v["cap_tes"]),
        "boiler":    val(v["cap_boiler"]),
    }

    peak_load = max(full_load) if full_load else 1.0
    cable     = peak_load * p.economic.cable_capex
    capex = (
        caps["solar"]     * p.solar.capex
        + caps["solar_inv"] * p.solar.inverter_capex
        + caps["bess"]    * p.storage.capex
        + caps["bess_inv"]* p.storage.inverter_capex
        + caps["wind"]    * p.wind.capex
        + caps["hydro"]   * p.hydro.capex
        + caps["gas"]     * 500
        + caps["hp"]      * p.thermal.hp.capex
        + caps["tes"]     * p.thermal.tes.capex
        + caps["boiler"]  * p.thermal.boiler.capex
        + cable
    )

    fuel_gaz_elec_vol_y0 = sum(
        (val(v["p_gas"][t]) / GAS_ELEC_EFF) * res.weight(t)
        for t in range(N)
    )
    fuel_gaz_th_vol_y0 = sum(
        (val(v["p_gas_th"][t]) / (actual_boiler_eff[t] if actual_boiler_eff else p.thermal.boiler.eff)) * res.weight(t)
        for t in range(N)
    )

    fuel_y     = (fuel_gaz_elec_vol_y0 + fuel_gaz_th_vol_y0) * p.gas.fuel_price
    grid_buy_y = sum(
        val(v["p_buy"][t])
        * (SPOT_PRICES_24H[t % 24] if p.grid.use_spot_market
           else (p.grid.peak_price if 8 <= t % 24 <= 20 else p.grid.offpeak_price))
        * res.weight(t)
        for t in range(N)
    )
    grid_sell_y = sum(
        val(v["p_sell"][t])
        * (max(0.0, SPOT_PRICES_24H[t % 24] - 0.02) if p.grid.use_spot_market
           else p.grid.sell_price)
        * res.weight(t)
        for t in range(N)
    )
    om_y     = capex * 0.02
    dc_y     = caps["max_grid"] * p.grid.demand_charge * 12
    shed_vol = sum(val(v["p_shed"][t]) * res.weight(t) for t in range(N))
    shed_y   = shed_vol * p.economic.voll
    opex_y1  = fuel_y + grid_buy_y - grid_sell_y + om_y + dc_y + shed_y

    total_load = sum(full_load[t] * res.weight(t) for t in range(N))
    resilience = round(100 - (shed_vol / max(1, total_load) * 100), 2)
    curtail_s  = sum(
        max(0, caps["solar"] * actual_solar[t] - val(v["p_s_ac"][t])) * res.weight(t)
        for t in range(N)
    )

    caps.update({
        "resilience":  resilience,
        "curtailment": round(curtail_s),
        "opex_y1":     round(opex_y1),
    })

    hourly = {
        "solar_gen":      [val(v["p_s_ac"][t])       for t in range(N)],
        "wind_gen":       [val(v["p_w_ac"][t])       for t in range(N)],
        "hydro_gen":      [val(v["p_h_ac"][t])       for t in range(N)],
        "bess_dis":       [val(v["p_b_dis"][t])      for t in range(N)],
        "bess_ch":        [-val(v["p_b_ch"][t])      for t in range(N)],
        "gas_gen":        [val(v["p_gas"][t])        for t in range(N)],
        "gas_th_gen":     [val(v["p_gas_th"][t])     for t in range(N)],
        "grid_buy":       [val(v["p_buy"][t])        for t in range(N)],
        "grid_sell":      [val(v["p_sell"][t])       for t in range(N)],
        "ev_discharge":   [val(v["ev_discharge"][t]) for t in range(N)],
        "ev_charge":      [-val(v["ev_charge"][t])   for t in range(N)],
        "hp_elec_load":   [-val(v["p_hp_elec"][t])  for t in range(N)],
        "load_shed":      [val(v["p_shed"][t])       for t in range(N)],
        "therm_shed":     [val(v["p_therm_shed"][t]) for t in range(N)],
        "optimized_load": [
            full_load[t] + val(v["shift_up"][t]) - val(v["shift_down"][t])
            for t in range(N)
        ],
        "raw_load":   full_load,
        "comm_load":  comm_load,
        "spot_price": ([SPOT_PRICES_24H[t % 24] for t in range(N)]
                       if p.grid.use_spot_market else []),
    }

    opex_detail = {
        "fuel_elec_gaz": round(fuel_gaz_elec_vol_y0 * p.gas.fuel_price, 0),
        "fuel_th_gaz":   round(fuel_gaz_th_vol_y0   * p.gas.fuel_price, 0),
        "grid_buy":      round(grid_buy_y,  0),
        "grid_sell":     round(-grid_sell_y, 0),
        "om":            round(om_y, 0),
        "demand_charge": round(dc_y, 0),
        "load_shed":     round(shed_y, 0),
        "total":         round(opex_y1, 0),
    }

    # Nombre de cycles équivalents par an (décharge totale / cap batterie)
    bess_cycles = (sum(val(v["p_b_dis"][t]) * res.weight(t) for t in range(N))
                   / max(0.01, caps["bess"]))

    return (capex, opex_y1, caps, hourly, opex_detail,
            fuel_gaz_elec_vol_y0, fuel_gaz_th_vol_y0, shed_vol, bess_cycles)


# ══════════════════════════════════════════════════════════════════════════════
# CONSTRUCTION DES PROFILS DE CHARGE (factorisée)
# ══════════════════════════════════════════════════════════════════════════════

def _build_load_profiles(p: EcoParams, l_src: List[float],
                          res: ResolutionConfig,
                          is_noisy: bool = False, noisy_fn=None):
    """Factorise la construction des profils de charge (commun à solve_*)."""
    load_mult  = 1.10 if p.economic.p90_mode else 1.0
    S          = p.economic.seasonality
    season_mult = res.season_multipliers(S)

    def noisy(x):
        if noisy_fn:
            return noisy_fn(x)
        return max(0.0, x)

    full_load, therm_load, comm_load = [], [], []
    for t in range(res.n_hours):
        p_idx = res.period_of(t)
        m_mult = season_mult[p_idx] if len(l_src) != res.n_hours else 1.0
        c_p    = p.economic.commercial_power if 8 <= (t % 24) <= 18 else 0.0
        raw    = (l_src[t % len(l_src)] + c_p) * m_mult * load_mult
        val_t  = noisy(raw)
        full_load.append(val_t)
        therm_load.append(max(0.0, val_t * p.thermal.thermal_ratio))
        comm_load.append(max(0.0, c_p * m_mult * load_mult))

    return full_load, therm_load, comm_load


# ══════════════════════════════════════════════════════════════════════════════
# SOLVE_MICROGRID — Optimisation LP/MILP
# ══════════════════════════════════════════════════════════════════════════════

def solve_microgrid(data: TimeseriesData, base_solar: List[float],
                    base_wind: List[float], p: EcoParams,
                    is_noisy: bool = False,
                    base_cop: Optional[List[float]] = None,
                    base_boiler_eff: Optional[List[float]] = None):
    """Construit et résout le problème LP/MILP. Retourne un tuple ou None."""
    res = get_resolution_config(p.economic.resolution)
    N = res.n_hours

    err = p.economic.forecast_error if is_noisy else 0.0

    def noisy(x):
        return max(0.0, x * (1 + random.uniform(-err, err))) if err else max(0.0, x)

    p90 = 0.85 if p.economic.p90_mode else 1.0
    actual_solar = [noisy(base_solar[t % len(base_solar)] * p90) for t in range(N)]
    actual_wind  = [noisy(base_wind[t  % len(base_wind)]  * p90) for t in range(N)]
    h_src        = data.hydro_1kw if data.hydro_1kw else [0.9] * 24
    annual_hydro = [noisy(h_src[t % len(h_src)]) for t in range(N)]

    # Profils thermiques temporels (M3)
    cop_arr = [base_cop[t % len(base_cop)] for t in range(N)] if base_cop else None
    eff_arr = [base_boiler_eff[t % len(base_boiler_eff)] for t in range(N)] if base_boiler_eff else None

    l_src = data.load if data.load else [2.0] * 24
    full_load, therm_load, comm_load = _build_load_profiles(
        p, l_src, res, is_noisy, noisy_fn=noisy
    )
    peak_load = max(full_load) if full_load else 1.0

    milp  = p.gas.use_milp and res.milp_supported
    model = pulp.LpProblem("Microgrid_Dispatch", pulp.LpMinimize)
    v     = _declare_variables(model, milp, peak_load, res)
    _build_objective(model, v, p, milp, res, eff_arr)
    _add_constraints(model, v, p, full_load, therm_load,
                     actual_solar, actual_wind, annual_hydro, milp, res,
                     cop_arr, eff_arr)

    solver = pulp.PULP_CBC_CMD(
        msg=False, timeLimit=res.time_limit_milp if milp else res.time_limit_lp
    )
    model.solve(solver)
    if pulp.LpStatus[model.status] != "Optimal":
        return None

    return _extract_results(v, full_load, therm_load, comm_load, actual_solar, p, res, eff_arr)


# ══════════════════════════════════════════════════════════════════════════════
# SOLVE_SIMULATION — Capacités fixées, dispatch optimisé
# ══════════════════════════════════════════════════════════════════════════════

def solve_simulation(req: SimulateRequest, base_solar: List[float],
                     base_wind: List[float],
                     base_cop: Optional[List[float]] = None,
                     base_boiler_eff: Optional[List[float]] = None):
    """Même LP que solve_microgrid, avec capacités fixées par l'utilisateur."""
    p    = req.params
    res  = get_resolution_config(p.economic.resolution)
    N    = res.n_hours
    p90  = 0.85 if p.economic.p90_mode else 1.0
    actual_solar = [base_solar[t % len(base_solar)] * p90 for t in range(N)]
    actual_wind  = [base_wind[t  % len(base_wind)]  * p90 for t in range(N)]
    h_src        = req.hydro_1kw if req.hydro_1kw else [0.9] * 24
    annual_hydro = [h_src[t % len(h_src)] for t in range(N)]

    cop_arr = [base_cop[t % len(base_cop)] for t in range(N)] if base_cop else None
    eff_arr = [base_boiler_eff[t % len(base_boiler_eff)] for t in range(N)] if base_boiler_eff else None

    l_src = req.load if req.load else [2.0] * 24
    full_load, therm_load, comm_load = _build_load_profiles(p, l_src, res)
    peak_load = max(full_load) if full_load else 1.0

    milp  = p.gas.use_milp and res.milp_supported
    model = pulp.LpProblem("Microgrid_Simulation", pulp.LpMinimize)
    v     = _declare_variables(model, milp, peak_load, res)

    # Fixer les capacités aux valeurs saisies par l'utilisateur
    model += v["cap_s"]      == req.solar_kw
    model += v["cap_s_inv"]  == (req.solar_inv_kw if req.solar_inv_kw > 0 else req.solar_kw)
    model += v["cap_w"]      == req.wind_kw
    model += v["cap_h"]      == req.hydro_kw
    model += v["cap_b"]      == req.bess_kwh
    model += v["cap_b_inv"]  == req.bess_kw
    model += v["cap_g"]      == req.gas_kw
    model += v["cap_hp"]     == req.hp_kw
    model += v["cap_boiler"] == req.boiler_kw
    model += v["cap_tes"]    == req.tes_kwh
    model += v["max_grid"]   == req.grid_kw

    _build_objective(model, v, p, milp, res, eff_arr)
    _add_constraints(model, v, p, full_load, therm_load,
                     actual_solar, actual_wind, annual_hydro, milp, res,
                     cop_arr, eff_arr)

    solver = pulp.PULP_CBC_CMD(
        msg=False, timeLimit=res.time_limit_milp if milp else res.time_limit_lp
    )
    model.solve(solver)
    if pulp.LpStatus[model.status] != "Optimal":
        return None

    return _extract_results(v, full_load, therm_load, comm_load, actual_solar, p, res, eff_arr)


# ══════════════════════════════════════════════════════════════════════════════
# BASELINE OPEX
# ══════════════════════════════════════════════════════════════════════════════

def _effective_weight_fn(h_base_or_load, res):
    """Retourne (N, weight_fn) adapté à la résolution réelle des données."""
    raw = h_base_or_load.get("raw_load", h_base_or_load) if isinstance(h_base_or_load, dict) else h_base_or_load
    N_data = len(raw) if hasattr(raw, '__len__') else 288
    if N_data == 8760:
        return N_data, lambda t: 1.0  # 8760h : chaque heure compte pour 1
    return res.n_hours, res.weight


def calc_baseline_opex(p: EcoParams, raw_load: List[float],
                       res: Optional[ResolutionConfig] = None) -> float:
    """OPEX annuel du site sans microgrid (référence pour les savings)."""
    if res is None:
        res = RES_288
    N, weight = _effective_weight_fn(raw_load, res)
    cost      = 0.0
    peak_load = max(raw_load) if raw_load else 0
    for t in range(N):
        h = t % 24
        w = weight(t)
        if p.grid.connected:
            bp = (
                SPOT_PRICES_24H[h] if p.grid.use_spot_market
                else (p.grid.peak_price if 8 <= h <= 20 else p.grid.offpeak_price)
            )
            cost += raw_load[t] * bp * w
        else:
            cost += raw_load[t] * p.gas.fuel_price / GAS_ELEC_EFF * w
    if p.grid.connected:
        cost += peak_load * p.grid.demand_charge * 12
    return cost


# ══════════════════════════════════════════════════════════════════════════════
# BILAN CARBONE
# ══════════════════════════════════════════════════════════════════════════════

def _carbon_balance(p: EcoParams, caps: dict, h_base: dict,
                    res: Optional[ResolutionConfig] = None,
                    actual_boiler_eff: Optional[List[float]] = None) -> tuple:
    """Retourne (dette_initiale_t, co2_baseline_t, co2_microgrid_t, co2_evite_t)."""
    if res is None:
        res = RES_288
    N, weight = _effective_weight_fn(h_base, res)

    dette = (
        caps["solar"]     * EMBODIED["solar"]
        + caps["wind"]    * EMBODIED["wind"]
        + caps["hydro"]   * EMBODIED["hydro"]
        + caps["bess"]    * EMBODIED["bess"]
        + caps["solar_inv"] * EMBODIED["inv"]
        + caps["bess_inv"]  * EMBODIED["inv"]
        + caps["gas"]     * EMBODIED["gas"]
        + caps["boiler"]  * EMBODIED["boiler"]
        + caps["hp"]      * EMBODIED["hp"]
        + caps["tes"]     * EMBODIED["tes"]
    ) / 1000

    total_load_y = sum(h_base["raw_load"][t] * weight(t)
                       for t in range(N))
    baseline = (
        (total_load_y * CO2_GRID_KG_KWH) if p.grid.connected
        else (total_load_y / GAS_ELEC_EFF * CO2_GAS_KG_KWH)
    ) / 1000

    boiler_eff_t = actual_boiler_eff if actual_boiler_eff else [p.thermal.boiler.eff] * N
    microgrid = sum(
        (
            (h_base["gas_gen"][t]    / GAS_ELEC_EFF)           * CO2_GAS_KG_KWH
            + (h_base["gas_th_gen"][t] / boiler_eff_t[t % len(boiler_eff_t)]) * CO2_GAS_KG_KWH
            + h_base["grid_buy"][t]  * CO2_GRID_KG_KWH
        ) * weight(t)
        for t in range(N)
    ) / 1000

    return dette, baseline, microgrid, baseline - microgrid


# ══════════════════════════════════════════════════════════════════════════════
# BOUCLE FINANCIÈRE 25 ANS
# ══════════════════════════════════════════════════════════════════════════════

def _financial_loop(p: EcoParams, c_base: float, caps: dict,
                     h_base: dict, fuel_gaz_elec_vol_y0: float,
                     fuel_gaz_th_vol_y0: float, shed_vol: float,
                     dette_carbone_initiale: float,
                     co2_evite_annuel: float,
                     res: Optional[ResolutionConfig] = None,
                     bess_cycles: float = 0.0) -> dict:
    """Boucle financière 25 ans commune aux deux endpoints."""
    if res is None:
        res = RES_288
    N, weight = _effective_weight_fn(h_base, res)

    horizon          = 25
    cash_flows       = [-c_base]
    cumul_fin        = -c_base
    cash_flows_cumul = [-c_base]
    cumul_co2          = -dette_carbone_initiale
    carbon_flows_cumul = [round(cumul_co2, 2)]
    base_opex_y0     = calc_baseline_opex(p, h_base["raw_load"], res)

    # Compteurs de dégradation BESS
    bess_age_since_repl   = 0   # années depuis dernier remplacement
    bess_cycles_since_repl = 0.0  # cycles cumulés depuis dernier remplacement

    def residual_value(asset_capex_total: float, lifetime_y: int,
                        year: int = horizon) -> float:
        remaining = max(0, lifetime_y - (year % lifetime_y
                                         if year % lifetime_y != 0 else lifetime_y))
        return asset_capex_total * (remaining / lifetime_y)

    for y in range(1, horizon + 1):
        inf_g  = (1 + p.economic.grid_inflation) ** y
        inf_f  = (1 + p.economic.gas_inflation)  ** y
        inf_om = (1 + p.economic.om_inflation)   ** y

        base_opex_y = base_opex_y0 * (inf_g if p.grid.connected else inf_f)

        # ── Dégradation BESS ─────────────────────────────────────────────────
        bess_age_since_repl += 1
        bess_cycles_since_repl += bess_cycles
        bess_cap_factor = max(
            BESS_DEG_FLOOR,
            1.0 - BESS_CALENDAR_DEG * bess_age_since_repl - BESS_CYCLE_DEG * bess_cycles_since_repl
        )
        # Énergie batterie perdue par dégradation (kWh/an)
        bess_dis_annual_y0 = sum(h_base["bess_dis"][t] * weight(t) for t in range(N))
        bess_shortfall_kwh = bess_dis_annual_y0 * (1.0 - bess_cap_factor)
        # Coût marginal de remplacement (réseau si connecté, gaz si îloté)
        bess_backup_price = (
            (p.grid.peak_price + p.grid.offpeak_price) / 2 if p.grid.connected
            else p.gas.fuel_price / GAS_ELEC_EFF
        )
        bess_deg_extra_opex = bess_shortfall_kwh * bess_backup_price * inf_g
        bess_deg_extra_co2  = bess_shortfall_kwh * (CO2_GRID_KG_KWH if p.grid.connected else CO2_GAS_KG_KWH / GAS_ELEC_EFF) / 1000

        grid_cost_y = 0.0
        if p.grid.connected:
            grid_cost_y = sum(
                (
                    h_base["grid_buy"][t]
                    * (SPOT_PRICES_24H[t % 24] if p.grid.use_spot_market
                       else (p.grid.peak_price if 8 <= t % 24 <= 20
                             else p.grid.offpeak_price))
                    - h_base["grid_sell"][t]
                    * (max(0.0, SPOT_PRICES_24H[t % 24] - 0.02) if p.grid.use_spot_market
                       else p.grid.sell_price)
                ) * inf_g * weight(t)
                for t in range(N)
            )
            grid_cost_y += caps["max_grid"] * p.grid.demand_charge * 12 * inf_g

        fuel_cost_y = (fuel_gaz_elec_vol_y0 + fuel_gaz_th_vol_y0) * p.gas.fuel_price * inf_f
        om_cost_y   = (c_base * 0.02) * inf_om
        shed_cost_y = shed_vol * p.economic.voll * inf_g

        solar_degradation_factor = (1 - p.solar.degradation) ** y
        solar_gen_y0 = sum(h_base["solar_gen"][t] * weight(t)
                           for t in range(N))
        solar_loss_y = solar_gen_y0 * (1 - solar_degradation_factor) * (
            (p.grid.peak_price if p.grid.connected
             else p.gas.fuel_price / GAS_ELEC_EFF) * inf_g
        )

        opex_y  = (grid_cost_y + fuel_cost_y + om_cost_y + shed_cost_y
                    + solar_loss_y + bess_deg_extra_opex)
        savings = base_opex_y - opex_y

        repl_fin = 0.0
        repl_co2 = 0.0
        replacements = [
            (p.solar.inverter_lifetime, caps["solar_inv"] * p.solar.inverter_capex, caps["solar_inv"] * EMBODIED["inv"]),
            (p.storage.lifetime,           caps["bess"]      * p.storage.capex,           caps["bess"]      * EMBODIED["bess"]),
            (p.storage.inverter_lifetime,  caps["bess_inv"]  * p.storage.inverter_capex,  caps["bess_inv"]  * EMBODIED["inv"]),
            (p.gas.lifetime,            caps["gas"]       * 500,                    caps["gas"]       * EMBODIED["gas"]),
            (p.thermal.hp.lifetime,             caps["hp"]        * p.thermal.hp.capex,             caps["hp"]        * EMBODIED["hp"]),
            (p.thermal.boiler.lifetime,         caps["boiler"]    * p.thermal.boiler.capex,         caps["boiler"]    * EMBODIED["boiler"]),
            (p.thermal.tes.lifetime,            caps["tes"]       * p.thermal.tes.capex,            caps["tes"]       * EMBODIED["tes"]),
            (p.wind.lifetime,           caps["wind"]      * p.wind.capex,           caps["wind"]      * EMBODIED["wind"]),
        ]
        for lt, cost_r, co2_r in replacements:
            if y % lt == 0:
                repl_fin += cost_r
                repl_co2 += co2_r / 1000

        if y == horizon:
            savings += (
                residual_value(caps["hydro"]      * p.hydro.capex,            p.hydro.lifetime)
                + residual_value(caps["wind"]     * p.wind.capex,             p.wind.lifetime)
                + residual_value(caps["solar"]    * p.solar.capex,            p.solar.lifetime)
                + residual_value(caps["solar_inv"]* p.solar.inverter_capex,   p.solar.inverter_lifetime)
                + residual_value(caps["bess"]     * p.storage.capex,             p.storage.lifetime)
                + residual_value(caps["bess_inv"] * p.storage.inverter_capex,    p.storage.inverter_lifetime)
                + residual_value(caps["gas"]      * 500,                       p.gas.lifetime)
                + residual_value(caps["hp"]       * p.thermal.hp.capex,               p.thermal.hp.lifetime)
                + residual_value(caps["boiler"]   * p.thermal.boiler.capex,           p.thermal.boiler.lifetime)
                + residual_value(caps["tes"]      * p.thermal.tes.capex,              p.thermal.tes.lifetime)
            )

        net_y = savings - repl_fin
        cash_flows.append(net_y)
        cumul_fin += net_y
        cash_flows_cumul.append(round(cumul_fin))
        cumul_co2 += co2_evite_annuel - repl_co2 - bess_deg_extra_co2
        carbon_flows_cumul.append(round(cumul_co2, 2))

        # Réinitialiser les compteurs de dégradation BESS après remplacement
        if y % p.storage.lifetime == 0:
            bess_age_since_repl = 0
            bess_cycles_since_repl = 0.0

    van = sum(cf / (1 + p.economic.discount_rate) ** i for i, cf in enumerate(cash_flows))
    tri = calculate_irr(cash_flows)
    roi_final = next((i for i, v_ in enumerate(cash_flows_cumul) if v_ > 0), 99.9)
    carbon_pb = next((i for i, v_ in enumerate(carbon_flows_cumul) if v_ > 0), 99.9)

    return {
        "van": round(van), "tri": tri,
        "roi_years": roi_final, "carbon_payback": carbon_pb,
        "cashflow_25y": cash_flows_cumul,
        "carbonflow_25y": carbon_flows_cumul,
    }
