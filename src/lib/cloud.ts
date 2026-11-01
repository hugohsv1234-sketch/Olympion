import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadRecords, saveRecords, mergeRecords } from './storage';
import type { RecordItem } from './types';
let instance: SupabaseClient | undefined;
export const cloudConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
export function cloud() {
  if (!cloudConfigured) return null;
  return (instance ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
  ));
}
export async function syncRecords(owner: string) {
  const client = cloud();
  if (!client) throw new Error('Kontosynchronisierung wurde noch nicht eingerichtet.');
  const queue = (await loadRecords(owner)).filter((r) => r.pending);
  for (let i = 0; i < queue.length; i += 50) {
    const batch = queue.slice(i, i + 50);
    const { error } = await client.rpc('sync_records', {
      rows: batch.map((r) => ({
        id: r.id,
        kind: r.kind,
        payload: r.value,
        client_updated_at: r.updatedAt,
        device_id: r.deviceId,
      })),
    });
    if (error) throw new Error(error.message);
    const current = await loadRecords(owner);
    const acknowledged = batch.flatMap((r) => {
      const now = current.find((x) => x.id === r.id);
      return now && now.updatedAt === r.updatedAt && now.deviceId === r.deviceId
        ? [{ ...now, pending: false }]
        : [];
    });
    await saveRecords(owner, acknowledged);
  }
  const remote: RecordItem[] = [];
  for (let from = 0; from < 20000; from += 500) {
    const { data, error } = await client
      .from('user_records')
      .select('id,kind,payload,client_updated_at,device_id')
      .order('id')
      .range(from, from + 499);
    if (error) throw new Error(error.message);
    for (const r of data || [])
      remote.push({
        id: r.id,
        kind: r.kind,
        value: r.payload,
        updatedAt: r.client_updated_at,
        deviceId: r.device_id,
        pending: false,
      });
    if (!data || data.length < 500) break;
  }
  const local = await loadRecords(owner);
  const merged = mergeRecords(local, remote);
  await saveRecords(owner, merged);
  return merged;
}
