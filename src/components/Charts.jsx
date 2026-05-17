import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  ComposedChart, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label,
} from 'recharts';
import { COLORS, MONTHS_FR, MONTH_BOUNDS_8760, SEASON_BOUNDS_672, SEASONS_FR } from '../defaults';
import { fmtCurrency, fmtCompactNum, fmtTons } from '../utils';
import { Tooltip as HelpPopover } from './Primitives';
import { useI18n } from '../i18n';

// ───────────────────────────────────────────────────────────────────────────
// Définition des séries du bilan énergétique (ordre = ordre de la légende)
// ───────────────────────────────────────────────────────────────────────────
function buildSeriesGroups(t) {
  return [
    {
      key: 'prod_renewable',
      title: t('series.prod_renewable'),
      items: [
        { key: 'solar_gen',  label: t('series.solar'),  color: COLORS.solar,  stack: 'prod' },
        { key: 'wind_gen',   label: t('series.wind'),   color: COLORS.wind,   stack: 'prod' },
        { key: 'hydro_gen',  label: t('series.hydro'),  color: COLORS.hydro,  stack: 'prod' },
      ],
    },
    {
      key: 'storage',
      title: t('series.storage_battery'),
      items: [
        { key: 'bess_dis', label: t('series.bess_dis'), color: COLORS.bessDis, stack: 'prod' },
        { key: 'bess_ch',  label: t('series.bess_ch'),  color: COLORS.bessCh,  stack: 'cons', negate: true },
      ],
    },
    {
      key: 'grid',
      title: t('series.grid'),
      items: [
        { key: 'grid_buy',  label: t('series.grid_buy'),  color: COLORS.gridBuy,  stack: 'prod' },
        { key: 'grid_sell', label: t('series.grid_sell'), color: COLORS.gridSell, stack: 'cons', negate: true },
      ],
    },
    {
      key: 'ev',
      title: t('series.ev'),
      items: [
        { key: 'ev_discharge', label: t('series.ev_discharge'), color: COLORS.evDis, stack: 'prod' },
        { key: 'ev_charge',    label: t('series.ev_charge'),     color: COLORS.evCh,  stack: 'cons', negate: true },
      ],
    },
    {
      key: 'combustion',
      title: t('series.combustion'),
      items: [
        { key: 'gas_gen',      label: t('series.gas_gen'),    color: COLORS.gas,   stack: 'prod' },
        { key: 'gas_th_gen',   label: t('series.gas_th_gen'), color: COLORS.gasTh, stack: 'prod' },
        { key: 'hp_elec_load', label: t('series.hp_elec'),    color: COLORS.hp,    stack: 'cons', negate: true },
      ],
    },
    {
      key: 'shedding',
      title: t('series.shedding'),
      items: [
        { key: 'load_shed',   label: t('series.load_shed'),  color: COLORS.shed, stack: 'prod' },
        { key: 'therm_shed',  label: t('series.therm_shed'), color: '#b91c1c',  stack: 'prod' },
      ],
    },
    {
      key: 'demand',
      title: t('series.demand'),
      items: [
        { key: 'home_load', label: t('series.home_load'), color: '#f59e0b', kind: 'line', help: 'Demande des foyers (avant load-shifting).' },
        { key: 'comm_load', label: t('series.comm_load'), color: '#0891b2', kind: 'line', help: 'Demande tertiaire en journée (8h-18h).' },
        { key: 'raw_load',  label: t('series.raw_load'),  color: '#dc2626', kind: 'line', strong: true, help: 'Total foyers + commerces, avant load-shifting.' },
        { key: 'optimized_load', label: t('series.optimized_load'), color: '#475569', kind: 'line', dashed: true, help: 'Demande après load-shifting (Demand Response).' },
      ],
    },
  ];
}

// ───────────────────────────────────────────────────────────────────────────
// EnergyBalanceChart
// ───────────────────────────────────────────────────────────────────────────
const THRESHOLD = 0.005; // kW — en dessous, une série est considérée inactive

export function EnergyBalanceChart({ hourly, monthSel, resolution }) {
  const { t } = useI18n();
  const SERIES_GROUPS = useMemo(() => buildSeriesGroups(t), [t]);
  const ALL_KEYS = useMemo(() => SERIES_GROUPS.flatMap((g) => g.items.map((s) => s.key)), [SERIES_GROUPS]);
  const data = useMemo(() => buildEnergyData(hourly, monthSel, resolution), [hourly, monthSel, resolution]);

  // Détection des séries inactives (toutes les valeurs ≈ 0)
  const inactiveKeys = useMemo(() => {
    if (!data.length) return new Set();
    const inactive = new Set();
    SERIES_GROUPS.flatMap((g) => g.items).forEach((s) => {
      if (s.kind === 'line') return; // toujours afficher les lignes de demande
      const allZero = data.every((pt) => {
        const val = s.negate ? Math.abs(pt[s.key] || 0) : (pt[s.key] || 0);
        return val < THRESHOLD;
      });
      if (allZero) inactive.add(s.key);
    });
    return inactive;
  }, [data, SERIES_GROUPS]);

  const [visible, setVisible] = useState(() => {
    const init = {};
    ALL_KEYS.forEach((k) => { init[k] = !inactiveKeys.has(k); });
    return init;
  });

  // Réinitialiser la visibilité quand les données changent
  const prevDataLen = useRef(0);
  useEffect(() => {
    const newLen = data.length;
    if (newLen !== prevDataLen.current) {
      prevDataLen.current = newLen;
      const init = {};
      ALL_KEYS.forEach((k) => { init[k] = !inactiveKeys.has(k); });
      setVisible(init);
    }
  }, [data.length]);

  const is8760 = resolution === '8760h';
  const is672h = resolution === '672h';
  const showFullYear = monthSel === 'all';
  const showAvg = monthSel === 'avg';
  const N = data.length;

  // ── Brush / zoom state ──────────────────────────────────────────────────
  const [brushRange, setBrushRange] = useState(null); // { startIndex, endIndex } or null = auto

  // Reset brush quand la sélection de mois change
  useEffect(() => {
    if (is8760 && showFullYear) {
      // Défaut 8760h : zoom sur le premier mois pour lisibilité
      setBrushRange({ startIndex: 0, endIndex: MONTH_BOUNDS_8760[1] - 1 });
    } else {
      setBrushRange(null);
    }
  }, [monthSel, resolution, is8760, showFullYear]);

  const effectiveData = useMemo(() => {
    if (!brushRange || showAvg) return data;
    return data.slice(brushRange.startIndex, brushRange.endIndex + 1);
  }, [data, brushRange, showAvg]);

  const xKey = (showAvg) ? 'hour' : 'idx';

  const toggle = (k) => setVisible((v) => ({ ...v, [k]: !v[k] }));
  const allOn = ALL_KEYS.every((k) => visible[k]);
  const setAll = (on) => setVisible(Object.fromEntries(ALL_KEYS.map((k) => [k, on])));

  const xLabel = showAvg
    ? t('chart.energy.xlabel_24h')
    : showFullYear
      ? (is8760 ? t('chart.energy.xlabel_8760h') : is672h ? t('chart.energy.xlabel_672h') : t('chart.energy.xlabel_288h'))
      : t('chart.energy.xlabel_24h');

  const hasAutoHidden = ALL_KEYS.some((k) => inactiveKeys.has(k));

  // ── Presets rapides ─────────────────────────────────────────────────────
  const presets = useMemo(() => {
    if (showAvg) return null;
    const list = [];
    if (!is8760 && !is672h) {
      // 288h : jour = 24h, mois = le mois courant en "all", tout = 288h
      list.push({ label: t('chart.energy.zoom_day'), range: [0, 23], condition: N > 24 });
      list.push({ label: t('chart.energy.zoom_all'), range: [0, N - 1], condition: true });
    } else if (is672h) {
      list.push({ label: t('chart.energy.zoom_week'), range: [0, 167], condition: N > 168 });
      list.push({ label: t('chart.energy.zoom_month'), range: [0, 335], condition: N > 336 });
      list.push({ label: t('chart.energy.zoom_all'), range: [0, N - 1], condition: true });
    } else {
      // 8760h
      list.push({ label: t('chart.energy.zoom_week'), range: [0, 167], condition: true });
      list.push({ label: t('chart.energy.zoom_month'), range: [0, MONTH_BOUNDS_8760[1] - 1], condition: true });
      list.push({ label: t('chart.energy.zoom_all'), range: [0, N - 1], condition: true });
    }
    return list.filter((p) => p.condition);
  }, [showAvg, is8760, is672h, N, t]);

  const hasZoom = !showAvg && N > 24;
  const zoomStart = brushRange?.startIndex ?? 0;
  const zoomEnd   = brushRange?.endIndex ?? (N - 1);
  const zoomSize  = zoomEnd - zoomStart + 1;

  const applyPreset = ([start, end]) => setBrushRange({ startIndex: Math.max(0, start), endIndex: Math.min(N - 1, end) });
  const panLeft  = () => { const w = Math.max(24, Math.floor(zoomSize * 0.5)); applyPreset([zoomStart - w, zoomEnd - w]); };
  const panRight = () => { const w = Math.max(24, Math.floor(zoomSize * 0.5)); applyPreset([zoomStart + w, zoomEnd + w]); };

  // Libellé de la plage zoomée
  const zoomLabel = useMemo(() => {
    if (!hasZoom || !brushRange || zoomSize >= N) return null;
    if (is8760) {
      const sm = MONTH_BOUNDS_8760.findIndex((b, i) => zoomStart >= b && zoomStart < MONTH_BOUNDS_8760[i + 1]);
      const em = MONTH_BOUNDS_8760.findIndex((b, i) => zoomEnd >= b && zoomEnd < MONTH_BOUNDS_8760[i + 1]);
      const sd = Math.floor((zoomStart - MONTH_BOUNDS_8760[sm]) / 24) + 1;
      const ed = Math.floor((zoomEnd - MONTH_BOUNDS_8760[em]) / 24) + 1;
      if (sm === em) return `${sd}–${ed} ${MONTHS_FR[sm]} · ${zoomSize}h`;
      return `${sd} ${MONTHS_FR[sm]?.slice(0,3)} – ${ed} ${MONTHS_FR[em]?.slice(0,3)} · ${zoomSize}h`;
    }
    if (is672h) {
      const ss = Math.floor(zoomStart / 168);
      const es = Math.floor(zoomEnd / 168);
      const sd = Math.floor((zoomStart % 168) / 24) + 1;
      const ed = Math.floor((zoomEnd % 168) / 24) + 1;
      const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
      return `${SEASONS_FR[ss]?.slice(0,5)} ${DAYS[sd-1]} – ${SEASONS_FR[es]?.slice(0,5)} ${DAYS[ed-1]} · ${zoomSize}h`;
    }
    const sm = Math.floor(zoomStart / 24);
    const em = Math.floor(zoomEnd / 24);
    return `${MONTHS_FR[sm]?.slice(0,3)}–${MONTHS_FR[em]?.slice(0,3)} · ${zoomSize}h`;
  }, [hasZoom, brushRange, zoomSize, N, zoomStart, zoomEnd, is8760, is672h]);

  return (
    <>
      {/* Légende + contrôles */}
      <div className="mb-4 rounded-xl border border-ink-200 dark:border-ink-800 bg-ink-50/40 dark:bg-ink-900/30 px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {t('chart.energy.legend_title')}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setAll(true)} disabled={allOn}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:opacity-30">
              {t('chart.energy.show_all')}
            </button>
            <span className="text-ink-300 dark:text-ink-700">·</span>
            <button onClick={() => setAll(false)}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/60">
              {t('chart.energy.hide_all')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-x-3 gap-y-1.5">
          {SERIES_GROUPS.map((g) => (
            <div key={g.key} className="space-y-1">
              <p className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">{g.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((s) => (
                  <SeriesChip key={s.key} label={s.label} color={s.color} active={visible[s.key]}
                    onClick={() => toggle(s.key)} help={s.help} dashed={s.dashed} strong={s.strong}
                    autoHidden={inactiveKeys.has(s.key)} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {hasAutoHidden && (
          <p className="mt-2 text-[9.5px] text-amber-600 dark:text-amber-400">
            {t('chart.energy.auto_hide_hint')}
          </p>
        )}
        {presets && (
          <div className="mt-2 pt-2 border-t border-ink-200/60 dark:border-ink-800 flex items-center gap-2 flex-wrap">
            <span className="text-[9.5px] font-medium text-ink-400 dark:text-ink-500">{t('chart.energy.zoom_presets')}</span>
            {presets.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.range)}
                className={'text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors ' +
                  (zoomStart === p.range[0] && zoomEnd === p.range[1]
                    ? 'border-brand-400 text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400')}>
                {p.label}
              </button>
            ))}
            <span className="text-ink-200 dark:text-ink-800">|</span>
            <button onClick={panLeft} disabled={zoomStart <= 0}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-400 disabled:opacity-30 transition-colors">
              ← {t('chart.energy.zoom_prev')}
            </button>
            <button onClick={panRight} disabled={zoomEnd >= N - 1}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-400 disabled:opacity-30 transition-colors">
              {t('chart.energy.zoom_next')} →
            </button>
            {zoomLabel && (
              <span className="text-[10px] text-ink-500 dark:text-ink-400 ml-1 font-mono">{zoomLabel}</span>
            )}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={effectiveData} margin={{ top: 8, right: 16, left: 16, bottom: 28 }}>
          <defs>
            {ALL_KEYS.map((k) => {
              const col = SERIES_GROUPS.flatMap((g) => g.items).find((s) => s.key === k)?.color;
              return (
                <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={col} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={col} stopOpacity={0.05} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400"
            tickFormatter={(v) => {
              if (showAvg) return `${v}h`;
              if (is8760) {
                const m = MONTH_BOUNDS_8760.findIndex((b, i) => v >= b && v < MONTH_BOUNDS_8760[i + 1]);
                return MONTHS_FR[m]?.slice(0, 3) ?? '';
              }
              if (is672h) {
                const s = Math.floor(v / 168);
                return SEASONS_FR[s]?.slice(0, 3) ?? '';
              }
              return v % 24 === 0 ? MONTHS_FR[Math.floor(v / 24)].slice(0, 3) : '';
            }}
            ticks={!brushRange && showFullYear && is8760 ? MONTH_BOUNDS_8760.slice(0, 12)
                 : !brushRange && showFullYear && is672h ? SEASON_BOUNDS_672.slice(0, 4)
                 : undefined}
            interval={(!brushRange && showFullYear && !is8760 && !is672h) ? 23 : 'preserveStartEnd'} minTickGap={0}>
            <Label value={xLabel} position="insideBottom" offset={-12} fill="#64748b" fontSize={11} fontWeight={500} />
          </XAxis>
          <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400" tickFormatter={fmtCompactNum}>
            <Label value={t('chart.energy.ylabel')} angle={-90} position="insideLeft" offset={5} fill="#64748b" fontSize={11} fontWeight={500} style={{ textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip content={<EnergyTooltip groups={SERIES_GROUPS} is8760={is8760} is672h={is672h} />} />
          <ReferenceLine y={0} stroke="rgba(100,116,139,0.4)" />
          {SERIES_GROUPS.flatMap((g) => g.items).filter((s) => s.kind !== 'line' && visible[s.key]).map((s) => {
            const dataKey = s.negate ? `${s.key}_neg` : s.key;
            return <Area key={s.key} type="monotone" dataKey={dataKey} stackId={s.stack} stroke={s.color} fill={`url(#g-${s.key})`} name={s.label} isAnimationActive={false} />;
          })}
          {SERIES_GROUPS.flatMap((g) => g.items).filter((s) => s.kind === 'line' && visible[s.key]).map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={s.strong ? 2.8 : (s.dashed ? 1.8 : 2.2)}
              strokeDasharray={s.dashed ? '5 4' : undefined} dot={false} name={s.label} isAnimationActive={false} connectNulls />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </>
  );
}

function SeriesChip({ label, color, active, onClick, help, dashed, strong, autoHidden }) {
  const button = (
    <button onClick={onClick}
      className={'inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium border transition-all ' +
        (active ? 'border-ink-200 dark:border-ink-700 text-ink-800 dark:text-ink-100 bg-white dark:bg-ink-900'
                : `border-ink-200/60 dark:border-ink-800 bg-transparent ${autoHidden ? 'text-amber-600 dark:text-amber-400 line-through opacity-70' : 'text-ink-400 dark:text-ink-500 line-through opacity-60'}`)}>
      {dashed || strong ? (
        <svg width="14" height="6" viewBox="0 0 14 6" className="shrink-0">
          <line x1="0" y1="3" x2="14" y2="3" stroke={active ? color : '#94a3b8'}
            strokeWidth={strong ? 2.6 : 1.8} strokeDasharray={dashed ? '3 2' : undefined} strokeLinecap="round" />
        </svg>
      ) : (
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: active ? color : 'transparent', border: `1.5px solid ${color}` }} />
      )}
      {label}
      {help && <span className="text-ink-400 text-[9px] ml-0.5" aria-hidden>?</span>}
    </button>
  );
  if (!help) return button;
  return <HelpPopover content={help} width={280}>{button}</HelpPopover>;
}

function buildEnergyData(hourly, sel, resolution) {
  const keys = [
    'solar_gen', 'wind_gen', 'hydro_gen', 'gas_gen', 'gas_th_gen',
    'bess_dis', 'bess_ch', 'grid_buy', 'grid_sell',
    'ev_discharge', 'ev_charge', 'hp_elec_load',
    'load_shed', 'therm_shed',
    'optimized_load', 'raw_load', 'comm_load',
  ];
  const is8760 = resolution === '8760h';
  const is672h = resolution === '672h';

  const transform = (point) => {
    const out = { ...point };
    out.bess_ch_neg = -Math.abs(point.bess_ch || 0);
    out.ev_charge_neg = -Math.abs(point.ev_charge || 0);
    out.hp_elec_load_neg = -Math.abs(point.hp_elec_load || 0);
    out.grid_sell_neg = -Math.abs(point.grid_sell || 0);
    out.home_load = Math.max(0, (point.raw_load || 0) - (point.comm_load || 0));
    return out;
  };

  if (sel === 'avg') {
    const out = [];
    for (let h = 0; h < 24; h++) {
      const p = { hour: h };
      keys.forEach((k) => {
        const arr = hourly[k];
        if (!Array.isArray(arr)) { p[k] = 0; return; }
        let s = 0, c = 0;
        for (let i = h; i < arr.length; i += 24) { s += arr[i]; c++; }
        p[k] = c ? s / c : 0;
      });
      out.push(transform(p));
    }
    return out;
  }

  if (sel === 'all') {
    const n = hourly.raw_load?.length || (is8760 ? 8760 : is672h ? 672 : 288);
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = { idx: i, hour: i % 24, day: Math.floor(i / 24) };
      keys.forEach((k) => { p[k] = hourly[k]?.[i] ?? 0; });
      out.push(transform(p));
    }
    return out;
  }

  const periodIdx = parseInt(sel, 10);
  const out = [];
  if (is8760) {
    const start = MONTH_BOUNDS_8760[periodIdx];
    const end = MONTH_BOUNDS_8760[periodIdx + 1];
    for (let i = start; i < end; i++) {
      const p = { idx: i, hour: i % 24, day: Math.floor(i / 24) };
      keys.forEach((k) => { p[k] = hourly[k]?.[i] ?? 0; });
      out.push(transform(p));
    }
  } else if (is672h) {
    const start = SEASON_BOUNDS_672[periodIdx];
    const end = SEASON_BOUNDS_672[periodIdx + 1];
    for (let i = start; i < end; i++) {
      const p = { idx: i, hour: i % 24, day: Math.floor(i / 24) };
      keys.forEach((k) => { p[k] = hourly[k]?.[i] ?? 0; });
      out.push(transform(p));
    }
  } else {
    for (let h = 0; h < 24; h++) {
      const idx = periodIdx * 24 + h;
      const p = { hour: h };
      keys.forEach((k) => { p[k] = hourly[k]?.[idx] ?? 0; });
      out.push(transform(p));
    }
  }
  return out;
}

function EnergyTooltip({ active, payload, label, groups, is8760, is672h }) {
  if (!active || !payload?.length) return null;

  const allItems = groups.flatMap((g) => g.items);
  const groupsMap = { Production: [], Consommation: [], Demande: [] };
  payload.forEach((p) => {
    const sample = allItems.find((s) => (s.negate ? `${s.key}_neg` : s.key) === p.dataKey);
    if (!sample) { groupsMap.Production.push(p); return; }
    if (sample.kind === 'line') groupsMap.Demande.push(p);
    else if (sample.stack === 'cons') groupsMap.Consommation.push(p);
    else groupsMap.Production.push(p);
  });

  const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  function fmtLabel(v) {
    if (typeof v !== 'number') return `t = ${v}`;
    if (v < 24) return `${v}h`;
    if (is8760) {
      const m = MONTH_BOUNDS_8760.findIndex((b, i) => v >= b && v < MONTH_BOUNDS_8760[i + 1]);
      const dayOfMonth = Math.floor((v - MONTH_BOUNDS_8760[m]) / 24) + 1;
      return `${MONTHS_FR[m] ?? ''} ${dayOfMonth} · ${v % 24}h`;
    }
    if (is672h) {
      const s = Math.floor(v / 168);
      const dow = Math.floor((v % 168) / 24);
      return `${SEASONS_FR[s] ?? ''} · ${DAYS_FR[dow]} · ${v % 24}h`;
    }
    return `${MONTHS_FR[Math.floor(v / 24)] ?? ''} · ${v % 24}h`;
  }
  const labelStr = fmtLabel(label);

  return (
    <div className="rounded-lg bg-white/97 dark:bg-ink-900/97 border border-ink-200 dark:border-ink-700 px-3 py-2 text-xs shadow-lg min-w-[220px]">
      <div className="text-ink-700 dark:text-ink-200 font-semibold mb-1.5">{labelStr}</div>
      {Object.entries(groupsMap).map(([groupName, items]) => {
        if (!items.length) return null;
        return (
          <div key={groupName} className="mb-1 last:mb-0">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500 mb-0.5">{groupName}</div>
            {items.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).map((p) => (
              <div key={p.dataKey} className="flex items-center gap-2 py-[1px]">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="text-ink-600 dark:text-ink-300 flex-1 truncate">{p.name}</span>
                <span className="font-mono text-ink-900 dark:text-ink-50 tabular-nums">
                  {p.value === 0 ? '0.0' : (p.value > 0 ? '+' : '') + (+p.value).toFixed(1)} kW
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// CashflowChart & CarbonChart
// ───────────────────────────────────────────────────────────────────────────
export function CashflowChart({ data, paybackYear }) {
  const { t } = useI18n();
  const series = (data ?? []).map((v, i) => ({ year: i, value: v }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={series} margin={{ top: 8, right: 16, left: 16, bottom: 28 }}>
        <defs>
          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.roi} stopOpacity={0.4} />
            <stop offset="100%" stopColor={COLORS.roi} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400">
          <Label value={t('chart.year_label')} position="insideBottom" offset={-12} fill="#64748b" fontSize={11} fontWeight={500} />
        </XAxis>
        <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400" tickFormatter={fmtCompactNum}>
          <Label value={t('chart.cashflow.ylabel')} angle={-90} position="insideLeft" offset={5} fill="#64748b" fontSize={11} fontWeight={500} style={{ textAnchor: 'middle' }} />
        </YAxis>
        <Tooltip formatter={(v) => [fmtCurrency(v), 'Cumul']} labelFormatter={(y) => `${t('chart.year_label')} ${y}`} />
        <ReferenceLine y={0} stroke="rgba(148,163,184,0.6)" strokeDasharray="3 3" />
        {paybackYear < 90 && (
          <ReferenceLine x={paybackYear} stroke={COLORS.roi} strokeDasharray="3 3"
            label={{ value: `ROI ${paybackYear}a`, position: 'top', fill: COLORS.roi, fontSize: 10 }} />
        )}
        <Area type="monotone" dataKey="value" stroke="none" fill="url(#cashGrad)" />
        <Line type="monotone" dataKey="value" stroke={COLORS.roi} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CarbonChart({ data, paybackYear }) {
  const { t } = useI18n();
  const series = (data ?? []).map((v, i) => ({ year: i, value: v }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={series} margin={{ top: 8, right: 16, left: 16, bottom: 28 }}>
        <defs>
          <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.co2} stopOpacity={0.4} />
            <stop offset="100%" stopColor={COLORS.co2} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400">
          <Label value={t('chart.year_label')} position="insideBottom" offset={-12} fill="#64748b" fontSize={11} fontWeight={500} />
        </XAxis>
        <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400" tickFormatter={fmtCompactNum}>
          <Label value={t('chart.carbon.ylabel')} angle={-90} position="insideLeft" offset={5} fill="#64748b" fontSize={11} fontWeight={500} style={{ textAnchor: 'middle' }} />
        </YAxis>
        <Tooltip formatter={(v) => [fmtTons(v), 'CO₂ cumulé']} labelFormatter={(y) => `${t('chart.year_label')} ${y}`} />
        <ReferenceLine y={0} stroke="rgba(148,163,184,0.6)" strokeDasharray="3 3" />
        {paybackYear < 90 && (
          <ReferenceLine x={paybackYear} stroke={COLORS.co2} strokeDasharray="3 3"
            label={{ value: `Carbon PB ${paybackYear}a`, position: 'top', fill: COLORS.co2, fontSize: 10 }} />
        )}
        <Area type="monotone" dataKey="value" stroke="none" fill="url(#co2Grad)" />
        <Line type="monotone" dataKey="value" stroke={COLORS.co2} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// OpexDonut
// ───────────────────────────────────────────────────────────────────────────
const opexLabelKeys = {
  fuel_elec_gaz: 'opex.fuel_elec_gaz',
  fuel_th_gaz:   'opex.fuel_th_gaz',
  grid_buy:      'opex.grid_buy',
  grid_sell:     'opex.grid_sell',
  om:            'opex.om',
  demand_charge: 'opex.demand_charge',
  load_shed:     'opex.load_shed',
};
const opexColors = {
  fuel_elec_gaz: COLORS.gas,
  fuel_th_gaz:   COLORS.gasTh,
  grid_buy:      COLORS.gridBuy,
  grid_sell:     COLORS.gridSell,
  om:            '#a78bfa',
  demand_charge: '#0ea5e9',
  load_shed:     COLORS.shed,
};

export function OpexDonut({ opex }) {
  const { t } = useI18n();
  const data = useMemo(() => {
    if (!opex) return [];
    return Object.entries(opex)
      .filter(([k]) => k !== 'total' && k !== 'grid_sell')
      .filter(([, v]) => Math.abs(v) > 0.5)
      .map(([k, v]) => ({
        name: t(opexLabelKeys[k] ?? k),
        value: Math.abs(v),
        color: opexColors[k] ?? '#64748b',
      }))
      .sort((a, b) => b.value - a.value);
  }, [opex, t]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <div className="relative" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={68} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [fmtCurrency(v), n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-400">{t('opex.total')}</div>
            <div className="text-xl font-bold text-ink-900 dark:text-ink-50 leading-tight">{fmtCurrency(total, { compact: true })}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5 text-[11px]">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 px-1">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-ink-700 dark:text-ink-200 flex-1 min-w-0 truncate">{d.name}</span>
            <span className="font-mono font-semibold text-ink-700 dark:text-ink-200 shrink-0 tabular-nums">{Math.round((d.value / total) * 100)}%</span>
            <span className="font-mono text-ink-500 dark:text-ink-400 text-[10px] shrink-0 tabular-nums w-16 text-right">{fmtCurrency(d.value, { compact: true })}</span>
          </div>
        ))}
        {opex?.grid_sell != null && opex.grid_sell !== 0 && (
          <div className="flex items-center gap-2 px-1 pt-1.5 mt-1.5 border-t border-ink-200/60 dark:border-ink-800">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS.gridSell }} />
            <span className="text-ink-700 dark:text-ink-200 flex-1 min-w-0 truncate">{t('opex.revenue')}</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums w-16 text-right">{fmtCurrency(opex.grid_sell, { compact: true })}</span>
          </div>
        )}
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// TornadoChart
// ───────────────────────────────────────────────────────────────────────────
export function TornadoChart({ sensitivity, baseRoi }) {
  const { t } = useI18n();
  if (!sensitivity?.length) {
    return <p className="text-xs text-ink-500 dark:text-ink-400 italic py-6 text-center">{t('tornado.empty')}</p>;
  }

  const enriched = sensitivity.map((s) => {
    const low = Math.min(99.9, s.roi_low ?? 99.9);
    const high = Math.min(99.9, s.roi_high ?? 99.9);
    return { param: s.parameter, delta: Math.abs(high - low), delta_low: low - (baseRoi ?? 0), delta_high: high - (baseRoi ?? 0) };
  });
  enriched.sort((a, b) => b.delta - a.delta);

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, enriched.length * 38)}>
      <BarChart data={enriched} layout="vertical" stackOffset="sign" margin={{ top: 8, right: 24, left: 16, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
        <XAxis type="number" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-ink-500 dark:text-ink-400"
          tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}>
          <Label value={t('tornado.xlabel')} position="insideBottom" offset={-12} fill="#64748b" fontSize={11} fontWeight={500} />
        </XAxis>
        <YAxis type="category" dataKey="param" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-700 dark:text-ink-200" width={140} />
        <Tooltip formatter={(v, n) => {
          const sign = v > 0 ? '+' : '';
          const label = n === 'delta_low' ? t('tornado.low_label') : t('tornado.high_label');
          return [`${sign}${(+v).toFixed(2)} ans`, label];
        }} />
        <ReferenceLine x={0} stroke="rgba(148,163,184,0.6)" />
        <Bar dataKey="delta_low" fill="#3b82f6" radius={[3, 0, 0, 3]} name="−20%" />
        <Bar dataKey="delta_high" fill={COLORS.gas} radius={[0, 3, 3, 0]} name="+20%" />
      </BarChart>
    </ResponsiveContainer>
  );
}
