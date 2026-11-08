import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { it, expect } from 'vitest';
it('schützt echte Profile, Elo und Bilder per RLS und verbucht Belohnungen atomar einmal', async () => {
  const db = new PGlite();
  const a = '00000000-0000-4000-8000-00000000000a',
    b = '00000000-0000-4000-8000-00000000000b',
    c = '00000000-0000-4000-8000-00000000000c';
  const role = async (name: string, id = '') => {
    await db.exec('reset role;set role ' + name);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,update on storage.objects to anon,authenticated;`,
    );
    await db.exec(await readFile('supabase/migrations/001_user_records.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/002_profiles_and_rankings.sql', 'utf8'));
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'private@example.com',now(),'{\"display_name\":\"Athene\"}'),($2,'not-confirmed@example.com',null,'{}'),($3,'other@example.com',now(),'{\"display_name\":\"Zeus\"}')",
      [a, b, c],
    );
    await role('anon');
    const publicRows = await db.query<Record<string, unknown>>('select * from public.leaderboard');
    expect(publicRows.rows).toHaveLength(2);
    expect(Object.keys(publicRows.rows[0])).not.toContain('email');
    expect(publicRows.rows.map((p) => p.user_id)).not.toContain(b);
    await expect(db.query('select * from public.elo_events')).rejects.toThrow();
    await role('authenticated', b);
    await expect(db.query('select * from public.ensure_player_profile()')).rejects.toThrow();
    await role('authenticated', a);
    expect((await db.query('select * from public.ensure_player_profile()')).rows).toHaveLength(1);
    await expect(
      db.query('update public.player_profiles set elo=99999 where user_id=$1', [a]),
    ).rejects.toThrow();
    await expect(
      db.query("select public.award_verified_elo($1,'puzzle','fake',1)", [a]),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "update public.player_profiles set display_name='Changed' where user_id=$1 returning user_id",
          [c],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.player_profiles set display_name='Strategos' where user_id=$1 returning display_name",
          [a],
        )
      ).rows[0],
    ).toEqual({ display_name: 'Strategos' });
    await expect(
      db.query('update public.player_profiles set avatar_path=$1 where user_id=$2', [
        c + '/avatar.webp',
        a,
      ]),
    ).rejects.toThrow();
    await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [
      a + '/avatar.webp',
    ]);
    await expect(
      db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [
        c + '/avatar.webp',
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.ranked_games(user_id,level,color,result) values($1,20,'w','1-0')",
        [a],
      ),
    ).rejects.toThrow();
    await role('service_role');
    expect(
      (
        await db.query<{ n: number }>(
          "select public.award_verified_elo($1,'puzzle','puzzle-1',1) as n",
          [a],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await db.query<{ n: number }>(
          "select public.award_verified_elo($1,'puzzle','puzzle-1',1) as n",
          [a],
        )
      ).rows[0].n,
    ).toBe(0);
    for (const level of [1, 20]) {
      const started = (
        await db.query<{ id: string }>('select * from public.start_ranked_game($1,$2,$3)', [
          a,
          level,
          'b',
        ])
      ).rows[0];
      const line = JSON.stringify(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
      const first = (
        await db.query<{ n: number }>(
          "select public.commit_ranked_game($1,$2,0,$3::jsonb,'0-1') as n",
          [a, started.id, line],
        )
      ).rows[0].n;
      expect(first).toBe(level === 1 ? 3 : 20);
      const repeated = (
        await db.query<{ n: number }>(
          "select public.commit_ranked_game($1,$2,0,$3::jsonb,'0-1') as n",
          [a, started.id, line],
        )
      ).rows[0].n;
      expect(repeated).toBe(0);
    }
    await role('authenticated', a);
    const own = (
      await db.query<{ elo: number; puzzles_solved: number; bots_won: number }>(
        'select * from public.player_profiles where user_id=$1',
        [a],
      )
    ).rows[0];
    expect(Number(own.elo)).toBe(24);
    expect(own.puzzles_solved).toBe(1);
    expect(own.bots_won).toBe(2);
    await role('authenticated', c);
    expect((await db.query('select * from public.elo_events')).rows).toHaveLength(0);
    expect((await db.query('select * from public.ranked_games')).rows).toHaveLength(0);
    const rankedWrite = () =>
      db.query<{ n: number }>(
        'select public.ranked_write(\'puzzle\', \'{"puzzle_id":"puzzle-2"}\') as n',
      );
    await expect(rankedWrite()).rejects.toThrow('nicht autorisiert');
    await db.exec('reset role');
    await db.query(
      "insert into olympion_private.ranking_key(digest) values(sha256(convert_to('test-key','UTF8')))",
    );
    await role('authenticated', a);
    await db.query("select set_config('request.headers',$1,false)", [
      JSON.stringify({ 'x-olympion-ranking-key': 'wrong-key' }),
    ]);
    await expect(rankedWrite()).rejects.toThrow('nicht autorisiert');
    await db.query("select set_config('request.headers',$1,false)", [
      JSON.stringify({ 'x-olympion-ranking-key': 'test-key' }),
    ]);
    expect((await rankedWrite()).rows[0].n).toBe(1);
    expect((await rankedWrite()).rows[0].n).toBe(0);
  } finally {
    await db.close();
  }
}, 30000);
