import React from 'react';
import {
  Sun, Wind, Droplets, BatteryCharging, Flame, Thermometer, Cable, Boxes, Plug,
} from 'lucide-react';
import { fmtPower } from '../utils';
import { COLORS } from '../defaults';
import { useI18n } from '../i18n';

function buildItems(t) {
  return [
    { key: 'solar_kw',     label: t('caps.solar'),          unit: 'kW',  icon: Sun,            color: COLORS.solar },
    { key: 'wind_kw',      label: t('caps.wind'),           unit: 'kW',  icon: Wind,           color: COLORS.wind },
    { key: 'hydro_kw',     label: t('caps.hydro'),          unit: 'kW',  icon: Droplets,       color: COLORS.hydro },
    { key: 'bess_kwh',     label: t('caps.bess'),           unit: 'kWh', icon: BatteryCharging, color: COLORS.bessDis },
    { key: 'bess_inv_kw',  label: t('caps.bess_inv'),       unit: 'kW',  icon: Plug,           color: '#7c3aed' },
    { key: 'solar_inv_kw', label: t('caps.solar_inv'),      unit: 'kW',  icon: Plug,           color: '#facc15' },
    { key: 'gas_kw',       label: t('caps.gas'),            unit: 'kW',  icon: Flame,          color: COLORS.gas },
    { key: 'boiler_kw',    label: t('caps.boiler'),         unit: 'kW',  icon: Flame,          color: COLORS.gasTh },
    { key: 'hp_kw',        label: t('caps.hp'),             unit: 'kW',  icon: Thermometer,    color: COLORS.hp },
    { key: 'tes_kwh',      label: t('caps.tes'),            unit: 'kWh', icon: Boxes,          color: '#f59e0b' },
  ];
}

export default function CapacitiesTable({ capacities, kpis }) {
  const { t } = useI18n();
  const ITEMS = React.useMemo(() => buildItems(t), [t]);
  if (!capacities) return null;
  const max = Math.max(...ITEMS.map((it) => capacities[it.key] || 0), 1);

  return (
    <div className="space-y-2">
      {ITEMS.map((it) => {
        const v = capacities[it.key] || 0;
        const pct = (v / max) * 100;
        const Icon = it.icon;
        return (
          <div key={it.key} className={'group flex items-center gap-3 p-2.5 rounded-xl transition-colors ' +
            (v > 0 ? 'bg-ink-50 dark:bg-ink-800/40 hover:bg-ink-100 dark:hover:bg-ink-800/60' : 'opacity-40')}>
            <span className="grid place-items-center h-8 w-8 rounded-lg shrink-0" style={{ background: `${it.color}22`, color: it.color }}>
              <Icon size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1 min-w-0">
                <span className="text-xs font-semibold truncate flex-1 min-w-0 text-ink-800 dark:text-ink-100">{it.label}</span>
                <span className="text-xs font-mono font-semibold tabular-nums shrink-0 text-ink-700 dark:text-ink-200">{fmtPower(v, it.unit)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-200/70 dark:bg-ink-700/60 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: it.color }} />
              </div>
            </div>
          </div>
        );
      })}
      {kpis?.max_grid_power > 0 && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/30">
          <span className="grid place-items-center h-8 w-8 rounded-lg shrink-0" style={{ background: '#3b82f622', color: '#3b82f6' }}>
            <Cable size={14} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-xs font-semibold truncate flex-1 min-w-0">{t('caps.grid')}</span>
              <span className="text-xs font-mono font-semibold tabular-nums shrink-0">{fmtPower(kpis.max_grid_power, 'kW')}</span>
            </div>
            <p className="text-[10px] text-ink-500 dark:text-ink-400 mt-0.5">{t('caps.grid_sub')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
