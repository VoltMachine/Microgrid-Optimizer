import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { MONTHS_FR } from './defaults';

// ═══════════════════════════════════════════════════════════════════════════
// CSV — multi-sections nettement séparées, chaque résultat = sa "page"
// ═══════════════════════════════════════════════════════════════════════════

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCSV(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

function sectionSeparator(title) {
  return `"# ${'='.repeat(60)}"\n"# ${title}"`;
}

function roundVal(v, decimals = 0) {
  if (typeof v !== 'number') return v;
  return +v.toFixed(decimals);
}

// ── Libellés et unités des paramètres (utilisés par CSV + PDF) ──────────────
const PARAM_LABELS = {
  num_homes: 'Nb foyers / unités',
  peak_per_home: 'Puissance max / unité (kW)',
  seasonality: 'Surconsommation hiver',
  commercial_power: 'Commerces (8h-18h, kW)',

  solar_capex: 'CAPEX Solaire (€/kWc)',
  solar_lifetime: 'Amort. Solaire (ans)',
  solar_degradation: 'Dégradation Solaire',
  solar_inverter_capex: 'CAPEX Onduleur PV (€/kW)',
  solar_inverter_lifetime: 'Amort. Onduleur PV (ans)',
  max_solar_kw: 'Solaire maximum (kWc) — surface',
  temp_coeff: 'Coeff. température PV (/°C)',
  tilt: 'Inclinaison panneaux (°)',
  azimuth: 'Orientation panneaux (°)',
  albedo: 'Albédo du sol',
  tracking: 'Mode de suivi',

  wind_capex: 'CAPEX Éolien (€/kW)',
  wind_lifetime: 'Amort. Éolien (ans)',
  max_wind_kw: 'Éolien maximum (kW) — terrain',
  hub_height: 'Hauteur moyeu (m)',
  roughness_length: 'Rugosité terrain z0 (m)',

  hydro_capex: 'CAPEX Hydro (€/kW)',
  hydro_flow: 'Débit Hydro (×)',
  hydro_lifetime: 'Amort. Hydro (ans)',
  max_hydro_kw: 'Hydro maximum (kW) — débit réel',

  bess_capex: 'CAPEX Batterie (€/kWh)',
  bess_inverter_capex: 'CAPEX Onduleur BESS (€/kW)',
  bess_lifetime: 'Amort. Batterie (ans)',
  bess_inverter_lifetime: 'Amort. Onduleur BESS (ans)',
  bess_cycle_cost: 'Coût cyclage (€/kWh)',
  eff_ch: 'η charge',
  eff_dis: 'η décharge',
  min_soc: 'SOC minimum',

  max_flex: 'Flexibilité Load-Shift',
  num_evs: 'Nombre de VE',
  v2g_enabled: 'V2G activé',

  thermal_ratio: 'Ratio besoin thermique',
  hp_capex: 'CAPEX PAC (€/kW)',
  cop_hp: 'COP PAC',
  hp_lifetime: 'Amort. PAC (ans)',
  hp_supply_temp: 'T° distribution PAC (°C)',
  tes_capex: 'CAPEX Ballon (€/kWh)',
  tes_lifetime: 'Amort. Ballon (ans)',
  boiler_capex: 'CAPEX Chaudière (€/kW)',
  boiler_eff: 'η Chaudière',
  boiler_lifetime: 'Amort. Chaudière (ans)',

  gas_fuel: 'Prix gaz (€/kWh PCI)',
  gas_lifetime: 'Amort. Moteur Gaz (ans)',
  ramp_limit_kw: 'Rampe gaz (kW/h)',
  use_milp: 'Mode MILP gaz',
  min_load_pct: 'Charge min. gaz (%)',
  startup_cost: 'Coût démarrage gaz (€)',

  discount_rate: "Taux d'actualisation (WACC)",
  grid_inflation: 'Inflation Réseau',
  gas_inflation: 'Inflation Gaz',
  om_inflation: 'Inflation O&M',

  grid_connected: 'Connecté au réseau',
  use_spot_market: 'Marché spot',
  grid_peak_price: 'Prix achat HP (€/kWh)',
  grid_offpeak_price: 'Prix achat HC (€/kWh)',
  grid_sell_price: 'Prix vente (€/kWh)',
  demand_charge: 'Abonnement (€/kW/mois)',
  cable_capex: 'Câblage HTA (€/kW)',
  voll: 'VOLL (€/kWh)',

  p90_mode: 'Mode P90',
  forecast_error: 'Bruit Météo',
  run_sensitivity: 'Tornado activé',
  max_annual_co2_t: 'Budget CO₂ (t/an)',
  resolution: 'Résolution temporelle',
  stochastic: 'Analyse P90 multi-années (M5)',
  extreme_events: 'Stress-test év. extrêmes (M6)',
  n1_reserve: 'Contrainte N-1',
  tmy_start_year: 'NASA POWER début',
  tmy_end_year: 'NASA POWER fin',
};

const PERCENT_FIELDS = new Set([
  'seasonality', 'solar_degradation', 'discount_rate',
  'grid_inflation', 'gas_inflation', 'om_inflation',
  'forecast_error', 'max_flex', 'min_soc', 'eff_ch', 'eff_dis', 'boiler_eff',
  'min_load_pct', 'thermal_ratio',
]);

const PARAM_UNITS = {
  num_homes: 'unités',
  peak_per_home: 'kW',
  seasonality: '%',
  commercial_power: 'kW',
  solar_capex: 'EUR/kWc',
  solar_lifetime: 'ans',
  solar_degradation: '%',
  solar_inverter_capex: 'EUR/kW',
  solar_inverter_lifetime: 'ans',
  max_solar_kw: 'kWc',
  wind_capex: 'EUR/kW',
  wind_lifetime: 'ans',
  max_wind_kw: 'kW',
  hydro_capex: 'EUR/kW',
  hydro_flow: '×',
  hydro_lifetime: 'ans',
  max_hydro_kw: 'kW',
  bess_capex: 'EUR/kWh',
  bess_inverter_capex: 'EUR/kW',
  bess_lifetime: 'ans',
  bess_inverter_lifetime: 'ans',
  bess_cycle_cost: 'EUR/kWh',
  eff_ch: '%',
  eff_dis: '%',
  min_soc: '%',
  max_flex: '%',
  num_evs: 'unités',
  v2g_enabled: '',
  thermal_ratio: '',
  hp_capex: 'EUR/kW',
  cop_hp: '',
  hp_lifetime: 'ans',
  tes_capex: 'EUR/kWh',
  tes_lifetime: 'ans',
  boiler_capex: 'EUR/kW',
  boiler_eff: '%',
  boiler_lifetime: 'ans',
  gas_fuel: 'EUR/kWh PCI',
  gas_lifetime: 'ans',
  ramp_limit_kw: 'kW/h',
  discount_rate: '%',
  grid_inflation: '%',
  gas_inflation: '%',
  om_inflation: '%',
  grid_connected: '',
  use_spot_market: '',
  grid_peak_price: 'EUR/kWh',
  grid_offpeak_price: 'EUR/kWh',
  grid_sell_price: 'EUR/kWh',
  demand_charge: 'EUR/kW/mois',
  cable_capex: 'EUR/kW',
  voll: 'EUR/kWh',
  p90_mode: '',
  forecast_error: '%',
  run_sensitivity: '',
  max_annual_co2_t: 't/an',
  temp_coeff: '/°C',
  tilt: '°',
  azimuth: '°',
  albedo: '',
  tracking: '',
  hub_height: 'm',
  roughness_length: 'm',
  hp_supply_temp: '°C',
  use_milp: '',
  min_load_pct: '%',
  startup_cost: 'EUR',
  resolution: '',
  stochastic: '',
  extreme_events: '',
  n1_reserve: '',
  tmy_start_year: '',
  tmy_end_year: '',
};

function fmtCsvParamValue(key, val) {
  if (typeof val === 'boolean') return val ? 'Oui' : 'Non';
  if (PERCENT_FIELDS.has(key) && typeof val === 'number') {
    return roundVal(val * 100, 2);
  }
  if (typeof val === 'number') return roundVal(val, 4);
  return String(val);
}

function fmtParamValue(key, val) {
  if (typeof val === 'boolean') return val ? 'Oui' : 'Non';
  if (PERCENT_FIELDS.has(key) && typeof val === 'number') {
    return `${(val * 100).toFixed(2).replace(/\.?0+$/, '')} %`;
  }
  if (typeof val === 'number') {
    return val.toLocaleString('fr-FR');
  }
  return String(val);
}

const KPI_LABELS = {
  total_capex:       { label: 'CAPEX total',                unit: 'EUR',  decimals: 0 },
  opex_y1:           { label: 'OPEX année 1',               unit: 'EUR',  decimals: 0 },
  roi_years:         { label: 'ROI (payback simple)',       unit: 'ans',  decimals: 1 },
  van:               { label: 'VAN sur 25 ans',             unit: 'EUR',  decimals: 0 },
  tri:               { label: 'TRI',                        unit: '%',    decimals: 2 },
  annual_co2_saved:  { label: 'CO2 evite par an',           unit: 't',    decimals: 1 },
  carbon_payback:    { label: 'Carbon payback',             unit: 'ans',  decimals: 1 },
  resilience:        { label: 'Resilience',                 unit: '%',    decimals: 1 },
  curtailment:       { label: 'Curtailment annuel',         unit: 'kWh',  decimals: 0 },
  max_grid_power:    { label: 'Souscription reseau',        unit: 'kW',   decimals: 1 },
};

const CAP_LABELS = {
  solar_kw:     { label: 'Solaire (PV)',         unit: 'kW' },
  solar_inv_kw: { label: 'Onduleur Solaire',     unit: 'kW' },
  wind_kw:      { label: 'Eolien',               unit: 'kW' },
  hydro_kw:     { label: 'Hydro',                unit: 'kW' },
  bess_kwh:     { label: 'Batterie',             unit: 'kWh' },
  bess_inv_kw:  { label: 'Onduleur Batterie',    unit: 'kW' },
  gas_kw:       { label: 'Moteur Gaz',           unit: 'kW' },
  boiler_kw:    { label: 'Chaudiere Gaz',        unit: 'kW' },
  hp_kw:        { label: 'Pompe a Chaleur',      unit: 'kW' },
  tes_kwh:      { label: 'Ballon thermique (TES)', unit: 'kWh' },
};

const OPEX_LABELS_CSV = {
  fuel_elec_gaz: 'Gaz - Production electrique',
  fuel_th_gaz:   'Gaz - Production thermique',
  grid_buy:      'Achat reseau',
  grid_sell:     'Revente reseau (revenu)',
  om:            'Operations & Maintenance',
  demand_charge: 'Abonnement (demand charge)',
  load_shed:     'Penalite delestage (VOLL)',
  total:         'TOTAL OPEX/an',
};

function buildHourlyCols(results) {
  const h = results.hourly_data;
  if (!h) return [];
  const all = [
    { key: 'solar_gen',    label: 'Solaire (kW)' },
    { key: 'wind_gen',     label: 'Eolien (kW)' },
    { key: 'hydro_gen',    label: 'Hydro (kW)' },
    { key: 'gas_gen',      label: 'Moteur Gaz (kW)' },
    { key: 'gas_th_gen',   label: 'Chaudiere Gaz (kW)' },
    { key: 'bess_dis',     label: 'Batterie decharge (kW)' },
    { key: 'bess_ch',      label: 'Batterie charge (kW)' },
    { key: 'grid_buy',     label: 'Achat reseau (kW)' },
    { key: 'grid_sell',    label: 'Vente reseau (kW)' },
    { key: 'ev_discharge', label: 'V2G VE vers Grid (kW)' },
    { key: 'ev_charge',    label: 'Charge VE (kW)' },
    { key: 'hp_elec_load', label: 'PAC elec (kW)' },
    { key: 'load_shed',    label: 'Delestage elec (kW)' },
    { key: 'therm_shed',   label: 'Delestage therm (kW)' },
    { key: 'optimized_load', label: 'Charge optimisee (kW)' },
    { key: 'raw_load',       label: 'Charge brute (kW)' },
    { key: 'comm_load',      label: 'Charge commerce (kW)' },
    { key: 'spot_price',   label: 'Prix spot (EUR/kWh)' },
  ];
  // Only include columns that exist AND have non-zero values
  return all.filter((c) => {
    const arr = h[c.key];
    if (!Array.isArray(arr)) return false;
    return arr.some((v) => typeof v === 'number' && Math.abs(v) > 0.001);
  });
}

export function buildCsv(results, params, location) {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const sections = [];

  // ─ Metadata header ──────────────────────────────────────────────────────
  sections.push(rowsToCSV([
    ['# Microgrid Optimizer - Export CSV', ''],
    ['# Date', stamp],
    ['# Localisation', `${location.lat}, ${location.lon}`],
    ['# Mode', results.mode || 'optimisation'],
    ['# Résolution', results.resolution || '288h'],
    ['# Années NASA POWER', results.tmy_years || '2013–2022'],
    ['# Hauteur moyeu', `${results.hub_height_m || '-'} m`],
    ['# MILP utilisé', results.milp_used ? 'Oui' : 'Non'],
    [''],
  ]));

  // ─ #1 KPIs ──────────────────────────────────────────────────────────────
  if (results.kpis) {
    sections.push(sectionSeparator('1. Indicateurs Cles (KPIs)'));
    sections.push('Indicateur,Valeur,Unite');
    const rows = [];
    Object.entries(KPI_LABELS).forEach(([k, info]) => {
      if (results.kpis[k] !== undefined && results.kpis[k] !== null) {
        const v = roundVal(results.kpis[k], info.decimals || 0);
        rows.push([info.label, v, info.unit]);
      }
    });
    sections.push(rowsToCSV(rows));
    sections.push('');
  }

  // ─ #2 Capacites ─────────────────────────────────────────────────────────
  if (results.capacities) {
    sections.push(sectionSeparator('2. Capacites Installees'));
    sections.push('Source,Capacite,Unite');
    const rows = [];
    Object.entries(CAP_LABELS).forEach(([k, info]) => {
      if (results.capacities[k] !== undefined) {
        rows.push([info.label, roundVal(results.capacities[k], 2), info.unit]);
      }
    });
    sections.push(rowsToCSV(rows));
    sections.push('');
  }

  // ─ #3 OPEX ──────────────────────────────────────────────────────────────
  if (results.opex_detail) {
    sections.push(sectionSeparator('3. Repartition OPEX - Annee 1'));
    sections.push('Poste de cout,Montant (EUR),Part (%)');
    const rows = [];
    const totalOpex = results.opex_detail.total || 1;
    Object.entries(results.opex_detail).forEach(([k, v]) => {
      const pct = roundVal((v / totalOpex) * 100, 1);
      rows.push([OPEX_LABELS_CSV[k] ?? k, roundVal(v, 0), pct]);
    });
    sections.push(rowsToCSV(rows));
    sections.push('');
  }

  // ─ #3.5 Stochastique P90 (M5) ────────────────────────────────────────────
  if (results.stochastic && results.stochastic.kpi_distributions) {
    sections.push(sectionSeparator('3.5. Analyse Stochastique P90 (M5)'));
    sections.push(`"# Années analysées : ${results.stochastic.num_years}"`);
    sections.push('Indicateur,P10,P50,P90,Moyenne,Min,Max');
    const dist = results.stochastic.kpi_distributions;
    const labels = {
      van: 'VAN (EUR)', tri: 'TRI (%)', total_capex: 'CAPEX total (EUR)',
      roi_years: 'ROI (ans)', annual_co2_saved: 'CO2 évité (t/an)',
      resilience: 'Résilience (%)', curtailment: 'Curtailment (kWh/an)',
      opex_y1: 'OPEX Y1 (EUR)',
    };
    Object.entries(labels).forEach(([k, label]) => {
      const d = dist[k];
      if (d) {
        sections.push(`${label},${roundVal(d.p10,2)},${roundVal(d.p50 ?? d.mean,2)},${roundVal(d.p90,2)},${roundVal(d.mean,2)},${roundVal(d.min,2)},${roundVal(d.max,2)}`);
      }
    });
    sections.push('');
  }

  // ─ #3.6 Événements extrêmes (M6) ─────────────────────────────────────────
  if (results.extreme_events && results.extreme_events.status === 'success') {
    sections.push(sectionSeparator('3.6. Événements Extrêmes (M6)'));
    sections.push(`"# Années scannées : ${results.extreme_events.years_scanned} · Jours : ${results.extreme_events.total_days_scanned}"`);
    sections.push('Événement,Détecté,Durée (h),Couverture (%),Délestage (kWh),Backup gaz (kWh)');
    results.extreme_events.events.forEach((ev) => {
      sections.push([
        ev.detected ? (ev.label_fr || ev.type) : `${ev.label_fr || ev.type} (non détecté)`,
        ev.detected ? 'Oui' : 'Non',
        ev.detected ? ev.duration_h : '-',
        ev.detected ? roundVal(ev.coverage_pct, 1) : '-',
        ev.detected ? roundVal(ev.total_shed_kwh, 0) : '-',
        ev.detected ? roundVal(ev.gas_backup_kwh, 0) : '-',
      ].map(csvEscape).join(','));
    });
    sections.push('');
  }

  // ─ #4 Cashflow + Carbon ─────────────────────────────────────────────────
  const cf = results.cashflow_25y || [];
  const cb = results.carbonflow_25y || [];
  if (cf.length || cb.length) {
    sections.push(sectionSeparator('4. Trajectoire Financiere & Carbone - 25 ans'));
    sections.push('Annee,Cashflow cumule (EUR),Cashflow annuel (EUR),Dette carbone cumulee (t CO2)');
    const len = Math.max(cf.length, cb.length);
    const rows = [];
    for (let y = 0; y < len; y++) {
      const cfCum = y < cf.length ? roundVal(cf[y], 0) : '';
      const cfAnn = y < cf.length
        ? roundVal(y === 0 ? cf[0] : cf[y] - cf[y - 1], 0)
        : '';
      const cbVal = y < cb.length ? roundVal(cb[y], 2) : '';
      rows.push([y, cfCum, cfAnn, cbVal]);
    }
    sections.push(rowsToCSV(rows));
    sections.push('');
  }

  // ─ #5 Donnees horaires ──────────────────────────────────────────────────
  const h = results.hourly_data;
  if (h) {
    const validCols = buildHourlyCols(results);
    const N_LOCAL = validCols.length ? Math.max(...validCols.map((c) => h[c.key].length)) : 0;
    const resolution = results.resolution || '288h';

    if (N_LOCAL > 0) {
      const resLabel = resolution === '8760h' ? '8760h' : resolution === '672h' ? '672h' : '288h';
      sections.push(sectionSeparator(`5. Donnees Horaires (${resLabel})`));

      if (resolution === '8760h') {
        const headers = ['Index', 'Heure_annee', 'Jour_annee', 'Heure_jour', 'Mois', 'Jour_mois', ...validCols.map((c) => c.label)];
        const rows = [headers];
        const MONTH_DAYS_CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        for (let i = 0; i < N_LOCAL; i++) {
          const dayOfYear = Math.floor(i / 24) + 1;
          const hourOfDay = i % 24;
          const monthIdx = MONTH_DAYS_CUM.findIndex((d, idx, arr) =>
            dayOfYear > d && (idx === arr.length - 1 || dayOfYear <= arr[idx + 1])
          );
          const monthName = MONTHS_FR[monthIdx] ?? '';
          const dayOfMonth = dayOfYear - (MONTH_DAYS_CUM[monthIdx] || 0);
          rows.push([
            i, i, dayOfYear, hourOfDay, monthName, dayOfMonth,
            ...validCols.map((c) => {
              const val = h[c.key][i];
              return typeof val === 'number' ? roundVal(val, 2) : (val ?? '');
            }),
          ]);
        }
        sections.push(rowsToCSV(rows));
      } else if (resolution === '672h') {
        const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const SEASON_NAMES = ['Déc–Fév', 'Mars–Mai', 'Juin–Août', 'Sept–Nov'];
        const headers = ['Index', 'Saison', 'Saison_num', 'Jour_semaine', 'Heure', ...validCols.map((c) => c.label)];
        const rows = [headers];
        for (let i = 0; i < N_LOCAL; i++) {
          const seasonIdx = Math.floor(i / 168);
          const dayOfWeek = Math.floor((i % 168) / 24);
          const hourOfDay = i % 24;
          rows.push([
            i, SEASON_NAMES[seasonIdx] ?? '', seasonIdx + 1, DAYS_FR[dayOfWeek], hourOfDay,
            ...validCols.map((c) => {
              const val = h[c.key][i];
              return typeof val === 'number' ? roundVal(val, 2) : (val ?? '');
            }),
          ]);
        }
        sections.push(rowsToCSV(rows));
      } else {
        // 288h (default)
        const headers = ['Index', 'Jour', 'Heure', 'Mois', 'Mois_num', ...validCols.map((c) => c.label)];
        const rows = [headers];
        for (let i = 0; i < N_LOCAL; i++) {
          const day = Math.floor(i / 24) + 1;
          const hour = i % 24;
          const monthIdx = Math.floor(i / 24);
          const monthName = MONTHS_FR[monthIdx] ?? '';
          const monthNum = monthIdx + 1;
          rows.push([
            i, day, hour, monthName, monthNum,
            ...validCols.map((c) => {
              const val = h[c.key][i];
              return typeof val === 'number' ? roundVal(val, 2) : (val ?? '');
            }),
          ]);
        }
        sections.push(rowsToCSV(rows));
      }
      sections.push('');
    }
  }

  // ─ #6 Sensibilite ───────────────────────────────────────────────────────
  if (Array.isArray(results.sensitivity) && results.sensitivity.length) {
    sections.push(sectionSeparator('6. Analyse de Sensibilite'));
    sections.push('Parametre,ROI a -20% (ans),ROI a +20% (ans),Ecart (ans)');
    const rows = [];
    results.sensitivity.forEach((s) => {
      const low = s.roi_low ?? '';
      const high = s.roi_high ?? '';
      const delta = (typeof low === 'number' && typeof high === 'number')
        ? roundVal(Math.abs(high - low), 2) : '';
      rows.push([s.parameter, low, high, delta]);
    });
    sections.push(rowsToCSV(rows));
    sections.push('');
  }

  // ─ #7 Parametres ────────────────────────────────────────────────────────
  const flatParams = flattenParams(params);
  const paramRows = [['Parametre', 'Valeur', 'Unite', 'Categorie']];
  Object.entries(flatParams).forEach(([k, v]) => {
    const label = PARAM_LABELS[k] || k;
    const unit = PARAM_UNITS[k] || '';
    const val = fmtCsvParamValue(k, v);
    paramRows.push([label, val, unit, paramCategory(k)]);
  });
  sections.push(sectionSeparator('7. Parametres en Entree'));
  sections.push(rowsToCSV(paramRows));

  return sections.join('\n');
}

function flattenParams(params) {
  const flat = {};
  // Top-level scalar keys
  if (typeof params.num_homes !== 'undefined') flat.num_homes = params.num_homes;
  if (typeof params.peak_per_home !== 'undefined') flat.peak_per_home = params.peak_per_home;

  const mappings = [
    ['solar',     ['capex','inverter_capex','lifetime','inverter_lifetime','degradation',
                    'temp_coeff','tilt','azimuth','albedo','tracking','max_kw']],
    ['wind',      ['capex','lifetime','hub_height','roughness_length','max_kw']],
    ['hydro',     ['capex','flow','lifetime','max_kw']],
    ['storage',   ['capex','inverter_capex','lifetime','inverter_lifetime','cycle_cost',
                    'eff_ch','eff_dis','min_soc']],
    ['gas',       ['fuel_price','lifetime','ramp_limit_kw','use_milp','min_load_pct',
                    'startup_cost']],
    ['grid',      ['connected','use_spot_market','sell_price','peak_price','offpeak_price',
                    'demand_charge']],
    ['economic',  ['discount_rate','grid_inflation','gas_inflation','om_inflation','voll',
                    'cable_capex','run_sensitivity','forecast_error','p90_mode','seasonality',
                    'max_flex','max_annual_co2_t','commercial_power','num_evs','v2g_enabled',
                    'tmy_start_year','tmy_end_year','resolution','stochastic','extreme_events',
                    'n1_reserve']],
  ];

  // Solar-specific field name aliases
  if (params.solar) {
    mappings[0][1].forEach((k) => {
      if (k in params.solar) flat[k === 'capex' ? 'solar_capex' :
        k === 'inverter_capex' ? 'solar_inverter_capex' :
        k === 'lifetime' ? 'solar_lifetime' :
        k === 'inverter_lifetime' ? 'solar_inverter_lifetime' :
        k === 'degradation' ? 'solar_degradation' :
        k === 'max_kw' ? 'max_solar_kw' : k] = params.solar[k];
    });
  }
  if (params.wind) {
    mappings[1][1].forEach((k) => {
      if (k in params.wind) flat[k === 'capex' ? 'wind_capex' :
        k === 'lifetime' ? 'wind_lifetime' :
        k === 'max_kw' ? 'max_wind_kw' : k] = params.wind[k];
    });
  }
  if (params.hydro) {
    mappings[2][1].forEach((k) => {
      if (k in params.hydro) flat[k === 'capex' ? 'hydro_capex' :
        k === 'flow' ? 'hydro_flow' :
        k === 'lifetime' ? 'hydro_lifetime' :
        k === 'max_kw' ? 'max_hydro_kw' : k] = params.hydro[k];
    });
  }
  if (params.storage) {
    mappings[3][1].forEach((k) => {
      if (k in params.storage) flat[k === 'capex' ? 'bess_capex' :
        k === 'inverter_capex' ? 'bess_inverter_capex' :
        k === 'lifetime' ? 'bess_lifetime' :
        k === 'inverter_lifetime' ? 'bess_inverter_lifetime' :
        k === 'cycle_cost' ? 'bess_cycle_cost' : k] = params.storage[k];
    });
  }
  if (params.thermal) {
    if (typeof params.thermal.thermal_ratio !== 'undefined') flat.thermal_ratio = params.thermal.thermal_ratio;
    if (params.thermal.hp) {
      const hp = params.thermal.hp;
      if (typeof hp.capex !== 'undefined') flat.hp_capex = hp.capex;
      if (typeof hp.cop !== 'undefined') flat.cop_hp = hp.cop;
      if (typeof hp.lifetime !== 'undefined') flat.hp_lifetime = hp.lifetime;
      if (typeof hp.supply_temp !== 'undefined') flat.hp_supply_temp = hp.supply_temp;
    }
    if (params.thermal.boiler) {
      const b = params.thermal.boiler;
      if (typeof b.capex !== 'undefined') flat.boiler_capex = b.capex;
      if (typeof b.eff !== 'undefined') flat.boiler_eff = b.eff;
      if (typeof b.lifetime !== 'undefined') flat.boiler_lifetime = b.lifetime;
    }
    if (params.thermal.tes) {
      const t = params.thermal.tes;
      if (typeof t.capex !== 'undefined') flat.tes_capex = t.capex;
      if (typeof t.lifetime !== 'undefined') flat.tes_lifetime = t.lifetime;
    }
  }
  if (params.gas) {
    mappings[4][1].forEach((k) => {
      if (k in params.gas) flat[k === 'fuel_price' ? 'gas_fuel' :
        k === 'lifetime' ? 'gas_lifetime' : k] = params.gas[k];
    });
  }
  if (params.grid) {
    mappings[5][1].forEach((k) => {
      if (k in params.grid) flat[k === 'connected' ? 'grid_connected' :
        k === 'peak_price' ? 'grid_peak_price' :
        k === 'offpeak_price' ? 'grid_offpeak_price' :
        k === 'sell_price' ? 'grid_sell_price' : k] = params.grid[k];
    });
  }
  if (params.economic) {
    mappings[6][1].forEach((k) => {
      if (k in params.economic) flat[k === 'discount_rate' ? 'discount_rate' :
        k === 'grid_inflation' ? 'grid_inflation' :
        k === 'gas_inflation' ? 'gas_inflation' :
        k === 'om_inflation' ? 'om_inflation' :
        k === 'voll' ? 'voll' :
        k === 'cable_capex' ? 'cable_capex' :
        k === 'run_sensitivity' ? 'run_sensitivity' :
        k === 'forecast_error' ? 'forecast_error' :
        k === 'p90_mode' ? 'p90_mode' :
        k === 'seasonality' ? 'seasonality' :
        k === 'max_flex' ? 'max_flex' :
        k === 'max_annual_co2_t' ? 'max_annual_co2_t' :
        k === 'commercial_power' ? 'commercial_power' :
        k === 'num_evs' ? 'num_evs' :
        k === 'v2g_enabled' ? 'v2g_enabled' :
        k === 'resolution' ? 'resolution' :
        k === 'stochastic' ? 'stochastic' :
        k === 'extreme_events' ? 'extreme_events' :
        k === 'n1_reserve' ? 'n1_reserve' :
        k === 'tmy_start_year' ? 'tmy_start_year' :
        k === 'tmy_end_year' ? 'tmy_end_year' : k] = params.economic[k];
    });
  }

  return flat;
}

function paramCategory(k) {
  if (['num_homes', 'peak_per_home', 'seasonality', 'commercial_power'].includes(k)) return 'Usages';
  if (k.startsWith('solar_') || k === 'temp_coeff' || k === 'tilt' || k === 'azimuth' ||
      k === 'albedo' || k === 'tracking' || k === 'wind_capex' || k === 'wind_lifetime' ||
      k === 'hub_height' || k === 'roughness_length' || k === 'max_wind_kw' ||
      k === 'hydro_capex' || k === 'hydro_flow' || k === 'hydro_lifetime' ||
      k === 'max_hydro_kw') return 'Renouvelables';
  if (k.startsWith('bess_') || k === 'eff_ch' || k === 'eff_dis' || k === 'min_soc') return 'Stockage';
  if (k === 'max_flex' || k === 'num_evs' || k === 'v2g_enabled') return 'Flexibilité';
  if (k === 'thermal_ratio' || k.startsWith('hp_') || k === 'cop_hp' || k === 'hp_supply_temp' ||
      k.startsWith('tes_') || k.startsWith('boiler_')) return 'Thermique';
  if (k.startsWith('gas_') || k === 'ramp_limit_kw' || k === 'use_milp' ||
      k === 'min_load_pct' || k === 'startup_cost') return 'Gaz';
  if (k.startsWith('grid_') || k === 'use_spot_market' || k === 'demand_charge' || k === 'cable_capex') return 'Réseau';
  if (k === 'discount_rate' || k.endsWith('_inflation') || k === 'voll') return 'Économie';
  if (['p90_mode', 'forecast_error', 'run_sensitivity', 'max_annual_co2_t',
       'resolution', 'stochastic', 'extreme_events', 'n1_reserve',
       'tmy_start_year', 'tmy_end_year'].includes(k)) return 'Modélisation';
  return 'Autre';
}

export function downloadCsv(results, params, location) {
  const csv = buildCsv(results, params, location);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `microgrid-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF — Page 1 = Localisation · Pages params · Pages résultats avec titres
// ═══════════════════════════════════════════════════════════════════════════

const PARAM_GROUPS = [
  { title: 'Usages & Demande', keys: ['num_homes', 'peak_per_home', 'seasonality', 'commercial_power'] },
  { title: 'Solaire (PV)', keys: ['__enabled_solar', 'solar_capex', 'solar_lifetime', 'solar_degradation',
                                    'temp_coeff', 'solar_inverter_capex', 'solar_inverter_lifetime',
                                    'max_solar_kw', 'tilt', 'azimuth', 'albedo', 'tracking'] },
  { title: 'Éolien',  keys: ['__enabled_wind', 'wind_capex', 'wind_lifetime', 'hub_height',
                              'roughness_length', 'max_wind_kw'] },
  { title: 'Hydro',   keys: ['__enabled_hydro', 'hydro_capex', 'hydro_flow', 'hydro_lifetime', 'max_hydro_kw'] },
  { title: 'Batterie BESS', keys: ['__enabled_battery', 'bess_capex', 'bess_inverter_capex',
                               'bess_lifetime', 'bess_inverter_lifetime', 'bess_cycle_cost',
                               'eff_ch', 'eff_dis', 'min_soc'] },
  { title: 'Flexibilité & Véhicules Électriques', keys: ['max_flex', 'num_evs', 'v2g_enabled'] },
  { title: 'Thermique', keys: ['thermal_ratio', '__enabled_hp', 'hp_capex', 'cop_hp', 'hp_supply_temp',
                                'hp_lifetime', 'tes_capex', 'tes_lifetime', '__enabled_boiler',
                                'boiler_capex', 'boiler_eff', 'boiler_lifetime'] },
  { title: 'Moteur Gaz', keys: ['__enabled_gas', 'gas_fuel', 'ramp_limit_kw', 'use_milp',
                                 'min_load_pct', 'startup_cost', 'gas_lifetime'] },
  { title: 'Réseau & Tarification', keys: ['grid_connected', 'use_spot_market',
                                            'grid_peak_price', 'grid_offpeak_price',
                                            'grid_sell_price', 'demand_charge',
                                            'cable_capex'] },
  { title: 'Hypothèses Financières', keys: ['discount_rate', 'grid_inflation',
                                              'gas_inflation', 'om_inflation', 'voll'] },
  { title: 'Modélisation & Risque', keys: ['resolution', 'p90_mode', 'stochastic', 'extreme_events',
                                           'n1_reserve', 'forecast_error', 'run_sensitivity',
                                           'max_annual_co2_t', 'tmy_start_year', 'tmy_end_year'] },
];

// Couleurs PDF (RGB)
const C_INK = [15, 23, 42];          // ink-900
const C_BLUE = [37, 99, 235];        // brand-600
const C_BLUE_LIGHT = [219, 234, 254]; // brand-100
const C_GRAY = [100, 116, 139];      // ink-500
const C_GRAY_LIGHT = [241, 245, 249];// ink-100

export async function exportPdf({ results, params, enabled, location, dashboardEl }) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — TITRE & LOCALISATION
  // ═══════════════════════════════════════════════════════════════════════
  let y = margin;

  // Bandeau bleu en haut
  pdf.setFillColor(...C_BLUE);
  pdf.rect(0, 0, pageW, 28, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('Microgrid Optimizer', margin, 14);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Rapport d\'optimisation énergétique', margin, 22);

  y = 38;

  pdf.setTextColor(...C_GRAY);
  pdf.setFontSize(9);
  pdf.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, margin, y);
  y += 12;

  // ─ Bloc Localisation ─────────────────────────────────────────────────
  pdf.setFillColor(...C_BLUE_LIGHT);
  pdf.roundedRect(margin, y, pageW - 2 * margin, 36, 3, 3, 'F');

  pdf.setTextColor(...C_BLUE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('LOCALISATION DU PROJET', margin + 6, y + 9);

  pdf.setTextColor(...C_INK);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text('Latitude :', margin + 6, y + 18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${location.lat}°`, margin + 32, y + 18);

  pdf.setFont('helvetica', 'normal');
  pdf.text('Longitude :', margin + 6, y + 26);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${location.lon}°`, margin + 32, y + 26);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...C_GRAY);
  pdf.text(
    `Profils PV/Vent récupérés via PVGIS / Open-Meteo`,
    pageW - margin - 6, y + 26, { align: 'right' },
  );

  y += 46;

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1+ — PARAMÈTRES EN ENTRÉE (regroupés par catégorie)
  // ═══════════════════════════════════════════════════════════════════════
  pdf.setTextColor(...C_INK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('Paramètres en entrée', margin, y);
  y += 7;

  pdf.setDrawColor(...C_BLUE);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y - 3, margin + 30, y - 3);
  y += 2;

  PARAM_GROUPS.forEach((group) => {
    if (y > pageH - 25) { pdf.addPage(); y = margin; }

    // Titre groupe
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...C_BLUE);
    pdf.text(group.title, margin, y);
    y += 4;

    pdf.setDrawColor(...C_GRAY_LIGHT);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y, pageW - margin, y);
    y += 3;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...C_INK);

    group.keys.forEach((k) => {
      let label, val;
      if (k.startsWith('__enabled_')) {
        const src = k.replace('__enabled_', '');
        label = 'Inclus dans la modélisation';
        val = enabled[src] ? 'Oui' : 'Non';
      } else {
        label = PARAM_LABELS[k] || k;
        val = fmtParamValue(k, params[k]);
      }
      if (val === undefined || val === null || val === '' || val === 'undefined') return;

      pdf.text(`  ${label}`, margin + 2, y);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(val), pageW - margin - 2, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      y += 4;
      if (y > pageH - 14) { pdf.addPage(); y = margin; }
    });
    y += 4;
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGES SUIVANTES — RÉSULTATS (chaque graphique avec son titre)
  // ═══════════════════════════════════════════════════════════════════════
  if (dashboardEl) {
    pdf.addPage();
    y = margin;

    pdf.setTextColor(...C_INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Résultats de l\'optimisation', margin, y);
    pdf.setDrawColor(...C_BLUE);
    pdf.setLineWidth(0.6);
    pdf.line(margin, y + 2, margin + 40, y + 2);
    y += 10;

    // Récupérer et trier les cartes par data-export-order
    const cards = Array.from(dashboardEl.querySelectorAll('[data-export-card]'))
      .sort((a, b) => {
        const oa = +(a.getAttribute('data-export-order') ?? 99);
        const ob = +(b.getAttribute('data-export-order') ?? 99);
        return oa - ob;
      });

    for (const card of cards) {
      const title = card.getAttribute('data-export-title') ||
                    card.querySelector('h3')?.textContent ||
                    'Section';

      // ── Déplier la carte pour capturer tout le contenu ──────────────────
      const savedStyles = [];
      let el = card;
      // Remonter jusqu'à un conteneur avec overflow-hidden ou height fixe
      for (let i = 0; i < 3; i++) {
        const style = el.style;
        savedStyles.push({ el, overflow: style.overflow, maxHeight: style.maxHeight, height: style.height });
        style.overflow = 'visible';
        style.maxHeight = 'none';
        style.height = 'auto';
        el = el.parentElement;
        if (!el) break;
      }

      // ── Désactiver le truncate sur les légendes / labels ─────────────────
      const truncatedEls = card.querySelectorAll('.truncate');
      truncatedEls.forEach((el) => {
        el.style.overflow = 'visible';
        el.style.whiteSpace = 'normal';
        el.style.textOverflow = 'clip';
      });
      const minW0Els = card.querySelectorAll('.min-w-0');
      minW0Els.forEach((el) => { el.style.minWidth = 'auto'; });

      // Capture la carte
      const canvas = await html2canvas(card, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        width: card.scrollWidth,
        height: card.scrollHeight,
      });

      // ── Restaurer truncate ───────────────────────────────────────────────
      truncatedEls.forEach((el) => {
        el.style.overflow = '';
        el.style.whiteSpace = '';
        el.style.textOverflow = '';
      });
      minW0Els.forEach((el) => { el.style.minWidth = ''; });

      // ── Restaurer les styles ─────────────────────────────────────────────
      savedStyles.forEach(({ el, overflow, maxHeight, height }) => {
        el.style.overflow = overflow;
        el.style.maxHeight = maxHeight;
        el.style.height = height;
      });

      const imgData = canvas.toDataURL('image/png');
      const imgW = pageW - 2 * margin;
      const imgH = (canvas.height * imgW) / canvas.width;

      // Hauteur totale = titre (8mm) + image + marge bas (6mm)
      const totalH = 10 + imgH + 6;

      // Saut de page si pas la place
      if (y + totalH > pageH - margin) {
        pdf.addPage();
        y = margin;
      }

      // Titre du résultat
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(...C_BLUE);
      pdf.text(title, margin, y);

      pdf.setDrawColor(...C_BLUE);
      pdf.setLineWidth(0.4);
      pdf.line(margin, y + 1.8, margin + 30, y + 1.8);
      y += 6;

      // Image capture
      pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH);
      y += imgH + 8;
    }
  }

  // Footer pages
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(...C_GRAY);
    pdf.text(
      `Microgrid Optimizer — ${i} / ${pageCount}`,
      pageW - margin, pageH - 6, { align: 'right' },
    );
  }

  pdf.save(`microgrid-${Date.now()}.pdf`);
}
