# Microgrid Optimizer

Sizing and simulation tool for microgrids — find the optimal mix of solar, wind, hydro, batteries, gas genset, and heat pump that minimizes total cost over a 25-year horizon.

![Stack](https://img.shields.io/badge/stack-FastAPI_+_PuLP/CBC_|_React_+_Vite_+_Tailwind_+_Recharts-2563eb)

## Features

- **Linear programming (LP/MILP)** — simultaneous optimization of equipment capacities and hourly dispatch
- **3 temporal resolutions** — 288h (12 typical days), 672h (4 typical weeks), 8760h (full chronological year)
- **Real weather data** — NASA POWER (~10 years) with PVGIS and Open-Meteo fallbacks
- **Temperature effects** — NOCT model for PV, Carnot model for heat pump COP, condensing boiler efficiency
- **Solar geometry** — HDKR transposition, tilt/azimuth, single and dual-axis tracking
- **Stochastic P90 analysis** — multi-year KPI distribution over real NASA POWER years
- **Extreme event stress-test** — dark doldrums, cold waves, heat waves detection
- **N-1 reserve constraint** — ensures load coverage if the largest generator fails
- **Progressive battery degradation** — calendar + cycling capacity fade
- **25-year financial loop** — NPV, IRR, ROI, carbon payback with differentiated inflation
- **CSV & PDF export** — full data export with formatted reports
- **Bilingual UI** — French / English

## Quick start

### Backend (port 8000)

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend (port 5173)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` to the backend.

## Project structure

```
├── backend/
│   ├── main.py                       # FastAPI app, routes /api/*
│   ├── models/schemas.py             # Pydantic models (EcoParams + 8 sub-models)
│   ├── services/
│   │   ├── weather_service.py        # NASA POWER, TMY, wind power curve, solar geometry, HDKR
│   │   ├── optimizer_engine.py       # LP/MILP core (288h, 672h), constraints, 25-year loop
│   │   ├── optimizer_8760.py         # LP core (8760h chronological)
│   │   ├── finance_utils.py          # CRF, IRR
│   │   ├── stochastic.py            # Multi-year P90 analysis (M5)
│   │   └── extreme_events.py        # Extreme event stress-test (M6)
│   ├── utils/helpers.py              # Constants, ResolutionConfig
│   └── tests/                        # pytest (37 tests)
├── src/
│   ├── App.jsx                       # Global state, API calls, dashboard
│   ├── components/
│   │   ├── Sidebar.jsx               # Left panel: all configuration tabs
│   │   ├── Header.jsx                # Top bar: month selector, exports, dark mode, language
│   │   ├── Charts.jsx                # Energy balance, cashflow, carbon, OPEX, tornado
│   │   ├── MapPicker.jsx             # Leaflet map for site selection
│   │   ├── Methodology.jsx           # "How it works" — full documentation (17 chapters)
│   │   └── Tutorial.jsx              # Interactive step-by-step guide
│   ├── defaults.js                   # Default parameters, colors, constants
│   ├── export.js                     # CSV and PDF export
│   └── i18n.js                       # FR/EN translation dictionary
├── docs/specs/physics_logic.md       # Technical reference (formulas, constraints, constants)
└── requirements.txt
```

## API

### `POST /api/optimize`

Sends `EcoParams` + load profile + GPS coordinates. Returns optimal capacities, KPIs, 25-year cashflow/carbon trajectories, and hourly dispatch data.

```json
{
  "params": { "solar": {...}, "wind": {...}, "storage": {...}, ... },
  "load": [0.35, 0.30, ...],
  "lat": 48.85,
  "lon": 2.35
}
```

### `POST /api/simulate`

Same structure as `/api/optimize` with additional manual capacity fields (`solar_kw`, `bess_kwh`, `gas_kw`, etc.). The solver optimizes dispatch only.

## License

MIT
