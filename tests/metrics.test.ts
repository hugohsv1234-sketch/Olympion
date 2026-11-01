import { describe, it, expect } from 'vitest';
import { expectation, qualityMetric, qualityLabel, scoreText } from '../src/lib/metrics';
import { parseInfo, parseOption } from '../src/lib/engine';
describe('Echte Enginebewertungen', () => {
  it('berechnet erwarteten Punktverlust und 92 Prozent im Beispiel', () => {
    const best = { wdl: [600, 200, 200] as [number, number, number] },
      played = { wdl: [520, 200, 280] as [number, number, number] };
    expect(expectation(best)).toBe(0.7);
    expect(qualityMetric(best, played)).toBe(92);
  });
  it('behandelt gleichwertige Züge, negative Bewertungen und Clamping', () => {
    expect(qualityMetric({ cp: -100 }, { cp: -100 })).toBe(100);
    expect(qualityMetric({ cp: 0 }, { cp: 20 })).toBe(100);
    expect(qualityMetric({ mate: 3 }, { mate: -2 })).toBe(0);
    expect(() => expectation({})).toThrow();
  });
  it('vergleicht aus Sicht des Zugspielers auch bei Schwarz', () => {
    const white = qualityMetric({ cp: 100 }, { cp: -200 });
    const black = qualityMetric({ cp: 100 }, { cp: -200 });
    expect(white).toBe(black);
    expect(scoreText({ cp: 100 }, true, 'b')).toBe('-1.00');
  });
  it('kennzeichnet Mattfälle und erzwungene Züge gesondert', () => {
    expect(qualityLabel({ mate: 3 }, { cp: 600 }, 99, false, false)).toBe('Matt verpasst');
    expect(qualityLabel({ cp: -100 }, { mate: -3 }, 20, false, false)).toBe('Matt zugelassen');
    expect(qualityLabel({ cp: 0 }, { cp: 0 }, 100, true, true)).toBe('Erzwungener Zug');
  });
  it('liest UCI-Bereiche und WDL statt Optionen zu erfinden', () => {
    expect(parseOption('option name Skill Level type spin default 20 min 0 max 20')).toEqual({
      name: 'Skill Level',
      type: 'spin',
      min: 0,
      max: 20,
    });
    expect(parseOption('id name Stockfish')).toBeNull();
    const info = parseInfo(
      'info depth 14 multipv 1 score cp -43 wdl 100 600 300 nodes 120000 pv e2e4 e7e5',
    );
    expect(info?.score).toEqual({ cp: -43, wdl: [100, 600, 300] });
    expect(info?.pv).toEqual(['e2e4', 'e7e5']);
  });
});
