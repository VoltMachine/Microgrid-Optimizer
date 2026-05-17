# -*- coding: utf-8 -*-
"""
Solveur d'optimisation 8760h — année chronologique complète.
LP uniquement (pas de MILP à cette échelle).
"""

import random
from typing import List, Optional

import pulp

from ..models.schemas import EcoParams, TimeseriesData, SimulateRequest
from ..utils.helpers import (
    N_HOURS_8760, MONTH_BOUNDS_8760, MONTH_DAYS_8760,
    SPOT_PRICES_24H, CO2_GAS_KG_KWH, CO2_GRID_KG_KWH, GAS_ELEC_EFF, EMBODIED,
    BESS_CALENDAR_DEG, BESS_CYCLE_DEG, BESS_DEG_FLOOR,
)
from .finance_utils import get_crf, calculate_irr


def _expand_load_8760(l_src: List[float], p: EcoParams, is_noisy: bool = False,
                       noisy_fn=None) -> tuple:
    """
    Construit les profils de charge 8760h.
    Si l_src a 24 valeurs → expansion avec saisonnalité mensuelle.
    Si l_src a 8760 valeurs → utilisation directe.
    """
    load_mult = 1.10 if p.economic.p90_mode else 1.0
    S = p.economic.seasonality
    month_mult = [1+S, 1+S, 1+0.5*S, 1+0.2*S, 1, 1, 1, 1, 1, 1+0.3*S, 1+0.7*S, 1+S]

    def noisy(x):
        if noisy_fn:
            return noisy_fn(x)
        return max(0.0, x)

    full_load, therm_load, comm_load = [], [], []

    if len(l_src) == N_HOURS_8760:
        # Données 8760h fournies directement
        for t in range(N_HOURS_8760):
            h = t % 24
            m = next(i for i in range(12) if MONTH_BOUNDS_8760[i] <= t < MONTH_BOUNDS_8760[i+1])
            c_p = p.economic.commercial_power if 8 <= h <= 18 else 0.0
            val_t = noisy(l_src[t] * load_mult + c_p * load_mult)
            full_load.append(val_t)
            therm_load.append(max(0.0, val_t * p.thermal.thermal_ratio))
            comm_load.append(max(0.0, c_p * load_mult))
    else:
        # Expansion depuis 24h
        for m in range(12):
            for d in range(MONTH_DAYS_8760[m]):
                for h in range(24):
                    c_p = p.economic.commercial_power if 8 <= h <= 18 else 0.0
                    base = l_src[h % len(l_src)] if l_src else 2.0
                    raw = (base + c_p) * month_mult[m] * load_mult
                    val_t = noisy(raw)
                    full_load.append(val_t)
                    therm_load.append(max(0.0, val_t * p.thermal.thermal_ratio))
                    comm_load.append(max(0.0, c_p * month_mult[m] * load_mult))

    return full_load, therm_load, comm_load


def _declare_variables_8760(model: pulp.LpProblem, peak_load: float) -> dict:
    """Variables de décision pour 8760h (LP uniquement, pas de binaires)."""
    N = N_HOURS_8760
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
        "soc_i":        pulp.LpVariable.dicts("SOC_I",      range(366),    lowBound=0),
        "p_tes_ch":     pulp.LpVariable.dicts("TES_CH",     range(N), lowBound=0),
        "p_tes_dis":    pulp.LpVariable.dicts("TES_DIS",    range(N), lowBound=0),
        "soc_tes":      pulp.LpVariable.dicts("SOC_TES",    range(N), lowBound=0),
        "soc_tes_i":    pulp.LpVariable.dicts("SOC_TES_I",  range(366),    lowBound=0),
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
    return {**caps, **flows}


def _build_objective_8760(model, v, p: EcoParams,
                           actual_boiler_eff: Optional[List[float]] = None) -> None:
    """Objectif 8760h : CAPEX annualisé + OPEX (chaque heure compte pour 1)."""
    N = N_HOURS_8760
    r = p.economic.discount_rate
    obj = (
        v["cap_s"]      * p.solar.capex           * get_crf(r, p.solar.lifetime)
        + v["cap_s_inv"]  * p.solar.inverter_capex * get_crf(r, p.solar.inverter_lifetime)
        + v["cap_b"]      * p.storage.capex        * get_crf(r, p.storage.lifetime)
        + v["cap_b_inv"]  * p.storage.inverter_capex * get_crf(r, p.storage.inverter_lifetime)
        + v["cap_boiler"] * p.thermal.boiler.capex * get_crf(r, p.thermal.boiler.lifetime)
        + v["cap_w"]      * p.wind.capex           * get_crf(r, p.wind.lifetime)
        + v["cap_h"]      * p.hydro.capex          * get_crf(r, p.hydro.lifetime)
        + v["cap_g"]      * 500                    * get_crf(r, p.gas.lifetime)
        + v["cap_hp"]     * p.thermal.hp.capex     * get_crf(r, p.thermal.hp.lifetime)
        + v["cap_tes"]    * p.thermal.tes.capex    * get_crf(r, p.thermal.tes.lifetime)
        + v["max_grid"]   * p.grid.demand_charge   * 12
    )
    for t in range(N):
        h = t % 24
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
        )
    model += obj


def _add_constraints_8760(model, v, p: EcoParams,
                           full_load, therm_load,
                           actual_solar, actual_wind, annual_hydro,
                           actual_cop: Optional[List[float]] = None,
                           actual_boiler_eff: Optional[List[float]] = None) -> None:
    """Contraintes 8760h (LP uniquement)."""
    N = N_HOURS_8760
    peak_original_load = max(full_load) if full_load else 1.0
    MAX_GRID_CAPACITY = peak_original_load * 3.0
    EV_CAPACITY = p.economic.num_evs * 50.0
    EV_COMMUTE  = p.economic.num_evs * 10.0

    # ── Contraintes mensuelles (bornes réelles) ───────────────────────────
    for m in range(12):
        model += v["soc_i"][m] <= v["cap_b"]
        model += v["soc_i"][m] >= v["cap_b"] * p.storage.min_soc
        model += v["soc_tes_i"][m] <= v["cap_tes"]
        m_start = MONTH_BOUNDS_8760[m]
        m_end   = MONTH_BOUNDS_8760[m+1]
        model += (
            pulp.lpSum(v["shift_up"][t]   for t in range(m_start, m_end))
            == pulp.lpSum(v["shift_down"][t] for t in range(m_start, m_end))
        )

    # Budget carbone
    if p.economic.max_annual_co2_t > 0:
        model += (
            pulp.lpSum(
                (v["p_gas"][t]    / GAS_ELEC_EFF) * CO2_GAS_KG_KWH
                + (v["p_gas_th"][t] / (actual_boiler_eff[t] if actual_boiler_eff else p.thermal.boiler.eff)) * CO2_GAS_KG_KWH
                + v["p_buy"][t]   * CO2_GRID_KG_KWH
                for t in range(N)
            ) <= p.economic.max_annual_co2_t * 1000
        )

    if p.solar.max_kw > 0:
        model += v["cap_s"] <= p.solar.max_kw
    if p.wind.max_kw > 0:
        model += v["cap_w"] <= p.wind.max_kw
    if p.hydro.max_kw > 0:
        model += v["cap_h"] <= p.hydro.max_kw
    if p.gas.max_kw == 0:
        model += v["cap_g"] == 0  # gaz désactivé (frontend toggle off)

    # ── Contraintes horaires ──────────────────────────────────────────────
    for t in range(N):
        h = t % 24
        # Jour de l'année (0-indexé)
        day_of_year = t // 24

        # Flexibilité
        model += v["shift_down"][t] <= full_load[t] * p.economic.max_flex
        model += v["shift_up"][t]   <= peak_original_load * p.economic.max_flex
        actual_load_t = full_load[t] + v["shift_up"][t] - v["shift_down"][t]

        # Génération EnR
        model += v["p_s_ac"][t] <= v["cap_s"] * actual_solar[t]
        model += v["p_s_ac"][t] <= v["cap_s_inv"]
        model += v["p_w_ac"][t] <= v["cap_w"] * actual_wind[t]
        model += v["p_h_ac"][t] <= v["cap_h"] * (annual_hydro[t] * p.hydro.flow)

        # ── VE ────────────────────────────────────────────────────────────
        if h >= 18 or h <= 7:
            model += v["ev_charge"][t] <= p.economic.num_evs * 7.0
            if p.economic.v2g_enabled:
                model += v["ev_discharge"][t] <= p.economic.num_evs * 7.0
            else:
                model += v["ev_discharge"][t] == 0
            if h == 18:
                model += (v["ev_soc"][t] == (EV_CAPACITY - EV_COMMUTE)
                          + v["ev_charge"][t] * 0.95 - v["ev_discharge"][t] / 0.95)
            elif t == 0:
                model += (v["ev_soc"][t] == EV_CAPACITY
                          + v["ev_charge"][t] * 0.95 - v["ev_discharge"][t] / 0.95)
            else:
                model += (v["ev_soc"][t] == v["ev_soc"][t-1]
                          + v["ev_charge"][t] * 0.95 - v["ev_discharge"][t] / 0.95)
            if h == 7:
                model += v["ev_soc"][t] == EV_CAPACITY
        else:
            model += v["ev_charge"][t] == 0
            model += v["ev_discharge"][t] == 0
            model += v["ev_soc"][t] == 0

        # ── Bilan électrique ──────────────────────────────────────────────
        model += (
            v["p_s_ac"][t] + v["p_w_ac"][t] + v["p_h_ac"][t]
            + v["p_b_dis"][t] + v["p_gas"][t] + v["p_buy"][t]
            + v["p_shed"][t] + v["ev_discharge"][t]
            ==
            actual_load_t + v["p_b_ch"][t] + v["p_sell"][t]
            + v["p_hp_elec"][t] + v["ev_charge"][t]
        )

        # ── Bilan thermique ───────────────────────────────────────────────
        model += v["p_hp_elec"][t] <= v["cap_hp"]
        model += v["p_gas_th"][t]  <= v["cap_boiler"]
        model += (
            v["p_gas_th"][t] + v["p_hp_elec"][t] * (actual_cop[t] if actual_cop else p.thermal.hp.cop)
            + v["p_tes_dis"][t] + v["p_therm_shed"][t]
            == therm_load[t] + v["p_tes_ch"][t]
        )

        # ── Réseau ────────────────────────────────────────────────────────
        if p.grid.connected:
            model += v["p_buy"][t]  <= MAX_GRID_CAPACITY
            model += v["p_sell"][t] <= MAX_GRID_CAPACITY
            model += v["p_buy"][t]  <= v["max_grid"]
            model += v["p_sell"][t] <= v["max_grid"]
        else:
            model += v["p_buy"][t]  == 0
            model += v["p_sell"][t] == 0

        # ── Gaz ───────────────────────────────────────────────────────────
        model += v["p_gas"][t] <= v["cap_g"]
        if p.gas.ramp_limit_kw > 0 and t > 0:
            model += v["p_gas"][t] - v["p_gas"][t-1] <= p.gas.ramp_limit_kw
            model += v["p_gas"][t-1] - v["p_gas"][t] <= p.gas.ramp_limit_kw

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

        # ── Batterie ──────────────────────────────────────────────────────
        model += v["soc_b"][t] <= v["cap_b"]
        model += v["soc_b"][t] >= v["cap_b"] * p.storage.min_soc
        model += v["p_b_ch"][t]  <= v["cap_b_inv"]
        model += v["p_b_dis"][t] <= v["cap_b_inv"]
        if h == 0:
            model += (v["soc_b"][t] == v["soc_i"][day_of_year]
                      + v["p_b_ch"][t] * p.storage.eff_ch
                      - v["p_b_dis"][t] / p.storage.eff_dis)
        else:
            model += (v["soc_b"][t] == v["soc_b"][t-1]
                      + v["p_b_ch"][t] * p.storage.eff_ch
                      - v["p_b_dis"][t] / p.storage.eff_dis)
        # Bouclage journalier (23h → SOC initial du jour)
        if h == 23:
            model += v["soc_b"][t] == v["soc_i"][day_of_year]

        # ── TES ───────────────────────────────────────────────────────────
        model += v["soc_tes"][t] <= v["cap_tes"]
        model += v["p_tes_ch"][t]  <= v["cap_tes"] / 2
        model += v["p_tes_dis"][t] <= v["cap_tes"] / 2
        if h == 0:
            model += (v["soc_tes"][t] == v["soc_tes_i"][day_of_year]
                      + v["p_tes_ch"][t] * 0.95 - v["p_tes_dis"][t] / 0.95)
        else:
            model += (v["soc_tes"][t] == v["soc_tes"][t-1]
                      + v["p_tes_ch"][t] * 0.95 - v["p_tes_dis"][t] / 0.95)
        if h == 23:
            model += v["soc_tes"][t] == v["soc_tes_i"][day_of_year]


def _extract_results_8760(v, full_load, therm_load, comm_load,
                           actual_solar, p: EcoParams,
                           actual_boiler_eff: Optional[List[float]] = None) -> tuple:
    """Extraction des résultats 8760h."""
    N = N_HOURS_8760

    def val(var):
        return var.varValue if var.varValue is not None else 0.0

    caps = {
        "solar":     val(v["cap_s"]),     "solar_inv": val(v["cap_s_inv"]),
        "bess":      val(v["cap_b"]),      "bess_inv":  val(v["cap_b_inv"]),
        "wind":      val(v["cap_w"]),      "hydro":     val(v["cap_h"]),
        "gas":       val(v["cap_g"]),      "max_grid":  val(v["max_grid"]),
        "hp":        val(v["cap_hp"]),     "tes":       val(v["cap_tes"]),
        "boiler":    val(v["cap_boiler"]),
    }

    peak_load = max(full_load) if full_load else 1.0
    cable = peak_load * p.economic.cable_capex
    capex = (
        caps["solar"] * p.solar.capex + caps["solar_inv"] * p.solar.inverter_capex
        + caps["bess"] * p.storage.capex + caps["bess_inv"] * p.storage.inverter_capex
        + caps["wind"] * p.wind.capex + caps["hydro"] * p.hydro.capex
        + caps["gas"] * 500 + caps["hp"] * p.thermal.hp.capex
        + caps["tes"] * p.thermal.tes.capex + caps["boiler"] * p.thermal.boiler.capex
        + cable
    )

    fuel_gaz_elec_vol_y0 = sum(val(v["p_gas"][t]) / GAS_ELEC_EFF for t in range(N))
    fuel_gaz_th_vol_y0   = sum(
        val(v["p_gas_th"][t]) / (actual_boiler_eff[t] if actual_boiler_eff else p.thermal.boiler.eff)
        for t in range(N)
    )

    fuel_y = (fuel_gaz_elec_vol_y0 + fuel_gaz_th_vol_y0) * p.gas.fuel_price
    grid_buy_y = sum(
        val(v["p_buy"][t]) * (
            SPOT_PRICES_24H[t % 24] if p.grid.use_spot_market
            else (p.grid.peak_price if 8 <= t % 24 <= 20 else p.grid.offpeak_price)
        ) for t in range(N)
    )
    grid_sell_y = sum(
        val(v["p_sell"][t]) * (
            max(0.0, SPOT_PRICES_24H[t % 24] - 0.02) if p.grid.use_spot_market
            else p.grid.sell_price
        ) for t in range(N)
    )
    om_y     = capex * 0.02
    dc_y     = caps["max_grid"] * p.grid.demand_charge * 12
    shed_vol = sum(val(v["p_shed"][t]) for t in range(N))
    shed_y   = shed_vol * p.economic.voll
    opex_y1  = fuel_y + grid_buy_y - grid_sell_y + om_y + dc_y + shed_y

    total_load = sum(full_load)
    resilience = round(100 - (shed_vol / max(1, total_load) * 100), 2)
    curtail_s = sum(
        max(0, caps["solar"] * actual_solar[t] - val(v["p_s_ac"][t]))
        for t in range(N)
    )

    caps.update({
        "resilience": resilience, "curtailment": round(curtail_s), "opex_y1": round(opex_y1),
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
        "optimized_load": [full_load[t] + val(v["shift_up"][t]) - val(v["shift_down"][t])
                          for t in range(N)],
        "raw_load":   full_load,
        "comm_load":  comm_load,
        "spot_price": ([SPOT_PRICES_24H[t % 24] for t in range(N)]
                       if p.grid.use_spot_market else []),
    }

    opex_detail = {
        "fuel_elec_gaz": round(fuel_gaz_elec_vol_y0 * p.gas.fuel_price, 0),
        "fuel_th_gaz":   round(fuel_gaz_th_vol_y0 * p.gas.fuel_price, 0),
        "grid_buy":      round(grid_buy_y, 0),
        "grid_sell":     round(-grid_sell_y, 0),
        "om":            round(om_y, 0),
        "demand_charge": round(dc_y, 0),
        "load_shed":     round(shed_y, 0),
        "total":         round(opex_y1, 0),
    }

    bess_cycles = (sum(val(v["p_b_dis"][t]) for t in range(N))
                   / max(0.01, caps["bess"]))

    return (capex, opex_y1, caps, hourly, opex_detail,
            fuel_gaz_elec_vol_y0, fuel_gaz_th_vol_y0, shed_vol, bess_cycles)


def solve_microgrid_8760(data: TimeseriesData, base_solar_8760: List[float],
                          base_wind_8760: List[float], p: EcoParams,
                          is_noisy: bool = False,
                          base_cop: Optional[List[float]] = None,
                          base_boiler_eff: Optional[List[float]] = None):
    """Optimisation 8760h — LP uniquement. Time limit 300s."""
    N = N_HOURS_8760
    err = p.economic.forecast_error if is_noisy else 0.0

    def noisy(x):
        return max(0.0, x * (1 + random.uniform(-err, err))) if err else max(0.0, x)

    p90 = 0.85 if p.economic.p90_mode else 1.0
    actual_solar = [noisy(base_solar_8760[t % len(base_solar_8760)] * p90) for t in range(N)]
    actual_wind  = [noisy(base_wind_8760[t  % len(base_wind_8760)]  * p90) for t in range(N)]
    h_src = data.hydro_1kw if data.hydro_1kw else [0.9] * 24
    annual_hydro = [noisy(h_src[t % len(h_src)]) for t in range(N)]

    cop_arr = [base_cop[t % len(base_cop)] for t in range(N)] if base_cop else None
    eff_arr = [base_boiler_eff[t % len(base_boiler_eff)] for t in range(N)] if base_boiler_eff else None

    l_src = data.load if data.load else [2.0] * 24
    full_load, therm_load, comm_load = _expand_load_8760(l_src, p, is_noisy, noisy_fn=noisy)
    peak_load = max(full_load) if full_load else 1.0

    model = pulp.LpProblem("Microgrid_8760", pulp.LpMinimize)
    v = _declare_variables_8760(model, peak_load)
    _build_objective_8760(model, v, p, eff_arr)
    _add_constraints_8760(model, v, p, full_load, therm_load,
                           actual_solar, actual_wind, annual_hydro,
                           cop_arr, eff_arr)

    solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=300)
    model.solve(solver)
    if pulp.LpStatus[model.status] != "Optimal":
        return None

    return _extract_results_8760(v, full_load, therm_load, comm_load, actual_solar, p, eff_arr)


def solve_simulation_8760(req: SimulateRequest, base_solar_8760: List[float],
                           base_wind_8760: List[float],
                           base_cop: Optional[List[float]] = None,
                           base_boiler_eff: Optional[List[float]] = None):
    """Simulation 8760h — capacités fixées, dispatch LP optimisé."""
    p = req.params
    N = N_HOURS_8760
    p90 = 0.85 if p.economic.p90_mode else 1.0
    actual_solar = [base_solar_8760[t % len(base_solar_8760)] * p90 for t in range(N)]
    actual_wind  = [base_wind_8760[t  % len(base_wind_8760)]  * p90 for t in range(N)]
    h_src = req.hydro_1kw if req.hydro_1kw else [0.9] * 24
    annual_hydro = [h_src[t % len(h_src)] for t in range(N)]

    cop_arr = [base_cop[t % len(base_cop)] for t in range(N)] if base_cop else None
    eff_arr = [base_boiler_eff[t % len(base_boiler_eff)] for t in range(N)] if base_boiler_eff else None

    l_src = req.load if req.load else [2.0] * 24
    full_load, therm_load, comm_load = _expand_load_8760(l_src, p)
    peak_load = max(full_load) if full_load else 1.0

    model = pulp.LpProblem("Microgrid_Sim_8760", pulp.LpMinimize)
    v = _declare_variables_8760(model, peak_load)

    # Fixer les capacités
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

    _build_objective_8760(model, v, p, eff_arr)
    _add_constraints_8760(model, v, p, full_load, therm_load,
                           actual_solar, actual_wind, annual_hydro,
                           cop_arr, eff_arr)

    solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=300)
    model.solve(solver)
    if pulp.LpStatus[model.status] != "Optimal":
        return None

    return _extract_results_8760(v, full_load, therm_load, comm_load, actual_solar, p, eff_arr)
