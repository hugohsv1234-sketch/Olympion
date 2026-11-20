import { describe, expect, it } from 'vitest';
import { classifyMove, offersSacrifice, moveGrade, REVIEW_VERSION } from '../src/lib/review';
import { DEFAULT_POSITION, importNotation } from '../src/lib/chess';
import type { MoveQuality } from '../src/lib/types';
const context = {
  best: { cp: 0 },
  played: { cp: 0 },
  same: true,
  forced: false,
  sacrifice: false,
  reliable: true,
};
describe('Move classifications', () => {
  it('requires a verified sacrifice, sufficient search and a viable position for brilliant', () => {
    expect(classifyMove({ ...context, sacrifice: true })).toBe('brilliant');
    expect(classifyMove({ ...context, sacrifice: true, reliable: false })).toBe('best');
    expect(
      classifyMove({ ...context, sacrifice: true, best: { cp: -800 }, played: { cp: -800 } }),
    ).toBe('best');
    expect(classifyMove({ ...context, sacrifice: true, played: { cp: -200 } })).not.toBe(
      'brilliant',
    );
  });
  it('requires an independently evaluated worse alternative for great', () => {
    expect(classifyMove({ ...context, second: { cp: -400 } })).toBe('great');
    expect(classifyMove({ ...context, second: { cp: -10 } })).toBe('best');
    expect(
      classifyMove({ ...context, best: { cp: 1200 }, played: { cp: 1200 }, second: { cp: 350 } }),
    ).toBe('best');
    expect(classifyMove({ ...context, second: { cp: -400 }, forced: true })).toBe('forced');
    expect(classifyMove({ ...context, second: { cp: -400 }, reliable: false })).toBe('best');
  });
  it('distinguishes forced mates and missed winning opportunities', () => {
    expect(classifyMove({ ...context, best: { mate: 3 }, played: { cp: 700 }, same: false })).toBe(
      'missed',
    );
    expect(classifyMove({ ...context, played: { mate: -2 }, same: false })).toBe('blunder');
    expect(classifyMove({ ...context, best: { mate: 3 }, played: { mate: 5 } })).toBe('best');
  });
  it('maps expectation loss to excellent, good, inaccuracies, mistakes and blunders', () => {
    const wdl = (win: number) => ({ wdl: [win, 0, 1000 - win] as [number, number, number] });
    const grade = (loss: number) =>
      classifyMove({ ...context, same: false, best: wdl(600), played: wdl(600 - loss) });
    expect(grade(10)).toBe('excellent');
    expect(grade(60)).toBe('good');
    expect(grade(150)).toBe('inaccuracy');
    expect(grade(300)).toBe('mistake');
    expect(grade(500)).toBe('blunder');
  });
  it('detects a real bishop offer but excludes ordinary exchanges and quiet opening moves', () => {
    expect(
      offersSacrifice({ initialFen: '4k3/5p2/8/8/2B5/8/8/4K3 w - - 0 1', moves: [] }, 'c4f7', [
        'c4f7',
        'e8f7',
      ]),
    ).toBe(true);
    expect(
      offersSacrifice({ initialFen: '4k3/8/4p3/3b4/2B1P3/8/8/4K3 w - - 0 1', moves: [] }, 'c4d5', [
        'c4d5',
        'e6d5',
        'e4d5',
      ]),
    ).toBe(false);
    expect(offersSacrifice({ initialFen: DEFAULT_POSITION, moves: [] }, 'e2e4', ['e2e4'])).toBe(
      false,
    );
  });
  it('recognises Morphy’s Opera Game queen sacrifice', () => {
    const game = importNotation(
      '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7',
    );
    expect(offersSacrifice(game, 'b3b8', ['b3b8', 'd7b8', 'd1d8'])).toBe(true);
  });
  it('keeps old stored reviews readable without invented special grades', () => {
    expect(moveGrade({ label: 'Matt verpasst' } as MoveQuality)).toBe('missed');
    expect(moveGrade({ label: 'Sehr gut' } as MoveQuality)).toBe('excellent');
    expect(REVIEW_VERSION).toBe(2);
  });
});
