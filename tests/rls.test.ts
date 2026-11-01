import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { it, expect } from 'vitest';

it('führt die echte Migration aus und schützt Lesen/Schreiben zwischen zwei JWT-Nutzer-IDs', async () => {
  const db = new PGlite();
  const a = '00000000-0000-4000-8000-00000000000a',
    b = '00000000-0000-4000-8000-00000000000b';
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;insert into auth.users(id) values('${a}'),('${b}');`,
    );
    await db.exec(await readFile('supabase/migrations/001_user_records.sql', 'utf8'));
    await db.exec('set role authenticated');
    const login = (id: string) =>
      db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    const sync = (seconds: number, at = 1000) =>
      db.query('select public.sync_records($1::jsonb)', [
        JSON.stringify([
          {
            id: 'test-record',
            kind: 'session',
            payload: { seconds, at: 1000, section: 'puzzles' },
            client_updated_at: at,
            device_id: a,
          },
        ]),
      ]);
    await login(a);
    await sync(10);
    expect((await db.query('select * from public.user_records')).rows).toHaveLength(1);
    await sync(5, 500);
    expect(
      (await db.query<{ payload: { seconds: number } }>('select payload from public.user_records'))
        .rows[0].payload.seconds,
    ).toBe(10);
    await login(b);
    expect((await db.query('select * from public.user_records')).rows).toHaveLength(0);
    expect(
      (await db.query('update public.user_records set client_updated_at=2000 returning id')).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        'insert into public.user_records(user_id,id,kind,payload,client_updated_at,device_id) values($1,$2,$3,$4::jsonb,$5,$6)',
        [a, 'forbidden', 'session', JSON.stringify({ seconds: 1, at: 1 }), 2000, b],
      ),
    ).rejects.toThrow();
    await sync(20);
    expect(
      (await db.query<{ user_id: string }>('select user_id from public.user_records')).rows[0]
        .user_id,
    ).toBe(b);
    await expect(
      db.query('select public.sync_records($1::jsonb)', [
        JSON.stringify([
          {
            id: 'bad',
            kind: 'settings',
            payload: { name: 'broken', goal: 99 },
            client_updated_at: 1000,
            device_id: b,
          },
        ]),
      ]),
    ).rejects.toThrow();
    await db.exec('reset role;set role anon');
    await expect(db.query('select * from public.user_records')).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 30000);
