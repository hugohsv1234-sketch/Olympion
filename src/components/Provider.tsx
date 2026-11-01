'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Kind, RecordItem, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { deviceId, loadRecords, saveRecords, mergeRecords } from '@/lib/storage';
import { cloud, syncRecords } from '@/lib/cloud';
interface ContextValue {
  records: RecordItem[];
  settings: Settings;
  user: User | null;
  ready: boolean;
  status: string;
  error: string | null;
  setError: (s: string | null) => void;
  put: <T>(id: string, kind: Kind, value: T) => Promise<void>;
  putMany: (rs: RecordItem[]) => Promise<void>;
  sync: () => Promise<void>;
  importGuest: () => Promise<void>;
}
const Context = createContext<ContextValue | null>(null);
let lastTimestamp = 0;
function timestamp() {
  return (lastTimestamp = Math.max(Date.now(), lastTimestamp + 1));
}
export function useStore() {
  const c = useContext(Context);
  if (!c) throw new Error('Provider fehlt');
  return c;
}
export default function Provider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<RecordItem[]>([]),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [authReady, setAuthReady] = useState(false),
    [status, setStatus] = useState('Speicher wird geöffnet …'),
    [error, setError] = useState<string | null>(null);
  const owner = user?.id || 'guest';
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const syncing = useRef(false);
  useEffect(() => {
    const client = cloud();
    if (!client) {
      setAuthReady(true);
      return;
    }
    let active = true;
    client.auth.getSession().then(({ data, error }) => {
      if (active) {
        setUser(data.session?.user || null);
        setAuthReady(true);
        if (error) setError(error.message);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user || null);
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    setReady(false);
    setRecords([]);
    loadRecords(owner)
      .then((rs) => {
        if (!cancelled) {
          setRecords(rs);
          setReady(true);
          setStatus(user ? 'Auf diesem Gerät gespeichert' : 'Auf diesem Gerät gespeichert · Gast');
        }
      })
      .catch((e) => setError(String(e.message)));
    return () => {
      cancelled = true;
    };
  }, [owner, authReady, user]);
  const putMany = useCallback(
    async (rs: RecordItem[]) => {
      try {
        await saveRecords(owner, rs);
        if (ownerRef.current === owner) {
          setRecords((old) => mergeRecords(old, rs));
          setStatus(
            owner === 'guest'
              ? 'Auf diesem Gerät gespeichert · Gast'
              : 'Auf diesem Gerät gespeichert · Synchronisierung ausstehend',
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
    [owner],
  );
  const put = useCallback(
    async <T,>(id: string, kind: Kind, value: T) => {
      await putMany([
        { id, kind, value, updatedAt: timestamp(), deviceId: deviceId(), pending: true },
      ]);
    },
    [putMany],
  );
  const sync = useCallback(async () => {
    if (!user || !navigator.onLine || syncing.current) return;
    syncing.current = true;
    setStatus('Wird synchronisiert …');
    try {
      const rs = await syncRecords(owner);
      if (ownerRef.current === owner) {
        setRecords((old) => mergeRecords(old, rs));
        setStatus('Synchronisiert');
      }
    } catch (e) {
      if (ownerRef.current === owner)
        setStatus(
          'Lokal gespeichert · Synchronisierung nicht möglich: ' +
            (e instanceof Error ? e.message : String(e)),
        );
    } finally {
      syncing.current = false;
    }
  }, [owner, user]);
  useEffect(() => {
    if (!ready || !user) return;
    void sync();
    const timer = setInterval(() => void sync(), 30000);
    const online = () => void sync();
    window.addEventListener('online', online);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', online);
    };
  }, [ready, user, sync]);
  const importGuest = useCallback(async () => {
    if (!user) return;
    const guest = await loadRecords('guest');
    const current = await loadRecords(owner);
    const ids = new Set(current.map((r) => r.id));
    await putMany(guest.filter((r) => !ids.has(r.id)).map((r) => ({ ...r, pending: true })));
    await sync();
  }, [owner, user, putMany, sync]);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...((records.find((r) => r.id === 'settings')?.value as Partial<Settings>) || {}),
  };
  return (
    <Context.Provider
      value={{
        records,
        settings,
        user,
        ready,
        status,
        error,
        setError,
        put,
        putMany,
        sync,
        importGuest,
      }}
    >
      {children}
    </Context.Provider>
  );
}
