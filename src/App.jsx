import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet, Banknote, Percent, Leaf, ShieldCheck, Clock,
  Activity, BarChart3, PieChart, LineChart, Sparkles, Zap, Layers,
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Methodology from './components/Methodology';
import Tutorial, { useTutorial } from './components/Tutorial';
import LanguageSelector from './components/LanguageSelector';
import CapacitiesTable from './components/CapacitiesTable';
import { useI18n } from './i18n';
import {
  Card, KpiCard, EmptyState, LoadingOverlay, SectionTitle, Tooltip,
} from './components/Primitives';
import {
  EnergyBalanceChart, CashflowChart, CarbonChart, OpexDonut, TornadoChart,
} from './components/Charts';

import {
  DEFAULT_PARAMS, DEFAULT_ENABLED, DEFAULT_LOCATION, DEFAULT_MANUAL_CAPS,
  RESIDENTIAL_PROFILE_NORM,
} from './defaults';
import { optimizeMicrogrid, simulateMicrogrid } from './api';
import { fmtCurrency, fmtPct, fmtTons, fmtYears } from './utils';
import { downloadCsv, exportPdf } from './export';

// ───────────────────────────────────────────────────────────────────────────
// Construit le profil de charge 24h à partir des Usages
// ───────────────────────────────────────────────────────────────────────────
function buildLoad(params) {
  const peak = params.num_homes * params.peak_per_home;
  return RESIDENTIAL_PROFILE_NORM.map((p) => +(p * peak).toFixed(2));
}

// ───────────────────────────────────────────────────────────────────────────
// Applique les toggles d'inclusion en saturant les CAPEX/coûts → LP zéro-out
// ───────────────────────────────────────────────────────────────────────────
function buildApiParams(params, enabled) {
  const p = structuredClone(params);
  delete p.num_homes;
  delete p.peak_per_home;

  const HUGE_CAPEX = 1e6;
  const HUGE_FUEL  = 1e3;

  if (!enabled.solar)   p.solar.capex              = HUGE_CAPEX;
  if (!enabled.wind)    p.wind.capex               = HUGE_CAPEX;
  if (!enabled.hydro)   p.hydro.flow               = 0;
  if (!enabled.battery) p.storage.capex            = HUGE_CAPEX;
  if (!enabled.gas)     p.gas.max_kw               = 0;       // force cap_g=0 dans le LP
  if (!enabled.hp)      p.thermal.hp.capex         = HUGE_CAPEX;
  if (!enabled.boiler)  p.thermal.boiler.capex     = HUGE_CAPEX;
  return p;
}

// ───────────────────────────────────────────────────────────────────────────
// Nettoie les params pour le mode simulation (pas de HUGE_CAPEX)
// ───────────────────────────────────────────────────────────────────────────
function buildSimParams(params) {
  const p = structuredClone(params);
  delete p.num_homes;
  delete p.peak_per_home;
  return p;
}

// ───────────────────────────────────────────────────────────────────────────
// Filtre l'analyse de sensibilité : ne garde que les paramètres pertinents
// pour les sources/options actuellement activées par l'utilisateur.
// ───────────────────────────────────────────────────────────────────────────
function filterSensitivity(sensitivity, params, enabled) {
  if (!Array.isArray(sensitivity)) return [];
  const allow = (label) => {
    switch (label) {
      case 'CAPEX Solaire':    return enabled.solar;
      case 'CAPEX Éolien':     return enabled.wind;
      case 'CAPEX Batterie':   return enabled.battery;
      case 'Prix Gaz':         return enabled.gas;
      case 'Abonnement Réseau': return params.grid.connected;
      case 'Vente Réseau':     return params.grid.connected && !params.grid.use_spot_market;
      case 'Achat Réseau':     return params.grid.connected && !params.grid.use_spot_market;
      case 'Surconso Hiver':   return true;
      default:                 return true;
    }
  };
  return sensitivity.filter((s) => allow(s.parameter));
}

// ───────────────────────────────────────────────────────────────────────────
// App
// ───────────────────────────────────────────────────────────────────────────
export default function App() {
  const { t, hasChosen, lang } = useI18n();
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);   // light mode par défaut
  const [monthSel, setMonthSel] = useState('all');   // année entière par défaut
  const [lastRunAt, setLastRunAt] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState('optimize');               // 'optimize' | 'simulate'
  const [manualCaps, setManualCaps] = useState(DEFAULT_MANUAL_CAPS);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [langSelectorOpen, setLangSelectorOpen] = useState(!hasChosen);
  const tutorial = useTutorial();

  const dashboardRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const runOptimization = async () => {
    setLoading(true);
    setError(null);
    try {
      // En mode simulation, on garde les CAPEX réels (pas de HUGE_CAPEX)
      // car les capacités sont fixées manuellement.
      const apiParams = mode === 'simulate'
        ? buildSimParams(params)
        : buildApiParams(params, enabled);
      const load = buildLoad(params);
      const loc = { lat: location.lat, lon: location.lon };

      const data = mode === 'simulate'
        ? await simulateMicrogrid({ params: apiParams, load, ...loc, caps: manualCaps })
        : await optimizeMicrogrid({ params: apiParams, load, ...loc });

      if (data.status === 'success') {
        setResults(data);
        setLastRunAt(Date.now());
      } else {
        setError(data.error || 'Erreur inconnue');
        setResults(null);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Erreur réseau';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetParams = () => {
    setParams(DEFAULT_PARAMS);
    setEnabled(DEFAULT_ENABLED);
    setLocation(DEFAULT_LOCATION);
    setMode('optimize');
    setManualCaps(DEFAULT_MANUAL_CAPS);
  };

  const handleExportCsv = () => {
    if (!results) return;
    downloadCsv(results, params, location);
  };

  const handleExportPdf = async () => {
    if (!results) return;
    setExporting(true);
    // Force vue annuelle pour la capture du bilan énergétique
    const prevMonth = monthSel;
    if (monthSel !== 'all') {
      setMonthSel('all');
      // Attendre re-render avant capture
      await new Promise((r) => setTimeout(r, 350));
    }
    try {
      await exportPdf({
        results, params, enabled, location,
        dashboardEl: dashboardRef.current,
      });
    } catch (e) {
      console.error(e);
      setError('Échec export PDF — voir console.');
    } finally {
      setMonthSel(prevMonth);
      setExporting(false);
    }
  };

  const kpis = results?.kpis;

  // Filtrage tornado en fonction des sources actives
  const filteredSensitivity = useMemo(
    () => filterSensitivity(results?.sensitivity, params, enabled),
    [results?.sensitivity, params, enabled]
  );

  return (
    <div className="flex min-h-screen bg-ink-100 dark:bg-ink-950 text-ink-900 dark:text-ink-100">
      {/* Sidebar (collapsible via marge négative) */}
      <div
        className={
          'transition-all duration-300 ease-out shrink-0 ' +
          (sidebarOpen ? 'ml-0' : '-ml-[380px]')
        }
      >
        <Sidebar
          params={params}
          setParams={setParams}
          enabled={enabled}
          setEnabled={setEnabled}
          location={location}
          setLocation={setLocation}
          darkMode={darkMode}
          onRun={runOptimization}
          onReset={resetParams}
          loading={loading}
          mode={mode}
          setMode={setMode}
          manualCaps={manualCaps}
          setManualCaps={setManualCaps}
        />
      </div>

      <main className="flex-1 min-w-0">
        <Header
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          hasResults={!!results}
          lastRunAt={lastRunAt}
          error={error}
          monthSel={monthSel}
          setMonthSel={setMonthSel}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          exporting={exporting}
          onOpenTutorial={() => setTutorialOpen(true)}
          onOpenMethodology={() => setMethodologyOpen(true)}
          resolution={results?.resolution}
        />

        <div ref={dashboardRef} className="p-6 space-y-6">
          {!results && !loading && !error && <WelcomeView mode={mode} t={t} />}
          {error && !loading && !results && <ErrorView error={error} t={t} />}

          {results && (
            <>
              {/* ────────── KPI ROW ────────── */}
              <section data-export-card data-export-title="Indicateurs clés (KPIs)" data-export-order="1">
                <SectionTitle hint={mode === 'simulate' ? t('kpi.section_hint_simulate') : t('kpi.section_hint_optimize')}>
                  {t('kpi.section_title')}{mode === 'simulate' ? t('kpi.sim_badge') : ''}
                </SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <KpiCard icon={Wallet} label={t('kpi.capex')}
                           value={fmtCurrency(kpis.total_capex, { compact: true })}
                           accent="blue" sub={t('kpi.capex_sub')} />
                  <KpiCard icon={Clock} label={t('kpi.roi')}
                           value={fmtYears(kpis.roi_years, lang)}
                           accent="brand" sub={t('kpi.roi_sub')} />
                  <KpiCard icon={Banknote} label={t('kpi.npv')}
                           value={fmtCurrency(kpis.van, { compact: true })}
                           accent="violet" sub={`@ ${(params.economic.discount_rate * 100).toFixed(1)}% WACC`} />
                  <KpiCard icon={Percent} label={t('kpi.tri')}
                           value={kpis.tri == null ? '—' : fmtPct(kpis.tri)}
                           accent="sky" sub={t('kpi.tri_sub')} />
                  <KpiCard icon={Leaf} label={t('kpi.co2')}
                           value={fmtTons(kpis.annual_co2_saved)}
                           accent="brand" sub={`${t('kpi.co2_sub')}${fmtYears(kpis.carbon_payback, lang)}`} />
                  <KpiCard icon={ShieldCheck} label={t('kpi.resilience')}
                           value={fmtPct(kpis.resilience)}
                           accent="amber" sub={`${t('kpi.resilience_sub')}${(kpis.curtailment ?? 0).toLocaleString('fr-FR')} kWh`} />
                </div>
              </section>

              {/* ────────── STOCHASTIC P90 ────────── */}
              {results.stochastic && (
                <section>
                  <Card
                    data-export-card
                    data-export-title="Distribution P90 multi-années"
                    data-export-order="1b"
                    title={t('kpi.stochastic_title')}
                    subtitle={`${results.stochastic.num_years} années NASA · P10 / P50 / P90`}
                    icon={ShieldCheck}
                  >
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {['van', 'tri', 'total_capex', 'roi_years', 'annual_co2_saved', 'resilience', 'curtailment', 'opex_y1'].map((k) => {
                        const d = results.stochastic.kpi_distributions[k];
                        if (!d) return null;
                        const labels = {
                          van: t('kpi.npv'), tri: t('kpi.tri'), total_capex: t('kpi.capex'),
                          roi_years: t('kpi.roi'), annual_co2_saved: t('kpi.co2'),
                          resilience: t('kpi.resilience'), curtailment: 'Curtailment', opex_y1: 'OPEX Y1'
                        };
                        const fmt = k === 'tri' ? (v) => fmtPct(v) : k === 'total_capex' || k === 'opex_y1' || k === 'van' ? (v) => fmtCurrency(v, {compact: true}) : k === 'roi_years' ? (v) => fmtYears(v, lang) : k === 'annual_co2_saved' ? (v) => fmtTons(v) : k === 'resilience' ? (v) => fmtPct(v) : (v) => `${v}`;
                        return (
                          <div key={k} className="rounded-lg border border-ink-200 dark:border-ink-800 p-2.5">
                            <div className="text-[10px] text-ink-500 dark:text-ink-400 mb-1">{labels[k] || k}</div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-bold text-ink-900 dark:text-ink-100">{d.p50 !== undefined ? fmt(d.p50) : fmt(d.mean)}</span>
                            </div>
                            <div className="flex gap-2 mt-1 text-[10px]">
                              <span className="text-emerald-600 dark:text-emerald-400">P10: {fmt(d.p10)}</span>
                              <span className="text-rose-600 dark:text-rose-400">P90: {fmt(d.p90)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </section>
              )}

              {/* ────────── EXTREME EVENTS ────────── */}
              {results.extreme_events && results.extreme_events.status !== 'success' && (
                <section>
                  <Card title={t('extreme.title')} subtitle={results.extreme_events.reason || t('stochastic.no_data')} icon={ShieldCheck}>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{t('extreme.requires_8760h')}</p>
                  </Card>
                </section>
              )}
              {results.extreme_events && results.extreme_events.status === 'success' && (
                <section>
                  <Card
                    data-export-card
                    data-export-title="Matrice de résilience — Événements extrêmes"
                    data-export-order="1c"
                    title={t('extreme.title')}
                    subtitle={`${t('extreme.subtitle')} · ${results.extreme_events.years_scanned} · ${results.extreme_events.total_days_scanned} jours`}
                    icon={ShieldCheck}
                  >
                    {results.extreme_events.events.every(e => !e.detected) ? (
                      <div className="text-center py-6">
                        <div className="text-3xl mb-3">☀️</div>
                        <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100 mb-1">
                          {t('extreme.no_event_title')}
                        </h3>
                        <p className="text-xs text-ink-500 dark:text-ink-400 max-w-md mx-auto">
                          {t('extreme.no_event_desc')
                            .replace('{years}', results.extreme_events.years_scanned)
                            .replace('{days}', results.extreme_events.total_days_scanned)}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                          {results.extreme_events.events.map((ev) => {
                            const label = lang === 'fr' ? ev.label_fr : ev.label_en;
                            const desc = lang === 'fr' ? ev.description_fr : ev.description_en;
                            const detected = ev.detected;
                            const icons = {dark_doldrums: '🌑', cold_wave: '🥶', heat_wave: '🔥'};
                            const accentColors = {
                              dark_doldrums: 'border-slate-400 dark:border-slate-600',
                              cold_wave: 'border-sky-400 dark:border-sky-600',
                              heat_wave: 'border-orange-400 dark:border-orange-600',
                            };
                            const bgColors = {
                              dark_doldrums: 'bg-slate-50 dark:bg-slate-500/5',
                              cold_wave: 'bg-sky-50 dark:bg-sky-500/5',
                              heat_wave: 'bg-orange-50 dark:bg-orange-500/5',
                            };
                            const coverageColor = !detected ? 'text-ink-400'
                              : ev.coverage_pct >= 99 ? 'text-emerald-600 dark:text-emerald-400'
                              : ev.coverage_pct >= 90 ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400';

                            return (
                              <div key={ev.event_type}
                                className={`rounded-xl border-2 ${detected ? accentColors[ev.event_type] : 'border-ink-200 dark:border-ink-800'} ${detected ? bgColors[ev.event_type] : 'opacity-50'} p-4`}>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">{icons[ev.event_type]}</span>
                                  <div>
                                    <div className="font-semibold text-sm text-ink-900 dark:text-ink-100">{label}</div>
                                    <div className="text-[10px] text-ink-500 dark:text-ink-400">{desc}</div>
                                  </div>
                                </div>

                                {!detected ? (
                                  <p className="text-xs text-ink-500 dark:text-ink-400 italic">{t('extreme.not_detected')}</p>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-ink-500 dark:text-ink-400">
                                        {t('extreme.duration')}
                                        <Tooltip content={t('extreme.help_duration')}><span className="ml-0.5 text-[10px] cursor-help">?</span></Tooltip>
                                      </span>
                                      <span className="font-mono font-bold text-ink-900 dark:text-ink-100">{ev.duration_h}h ({ev.duration_days}j)</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-ink-500 dark:text-ink-400">
                                        {t('extreme.coverage')}
                                        <Tooltip content={t('extreme.help_coverage')}><span className="ml-0.5 text-[10px] cursor-help">?</span></Tooltip>
                                      </span>
                                      <span className={`font-mono font-bold ${coverageColor}`}>{ev.coverage_pct}%</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-ink-500 dark:text-ink-400">
                                        {t('extreme.shed')}
                                        <Tooltip content={t('extreme.help_shed')}><span className="ml-0.5 text-[10px] cursor-help">?</span></Tooltip>
                                      </span>
                                      <span className="font-mono text-ink-700 dark:text-ink-300">{ev.shed_kwh} kWh</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-ink-500 dark:text-ink-400">
                                        {t('extreme.backup')}
                                        <Tooltip content={t('extreme.help_backup')}><span className="ml-0.5 text-[10px] cursor-help">?</span></Tooltip>
                                      </span>
                                      <span className="font-mono text-ink-700 dark:text-ink-300">{ev.backup_gas_kwh} kWh</span>
                                    </div>
                                    {ev.avg_temp_c !== undefined && (
                                      <div className="flex justify-between text-[10px] text-ink-400 dark:text-ink-500">
                                        <span>∅ T°</span>
                                        <span className="font-mono">{ev.avg_temp_c}°C</span>
                                      </div>
                                    )}
                                    <div className="text-[10px] text-ink-400 dark:text-ink-500 mt-1 pt-2 border-t border-ink-200/60 dark:border-ink-800">
                                      {ev.start_date} → {ev.end_date}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {results.extreme_events.worst_event && results.extreme_events.worst_event !== 'none' && (
                          <div className="mt-3 p-3 rounded-lg bg-ink-50 dark:bg-ink-900/30 border border-ink-200 dark:border-ink-800">
                            <p className="text-xs text-ink-700 dark:text-ink-300">
                              <strong>{lang === 'fr' ? 'Pire événement' : 'Worst event'}</strong> : {results.extreme_events.worst_event} · {results.extreme_events.max_duration_h}h
                              <span className="text-ink-500 dark:text-ink-400 ml-4">
                                {lang === 'fr'
                                  ? 'Cette séquence dimensionne le besoin de backup et de stockage.'
                                  : 'This sequence sizes the backup and storage requirements.'}
                              </span>
                            </p>
                          </div>
                        )}

                        <div className="mt-3 text-[10px] text-ink-400 dark:text-ink-500 leading-relaxed border-t border-ink-200/60 dark:border-ink-800 pt-3">
                          <span className="font-semibold">{t('extreme.legend_title')}</span> — {lang === 'fr'
                            ? 'Couverture : part de la demande servie sans interruption. Délestage : énergie non fournie (pénalisée à '
                            : 'Coverage: share of demand served without interruption. Shedding: unserved energy (penalized at '}
                          {fmtCurrency(params.economic.voll, {compact: false})}/kWh).
                        </div>
                      </>
                    )}
                  </Card>
                </section>
              )}

              {/* ────────── ENERGY BALANCE ────────── */}
              <section>
                <Card
                  data-export-card
                  data-export-title={`Bilan énergétique annuel — ${results.resolution === '8760h' ? '8760h' : '288h'} consécutives`}
                  data-export-order="2"
                  title={t('chart.energy.title')}
                  subtitle={
                    monthSel === 'avg'
                      ? t('chart.energy.subtitle_avg')
                      : monthSel === 'all'
                        ? (results.resolution === '8760h' ? t('chart.energy.subtitle_8760h')
                          : results.resolution === '672h' ? t('chart.energy.subtitle_672h')
                          : t('chart.energy.subtitle_288h'))
                        : `${t('chart.energy.subtitle_month')} ${monthLabel(monthSel, results.resolution)} · 24h`
                  }
                  icon={Activity}
                >
                  <EnergyBalanceChart hourly={results.hourly_data} monthSel={monthSel} resolution={results.resolution} />
                  <p className="mt-3 text-[11px] text-ink-500 dark:text-ink-400">
                    <Sparkles className="inline" size={11} /> {t('chart.energy.hint')}
                  </p>
                </Card>
              </section>

              {/* ────────── FINANCIAL & CARBON ────────── */}
              <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card data-export-card data-export-title="Cash-flow cumulé sur 25 ans" data-export-order="3"
                      title={t('chart.cashflow.title')} icon={LineChart} subtitle={t('chart.cashflow.subtitle')}>
                  <CashflowChart data={results.cashflow_25y} paybackYear={kpis.roi_years} />
                </Card>
                <Card data-export-card data-export-title="Dette carbone cumulée sur 25 ans" data-export-order="4"
                      title={t('chart.carbon.title')} icon={Leaf} subtitle={t('chart.carbon.subtitle')}>
                  <CarbonChart data={results.carbonflow_25y} paybackYear={kpis.carbon_payback} />
                </Card>
              </section>

              {/* ────────── OPEX + CAPACITIES ────────── */}
              <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card data-export-card data-export-title="Répartition de l'OPEX (Année 1)" data-export-order="5"
                      title={t('opex.title')} icon={PieChart} className="xl:col-span-1">
                  <OpexDonut opex={results.opex_detail} />
                </Card>
                <Card data-export-card data-export-title="Capacités installées optimales" data-export-order="6"
                      title={t('caps.title')} icon={Layers}
                      subtitle={t('caps.subtitle')} className="xl:col-span-2">
                  <CapacitiesTable capacities={results.capacities} kpis={kpis} />
                </Card>
              </section>

              {/* ────────── TORNADO ────────── */}
              {mode === 'optimize' && params.economic.run_sensitivity && (
                <section>
                  <Card
                    data-export-card
                    data-export-title="Analyse de sensibilité (Tornado)"
                    data-export-order="7"
                    title={t('tornado.title')}
                    subtitle={t('tornado.subtitle')}
                    icon={BarChart3}
                  >
                    <div className="flex items-center gap-4 mb-2 text-[11px] text-ink-500 dark:text-ink-400">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-3 rounded bg-blue-500" /> {t('tornado.low_label')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-3 rounded bg-orange-500" /> {t('tornado.high_label')}
                      </span>
                      <span className="ml-auto">
                        {t('tornado.reference')}<strong>{fmtYears(kpis.roi_years, lang)}</strong>
                      </span>
                    </div>
                    <TornadoChart sensitivity={filteredSensitivity} baseRoi={kpis.roi_years} />
                  </Card>
                </section>
              )}
            </>
          )}

          {loading && !results && (
            <Card className="relative h-96">
              <LoadingOverlay
                message={
                  params.economic.resolution === '8760h' ? t('loading.message_8760h')
                  : params.economic.resolution === '672h' ? t('loading.message_672h')
                  : t('loading.message')
                }
                estimatedSeconds={
                  params.economic.stochastic
                    ? (params.economic.resolution === '8760h' ? 600 : params.economic.resolution === '672h' ? 80 : 30)
                    : params.economic.extreme_events
                      ? 120
                      : params.economic.resolution === '8760h'
                        ? 45
                        : params.economic.resolution === '672h'
                          ? 15
                          : 5
                }
              />
            </Card>
          )}
        </div>
      </main>

      <Methodology
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
      />
      <LanguageSelector
        open={langSelectorOpen}
        onClose={() => setLangSelectorOpen(false)}
      />
      <Tutorial
        open={(tutorial.show || tutorialOpen) && !langSelectorOpen}
        onClose={() => { tutorial.dismiss(); setTutorialOpen(false); }}
      />
    </div>
  );
}

function monthLabel(idx, resolution) {
  if (resolution === '672h') {
    return ['Déc–Fév','Mars–Mai','Juin–Août','Sept–Nov'][parseInt(idx, 10)] ?? '—';
  }
  const m = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return m[parseInt(idx, 10)] ?? '—';
}

function WelcomeView({ mode, t }) {
  const isSim = mode === 'simulate';
  return (
    <Card className="text-center py-16">
      <EmptyState
        icon={Zap}
        title={isSim ? t('welcome.simulate_title') : t('welcome.optimize_title')}
        description={isSim ? t('welcome.simulate_desc') : t('welcome.optimize_desc')}
      />
    </Card>
  );
}

function ErrorView({ error, t }) {
  return (
    <Card className="border-rose-300/60 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-500/5">
      <div className="flex items-start gap-4">
        <div className="grid place-items-center h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
          <Zap size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            {t('error.title')}
          </h3>
          <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1">{error}</p>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-3">
            {t('error.check_backend')} <code className="font-mono">http://127.0.0.1:8000</code>{' '}
            (<code className="font-mono">uvicorn main:app --reload</code> {t('error.run_uvicorn')}).
          </p>
        </div>
      </div>
    </Card>
  );
}
