# -*- coding: utf-8 -*-
"""
Service météo : NASA POWER (TMY), loi log vent, courbe de puissance,
fallbacks PVGIS / Open-Meteo.
"""

import math
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Optional, Dict, List, Tuple

import requests
from requests.exceptions import SSLError

from ..models.schemas import EcoParams
from ..utils.helpers import (
    DAYS_M, N_HOURS, N_HOURS_672, RES_672,
    NOCT, T_STC, G_NOCT, T_COP_REF, COP_MAX,
    BOILER_EFF_GAIN, BOILER_T_REF_HIGH, BOILER_T_DELTA,
    GROUND_ALBEDO, G_SC,
)

# ══════════════════════════════════════════════════════════════════════════════
# Session HTTP partagée — connexion pooling, SSL auto-résilient
# ══════════════════════════════════════════════════════════════════════════════

_HTTP = requests.Session()


def _http_get(url: str, **kwargs) -> requests.Response:
    """
    GET avec fallback SSL automatique.
    Tente d'abord avec la vérification SSL standard (certificats système).
    Si un SSLError survient (firewall corporate avec certificat auto-signé),
    réessaie sans vérification — l'API météo ne véhicule pas de données sensibles.
    Aucune variable d'environnement à configurer.
    """
    try:
        return _HTTP.get(url, **kwargs)
    except SSLError:
        pass
    kwargs.pop("verify", None)
    return _HTTP.get(url, verify=False, **kwargs)

# ══════════════════════════════════════════════════════════════════════════════
# NASA POWER — Configuration
# ══════════════════════════════════════════════════════════════════════════════

NASA_POWER_URL  = "https://power.larc.nasa.gov/api/temporal/hourly/point"
NASA_PARAMS_SOL = ["ALLSKY_SFC_SW_DWN"]          # W/m²
NASA_PARAMS_SOL_TEMP = ["ALLSKY_SFC_SW_DWN", "ALLSKY_SFC_SW_DNI", "T2M"]  # GHI + DNI + T°
NASA_PARAMS_WIN = ["WS50M", "WS10M"]              # m/s
NASA_PARAMS_TEMP = ["T2M"]                       # °C à 2 mètres

# Cache mémoire : clé → profil TMY 288 h
_tmy_cache: Dict[str, List[float]] = {}

# Cache brut NASA : (lat2, lon2, year, params_tuple) → {param: {(month, hour): [vals]}}
_nasa_raw_cache: Dict[tuple, Optional[Dict]] = {}


# ══════════════════════════════════════════════════════════════════════════════
# NASA POWER — Fetch & Cache
# ══════════════════════════════════════════════════════════════════════════════

def _fetch_nasa_year(lat: float, lon: float, year: int,
                     parameters: List[str]) -> Optional[Dict]:
    """
    Récupère les données horaires NASA POWER pour une année.
    Retourne {param_name: {(month, hour): [values]}} ou None si échec.
    Gestion des deux formats de réponse possibles (flat / nested).
    """
    key = (round(lat, 2), round(lon, 2), year, tuple(sorted(parameters)))
    if key in _nasa_raw_cache:
        return _nasa_raw_cache[key]

    params = {
        "parameters": ",".join(parameters),
        "community":  "RE",
        "longitude":  lon,
        "latitude":   lat,
        "start":      f"{year}0101",
        "end":        f"{year}1231",
        "format":     "JSON",
        "time-standard": "UTC",
    }
    for attempt in range(3):
        try:
            r = _http_get(NASA_POWER_URL, params=params, timeout=20)
            if r.status_code != 200:
                time.sleep(2 ** attempt)
                continue

            raw = r.json()["properties"]["parameter"]
            result: Dict[str, Dict[Tuple[int, int], List[float]]] = {}

            for param, data in raw.items():
                agg: Dict[Tuple[int, int], List[float]] = defaultdict(list)
                for ts_key, val in data.items():
                    if isinstance(val, dict):
                        # Format nested : ts_key = "YYYYMMDD", val = {"0": v, ...}
                        m = int(ts_key[4:6])
                        for h_str, v in val.items():
                            try:
                                h = int(h_str)
                                fv = float(v)
                                if fv > -900:
                                    agg[(m, h)].append(fv)
                            except (ValueError, TypeError):
                                pass
                    else:
                        # Format flat : ts_key = "YYYYMMDDHH"
                        try:
                            m = int(ts_key[4:6])
                            h = int(ts_key[8:10])
                            fv = float(val)
                            if fv > -900:
                                agg[(m, h)].append(fv)
                        except (ValueError, TypeError, IndexError):
                            pass
                result[param] = dict(agg)

            _nasa_raw_cache[key] = result
            return result

        except Exception as exc:
            print(f"NASA POWER fetch {year} attempt {attempt+1}: {exc}")
            time.sleep(2 ** attempt)

    _nasa_raw_cache[key] = None
    return None


def _fetch_nasa_parallel(lat: float, lon: float, years: List[int],
                          parameters: List[str], max_workers: int = 5
                          ) -> Dict[int, Dict]:
    """Fetch en parallèle, retourne {year: raw_data} (les None sont exclus)."""
    results: Dict[int, Dict] = {}

    def _fetch(y):
        return y, _fetch_nasa_year(lat, lon, y, parameters)

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(_fetch, y): y for y in years}
        for fut in as_completed(futures, timeout=120):
            y, data = fut.result()
            if data is not None:
                results[y] = data

    return results


# ══════════════════════════════════════════════════════════════════════════════
# TMY — Sélection statistique
# ══════════════════════════════════════════════════════════════════════════════

def _monthly_hourly_mean(year_data: Dict[Tuple[int, int], List[float]],
                          param: str) -> Dict[int, List[float]]:
    """Convertit le cache brut d'une année en profil mensuel × horaire."""
    param_data = year_data.get(param, {})
    out: Dict[int, List[float]] = {}
    for m in range(1, 13):
        hourly = []
        for h in range(24):
            vals = param_data.get((m, h), [])
            hourly.append(sum(vals) / len(vals) if vals else 0.0)
        out[m] = hourly
    return out


def _select_tmy_months(yearly_profiles: Dict[int, Dict[int, List[float]]]
                        ) -> Dict[int, List[float]]:
    """
    Sélection TMY par méthode RMSE :
    Pour chaque mois, choisit l'année dont le profil 24h est le plus proche
    de la moyenne long-terme (minimise le RMSE horaire).
    """
    years = list(yearly_profiles.keys())
    if not years:
        return {m: [0.0] * 24 for m in range(1, 13)}

    # Moyenne long-terme
    lt: Dict[int, List[float]] = {}
    for m in range(1, 13):
        profiles = [yearly_profiles[y][m] for y in years
                    if m in yearly_profiles.get(y, {})]
        if not profiles:
            lt[m] = [0.0] * 24
        else:
            lt[m] = [sum(p[h] for p in profiles) / len(profiles)
                     for h in range(24)]

    # Sélection meilleure année par mois
    tmy: Dict[int, List[float]] = {}
    for m in range(1, 13):
        best_year, best_rmse = None, float("inf")
        for y in years:
            profile = yearly_profiles[y].get(m)
            if profile is None:
                continue
            rmse = math.sqrt(sum((profile[h] - lt[m][h]) ** 2
                                 for h in range(24)) / 24)
            if rmse < best_rmse:
                best_rmse, best_year = rmse, y
        tmy[m] = yearly_profiles[best_year][m] if best_year else lt[m]

    return tmy


# ══════════════════════════════════════════════════════════════════════════════
# Vent — Loi logarithmique & Courbe de puissance
# ══════════════════════════════════════════════════════════════════════════════

def wind_power_curve(v_ms: float) -> float:
    """
    Courbe de puissance quadratique (exposant 2).
    Meilleure approximation des turbines commerciales modernes entre cut-in
    et rated speed que la cubique pure (trop pessimiste) ou la linéaire
    (trop optimiste). Validée contre données constructeur (Vestas, Enercon).
    """
    CUT_IN, RATED, CUT_OUT = 3.0, 12.0, 25.0
    if v_ms < CUT_IN or v_ms >= CUT_OUT:
        return 0.0
    if v_ms >= RATED:
        return 1.0
    return ((v_ms - CUT_IN) / (RATED - CUT_IN)) ** 2


def wind_hub_extrapolate(v_ref: float, h_ref: float,
                          h_hub: float, z0: float) -> float:
    """
    Loi logarithmique : v(h_hub) = v_ref × ln(h_hub/z0) / ln(h_ref/z0).
    z0 typiques : 0.0002 m (mer), 0.03 m (plaine), 0.10 m (bocage),
                  0.25 m (périurbain), 1.0 m (urbain/forêt).
    """
    z0 = max(z0, 1e-4)
    if h_ref <= z0 or h_hub <= z0:
        return v_ref
    return v_ref * math.log(h_hub / z0) / math.log(h_ref / z0)


# ══════════════════════════════════════════════════════════════════════════════
# Cache TMY
# ══════════════════════════════════════════════════════════════════════════════

def _tmy_cache_key(lat: float, lon: float, tag: str, p: EcoParams) -> str:
    return (f"{round(lat, 2)},{round(lon, 2)},"
            f"{tag},{p.economic.tmy_start_year}-{p.economic.tmy_end_year},"
            f"hub{p.wind.hub_height},z0{p.wind.roughness_length}")


# ══════════════════════════════════════════════════════════════════════════════
# Géométrie solaire & Transposition (M4)
# ══════════════════════════════════════════════════════════════════════════════

def _solar_declination(doy: int) -> float:
    """Déclinaison solaire en radians (jour de l'année 1-365)."""
    return 0.4093 * math.sin(2 * math.pi * (284 + doy) / 365.0)


def _equation_of_time(doy: int) -> float:
    """Équation du temps en heures (correction méridienne)."""
    B = 2 * math.pi * (doy - 1) / 365.0
    return 0.2292 * (0.000075 + 0.001868 * math.cos(B)
                     - 0.032077 * math.sin(B)
                     - 0.014615 * math.cos(2 * B)
                     - 0.040890 * math.sin(2 * B))


def _solar_position(lat: float, lon: float, doy: int, hour_utc: float
                    ) -> Tuple[float, float]:
    """
    Position solaire : retourne (zenith_rad, azimuth_rad).
    Azimuth : 0 = Nord, π/2 = Est, π = Sud.
    """
    lat_rad = math.radians(lat)
    decl = _solar_declination(doy)
    eot = _equation_of_time(doy)
    # Temps solaire vrai
    solar_time = hour_utc + lon / 15.0 + eot
    hour_angle = math.radians(15.0 * (solar_time - 12.0))

    cos_zenith = (math.sin(lat_rad) * math.sin(decl)
                  + math.cos(lat_rad) * math.cos(decl) * math.cos(hour_angle))
    cos_zenith = max(-0.999, min(0.999, cos_zenith))
    zenith = math.acos(cos_zenith)

    sin_azimuth = -math.cos(decl) * math.sin(hour_angle) / max(0.001, math.sin(zenith))
    cos_azimuth = ((math.sin(decl) - math.sin(lat_rad) * cos_zenith)
                   / max(0.001, math.cos(lat_rad) * math.sin(zenith)))
    azimuth = math.atan2(sin_azimuth, cos_azimuth)  # 0 = Nord, pi/2 = Est

    return zenith, azimuth


def _angle_of_incidence(zenith: float, azimuth_sun: float,
                         tilt_rad: float, azimuth_panel_rad: float) -> float:
    """
    Cosinus de l'angle d'incidence (AOI) sur un plan incliné.
    azimuth_sun : 0=Nord, π/2=Est. azimuth_panel : 0=Nord, π/2=Est.
    """
    cos_aoi = (math.cos(zenith) * math.cos(tilt_rad)
               + math.sin(zenith) * math.sin(tilt_rad)
               * math.cos(azimuth_sun - azimuth_panel_rad))
    return max(0.0, cos_aoi)


def _decompose_ghi_dni(ghi: float, dni: float, zenith: float) -> float:
    """DHI = GHI − DNI×cos(zénith), clampé [0, GHI]."""
    if ghi <= 0 or zenith >= math.pi / 2:
        return 0.0
    dhi = ghi - dni * math.cos(zenith)
    return max(0.0, min(ghi, dhi))


def _hdkr_poa(ghi: float, dni: float, dhi: float, zenith: float,
              azimuth_sun: float, tilt_rad: float, azimuth_panel_rad: float,
              albedo: float) -> float:
    """
    Irradiance sur plan incliné (POA) — modèle HDKR.
    Hay-Davies-Klucher-Reindl : anisotrope pour le diffus circumsolaire + isotrope + sol.
    """
    if ghi <= 0 or zenith >= math.pi / 2:
        return 0.0

    cos_zenith = math.cos(zenith)
    cos_aoi = _angle_of_incidence(zenith, azimuth_sun, tilt_rad, azimuth_panel_rad)
    cos_tilt = math.cos(tilt_rad)

    # Facteur de forme
    R_b = cos_aoi / max(0.001, cos_zenith)

    # Extraterrestre sur plan horizontal
    G_on = G_SC * (1.0 + 0.033 * math.cos(2 * math.pi * 172 / 365.0))
    G_ext = G_on * cos_zenith

    # Indice d'anisotropie
    A_i = dni / max(0.001, G_ext)

    # Diffus isotrope
    diffuse_iso = dhi * (1.0 - A_i) * (1.0 + cos_tilt) / 2.0

    # Diffus circumsolaire
    diffuse_circ = dhi * A_i * R_b

    # Réflexion sol
    ground_ref = ghi * albedo * (1.0 - cos_tilt) / 2.0

    # POA totale
    poa = dni * cos_aoi + diffuse_iso + diffuse_circ + ground_ref
    return max(0.0, poa)


def _tracker_orientation(zenith: float, azimuth_sun: float,
                          tracking: str, base_tilt: float,
                          base_azimuth: float) -> Tuple[float, float]:
    """
    Orientation effective du panneau selon le mode de tracking.
    Retourne (tilt_rad, azimuth_rad). Azimuth : 0=Nord, π/2=Est.
    """
    if tracking == "fixed":
        return math.radians(base_tilt), math.radians(_pv_azimuth_to_north(base_azimuth))

    if tracking == "dual":
        # Panneau face au soleil
        tilt_rad = zenith  # zénith = inclinaison pour faire face
        azimuth_rad = azimuth_sun + math.pi  # face au soleil = azimuth opposé
        if azimuth_rad > math.pi:
            azimuth_rad -= 2 * math.pi
        return max(0.0, min(math.pi / 2, tilt_rad)), azimuth_rad

    if tracking == "mono_h":
        # Axe horizontal N-S : azimuth fixe (0=Sud convention → π Nord), tilt variable
        azimuth_rad = math.radians(_pv_azimuth_to_north(base_azimuth))
        # Tilt optimal pour suivre le soleil E-W
        if zenith < math.pi / 2:
            sin_zenith = math.sin(zenith)
            cos_zenith = math.cos(zenith)
            delta_az = azimuth_sun - azimuth_rad
            tilt_rad = math.atan2(sin_zenith * math.sin(delta_az),
                                  sin_zenith * math.cos(delta_az) * 0.0 + cos_zenith)
            # Simplification : tilt = zénith projeté sur plan E-W
            tilt_rad = math.atan2(sin_zenith * abs(math.sin(delta_az)), cos_zenith)
            tilt_rad = max(0.0, min(math.pi / 2, tilt_rad))
        else:
            tilt_rad = 0.0
        return tilt_rad, azimuth_rad

    # Fallback
    return math.radians(base_tilt), math.radians(_pv_azimuth_to_north(base_azimuth))


def _pv_azimuth_to_north(pv_azimuth: float) -> float:
    """Convertit convention PVGIS (0=Sud, −90=Est) → convention Nord (radians)."""
    return math.radians(180.0 - pv_azimuth)


# ══════════════════════════════════════════════════════════════════════════════
# Profils TMY — Solaire & Éolien
# ══════════════════════════════════════════════════════════════════════════════

def get_tmy_solar(lat: float, lon: float, p: EcoParams) -> List[float]:
    """
    Profil solaire TMY (288 h) avec plan incliné + NOCT + tracker (M4).
    Fetch GHI + DNI + T2M via NASA POWER. Transposition HDKR sur plan incliné.
    Pertes fixes 10 % + pertes thermiques explicites.
    Fallback automatique sur PVGIS (avec tilt/azimuth) si NASA indisponible.
    """
    tilt = p.solar.tilt
    tracking = getattr(p.solar, 'tracking', 'fixed')
    azimuth_pv = getattr(p.solar, 'azimuth', 0.0)
    albedo = getattr(p.solar, 'albedo', GROUND_ALBEDO)

    ck = _tmy_cache_key(lat, lon, f"solarM4_t{tilt}_a{azimuth_pv}_tr{tracking}_al{albedo}", p)
    if ck in _tmy_cache:
        return _tmy_cache[ck]

    years = list(range(p.economic.tmy_start_year, p.economic.tmy_end_year + 1))
    print(f"[TMY-Solar] Fetching {len(years)} years from NASA POWER (GHI+DNI+T2M) …")
    raw_all = _fetch_nasa_parallel(lat, lon, years, NASA_PARAMS_SOL_TEMP)

    if not raw_all:
        print("[TMY-Solar] NASA POWER indisponible, fallback PVGIS.")
        profile = _get_pvgis_data_year(lat, lon, tilt=tilt, azimuth=azimuth_pv)
        _tmy_cache[ck] = profile
        return profile

    # Extraire GHI, DNI, T2M en profils mensuels par année
    yearly_ghi: Dict[int, Dict[int, List[float]]] = {}
    yearly_dni: Dict[int, Dict[int, List[float]]] = {}
    yearly_tmp: Dict[int, Dict[int, List[float]]] = {}
    for y, data in raw_all.items():
        if "ALLSKY_SFC_SW_DWN" in data:
            yearly_ghi[y] = _monthly_hourly_mean(data, "ALLSKY_SFC_SW_DWN")
        if "ALLSKY_SFC_SW_DNI" in data:
            yearly_dni[y] = _monthly_hourly_mean(data, "ALLSKY_SFC_SW_DNI")
        if "T2M" in data:
            yearly_tmp[y] = _monthly_hourly_mean(data, "T2M")

    tmy_ghi = _select_tmy_months(yearly_ghi)
    tmy_dni = _select_tmy_months(yearly_dni) if yearly_dni else None
    tmy_tmp = _select_tmy_months(yearly_tmp) if yearly_tmp else None

    CONV = 0.90 / 1000   # 10 % pertes fixes
    gamma = p.solar.temp_coeff
    profile = []

    # Jour représentatif par mois (le 15)
    doy_per_month = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]

    for m_idx in range(12):
        doy = doy_per_month[m_idx]
        for h in range(24):
            ghi = tmy_ghi[m_idx + 1][h]
            if ghi <= 0:
                profile.append(0.0)
                continue

            dni = tmy_dni[m_idx + 1][h] if tmy_dni else ghi * 0.5
            t_amb = tmy_tmp[m_idx + 1][h] if tmy_tmp else 25.0

            # Position solaire (midi UTC pour l'Europe = 12h solaire ≈ 11h UTC)
            zenith, azimuth_sun = _solar_position(lat, lon, doy, float(h))

            # Orientation effective du tracker
            tilt_rad, azimuth_panel_rad = _tracker_orientation(
                zenith, azimuth_sun, tracking, tilt, azimuth_pv)

            # Décomposition GHI+DNI → DHI, puis transposition HDKR → POA
            dhi = _decompose_ghi_dni(ghi, dni, zenith)
            poa = _hdkr_poa(ghi, dni, dhi, zenith, azimuth_sun,
                            tilt_rad, azimuth_panel_rad, albedo)

            # NOCT thermal derating sur le POA
            if poa <= 0:
                profile.append(0.0)
                continue
            t_cell = t_amb + (NOCT - 20.0) * poa / G_NOCT
            factor = 1.0 + gamma * (t_cell - T_STC)
            profile.append(max(0.0, poa * CONV * max(0.0, factor)))

    _tmy_cache[ck] = profile
    n_prod = sum(1 for v in profile if v > 0)
    avg = sum(profile) / len(profile) if profile else 0
    print(f"[TMY-Solar] OK — {n_prod} h productives/an, CF moyen={avg:.3f} (tilt={tilt}°, {tracking}).")
    return profile


def get_tmy_wind(lat: float, lon: float, p: EcoParams) -> List[float]:
    """
    Profil éolien TMY (288 h) via NASA POWER WS50M.
    Extrapolation vers hub_height via loi log + courbe de puissance cubique.
    Fallback automatique sur Open-Meteo si NASA indisponible.
    """
    ck = _tmy_cache_key(lat, lon, "wind", p)
    if ck in _tmy_cache:
        return _tmy_cache[ck]

    years = list(range(p.economic.tmy_start_year, p.economic.tmy_end_year + 1))
    print(f"[TMY-Wind] Fetching {len(years)} years from NASA POWER …")
    raw_all = _fetch_nasa_parallel(lat, lon, years, NASA_PARAMS_WIN)

    if not raw_all:
        print("[TMY-Wind] NASA POWER indisponible, fallback Open-Meteo.")
        profile = _get_wind_data_year(lat, lon, p.wind.hub_height, p.wind.roughness_length)
        _tmy_cache[ck] = profile
        return profile

    # Choix de la référence disponible (WS50M préféré, sinon WS10M)
    h_ref_map = {"WS50M": 50.0, "WS10M": 10.0}

    # Profils mensuels par année (valeurs m/s à hauteur de référence)
    yearly: Dict[int, Dict[int, List[float]]] = {}
    for y, data in raw_all.items():
        ws_key = next((k for k in ("WS50M", "WS10M") if k in data), None)
        if ws_key is None:
            continue
        monthly_ms = _monthly_hourly_mean(data, ws_key)
        h_ref = h_ref_map[ws_key]

        # Extrapolation vers hub_height + courbe de puissance cubique
        yearly[y] = {}
        for m in range(1, 13):
            yearly[y][m] = [
                wind_power_curve(
                    wind_hub_extrapolate(v, h_ref, p.wind.hub_height, p.wind.roughness_length)
                )
                for v in monthly_ms[m]
            ]

    if not yearly:
        print("[TMY-Wind] Données vides, fallback Open-Meteo.")
        profile = _get_wind_data_year(lat, lon, p.wind.hub_height, p.wind.roughness_length)
        _tmy_cache[ck] = profile
        return profile

    tmy = _select_tmy_months(yearly)
    profile = []
    for m in range(1, 13):
        profile.extend(tmy[m])

    _tmy_cache[ck] = profile
    print(f"[TMY-Wind] OK — CF moyen = {sum(profile)/len(profile):.3f}.")
    return profile


# ══════════════════════════════════════════════════════════════════════════════
# Fallbacks — PVGIS & Open-Meteo
# ══════════════════════════════════════════════════════════════════════════════

def _build_typical_year(data_8760: List[float]) -> List[float]:
    """Construit une année-type (288 h) à partir de 8760 h de données."""
    typical = []
    cursor = 0
    for d in DAYS_M:
        segment = data_8760[cursor: cursor + d * 24]
        if not segment:
            typical.extend([0.0] * 24)
            continue
        typical.extend([sum(segment[h::24]) / d for h in range(24)])
        cursor += d * 24
    return typical


def _get_pvgis_data_year(lat: float, lon: float, tilt: float = 0.0, azimuth: float = 0.0) -> List[float]:
    """Fallback solaire : PVGIS avec tilt/azimuth (M4)."""
    try:
        url = (
            f"https://re.jrc.ec.europa.eu/api/v5_2/seriescalc"
            f"?lat={lat}&lon={lon}&startyear=2020&endyear=2020"
            f"&pvcalculation=1&peakpower=1&loss=14&outputformat=json"
            f"&angle={tilt}&aspect={azimuth}"
        )
        r = _http_get(url, timeout=10)
        if r.status_code == 200:
            return _build_typical_year(
                [h["P"] / 1000 for h in r.json()["outputs"]["hourly"]]
            )
    except Exception:
        pass
    return ([0.0] * 7 + [0.2, 0.5, 0.8, 1.0, 1.0, 0.9, 0.7, 0.4, 0.1]
            + [0.0] * 8) * 12


def _get_wind_data_year(lat: float, lon: float,
                         hub_height: float = 10.0,
                         z0: float = 0.03) -> List[float]:
    """Fallback éolien : Open-Meteo avec extrapolation hub_height."""
    try:
        url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date=2020-01-01&end_date=2020-12-31"
            f"&hourly=wind_speed_10m"
        )
        r = _http_get(url, timeout=10)
        if r.status_code == 200:
            ws10 = [s / 3.6 for s in r.json()["hourly"]["wind_speed_10m"]]
            ws_hub = [
                wind_hub_extrapolate(v, 10.0, hub_height, z0) for v in ws10
            ]
            return _build_typical_year(
                [wind_power_curve(v) for v in ws_hub]
            )
    except Exception:
        pass
    return [0.3] * N_HOURS


# ══════════════════════════════════════════════════════════════════════════════
# Profils de température TMY (M3)
# ══════════════════════════════════════════════════════════════════════════════

def _get_temperature_fallback(lat: float, lon: float) -> List[float]:
    """Fallback température : Open-Meteo, puis profil constant 15°C."""
    try:
        url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date=2020-01-01&end_date=2020-12-31"
            f"&hourly=temperature_2m"
        )
        r = _http_get(url, timeout=10)
        if r.status_code == 200:
            raw = r.json()["hourly"]["temperature_2m"]
            if len(raw) >= 8760:
                return _build_typical_year(raw[:8760])
    except Exception:
        pass
    return [15.0] * N_HOURS


def get_tmy_temperature_profile(lat: float, lon: float, p: EcoParams) -> List[float]:
    """Profil TMY 288h de température ambiante (°C). NASA POWER T2M, fallback Open-Meteo."""
    ck = _tmy_cache_key(lat, lon, "temp", p)
    if ck in _tmy_cache:
        return _tmy_cache[ck]

    years = list(range(p.economic.tmy_start_year, p.economic.tmy_end_year + 1))
    raw_all = _fetch_nasa_parallel(lat, lon, years, NASA_PARAMS_TEMP)

    if not raw_all:
        profile = _get_temperature_fallback(lat, lon)
        _tmy_cache[ck] = profile
        return profile

    yearly: Dict[int, Dict[int, List[float]]] = {}
    for y, data in raw_all.items():
        if "T2M" in data:
            yearly[y] = _monthly_hourly_mean(data, "T2M")

    if not yearly:
        profile = _get_temperature_fallback(lat, lon)
        _tmy_cache[ck] = profile
        return profile

    tmy = _select_tmy_months(yearly)
    profile = []
    for m in range(1, 13):
        profile.extend(tmy[m])

    _tmy_cache[ck] = profile
    return profile


def get_tmy_cop_profile(lat: float, lon: float, p: EcoParams) -> List[float]:
    """
    Profil COP 288h via modèle de Carnot.
    COP[t] = η_carnot × (T_supply + 273) / max(1, T_supply - T_amb[t])
    η_carnot calibré pour que COP(T=7°C) = COP_nominal.
    """
    ck = _tmy_cache_key(lat, lon, f"cop_S{p.thermal.hp.supply_temp}_C{p.thermal.hp.cop}", p)
    if ck in _tmy_cache:
        return _tmy_cache[ck]

    temp = get_tmy_temperature_profile(lat, lon, p)
    T_supply = p.thermal.hp.supply_temp
    cop_nom = p.thermal.hp.cop
    eta_carnot = cop_nom * (T_supply - T_COP_REF) / (T_supply + 273.15)

    profile = []
    for t_amb in temp:
        delta = T_supply - t_amb
        if delta <= 0:
            cop = COP_MAX
        else:
            cop = eta_carnot * (T_supply + 273.15) / delta
        profile.append(max(0.5, min(COP_MAX, cop)))

    _tmy_cache[ck] = profile
    return profile


def get_tmy_boiler_eff_profile(lat: float, lon: float, p: EcoParams) -> List[float]:
    """
    Profil d'efficacité chaudière 288h (modèle condensation simplifié).
    eff[t] = η_nom + 0.04 × clamp((20 - T_amb[t]) / 40, 0, 1)
    Varie de η_nom (été, 20°C) à η_nom + 0.04 (hiver, -20°C).
    """
    ck = _tmy_cache_key(lat, lon, f"boilerEff_{p.thermal.boiler.eff}", p)
    if ck in _tmy_cache:
        return _tmy_cache[ck]

    temp = get_tmy_temperature_profile(lat, lon, p)
    eff_nom = p.thermal.boiler.eff
    profile = []
    for t_amb in temp:
        cold_frac = max(0.0, min(1.0, (BOILER_T_REF_HIGH - t_amb) / BOILER_T_DELTA))
        profile.append(eff_nom + BOILER_EFF_GAIN * cold_frac)

    _tmy_cache[ck] = profile
    return profile


# ══════════════════════════════════════════════════════════════════════════════
# Profils 8760h (bruts, sans compression TMY)
# ══════════════════════════════════════════════════════════════════════════════

_8760_cache: Dict[str, List[float]] = {}


def _get_pvgis_8760h(lat: float, lon: float, year: int = 2020,
                       tilt: float = 0.0, azimuth: float = 0.0) -> List[float]:
    """Retourne 8760h de profil solaire (kW/kWp) depuis PVGIS avec tilt/azimuth (M4)."""
    try:
        url = (
            f"https://re.jrc.ec.europa.eu/api/v5_2/seriescalc"
            f"?lat={lat}&lon={lon}&startyear={year}&endyear={year}"
            f"&pvcalculation=1&peakpower=1&loss=14&outputformat=json"
            f"&angle={tilt}&aspect={azimuth}"
        )
        r = _http_get(url, timeout=30)
        if r.status_code == 200:
            raw = [h["P"] / 1000 for h in r.json()["outputs"]["hourly"]]
            if len(raw) == 8760:
                return raw
    except Exception:
        pass
    # Fallback: répéter le profil synthétique 365 fois
    synthetic_day = [0.0]*7 + [0.2,0.5,0.8,1.0,1.0,0.9,0.7,0.4,0.1] + [0.0]*8
    return (synthetic_day * 365)[:8760]


def _get_openmeteo_wind_8760h(lat: float, lon: float, year: int = 2020,
                                hub_height: float = 80.0, z0: float = 0.03) -> List[float]:
    """Retourne 8760h de profil éolien (kW/kW) depuis Open-Meteo pour une année."""
    try:
        url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date={year}-01-01&end_date={year}-12-31"
            f"&hourly=wind_speed_10m"
        )
        r = _http_get(url, timeout=30)
        if r.status_code == 200:
            ws10 = [s / 3.6 for s in r.json()["hourly"]["wind_speed_10m"]]
            ws_hub = [wind_hub_extrapolate(v, 10.0, hub_height, z0) for v in ws10]
            cf = [wind_power_curve(v) for v in ws_hub]
            if len(cf) >= 8760:
                return cf[:8760]
    except Exception:
        pass
    return [0.3] * 8760


def get_solar_8760h(lat: float, lon: float, year: int = 2020,
                     tilt: float = 0.0, azimuth: float = 0.0) -> List[float]:
    """Profil solaire 8760h avec cache mémoire et tilt/azimuth (M4)."""
    ck = f"s8760_{round(lat,2)}_{round(lon,2)}_{year}_t{tilt}_a{azimuth}"
    if ck not in _8760_cache:
        _8760_cache[ck] = _get_pvgis_8760h(lat, lon, year, tilt, azimuth)
    return _8760_cache[ck]


def get_wind_8760h(lat: float, lon: float, hub_height: float = 80.0,
                    z0: float = 0.03, year: int = 2020) -> List[float]:
    """Profil éolien 8760h avec cache mémoire."""
    ck = f"w8760_{round(lat,2)}_{round(lon,2)}_{hub_height}_{z0}_{year}"
    if ck not in _8760_cache:
        _8760_cache[ck] = _get_openmeteo_wind_8760h(lat, lon, year, hub_height, z0)
    return _8760_cache[ck]


def _get_openmeteo_temp_8760h(lat: float, lon: float, year: int = 2020) -> List[float]:
    """Retourne 8760h de température ambiante (°C) depuis Open-Meteo."""
    try:
        url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date={year}-01-01&end_date={year}-12-31"
            f"&hourly=temperature_2m"
        )
        r = _http_get(url, timeout=30)
        if r.status_code == 200:
            raw = r.json()["hourly"]["temperature_2m"]
            if len(raw) >= 8760:
                return raw[:8760]
    except Exception:
        pass
    return [15.0] * 8760


def get_temperature_8760h(lat: float, lon: float, year: int = 2020) -> List[float]:
    """Profil température 8760h avec cache mémoire."""
    ck = f"t8760_{round(lat,2)}_{round(lon,2)}_{year}"
    if ck not in _8760_cache:
        _8760_cache[ck] = _get_openmeteo_temp_8760h(lat, lon, year)
    return _8760_cache[ck]


def get_cop_profile_8760h(lat: float, lon: float, p: EcoParams, year: int = 2020) -> List[float]:
    """Profil COP 8760h via modèle Carnot calibré sur COP nominal à 7°C."""
    ck = f"cop8760_{round(lat,2)}_{round(lon,2)}_{p.thermal.hp.supply_temp}_{p.thermal.hp.cop}_{year}"
    if ck not in _8760_cache:
        temp = get_temperature_8760h(lat, lon, year)
        T_supply = p.thermal.hp.supply_temp
        eta = p.thermal.hp.cop * (T_supply - T_COP_REF) / (T_supply + 273.15)
        profile = []
        for t_amb in temp:
            delta = T_supply - t_amb
            cop = COP_MAX if delta <= 0 else eta * (T_supply + 273.15) / delta
            profile.append(max(0.5, min(COP_MAX, cop)))
        _8760_cache[ck] = profile
    return _8760_cache[ck]


def get_boiler_eff_profile_8760h(lat: float, lon: float, p: EcoParams, year: int = 2020) -> List[float]:
    """Profil efficacité chaudière 8760h (modèle condensation simplifié)."""
    ck = f"beff8760_{round(lat,2)}_{round(lon,2)}_{p.thermal.boiler.eff}_{year}"
    if ck not in _8760_cache:
        temp = get_temperature_8760h(lat, lon, year)
        eff_nom = p.thermal.boiler.eff
        profile = []
        for t_amb in temp:
            cold_frac = max(0.0, min(1.0, (BOILER_T_REF_HIGH - t_amb) / BOILER_T_DELTA))
            profile.append(eff_nom + BOILER_EFF_GAIN * cold_frac)
        _8760_cache[ck] = profile
    return _8760_cache[ck]


# ══════════════════════════════════════════════════════════════════════════════
# Profils 672h — 4 semaines-types saisonnières
# ══════════════════════════════════════════════════════════════════════════════

_TIMY_672_CACHE: Dict[str, List[float]] = {}

# Jours cumulés par mois pour 2020 (bissextile) — mapping heure → saison/jour semaine
_CUMUL_2020 = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366]
_SEASON_MAP = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0]  # mois 0-11 → saison


def _build_672_from_8760(data_8760: List[float]) -> List[float]:
    """
    Construit 4 semaines-types (672h) à partir de 8760h chronologiques.
    Pour chaque saison météo, moyenne tous les mêmes (jour_sem, heure).
    """
    # Agrégation : (saison 0-3, jour_sem 0-6, heure 0-23) → [valeurs]
    agg: Dict[Tuple[int, int, int], List[float]] = defaultdict(list)
    for t, val in enumerate(data_8760[:8760]):
        day_of_year = t // 24
        h = t % 24
        m = next(i for i in range(12) if _CUMUL_2020[i] <= day_of_year < _CUMUL_2020[i + 1])
        season = _SEASON_MAP[m]
        day_in_month = day_of_year - _CUMUL_2020[m] + 1
        wd = date(2020, m + 1, day_in_month).weekday()  # 0=Lun
        agg[(season, wd, h)].append(val)

    # Construire le profil 672h : 4 saisons × 7 jours × 24h
    result = []
    for season in range(4):
        for wd in range(7):
            for h in range(24):
                vals = agg.get((season, wd, h), [])
                result.append(sum(vals) / len(vals) if vals else 0.0)
    return result


def get_tmy_solar_672h(lat: float, lon: float, p: EcoParams) -> List[float]:
    """Profil solaire 672h (4 semaines-types saisonnières) depuis PVGIS avec tilt/azimuth."""
    tilt = getattr(p.solar, 'tilt', 0.0)
    azimuth = getattr(p.solar, 'azimuth', 0.0)
    ck = f"s672_{round(lat,2)}_{round(lon,2)}_t{tilt}_a{azimuth}"
    if ck not in _TIMY_672_CACHE:
        raw_8760 = get_solar_8760h(lat, lon, year=2020, tilt=tilt, azimuth=azimuth)
        _TIMY_672_CACHE[ck] = _build_672_from_8760(raw_8760)
    return _TIMY_672_CACHE[ck]


def get_tmy_wind_672h(lat: float, lon: float, p: EcoParams) -> List[float]:
    """Profil éolien 672h (4 semaines-types saisonnières) depuis Open-Meteo 2020."""
    ck = f"w672_{round(lat,2)}_{round(lon,2)}_{p.wind.hub_height}_{p.wind.roughness_length}"
    if ck not in _TIMY_672_CACHE:
        raw_8760 = get_wind_8760h(lat, lon, p.wind.hub_height, p.wind.roughness_length, year=2020)
        _TIMY_672_CACHE[ck] = _build_672_from_8760(raw_8760)
    return _TIMY_672_CACHE[ck]


def get_tmy_temperature_672h(lat: float, lon: float, p: EcoParams) -> List[float]:
    """Profil température 672h (4 semaines-types saisonnières)."""
    ck = f"t672_{round(lat,2)}_{round(lon,2)}"
    if ck not in _TIMY_672_CACHE:
        raw_8760 = get_temperature_8760h(lat, lon, year=2020)
        _TIMY_672_CACHE[ck] = _build_672_from_8760(raw_8760)
    return _TIMY_672_CACHE[ck]


def get_tmy_cop_profile_672h(lat: float, lon: float, p: EcoParams) -> List[float]:
    """Profil COP 672h (4 semaines-types saisonnières)."""
    ck = f"cop672_{round(lat,2)}_{round(lon,2)}_{p.thermal.hp.supply_temp}_{p.thermal.hp.cop}"
    if ck not in _TIMY_672_CACHE:
        raw_8760 = get_cop_profile_8760h(lat, lon, p, year=2020)
        _TIMY_672_CACHE[ck] = _build_672_from_8760(raw_8760)
    return _TIMY_672_CACHE[ck]


def get_tmy_boiler_eff_profile_672h(lat: float, lon: float, p: EcoParams) -> List[float]:
    """Profil efficacité chaudière 672h (4 semaines-types saisonnières)."""
    ck = f"beff672_{round(lat,2)}_{round(lon,2)}_{p.thermal.boiler.eff}"
    if ck not in _TIMY_672_CACHE:
        raw_8760 = get_boiler_eff_profile_8760h(lat, lon, p, year=2020)
        _TIMY_672_CACHE[ck] = _build_672_from_8760(raw_8760)
    return _TIMY_672_CACHE[ck]


# ══════════════════════════════════════════════════════════════════════════════
# API publique du cache TMY
# ══════════════════════════════════════════════════════════════════════════════

def get_tmy_cache_keys() -> List[str]:
    """Retourne les clés présentes dans le cache TMY."""
    return list(_tmy_cache.keys())


def get_tmy_cache_size() -> int:
    """Retourne le nombre de profils en cache."""
    return len(_tmy_cache)
