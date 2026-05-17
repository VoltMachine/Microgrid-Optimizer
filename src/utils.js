// Formatters FR
const nbsp = ' ';

export const fmtCurrency = (n, opts = {}) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (opts.compact && abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}${nbsp}M€`;
  if (opts.compact && abs >= 1_000) return `${(n / 1_000).toFixed(1)}${nbsp}k€`;
  return `${Math.round(n).toLocaleString('fr-FR')}${nbsp}€`;
};

export const fmtCompactNum = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toString();
};

export const fmtPower = (n, unit = 'kW') => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(2)}${nbsp}${unit.replace(/^k/, 'M')}`;
  return `${n.toFixed(1)}${nbsp}${unit}`;
};

export const fmtTons = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(2)}${nbsp}kt`;
  return `${n.toFixed(1)}${nbsp}t`;
};

export const fmtPct = (n, digits = 1) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}${nbsp}%`;
};

export const fmtYears = (n, lang = 'fr') => {
  const yr = lang === 'en' ? 'yr' : 'an';
  const yrs = lang === 'en' ? 'yrs' : 'ans';
  if (n === null || n === undefined || Number.isNaN(n) || n >= 99) return `>${nbsp}25${nbsp}${yrs}`;
  if (n === 0) return `0${nbsp}${yr}`;
  return `${(+n).toFixed(1)}${nbsp}${yrs}`;
};

export const fmtNumber = (n, digits = 0) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
