import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { saveRecords, loadRecords } from '../src/lib/storage';
import type { RecordItem } from '../src/lib/types';
const row = (updatedAt: number, seconds: number): RecordItem => ({
  id: 'same-id',
  kind: 'session',
  value: { at: 1, seconds, section: 'puzzles' },
  updatedAt,
  deviceId: '00000000-0000-4000-8000-000000000001',
  pending: true,
});
it('isoliert zwei Konten und das Gastprofil in IndexedDB', async () => {
  await saveRecords('user-a', [row(1, 10)]);
  await saveRecords('user-b', [row(2, 20)]);
  await saveRecords('guest', [row(3, 30)]);
  expect((await loadRecords('user-a'))[0].value).toEqual({
    at: 1,
    seconds: 10,
    section: 'puzzles',
  });
  expect((await loadRecords('user-b'))[0].value).toEqual({
    at: 1,
    seconds: 20,
    section: 'puzzles',
  });
  expect((await loadRecords('guest'))[0].value).toEqual({ at: 1, seconds: 30, section: 'puzzles' });
});
it('verhindert, dass ein älterer Import eine neue lokale Änderung überschreibt', async () => {
  await saveRecords('transaction-test', [row(20, 20)]);
  await saveRecords('transaction-test', [row(10, 10)]);
  expect((await loadRecords('transaction-test'))[0].updatedAt).toBe(20);
  await Promise.all([
    saveRecords('transaction-test', [row(22, 22)]),
    saveRecords('transaction-test', [row(21, 21)]),
  ]);
  expect((await loadRecords('transaction-test'))[0].updatedAt).toBe(22);
});
