import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useI18n, tUnit } from '../i18n';

// ───────────────────────────────────────────────────────────────────────────
// Tooltip floating positioning hook (right-of-trigger by default, auto-flip)
// ───────────────────────────────────────────────────────────────────────────
function useTooltipPosition(triggerRef, isOpen, { width = 300, estHeight = 130 } = {}) {
  const [style, setStyle] = useState(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setStyle(null);
      return;
    }
    const compute = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const PAD = 10;

      // Default : à droite, centré verticalement
      let left = rect.right + PAD;
      let top = rect.top + rect.height / 2;

      if (left + width > window.innerWidth - 10) {
        // Pas la place à droite → bascule à gauche
        left = rect.left - width - PAD;
      }
      if (left < 10) {
        // Pas la place non plus à gauche → place dessous, aligné
        left = Math.max(10, rect.left);
        top = rect.bottom + PAD;
      } else {
        // Clamp vertical (translateY -50% = halfH au-dessus)
        const halfH = estHeight / 2;
        if (top - halfH < 10) top = halfH + 10;
        if (top + halfH > window.innerHeight - 10) top = window.innerHeight - halfH - 10;
      }

      setStyle({ position: 'fixed', left, top, transform: 'translateY(-50%)', width });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [isOpen, triggerRef, width, estHeight]);

  return style;
}

// ───────────────────────────────────────────────────────────────────────────
// HelpTip — icône "?" avec popover personnalisé (remplace title HTML natif)
// ───────────────────────────────────────────────────────────────────────────
export function HelpTip({ children, size = 11, side: _side }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const style = useTooltipPosition(ref, open);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center cursor-help text-ink-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
        aria-label="Aide"
      >
        <HelpCircle size={size} strokeWidth={2.2} />
      </span>
      {open && style &&
        createPortal(
          <div
            role="tooltip"
            style={{ ...style, zIndex: 1000, pointerEvents: 'none' }}
            className="px-3 py-2 rounded-lg text-[11px] leading-relaxed shadow-xl animate-fadeIn bg-white text-ink-900 border border-ink-200 dark:bg-ink-900 dark:text-ink-50 dark:border-ink-700"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Tooltip — wrapper pour boutons & autres éléments (sans icône "?")
// ───────────────────────────────────────────────────────────────────────────
export function Tooltip({ content, children, width = 260 }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const style = useTooltipPosition(ref, open, { width });

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex"
      >
        {children}
      </span>
      {open && style && content &&
        createPortal(
          <div
            role="tooltip"
            style={{ ...style, zIndex: 1000, pointerEvents: 'none' }}
            className="px-3 py-2 rounded-lg text-[11px] leading-relaxed shadow-xl animate-fadeIn bg-white text-ink-900 border border-ink-200 dark:bg-ink-900 dark:text-ink-50 dark:border-ink-700"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Card — conteneur générique
// ───────────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', title, subtitle, icon: Icon, action, ...rest }) {
  return (
    <div
      {...rest}
      className={
        'rounded-2xl border border-ink-200/70 dark:border-ink-800 ' +
        'bg-white dark:bg-ink-900/70 backdrop-blur shadow-card ' +
        'p-5 animate-fadeIn ' + className
      }
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="grid place-items-center h-8 w-8 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Icon size={16} />
              </span>
            )}
            <div>
              {title && <h3 className="text-sm font-semibold tracking-tight">{title}</h3>}
              {subtitle && (
                <p className="text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// KpiCard — tuile KPI
// ───────────────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, icon: Icon, accent = 'brand', sub }) {
  const accents = {
    brand: 'from-brand-500/15 to-brand-500/0 text-brand-500',
    blue:  'from-blue-500/15 to-blue-500/0 text-blue-500',
    violet:'from-violet-500/15 to-violet-500/0 text-violet-500',
    sky:   'from-sky-500/15 to-sky-500/0 text-sky-500',
    amber: 'from-amber-500/15 to-amber-500/0 text-amber-500',
    rose:  'from-rose-500/15 to-rose-500/0 text-rose-500',
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900/70 p-5 shadow-card">
      <div
        className={
          'absolute inset-x-0 -top-12 h-32 bg-gradient-to-b ' +
          (accents[accent] || accents.brand)
        }
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={'grid place-items-center h-8 w-8 rounded-xl bg-white/60 dark:bg-ink-900/60 ' + (accents[accent] || accents.brand).split(' ').pop()}>
              <Icon size={16} />
            </span>
          )}
          <span className="text-xs font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {label}
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          {value}
        </p>
        {sub && (
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Accordion — section dépliable
// ───────────────────────────────────────────────────────────────────────────
export function Accordion({ title, icon: Icon, defaultOpen = false, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          {Icon && (
            <span className="grid place-items-center h-7 w-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Icon size={14} />
            </span>
          )}
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={'text-ink-400 transition-transform duration-200 ' + (open ? 'rotate-180' : '')}
        />
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-ink-200/70 dark:border-ink-800 space-y-4 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// ParamControl — slider + input numérique synchronisés
//   - asPercent : la valeur stockée est décimale (0.05 → 5%) mais affichée ×100
// ───────────────────────────────────────────────────────────────────────────
export function ParamControl({
  label, value, onChange, min = 0, max = 100, step = 1,
  unit = '', help, asPercent = false,
}) {
  const { t } = useI18n();
  const unitTranslated = tUnit(unit, t);
  const factor = asPercent ? 100 : 1;
  const dispMin = +(min * factor).toFixed(4);
  const dispMax = +(max * factor).toFixed(4);
  const dispStep = +(step * factor).toFixed(4);
  const dispValue = +(value * factor).toFixed(asPercent ? 2 : 4);

  const handleDisp = (v) => {
    const raw = v === '' ? min : +v;
    const clamped = Math.max(dispMin, Math.min(dispMax, raw));
    onChange(asPercent ? +(clamped / 100).toFixed(6) : clamped);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="flex items-center gap-1 text-xs font-medium text-ink-700 dark:text-ink-300">
          {label}
          {help && <HelpTip>{help}</HelpTip>}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={dispValue}
            min={dispMin}
            max={dispMax}
            step={dispStep}
            onChange={(e) => handleDisp(e.target.value)}
            className="w-20 text-right text-xs font-mono bg-ink-50 dark:bg-ink-800/60 border border-ink-200 dark:border-ink-700 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {unit && <span className="text-[11px] text-ink-500 dark:text-ink-400">{unitTranslated}</span>}
        </div>
      </div>
      <input
        type="range"
        value={dispValue}
        min={dispMin}
        max={dispMax}
        step={dispStep}
        onChange={(e) => handleDisp(e.target.value)}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Toggle — switch booléen
// ───────────────────────────────────────────────────────────────────────────
export function Toggle({ label, checked, onChange, help, icon: Icon, disabled = false }) {
  return (
    <div className={'flex items-center justify-between gap-3 ' + (disabled ? 'opacity-50' : '')}>
      <span className="flex items-center gap-2 text-xs font-medium text-ink-700 dark:text-ink-300">
        {Icon && <Icon size={14} className="text-ink-500" />}
        {label}
        {help && <HelpTip>{help}</HelpTip>}
      </span>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        className={
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' +
          (disabled ? 'cursor-not-allowed ' : '') +
          (checked ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-700')
        }
      >
        <span
          className={
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ' +
            (checked ? 'translate-x-5' : 'translate-x-1')
          }
        />
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SelectField — select stylisé
// ───────────────────────────────────────────────────────────────────────────
export function SelectField({ label, value, onChange, options, icon: Icon }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={14} className="text-ink-500" />}
      {label && <span className="text-xs text-ink-500 dark:text-ink-400">{label}</span>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-md text-xs font-medium pl-2.5 pr-7 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-500"
        />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// EmptyState — placeholder dashboard avant 1er run
// ───────────────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="grid place-items-center h-16 w-16 rounded-2xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-4">
          <Icon size={28} />
        </div>
      )}
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-ink-500 dark:text-ink-400 max-w-sm">{description}</p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Spinner / Loader
// ───────────────────────────────────────────────────────────────────────────
export function Spinner({ size = 18, className = '' }) {
  return (
    <span
      className={'inline-block rounded-full border-2 border-current border-t-transparent animate-spin ' + className}
      style={{ width: size, height: size }}
    />
  );
}

export function LoadingOverlay({ message, estimatedSeconds = 8 }) {
  const startTime = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((Date.now() - startTime.current) / 1000);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  // Courbe : atteint 95 % à ~2× estimatedSeconds (buffer pour les runs longs)
  const progress = useMemo(() => {
    const tau = (2 * estimatedSeconds) / 3; // 95 % à 2× estimated
    return Math.round(100 * (1 - Math.exp(-elapsed / tau)));
  }, [elapsed, estimatedSeconds]);

  const capped = progress >= 95;
  const displayPct = Math.min(95, progress);
  const remaining = Math.max(0, Math.round(estimatedSeconds - elapsed));
  const overtime = elapsed > estimatedSeconds * 1.5;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-white/70 dark:bg-ink-950/70 backdrop-blur-sm rounded-2xl">
      <div className="flex flex-col items-center gap-4">
        <ProgressRing pct={displayPct} pulse={capped} size={80} strokeWidth={5} />
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-bold text-ink-800 dark:text-ink-100">
            {displayPct}% {capped && <span className="inline-block animate-pulse">…</span>}
          </p>
          <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400">{message}</p>
          {!capped && remaining > 0 && (
            <p className="text-[10px] text-ink-400 dark:text-ink-500">
              ~{remaining}s restante{remaining > 1 ? 's' : ''}…
            </p>
          )}
          {capped && (
            <p className="text-[10px] text-ink-400 dark:text-ink-500">
              {overtime
                ? `Calcul complexe — déjà ${Math.round(elapsed)}s écoulées`
                : `${Math.round(elapsed)}s écoulées — ne quittez pas la page`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ pct, pulse, size = 80, strokeWidth = 5 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className={`transform -rotate-90 ${pulse ? 'animate-pulse' : ''}`}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-ink-200 dark:text-ink-800"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="text-brand-500 transition-all duration-300 ease-out"
        style={{ filter: 'drop-shadow(0 0 4px rgba(37,99,235,0.3))' }}
      />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SectionTitle — titre de bloc
// ───────────────────────────────────────────────────────────────────────────
export function SectionTitle({ children, hint }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-1">
      <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-500 dark:text-ink-400">
        {children}
      </h2>
      {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Tabs — onglets internes (compact, dans un Accordéon)
// ───────────────────────────────────────────────────────────────────────────
export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="grid gap-1 p-1 rounded-xl bg-ink-100 dark:bg-ink-800/60"
         style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.value === value;
        const dot = tab.indicator;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={
              'relative inline-flex items-center justify-center gap-1.5 ' +
              'h-8 px-2 text-[11px] font-medium rounded-lg transition-all ' +
              (active
                ? 'bg-white dark:bg-ink-900 shadow-sm text-ink-900 dark:text-ink-50'
                : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200')
            }
          >
            {Icon && <Icon size={12} className={active ? 'text-brand-500' : ''} />}
            <span className="truncate">{tab.label}</span>
            {dot != null && (
              <span
                className={
                  'absolute top-1 right-1 h-1.5 w-1.5 rounded-full ' +
                  (dot ? 'bg-brand-500' : 'bg-ink-400/60')
                }
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ value, current, children }) {
  if (value !== current) return null;
  return <div className="mt-3 space-y-3 animate-fadeIn">{children}</div>;
}

// ───────────────────────────────────────────────────────────────────────────
// IncludeBanner — bandeau d'inclusion en tête d'onglet
// ───────────────────────────────────────────────────────────────────────────
export function IncludeBanner({ enabled, onToggle, label, disabledLabel, help }) {
  const { t } = useI18n();
  return (
    <div
      className={
        'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ' +
        (enabled
          ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-300/50 dark:border-brand-500/30'
          : 'bg-ink-100/60 dark:bg-ink-800/40 border-ink-200 dark:border-ink-700')
      }
    >
      <span
        className={
          'flex items-center gap-1 text-[11px] font-semibold ' +
          (enabled ? 'text-brand-700 dark:text-brand-400' : 'text-ink-500 dark:text-ink-400')
        }
      >
        {enabled ? `${t('include.enabled')} ${label} ${t('include.in_modeling')}` : (disabledLabel || `${label} ${t('include.disabled')}`)}
        {help && <HelpTip>{help}</HelpTip>}
      </span>
      <button
        onClick={() => onToggle(!enabled)}
        role="switch"
        aria-checked={enabled}
        className={
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' +
          (enabled ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-700')
        }
      >
        <span
          className={
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ' +
            (enabled ? 'translate-x-5' : 'translate-x-1')
          }
        />
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Modal — overlay avec backdrop flouté
// ───────────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] pb-[5vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-full overflow-y-auto rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-b border-ink-200 dark:border-ink-800 bg-white/90 dark:bg-ink-900/90 backdrop-blur">
          <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50">{title}</h2>
          <button
            onClick={onClose}
            className="grid place-items-center h-8 w-8 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 text-sm text-ink-700 dark:text-ink-200 leading-relaxed space-y-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
