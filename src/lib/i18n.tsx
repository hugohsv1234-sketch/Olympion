'use client';
import { useCallback } from 'react';
import { useStore } from '@/components/Provider';
import { english } from './translations';
export function translate(text: string, language: 'de' | 'en', en?: string) {
  if (language === 'de') return text;
  const trimmed = text.trim(),
    translated = en || english[text] || english[trimmed];
  if (translated) return text.replace(trimmed, translated);
  return text
    .replace(/Die Engine bevorzugt (.+?)\. Variante: /g, 'The engine prefers $1. Variation: ')
    .replace(/(\S+) schlägt eine Figur\./g, '$1 captures a piece.')
    .replace(
      /Bei bestem Gegenspiel: Matt für dich in (\d+)\./g,
      'With best play: mate for you in $1.',
    )
    .replace(
      /Bei bestem Gegenspiel: Matt gegen dich in (\d+)\./g,
      'With best play: mate against you in $1.',
    )
    .replace(/^(\d+) Prozent deines Tagesziels erreicht$/, '$1 percent of your daily goal achieved')
    .replace(/^Matt ([+−–\d]+)$/, 'Mate $1')
    .replace(/^Betrachte die Figur auf (.+)\.$/, 'Look at the piece on $1.')
    .replace(/^Der nächste Zug ist (.+)\.$/, 'The next move is $1.')
    .replace(
      /^Zeittraining beendet\. (\d+) Aufgaben gelöst\. Die Uhr läuft auch bei einem App-Wechsel weiter\.$/,
      'Timed training finished. $1 puzzles solved. The clock keeps running when you switch apps.',
    );
}
export function useT() {
  const { settings } = useStore();
  return useCallback(
    (text: string, en?: string) => translate(text, settings.language, en),
    [settings.language],
  );
}

export function useLocale() {
  const { settings } = useStore();
  return settings.language === 'de' ? 'de-DE' : 'en-US';
}
