# -*- coding: utf-8 -*-
"""
Détection d'événements extrêmes (M6).
Scanne les 10 ans de données NASA POWER (2013–2022) pour trouver les pires
séquences historiques de 3 types : dark doldrums, vague de froid, canicule.
Analyse la résilience du système sur ces séquences.
"""

from typing import List, Dict, Optional, Tuple

from ..models.schemas import EcoParams
from .weather_service import (
    _fetch_nasa_parallel, _monthly_hourly_mean,
    NASA_PARAMS_SOL_TEMP, NASA_PARAMS_WIN,
    wind_power_curve, wind_hub_extrapolate,
)


def _daily_avg(hourly: List[float]) -> List[float]:
    """Convertit 24×N valeurs horaires en N moyennes journalières."""
    days = len(hourly) // 24
    return [sum(hourly[d * 24:(d + 1) * 24]) / 24 for d in range(days)]


def _longest_consecutive(data: List[bool], min_len: int = 1) -> Tuple[int, int]:
    """Plus longue séquence de True consécutifs. Retourne (start_idx, length)."""
    best_start, best_len = 0, 0
    cur_start, cur_len = 0, 0
    for i, val in enumerate(data):
        if val:
            if cur_len == 0:
                cur_start = i
            cur_len += 1
        else:
            if cur_len > best_len:
                best_start, best_len = cur_start, cur_len
            cur_len = 0
    if cur_len > best_len:
        best_start, best_len = cur_start, cur_len
    return (best_start, best_len) if best_len >= min_len else (0, 0)


def _build_hourly_profile(daily_ghi: List[float], daily_wind: List[float],
                           daily_temp: List[float], start_day: int, length_days: int,
                           lat: float, hub_height: float, z0: float) -> dict:
    """
    Construit un profil horaire pour une séquence de J jours.
    Les moyennes journalières NASA sont expansées en 24h avec un profil diurne type.
    """
    from .weather_service import _solar_position, _decompose_ghi_dni, _hdkr_poa

    hours = length_days * 24
    solar_profile = []
    wind_profile = []
    temp_profile = []

    synthetic_day = [0.0]*7 + [0.2,0.5,0.8,1.0,1.0,0.9,0.7,0.4,0.1] + [0.0]*8
    # Normaliser pour que la moyenne = 1.0 sur 24h
    day_norm = sum(synthetic_day) / 24
    day_shape = [v / max(0.001, day_norm) for v in synthetic_day]

    for d in range(length_days):
        ghi_d = daily_ghi[start_day + d]
        wnd_d = daily_wind[start_day + d]
        tmp_d = daily_temp[start_day + d]

        for h in range(24):
            solar_profile.append(ghi_d * day_shape[h] * 0.90 / 1000.0)
            wind_profile.append(wnd_d)
            temp_profile.append(tmp_d)

    return {
        "solar": solar_profile,
        "wind": wind_profile,
        "temp": temp_profile,
        "hours": hours,
        "days": length_days,
    }


def detect_all_events(lat: float, lon: float, p: EcoParams,
                       hourly_data: dict) -> Dict:
    """
    Scanne les 10 ans NASA POWER pour les pires séquences historiques.
    Retourne 3 événements avec leur profil horaire et analyse de résilience.
    """
    years = list(range(p.economic.tmy_start_year, p.economic.tmy_end_year + 1))
    print(f"[ExtremeEvents] Scanning {len(years)} years of NASA data …")

    # Récupérer toutes les années NASA (ou fallback 8760h)
    raw_sol = _fetch_nasa_parallel(lat, lon, years, NASA_PARAMS_SOL_TEMP)
    raw_win = _fetch_nasa_parallel(lat, lon, years, NASA_PARAMS_WIN)

    if not raw_sol:
        # Fallback : utiliser les données 8760h PVGIS/Open-Meteo (2020) déjà en cache
        print("[ExtremeEvents] NASA indisponible, fallback 8760h 2020 data.")
        from .weather_service import get_solar_8760h, get_wind_8760h, get_temperature_8760h
        try:
            solar_8760 = get_solar_8760h(lat, lon, tilt=p.solar.tilt, azimuth=p.solar.azimuth)
            wind_8760 = get_wind_8760h(lat, lon, p.wind.hub_height, p.wind.roughness_length)
            temp_8760 = get_temperature_8760h(lat, lon)
        except Exception:
            return {"status": "unavailable",
                    "reason": "Aucune donnée météo disponible (NASA + PVGIS/Open-Meteo)."}

        # Convertir en moyennes journalières
        all_days_ghi = []
        all_days_wind = []
        all_days_temp = []
        day_labels = []
        days_2020 = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        cursor = 0
        for m_idx, ndays in enumerate(days_2020):
            for d in range(1, ndays + 1):
                seg = slice(cursor, cursor + 24)
                all_days_ghi.append(sum(solar_8760[seg]) / 24 * 1000 / 0.90)  # CF → W/m² approx
                all_days_wind.append(sum(wind_8760[seg]) / 24)
                all_days_temp.append(sum(temp_8760[seg]) / 24)
                day_labels.append((2020, m_idx + 1, d))
                cursor += 24

    else:
        # Agrégation : par jour sur toutes les années NASA
        all_days_ghi = []   # W/m² moyen journalier
        all_days_wind = []  # CF éolien moyen journalier
        all_days_temp = []  # °C moyen journalier
        day_labels = []     # (year, month, day) pour traçabilité

        for year in sorted(raw_sol.keys()):
            s_data = raw_sol.get(year, {})
            w_data = raw_win.get(year, {})
            if "ALLSKY_SFC_SW_DWN" not in s_data:
                continue

            ghi_monthly = _monthly_hourly_mean(s_data, "ALLSKY_SFC_SW_DWN")
            tmp_monthly = _monthly_hourly_mean(s_data, "T2M") if "T2M" in s_data else None
            ws_key = next((k for k in ("WS50M", "WS10M") if k in w_data), None)

            for m in range(1, 13):
                days_in_month = [31, 29 if year % 4 == 0 else 28, 31, 30, 31, 30,
                                 31, 31, 30, 31, 30, 31][m - 1]
                for d in range(1, days_in_month + 1):
                    ghi_avg = sum(ghi_monthly[m][h] for h in range(24)) / 24
                    tmp_avg = sum(tmp_monthly[m][h] for h in range(24)) / 24 if tmp_monthly else 15.0
                    if ws_key:
                        ws_monthly = _monthly_hourly_mean(w_data, ws_key)
                        h_ref = 50.0 if ws_key == "WS50M" else 10.0
                        wnd_vals = [wind_power_curve(
                            wind_hub_extrapolate(ws_monthly[m][h], h_ref,
                                                p.wind.hub_height, p.wind.roughness_length))
                                  for h in range(24)]
                        wnd_avg = sum(wnd_vals) / 24
                    else:
                        wnd_avg = 0.0

                    all_days_ghi.append(ghi_avg)
                    all_days_wind.append(wnd_avg)
                    all_days_temp.append(tmp_avg)
                    day_labels.append((year, m, d))

    total_days = len(all_days_ghi)
    if total_days < 30:
        return {"status": "unavailable", "reason": "Insufficient daily data."}

    # ── 1. Dark doldrums : vent faible ET soleil faible ──────────────────
    # Critère : vent CF < 0.03 (≈ 2 m/s) ET GHI < 100 W/m² (≈ CF 0.10)
    dd_mask = [
        all_days_wind[d] < 0.03 and (all_days_ghi[d] * 0.90 / 1000) < 0.10
        for d in range(total_days)
    ]
    dd_start, dd_len = _longest_consecutive(dd_mask, min_len=1)

    # ── 2. Vague de froid : T° < −2°C ────────────────────────────────────
    cw_mask = [all_days_temp[d] < -2.0 for d in range(total_days)]
    cw_start, cw_len = _longest_consecutive(cw_mask, min_len=1)

    # ── 3. Canicule : T° > 32°C ──────────────────────────────────────────
    hw_mask = [all_days_temp[d] > 32.0 for d in range(total_days)]
    hw_start, hw_len = _longest_consecutive(hw_mask, min_len=1)

    # ── Analyse de résilience sur chaque séquence ─────────────────────────
    def resilience_on_sequence(start_day: int, length_days: int,
                               event_type: str) -> dict:
        if length_days == 0:
            return {"detected": False, "duration_h": 0, "event_type": event_type}

        # Construire profil horaire de la séquence
        prof = _build_hourly_profile(all_days_ghi, all_days_wind, all_days_temp,
                                      start_day, length_days,
                                      lat, p.wind.hub_height, p.wind.roughness_length)
        H = prof["hours"]

        # Utiliser les capacités optimales pour estimer la résilience
        caps = {k: v for k, v in hourly_data.get("caps", {}).items()} if isinstance(hourly_data.get("caps"), dict) else {}
        cap_s = caps.get("solar", 0)
        cap_w = caps.get("wind", 0)
        cap_b = caps.get("bess", 0)
        cap_g = caps.get("gas", 0)

        # Analyser heure par heure
        total_load = 0.0
        shed = 0.0
        backup = 0.0
        batt_used = 0.0
        soc = cap_b * 0.5  # SOC initial à 50%

        raw_load = hourly_data.get("raw_load", [])
        avg_load = sum(raw_load) / max(1, len(raw_load)) if raw_load else 1.0

        for t in range(H):
            solar = prof["solar"][t] * cap_s
            wind = prof["wind"][t] * cap_w
            load = avg_load
            net = load - solar - wind

            if net <= 0:
                # Surplus : charge batterie
                batt_used += min(-net, cap_b - soc)
                soc = min(cap_b, soc - net)
            else:
                # Déficit : décharge batterie puis backup
                batt_disch = min(net, soc - cap_b * 0.2)
                batt_used += batt_disch
                soc -= batt_disch
                remaining = net - batt_disch
                if cap_g > 0:
                    backup += remaining
                else:
                    shed += remaining

            total_load += load

        coverage = round(100 - (shed / max(1, total_load) * 100), 1)
        y, m, d = day_labels[start_day]
        y2, m2, d2 = day_labels[min(start_day + length_days - 1, len(day_labels) - 1)]

        avg_w = sum(all_days_wind[start_day:start_day + length_days]) / length_days
        avg_s = sum(all_days_ghi[start_day:start_day + length_days]) * 0.90 / 1000 / length_days
        avg_t = sum(all_days_temp[start_day:start_day + length_days]) / length_days

        return {
            "detected": True,
            "event_type": event_type,
            "duration_h": length_days * 24,
            "duration_days": length_days,
            "start_date": f"{y}-{m:02d}-{d:02d}",
            "end_date": f"{y2}-{m2:02d}-{d2:02d}",
            "total_load_kwh": round(total_load, 1),
            "shed_kwh": round(shed, 1),
            "coverage_pct": coverage,
            "backup_gas_kwh": round(backup, 1),
            "battery_kwh": round(batt_used, 1),
            "avg_wind_cf": round(avg_w, 3),
            "avg_solar_cf": round(avg_s, 3),
            "avg_temp_c": round(avg_t, 1),
        }

    dd_result = resilience_on_sequence(dd_start, dd_len, "dark_doldrums")
    cw_result = resilience_on_sequence(cw_start, cw_len, "cold_wave")
    hw_result = resilience_on_sequence(hw_start, hw_len, "heat_wave")

    # Labels pour le frontend
    for ev, label_fr, label_en, desc_fr, desc_en in [
        (dd_result, "Dark doldrums", "Dark doldrums",
         f"Vent faible + soleil faible · {dd_len}j ({day_labels[dd_start][0] if dd_len else ''})",
         f"Low wind + low solar · {dd_len}d ({day_labels[dd_start][0] if dd_len else ''})"),
        (cw_result, "Vague de froid", "Cold wave",
         f"T° < −2°C · {cw_len}j ({day_labels[cw_start][0] if cw_len else ''})",
         f"T < −2°C · {cw_len}d ({day_labels[cw_start][0] if cw_len else ''})"),
        (hw_result, "Canicule", "Heat wave",
         f"T° > 32°C · {hw_len}j ({day_labels[hw_start][0] if hw_len else ''})",
         f"T > 32°C · {hw_len}d ({day_labels[hw_start][0] if hw_len else ''})"),
    ]:
        ev["label_fr"] = label_fr
        ev["label_en"] = label_en
        ev["description_fr"] = desc_fr
        ev["description_en"] = desc_en

    worst = max(
        [e for e in [dd_result, cw_result, hw_result] if e.get("detected")],
        key=lambda e: e.get("duration_h", 0),
        default=None
    )

    return {
        "status": "success",
        "total_days_scanned": total_days,
        "years_scanned": f"{min(years)}–{max(years)}",
        "events": [dd_result, cw_result, hw_result],
        "worst_event": worst["event_type"] if worst else "none",
        "max_duration_h": worst["duration_h"] if worst else 0,
    }


# Alias pour compatibilité avec main.py
run_extreme_events_analysis = detect_all_events
