import React from 'react';
import {
  Sun, Moon, AlertCircle, CheckCircle2, HelpCircle, Languages,
  PanelLeftClose, PanelLeftOpen, Download, FileText, FileSpreadsheet,
} from 'lucide-react';
import { SelectField, Spinner, Tooltip } from './Primitives';
import { MONTHS_FR, SEASONS_FR, SEASONS_EN } from '../defaults';
import { useI18n } from '../i18n';

export default function Header({
  darkMode, setDarkMode, hasResults, lastRunAt, error,
  monthSel, setMonthSel,
  sidebarOpen, setSidebarOpen,
  onExportCsv, onExportPdf, exporting,
  onOpenTutorial,
  onOpenMethodology,
  resolution,
}) {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/70 dark:border-ink-800 bg-white/80 dark:bg-ink-950/80 backdrop-blur">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Tooltip content={sidebarOpen ? t('header.toggle_sidebar_hide') : t('header.toggle_sidebar_show')}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="grid place-items-center h-9 w-9 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors"
            >
              {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </button>
          </Tooltip>
          <div>
            <h2 className="text-base font-bold tracking-tight">{t('header.title')}</h2>
            <p className="text-[11px] text-ink-500 dark:text-ink-400">
              {t('header.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasResults && (
            <SelectField
              value={monthSel}
              onChange={setMonthSel}
              options={[
                { value: 'all', label: resolution === '8760h' ? t('select.year_all_8760h') : resolution === '672h' ? t('select.year_all_672h') : t('select.year_all') },
                { value: 'avg', label: t('select.year_avg') },
                ...(resolution === '672h'
                  ? (lang === 'fr' ? SEASONS_FR : SEASONS_EN).map((s, i) => ({ value: String(i), label: s }))
                  : MONTHS_FR.map((m, i) => ({ value: String(i), label: m }))),
              ]}
            />
          )}

          <StatusPill error={error} hasResults={hasResults} lastRunAt={lastRunAt} />

          {/* Export buttons */}
          {hasResults && (
            <div className="flex items-center gap-1.5 border-l border-ink-200 dark:border-ink-800 pl-3">
              <Tooltip content="Exporte tous les résultats au format CSV : KPIs, capacités, OPEX, cashflow & carbone 25 ans, données horaires (288h), sensibilité, paramètres en entrée. Chaque section a son propre en-tête.">
                <button
                  onClick={onExportCsv}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors text-[11px] font-medium disabled:opacity-50"
                >
                  <FileSpreadsheet size={13} /> CSV
                </button>
              </Tooltip>
              <Tooltip content="Génère un rapport PDF : page 1 = localisation, pages suivantes = paramètres en entrée par catégorie, puis chaque graphique avec son titre. Le bilan énergétique est capturé en vue annuelle (288h).">
                <button
                  onClick={onExportPdf}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors text-[11px] font-medium disabled:opacity-50"
                >
                  {exporting ? <Spinner size={12} /> : <FileText size={13} />} PDF
                </button>
              </Tooltip>
            </div>
          )}

          <button
            onClick={onOpenTutorial}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors text-[11px] font-medium"
          >
            <HelpCircle size={13} /> {t('header.tutorial')}
          </button>
          <button
            onClick={onOpenMethodology}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors text-[11px] font-medium"
          >
            <HelpCircle size={13} /> {t('header.how_it_works')}
          </button>
          <a
            href="https://github.com/VoltMachine/Microgrid-Optimizer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors text-[11px] font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-ink-700 dark:text-ink-200">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>

          <Tooltip content={t('header.lang.tooltip')}>
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="grid place-items-center h-9 w-9 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors text-xs font-bold uppercase"
            >
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
          </Tooltip>

          <Tooltip content={darkMode ? t('header.toggle_dark') : t('header.toggle_light')}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="grid place-items-center h-9 w-9 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors"
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

function StatusPill({ error, hasResults, lastRunAt }) {
  const { t } = useI18n();
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/30">
        <AlertCircle size={12} /> {error.length > 50 ? error.slice(0, 50) + '…' : error}
      </span>
    );
  }
  if (hasResults) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-200/60 dark:border-brand-500/30">
        <CheckCircle2 size={12} /> {t('status.success')}{lastRunAt ? ` · ${formatTime(lastRunAt)}` : ''}
      </span>
    );
  }
  return (
    <span className="text-[11px] text-ink-500 dark:text-ink-400">
      {t('status.waiting')}
    </span>
  );
}

function formatTime(d) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
