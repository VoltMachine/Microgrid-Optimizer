import React, { useEffect, useState } from 'react';
import { Modal, Spinner } from './Primitives';
import { useI18n } from '../i18n';
import axios from 'axios';

function cleanSource(raw) {
  // 1. Supprimer le bloc docstring initial contenant les [FIX-X]
  const first = raw.indexOf('"""');
  if (first !== -1) {
    const second = raw.indexOf('"""', first + 3);
    if (second !== -1 && raw.slice(first, second).includes('[FIX-')) {
      raw = raw.slice(0, first) + raw.slice(second + 3);
    }
  }

  // 2. Supprimer les lignes [FIX-X] (ligne entière)
  raw = raw.replace(/^[ \t]*#\s*\[FIX-\d+\].*$\n?/gm, '');

  // 3. Supprimer les annotations [FIX-X] en fin de ligne
  raw = raw.replace(/\s*#\s*\[FIX-\d+\].*$/gm, '');

  // 4. Réduire les lignes vides multiples
  raw = raw.replace(/\n{3,}/g, '\n\n');

  // 5. Nettoyer les lignes vides en début de fichier
  raw = raw.replace(/^\n+/, '');

  return raw;
}

export default function CodeModal({ open, onClose }) {
  const { t } = useI18n();
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (source) return;
    const client = axios.create({ timeout: 10_000 });
    client.get('/api/source')
      .then(({ data }) => {
        if (data.status === 'success') setSource(cleanSource(data.source));
        else setError(data.error || 'Erreur inconnue');
      })
      .catch(() => setError('Backend inaccessible — lancez uvicorn main:app'));
  }, [open, source]);

  return (
    <Modal open={open} onClose={onClose} title={t('code.title')}>
      {error ? (
        <p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
      ) : !source ? (
        <div className="flex items-center justify-center py-16 gap-2 text-ink-500">
          <Spinner size={16} /> Chargement du code source...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <pre className="text-[11px] leading-relaxed font-mono text-ink-800 dark:text-ink-200 whitespace-pre bg-ink-50 dark:bg-ink-800/40 rounded-xl p-4 overflow-auto max-h-[70vh]">
{source}
          </pre>
        </div>
      )}
    </Modal>
  );
}
