import { describe, it, expect } from 'vitest';
import { mergeRecords, validateBackup } from '../src/lib/storage';
import type { RecordItem } from '../src/lib/types';
const row = (at: number, device = 'a'): RecordItem => ({
  id: 'test',
  kind: 'session',
  value: { seconds: 1, at: 1, section: 'puzzles' },
  updatedAt: at,
  deviceId: device,
  pending: true,
});
describe('Datenkonflikte und Wiederimport', () => {
  it('weist unvollständige oder falsch typisierte Nutzdaten zurück', () => {
    expect(() =>
      validateBackup({
        schemaVersion: 1,
        records: [{ ...row(1), kind: 'settings', value: { name: 'Test', goal: 20 } }],
      }),
    ).toThrow();
    expect(() =>
      validateBackup({
        schemaVersion: 1,
        records: [{ ...row(1), kind: 'session', value: { seconds: -1, at: 0, section: 'arena' } }],
      }),
    ).toThrow();
  });
  it('führt identische IDs ohne Duplikate zusammen', () => {
    expect(mergeRecords([row(1)], [row(1)])).toHaveLength(1);
    expect(mergeRecords([row(2)], [row(1)])[0].updatedAt).toBe(2);
    expect(mergeRecords([row(1)], [row(2)])[0].updatedAt).toBe(2);
  });
  it('löst Zeitgleichstand auf allen Geräten identisch', () => {
    expect(mergeRecords([row(1, 'b')], [row(1, 'a')])[0].deviceId).toBe('b');
    expect(mergeRecords([row(1, 'a')], [row(1, 'b')])[0].deviceId).toBe('b');
  });
  it('validiert Schema, doppelte IDs und Zukunftszeiten', () => {
    expect(validateBackup({ schemaVersion: 1, records: [row(1)] })).toHaveLength(1);
    expect(() => validateBackup({ schemaVersion: 2, records: [] })).toThrow();
    expect(() => validateBackup({ schemaVersion: 1, records: [row(1), row(2)] })).toThrow();
    expect(() =>
      validateBackup({ schemaVersion: 1, records: [row(Date.now() + 2 * 86400000)] }),
    ).toThrow();
  });
});
