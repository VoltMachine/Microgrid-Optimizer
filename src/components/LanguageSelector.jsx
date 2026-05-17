import React from 'react';
import { createPortal } from 'react-dom';
import { Globe } from 'lucide-react';
import { useI18n } from '../i18n';

export default function LanguageSelector({ open, onClose }) {
  const { setLang, t } = useI18n();

  if (!open) return null;

  const choose = (l) => {
    setLang(l);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm mx-4 rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 shadow-2xl p-8 text-center">
        <div className="grid place-items-center h-14 w-14 rounded-2xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 mx-auto mb-5">
          <Globe size={28} />
        </div>
        <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50 mb-2">
          {t('lang.selector.title')}
        </h2>
        <p className="text-[13px] text-ink-500 dark:text-ink-400 mb-6">
          {t('lang.selector.subtitle')}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => choose('fr')}
            className="flex-1 py-3 rounded-xl border-2 border-brand-500 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 text-brand-700 dark:text-brand-300 font-semibold text-sm transition-colors"
          >
            🇫🇷 Français
          </button>
          <button
            onClick={() => choose('en')}
            className="flex-1 py-3 rounded-xl border-2 border-ink-200 dark:border-ink-700 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 text-ink-700 dark:text-ink-300 font-semibold text-sm transition-colors"
          >
            🇬🇧 English
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
