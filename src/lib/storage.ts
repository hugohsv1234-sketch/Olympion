import { uuid } from './id';
import { validPayload } from './validation';
import type { RecordItem } from './types';
export const DATABASE_VERSION = 1;
let promise: Promise<IDBDatabase> | null = null;
function database() {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('Dieser Browser erlaubt keinen lokalen Speicher.'));
  return (promise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('olympion', DATABASE_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('records')) {
        const s = db.createObjectStore('records', { keyPath: 'key' });
        s.createIndex('owner', 'owner');
      }
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => {
        r.result.close();
        promise = null;
      };
      resolve(r.result);
    };
    r.onerror = () => {
      promise = null;
      reject(
        new Error(
          'Lokaler Speicher kann nicht geöffnet werden. Bitte Browserberechtigungen prüfen.',
        ),
      );
    };
    r.onblocked = () =>
      reject(new Error('Bitte andere OLYMPION-Tabs schließen, um die Datenbank zu aktualisieren.'));
  }));
}
export function deviceId() {
  let id = localStorage.getItem('olympion-device');
  if (!id) {
    id = uuid();
    localStorage.setItem('olympion-device', id);
  }
  return id;
}
export async function loadRecords(owner: string): Promise<RecordItem[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const r = tx.objectStore('records').index('owner').getAll(owner);
    r.onsuccess = () =>
      resolve(
        r.result.map((row) => ({
          id: row.id,
          kind: row.kind,
          value: row.value,
          updatedAt: row.updatedAt,
          deviceId: row.deviceId,
          pending: row.pending,
        })),
      );
    r.onerror = () => reject(r.error);
  });
}
export async function saveRecords(owner: string, records: RecordItem[]) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    for (const r of records) {
      const key = owner + ':' + r.id,
        request = store.get(key);
      request.onsuccess = () => {
        if (!request.result || !newer(request.result, r)) store.put({ ...r, key, owner });
      };
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        new Error(
          'Daten konnten nicht gespeichert werden. Speicherplatz und Browserberechtigungen prüfen.',
        ),
      );
    tx.onerror = () => reject(tx.error);
  });
}
export function newer(a: RecordItem, b: RecordItem) {
  return a.updatedAt > b.updatedAt || (a.updatedAt === b.updatedAt && a.deviceId > b.deviceId);
}
export function mergeRecords(local: RecordItem[], incoming: RecordItem[]) {
  const map = new Map(local.map((r) => [r.id, r]));
  for (const r of incoming) {
    const old = map.get(r.id);
    if (!old || newer(r, old) || (r.updatedAt === old.updatedAt && r.deviceId === old.deviceId))
      map.set(r.id, r);
  }
  return [...map.values()];
}
const kinds = ['settings', 'attempt', 'game', 'analysis', 'lesson', 'review', 'session', 'mistake'];
export function validateBackup(input: unknown): RecordItem[] {
  if (
    !input ||
    typeof input !== 'object' ||
    !('schemaVersion' in input) ||
    input.schemaVersion !== 1 ||
    !('records' in input) ||
    !Array.isArray(input.records) ||
    input.records.length > 20000
  )
    throw new Error('Ungültiges OLYMPION-Backup (Version 1 erwartet).');
  const ids = new Set<string>();
  for (const r of input.records) {
    if (
      !r ||
      typeof r !== 'object' ||
      typeof r.id !== 'string' ||
      !/^[A-Za-z0-9:._-]{1,180}$/.test(r.id) ||
      ids.has(r.id) ||
      !kinds.includes(r.kind) ||
      !Number.isSafeInteger(r.updatedAt) ||
      r.updatedAt < 0 ||
      r.updatedAt > Date.now() + 86400000 ||
      typeof r.deviceId !== 'string' ||
      !('value' in r)
    )
      throw new Error('Beschädigter oder doppelter Datensatz im Backup.');
    ids.add(r.id);
    if (!validPayload(r.kind, r.value)) throw new Error('Ungültige Daten im Backup: ' + r.kind);
  }
  return input.records as RecordItem[];
}
export function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
