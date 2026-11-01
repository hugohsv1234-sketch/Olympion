import type { EngineScore } from './types';
export function expectation(score: EngineScore) {
  if (score.mate !== undefined) return score.mate > 0 ? 1 : 0;
  if (score.wdl) {
    const [w, d, l] = score.wdl;
    const n = w + d + l;
    if (n > 0) return (w + d * 0.5) / n;
  }
  if (score.cp !== undefined)
    return 1 / (1 + Math.exp(-Math.max(-3000, Math.min(3000, score.cp)) / 220));
  throw new Error('Engine liefert keine auswertbare Bewertung.');
}
export function qualityMetric(best: EngineScore, played: EngineScore) {
  return (
    Math.round(10000 * (1 - Math.max(0, Math.min(1, expectation(best) - expectation(played))))) /
    100
  );
}
export function qualityLabel(
  best: EngineScore,
  played: EngineScore,
  quality: number,
  same: boolean,
  forced: boolean,
) {
  if (forced) return 'Erzwungener Zug';
  if (best.mate !== undefined && best.mate > 0 && (played.mate === undefined || played.mate <= 0))
    return 'Matt verpasst';
  if (played.mate !== undefined && played.mate < 0 && (best.mate === undefined || best.mate >= 0))
    return 'Matt zugelassen';
  if (same) return 'Bester Zug';
  if (quality >= 98) return 'Sehr gut';
  if (quality >= 92) return 'Guter Zug';
  if (quality >= 80) return 'Ungenauigkeit';
  if (quality >= 60) return 'Fehler';
  return 'Grober Fehler';
}
export function scoreText(score: EngineScore, white = false, turn: 'w' | 'b' = 'w') {
  const sign = white && turn === 'b' ? -1 : 1;
  if (score.mate !== undefined)
    return `Matt ${score.mate * sign > 0 ? '+' : '−'}${Math.abs(score.mate)}`;
  if (score.cp === undefined) return '–';
  const cp = score.cp * sign;
  return (cp >= 0 ? '+' : '') + (cp / 100).toFixed(2);
}
