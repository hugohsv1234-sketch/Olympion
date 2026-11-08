import { cloud } from './cloud';
import type { PlayerProfile } from './types';
export const SOCIAL_PROVIDERS = ['google', 'apple', 'custom:samsung'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export async function rankedRequest<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const client = cloud();
  if (!client)
    throw new Error(
      'Online-Konten werden noch eingerichtet. Du kannst bereits als Gast trainieren.',
    );
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error('Bitte melde dich zuerst an.');
  const response = await fetch('/api/ranking', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + data.session.access_token,
    },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response
    .json()
    .catch(() => ({ error: 'Die Online-Verbindung ist gerade nicht verfügbar.' }));
  if (!response.ok)
    throw new Error(result.error || 'Die Anfrage konnte nicht abgeschlossen werden.');
  return result as T;
}
export async function getPlayerProfile() {
  const client = cloud();
  if (!client) return null;
  const { data, error } = await client.rpc('ensure_player_profile');
  if (error)
    throw new Error(
      'Dein Online-Profil konnte nicht geladen werden. Bitte versuche es später erneut.',
    );
  return (Array.isArray(data) ? data[0] : data) as PlayerProfile | null;
}
export function avatarUrl(profile: PlayerProfile | null, fallback?: string) {
  if (profile?.avatar_path)
    return (
      cloud()?.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl +
      '?v=' +
      encodeURIComponent(profile.updated_at || '1')
    );
  return fallback;
}
export async function authProviders(): Promise<SocialProvider[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return [];
  const configured: SocialProvider[] = [];
  try {
    const r = await fetch(base + '/auth/v1/settings', {
      headers: { apikey: key },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const s = await r.json();
      for (const provider of SOCIAL_PROVIDERS)
        if (s.external?.[provider] === true) configured.push(provider);
    }
  } catch {}
  if (
    process.env.NEXT_PUBLIC_SAMSUNG_AUTH_ENABLED === 'true' &&
    !configured.includes('custom:samsung')
  )
    configured.push('custom:samsung');
  return configured;
}
