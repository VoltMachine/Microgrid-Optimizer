# -*- coding: utf-8 -*-
"""
Microgrid Optimization API — Version 4 (modulaire)
===================================================
FastAPI : configuration, middlewares et routes.
La logique métier est déléguée aux services.
"""

import copy
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, List

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .models.schemas import EcoParams, TimeseriesData, SimulateRequest
from .services.weather_service import (
    get_tmy_solar, get_tmy_wind,
    get_tmy_solar_672h, get_tmy_wind_672h,
    get_solar_8760h, get_wind_8760h,
    get_tmy_cache_keys, get_tmy_cache_size,
    get_tmy_cop_profile, get_tmy_boiler_eff_profile,
    get_tmy_cop_profile_672h, get_tmy_boiler_eff_profile_672h,
    get_cop_profile_8760h, get_boiler_eff_profile_8760h,
)
from .services.optimizer_engine import (
    solve_microgrid, solve_simulation,
    calc_baseline_opex, _carbon_balance, _financial_loop,
)
from .services.optimizer_8760 import (
    solve_microgrid_8760, solve_simulation_8760,
)
from .utils.helpers import get_resolution_config
from .services.stochastic import run_stochastic_analysis
from .services.extreme_events import run_extreme_events_analysis


def _get_resolution(p):
    """Résolution effective : backward-compat avec use_8760h."""
    if getattr(p.economic, 'use_8760h', False):
        return "8760h"
    return getattr(p.economic, 'resolution', '288h')

# ══════════════════════════════════════════════════════════════════════════════
# APPLICATION FASTAPI
# ══════════════════════════════════════════════════════════════════════════════

app = FastAPI(title="My Microgrid v4")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("CRASH INTERCEPTÉ :", str(exc))
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"status": "error", "error": f"Erreur interne : {str(exc)}"},
    )


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT — CODE SOURCE
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/source")
def get_source():
    """Retourne le code source de main.py pour affichage dans le frontend."""
    import os
    src_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")
    try:
        with open(src_path, "r", encoding="utf-8") as f:
            return {"status": "success", "source": f.read()}
    except FileNotFoundError:
        return {"status": "error", "error": "Fichier source introuvable."}


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT — /api/optimize
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/optimize")
def optimize(data: TimeseriesData):
    p = data.params
    resolution = _get_resolution(p)
    res_cfg = get_resolution_config(resolution)

    # Profils météo selon résolution
    if resolution == "8760h":
        with ThreadPoolExecutor(max_workers=4) as executor:
            fut_solar = executor.submit(get_solar_8760h, data.lat, data.lon,
                                       2020, p.solar.tilt, p.solar.azimuth)
            fut_wind  = executor.submit(get_wind_8760h, data.lat, data.lon,
                                       p.wind.hub_height, p.wind.roughness_length)
            fut_cop   = executor.submit(get_cop_profile_8760h, data.lat, data.lon, p)
            fut_beff  = executor.submit(get_boiler_eff_profile_8760h, data.lat, data.lon, p)
            base_solar = fut_solar.result()
            base_wind  = fut_wind.result()
            base_cop   = fut_cop.result()
            base_boiler_eff = fut_beff.result()
    elif resolution == "672h":
        base_solar = get_tmy_solar_672h(data.lat, data.lon, p)
        base_wind  = get_tmy_wind_672h(data.lat, data.lon, p)
        base_cop   = get_tmy_cop_profile_672h(data.lat, data.lon, p)
        base_boiler_eff = get_tmy_boiler_eff_profile_672h(data.lat, data.lon, p)
    else:
        base_solar = get_tmy_solar(data.lat, data.lon, p)
        base_wind  = get_tmy_wind(data.lat, data.lon, p)
        base_cop   = get_tmy_cop_profile(data.lat, data.lon, p)
        base_boiler_eff = get_tmy_boiler_eff_profile(data.lat, data.lon, p)

    # 1. Optimisation cas de base
    if resolution == "8760h":
        res_base = solve_microgrid_8760(data, base_solar, base_wind, p, is_noisy=False,
                                         base_cop=base_cop, base_boiler_eff=base_boiler_eff)
    else:
        res_base = solve_microgrid(data, base_solar, base_wind, p, is_noisy=False,
                                   base_cop=base_cop, base_boiler_eff=base_boiler_eff)
    if res_base is None:
        return {"status": "error",
                "error": "Modèle insoluble : Modifiez vos contraintes physiques."}

    (c_base, opex_y1_base, caps, h_base, opex_detail,
     fuel_gaz_elec_vol_y0, fuel_gaz_th_vol_y0, shed_vol, bess_cycles) = res_base

    # 2. Bilan carbone (passe la config pour le poids d'annualisation correct)
    dette, co2_base, co2_mg, co2_evite = _carbon_balance(p, caps, h_base, res_cfg,
                                                          actual_boiler_eff=base_boiler_eff)

    # 3. Boucle financière 25 ans
    fin = _financial_loop(p, c_base, caps, h_base,
                          fuel_gaz_elec_vol_y0, fuel_gaz_th_vol_y0,
                          shed_vol, dette, co2_evite, res_cfg,
                          bess_cycles=bess_cycles)

    # 3.5 Analyse stochastique P90 multi-années (M5)
    stochastic_result = None
    if p.economic.stochastic:
        print("[Stochastic] Running multi-year analysis …")
        stochastic_result = run_stochastic_analysis(
            data.lat, data.lon, data, p,
            base_solar, base_wind, base_cop, base_boiler_eff)
        if stochastic_result:
            print(f"[Stochastic] OK — {stochastic_result['num_years']} years analyzed.")
        else:
            print("[Stochastic] Failed — NASA data insufficient, fallback to deterministic.")

    # 3.6 Stress-test événements extrêmes (M6)
    extreme_result = None
    if p.economic.extreme_events:
        print("[ExtremeEvents] Detecting extreme sequences …")
        extreme_result = run_extreme_events_analysis(
            data.lat, data.lon, p, {**h_base, "caps": caps})
        if extreme_result and extreme_result.get("status") == "success":
            n_detected = sum(1 for e in extreme_result.get("events", []) if e.get("detected"))
            print(f"[ExtremeEvents] OK — {n_detected}/3 event types detected.")
        else:
            print(f"[ExtremeEvents] {extreme_result.get('reason', 'unavailable') if extreme_result else 'failed'}")

    # 4. Analyse de sensibilité (Tornado)
    sens_res = []
    if p.economic.run_sensitivity:
        def get_simple_roi(res_t, p_):
            if not res_t:
                return 99.9
            c_, o_, caps_, h_, *_ = res_t
            bl  = calc_baseline_opex(p_, h_["raw_load"])
            sav = bl - o_
            return min(99.9, round(c_ / sav, 1)) if sav > 0 else 99.9

        # (chemin_imbriqué, label) — le chemin référence l'attribut sur EcoParams
        test_scenarios = [
            ("solar.capex",         "CAPEX Solaire"),
            ("wind.capex",          "CAPEX Éolien"),
            ("storage.capex",       "CAPEX Batterie"),
            ("gas.fuel_price",      "Prix Gaz"),
            ("grid.demand_charge",  "Abonnement Réseau"),
            ("economic.seasonality","Surconso Hiver"),
            ("wind.hub_height",     "Hauteur Moyeu"),
        ]
        if not p.grid.use_spot_market:
            test_scenarios += [
                ("grid.sell_price", "Vente Réseau"),
                ("grid.peak_price", "Achat Réseau"),
            ]

        def _nested_get(obj, path: str):
            *parts, attr = path.split(".")
            for part in parts:
                obj = getattr(obj, part)
            return getattr(obj, attr)

        def _nested_set(obj, path: str, value):
            *parts, attr = path.split(".")
            for part in parts:
                obj = getattr(obj, part)
            setattr(obj, attr, value)

        for path, label in test_scenarios:
            p_l = copy.deepcopy(p)
            _nested_set(p_l, path, _nested_get(p_l, path) * 0.8)
            roi_low = get_simple_roi(
                solve_microgrid(data, base_solar, base_wind, p_l), p_l
            )
            p_h = copy.deepcopy(p)
            _nested_set(p_h, path, _nested_get(p_h, path) * 1.2)
            roi_high = get_simple_roi(
                solve_microgrid(data, base_solar, base_wind, p_h), p_h
            )
            sens_res.append({"parameter": label,
                              "roi_low": roi_low, "roi_high": roi_high})

    return {
        "status": "success",
        "resolution": resolution,
        "milp_used": p.gas.use_milp,
        "tmy_years": f"{p.economic.tmy_start_year}–{p.economic.tmy_end_year}",
        "hub_height_m": p.wind.hub_height,
        "capacities": {
            "solar_kw":     round(caps["solar"],     2),
            "solar_inv_kw": round(caps["solar_inv"], 2),
            "bess_kwh":     round(caps["bess"],      2),
            "bess_inv_kw":  round(caps["bess_inv"],  2),
            "wind_kw":      round(caps["wind"],      2),
            "hydro_kw":     round(caps["hydro"],     2),
            "gas_kw":       round(caps["gas"],       2),
            "boiler_kw":    round(caps["boiler"],    2),
            "hp_kw":        round(caps["hp"],        2),
            "tes_kwh":      round(caps["tes"],       2),
        },
        "kpis": {
            "total_capex":      round(c_base),
            "roi_years":        fin["roi_years"],
            "van":              fin["van"],
            "tri":              fin["tri"],
            "max_grid_power":   round(caps["max_grid"], 2),
            "annual_co2_saved": round(co2_evite, 1),
            "resilience":       caps["resilience"],
            "carbon_payback":   fin["carbon_payback"],
            "curtailment":      caps["curtailment"],
            "opex_y1":          caps["opex_y1"],
        },
        "opex_detail":    opex_detail,
        "cashflow_25y":   fin["cashflow_25y"],
        "carbonflow_25y": fin["carbonflow_25y"],
        "hourly_data":    h_base,
        "sensitivity":    sens_res,
        "stochastic":     stochastic_result,
        "extreme_events": extreme_result,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT — /api/simulate
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/simulate")
def simulate(req: SimulateRequest):
    p = req.params
    resolution = _get_resolution(p)
    res_cfg = get_resolution_config(resolution)

    if resolution == "8760h":
        with ThreadPoolExecutor(max_workers=4) as executor:
            fut_solar = executor.submit(get_solar_8760h, req.lat, req.lon,
                                       2020, p.solar.tilt, p.solar.azimuth)
            fut_wind  = executor.submit(get_wind_8760h, req.lat, req.lon,
                                       p.wind.hub_height, p.wind.roughness_length)
            fut_cop   = executor.submit(get_cop_profile_8760h, req.lat, req.lon, p)
            fut_beff  = executor.submit(get_boiler_eff_profile_8760h, req.lat, req.lon, p)
            base_solar = fut_solar.result()
            base_wind  = fut_wind.result()
            base_cop   = fut_cop.result()
            base_boiler_eff = fut_beff.result()
        solver_res = solve_simulation_8760(req, base_solar, base_wind,
                                           base_cop=base_cop, base_boiler_eff=base_boiler_eff)
    elif resolution == "672h":
        base_solar = get_tmy_solar_672h(req.lat, req.lon, p)
        base_wind  = get_tmy_wind_672h(req.lat, req.lon, p)
        base_cop   = get_tmy_cop_profile_672h(req.lat, req.lon, p)
        base_boiler_eff = get_tmy_boiler_eff_profile_672h(req.lat, req.lon, p)
        solver_res = solve_simulation(req, base_solar, base_wind,
                                      base_cop=base_cop, base_boiler_eff=base_boiler_eff)
    else:
        base_solar = get_tmy_solar(req.lat, req.lon, p)
        base_wind  = get_tmy_wind(req.lat, req.lon, p)
        base_cop   = get_tmy_cop_profile(req.lat, req.lon, p)
        base_boiler_eff = get_tmy_boiler_eff_profile(req.lat, req.lon, p)
        solver_res = solve_simulation(req, base_solar, base_wind,
                                      base_cop=base_cop, base_boiler_eff=base_boiler_eff)
    if solver_res is None:
        return {"status": "error",
                "error": "Modèle insoluble — Vérifiez les capacités et contraintes."}

    (c_base, opex_y1_base, caps, h_base, opex_detail,
     fuel_gaz_elec_vol_y0, fuel_gaz_th_vol_y0, shed_vol, bess_cycles) = solver_res

    dette, co2_base, co2_mg, co2_evite = _carbon_balance(p, caps, h_base, res_cfg,
                                                          actual_boiler_eff=base_boiler_eff)
    fin = _financial_loop(p, c_base, caps, h_base,
                          fuel_gaz_elec_vol_y0, fuel_gaz_th_vol_y0,
                          shed_vol, dette, co2_evite, res_cfg,
                          bess_cycles=bess_cycles)

    return {
        "status": "success",
        "mode": "simulation",
        "resolution": resolution,
        "milp_used": p.gas.use_milp,
        "tmy_years": f"{p.economic.tmy_start_year}–{p.economic.tmy_end_year}",
        "hub_height_m": p.wind.hub_height,
        "capacities": {
            "solar_kw":     round(caps["solar"],     2),
            "solar_inv_kw": round(caps["solar_inv"], 2),
            "bess_kwh":     round(caps["bess"],      2),
            "bess_inv_kw":  round(caps["bess_inv"],  2),
            "wind_kw":      round(caps["wind"],      2),
            "hydro_kw":     round(caps["hydro"],     2),
            "gas_kw":       round(caps["gas"],       2),
            "boiler_kw":    round(caps["boiler"],    2),
            "hp_kw":        round(caps["hp"],        2),
            "tes_kwh":      round(caps["tes"],       2),
        },
        "kpis": {
            "total_capex":      round(c_base),
            "roi_years":        fin["roi_years"],
            "van":              fin["van"],
            "tri":              fin["tri"],
            "max_grid_power":   round(caps["max_grid"], 2),
            "annual_co2_saved": round(co2_evite, 1),
            "resilience":       caps["resilience"],
            "carbon_payback":   fin["carbon_payback"],
            "curtailment":      caps["curtailment"],
            "opex_y1":          caps["opex_y1"],
        },
        "opex_detail":    opex_detail,
        "cashflow_25y":   fin["cashflow_25y"],
        "carbonflow_25y": fin["carbonflow_25y"],
        "hourly_data":    h_base,
        "sensitivity":    [],
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT — /api/tmy_cache
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/tmy_cache")
def tmy_cache_status():
    """Retourne les clés présentes en cache TMY (debug/monitoring)."""
    return {
        "status": "success",
        "cached_profiles": get_tmy_cache_size(),
        "keys": get_tmy_cache_keys(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# FRONTEND STATIQUE
# ══════════════════════════════════════════════════════════════════════════════

import os
dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")
if os.path.isdir(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
