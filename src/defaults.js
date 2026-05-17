// ───────────────────────────────────────────────────────────────────────────
// Profil résidentiel/mixte normalisé sur 24h (peak = 1.0)
// → load[h] = RESIDENTIAL_PROFILE_NORM[h] × num_homes × peak_per_home
// ───────────────────────────────────────────────────────────────────────────
export const RESIDENTIAL_PROFILE_NORM = [
  0.30, 0.28, 0.25, 0.25, 0.27, 0.30, 0.40, 0.55,
  0.55, 0.45, 0.40, 0.42, 0.45, 0.45, 0.45, 0.50,
  0.65, 0.85, 1.00, 0.95, 0.80, 0.65, 0.50, 0.38,
];

// ───────────────────────────────────────────────────────────────────────────
// Toggles d'inclusion (front-only) — sources actives dans la modélisation
// ───────────────────────────────────────────────────────────────────────────
export const DEFAULT_ENABLED = {
  solar: true,
  wind: true,
  hydro: false,    // peu de sites ont accès à l'hydro
  battery: true,
  gas: true,       // moteur gaz
  hp: false,       // pompe à chaleur
  boiler: true,    // chaudière gaz
};

// ───────────────────────────────────────────────────────────────────────────
// Valeurs par défaut alignées avec EcoParams (backend/models/schemas.py)
// Structure imbriquée identique au backend : params.solar.capex, etc.
// Seuls num_homes et peak_per_home restent à plat (frontend-only).
// ───────────────────────────────────────────────────────────────────────────
export const DEFAULT_PARAMS = {
  // ── Usages (front → calcule load) ────────────────────────────────────
  num_homes: 50,
  peak_per_home: 2.0,

  // ── Solaire ──────────────────────────────────────────────────────────
  solar: {
    capex: 600.0,
    inverter_capex: 150.0,
    inverter_lifetime: 10,
    lifetime: 25,
    degradation: 0.005,
    temp_coeff: -0.004,
    tilt: 30,
    azimuth: 0,
    albedo: 0.2,
    tracking: 'fixed',
    max_kw: 200.0,
  },

  // ── Éolien ───────────────────────────────────────────────────────────
  wind: {
    capex: 1500.0,
    lifetime: 20,
    hub_height: 80.0,
    roughness_length: 0.03,
    max_kw: 200.0,
  },

  // ── Hydro ────────────────────────────────────────────────────────────
  hydro: {
    capex: 2500.0,
    flow: 1.0,
    lifetime: 30,
    max_kw: 0.0,
  },

  // ── Stockage batterie ────────────────────────────────────────────────
  storage: {
    capex: 300.0,
    lifetime: 10,
    inverter_capex: 150.0,
    inverter_lifetime: 10,
    cycle_cost: 0.05,
    eff_ch: 0.95,
    eff_dis: 0.95,
    min_soc: 0.20,
  },

  // ── Thermique ────────────────────────────────────────────────────────
  thermal: {
    thermal_ratio: 0.0,
    hp: {
      capex: 800.0,
      lifetime: 15,
      cop: 3.0,
      supply_temp: 35,
    },
    boiler: {
      capex: 150.0,
      lifetime: 15,
      eff: 0.90,
    },
    tes: {
      capex: 50.0,
      lifetime: 20,
    },
  },

  // ── Moteur gaz ──────────────────────────────────────────────────────
  gas: {
    fuel_price: 0.20,
    lifetime: 15,
    ramp_limit_kw: 0.0,
    use_milp: false,
    min_load_pct: 0.30,
    startup_cost: 5.0,
    max_kw: 10000.0,
  },

  // ── Réseau ───────────────────────────────────────────────────────────
  grid: {
    connected: true,
    use_spot_market: false,
    peak_price: 0.25,
    offpeak_price: 0.12,
    sell_price: 0.10,
    demand_charge: 10.0,
  },

  // ── Économie & Modélisation ──────────────────────────────────────────
  economic: {
    discount_rate: 0.05,
    cable_capex: 150.0,
    voll: 5.0,
    grid_inflation: 0.04,
    gas_inflation: 0.02,
    om_inflation: 0.02,
    seasonality: 0.30,
    commercial_power: 0.0,
    p90_mode: false,
    forecast_error: 0.0,
    run_sensitivity: true,
    max_annual_co2_t: 0.0,
    max_flex: 0.10,
    num_evs: 0,
    v2g_enabled: false,
    tmy_start_year: 2013,
    tmy_end_year: 2022,
    resolution: '288h',
    stochastic: false,
    extreme_events: false,
    n1_reserve: false,
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Capacités manuelles par défaut (mode "Paramétrage personnel")
// ───────────────────────────────────────────────────────────────────────────
export const DEFAULT_MANUAL_CAPS = {
  solar_kw: 0.0,
  solar_inv_kw: 0.0,
  wind_kw: 0.0,
  hydro_kw: 0.0,
  bess_kwh: 0.0,
  bess_kw: 0.0,
  gas_kw: 0.0,
  hp_kw: 0.0,
  boiler_kw: 0.0,
  tes_kwh: 0.0,
  grid_kw: 0.0,
};

export const DEFAULT_LOCATION = { lat: 48.85, lon: 2.35 };

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// Bornes mensuelles pour 8760h (heures cumulées, année non-bissextile)
export const MONTH_BOUNDS_8760 = [0, 744, 1416, 2160, 2880, 3624, 4344, 5088, 5832, 6552, 7296, 8016, 8760];

// Bornes saisonnières pour 672h (4 saisons × 168h)
export const SEASON_BOUNDS_672 = [0, 168, 336, 504, 672];
export const SEASONS_FR = ['Déc–Fév', 'Mars–Mai', 'Juin–Août', 'Sept–Nov'];
export const SEASONS_EN = ['Dec–Feb', 'Mar–May', 'Jun–Aug', 'Sep–Nov'];
export const SEASONS_FULL_FR = { 0: 'Décembre–Février', 1: 'Mars–Mai', 2: 'Juin–Août', 3: 'Septembre–Novembre' };
export const SEASONS_FULL_EN = { 0: 'December–February', 1: 'March–May', 2: 'June–August', 3: 'September–November' };

// ───────────────────────────────────────────────────────────────────────────
// Palette "Clean Tech" (bleu profond + accents sectoriels)
// ───────────────────────────────────────────────────────────────────────────
export const COLORS = {
  solar:    '#f59e0b', // amber 500
  wind:     '#0ea5e9', // sky 500
  hydro:    '#0891b2', // cyan 600
  bessDis:  '#a855f7', // purple 500
  bessCh:   '#7c3aed', // violet 600
  gas:      '#ea580c', // orange 600
  gasTh:    '#dc2626', // red 600
  gridBuy:  '#475569', // slate 600
  gridSell: '#10b981', // emerald (revenu)
  evDis:    '#14b8a6', // teal 500
  evCh:     '#3b82f6', // blue 500
  hp:       '#db2777', // pink 600
  load:     '#1e293b', // slate 800 (light theme)
  loadRaw:  '#64748b',
  shed:     '#ef4444',

  // KPIs
  capex: '#2563eb', // blue 600
  roi:   '#10b981', // emerald (économie)
  van:   '#7c3aed', // violet 600
  tri:   '#0284c7', // sky 600
  co2:   '#10b981', // emerald (CO₂ évité)
};
