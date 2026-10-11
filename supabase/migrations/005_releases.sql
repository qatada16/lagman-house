-- Migration 005: app releases are written only by the owner (SQL Editor) or the EAS build webhook,
-- and latest_release compares version and build number. Run after 004. Safe to re-run.

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  build_number int not null default 0,
  apk_url text,
  notes text,
  mandatory boolean not null default false,
  released_at timestamptz not null default now()
);
alter table public.app_releases add column if not exists build_id text;
alter table public.app_releases add column if not exists expires_at timestamptz;
create unique index if not exists app_releases_build_id_key on public.app_releases(build_id);

delete from public.app_releases where apk_url is null or apk_url !~ '^https://';
alter table public.app_releases alter column apk_url set not null;
alter table public.app_releases drop constraint if exists app_releases_apk_url_https;
alter table public.app_releases add constraint app_releases_apk_url_https check (apk_url ~ '^https://\S+$');

alter table public.app_releases enable row level security;
drop policy if exists app_releases_admin on public.app_releases;
revoke all on public.app_releases from anon, authenticated;

create or replace function public.version_key(p_version text) returns numeric[]
language sql immutable set search_path = public as $$
  with parts as (
    select coalesce(nullif(regexp_replace(part, '\D', '', 'g'), '')::numeric, 0) as n, ord
    from unnest(string_to_array(coalesce(p_version, ''), '.')) with ordinality as t(part, ord)
  )
  select coalesce((select array_agg(n order by ord) from parts), '{}'::numeric[])
    || array_fill(0::numeric, array[greatest(0, 4 - (select count(*) from parts)::int)]);
$$;

drop function if exists public.latest_release();
create or replace function public.latest_release(p_version text default null, p_build int default null) returns jsonb
language sql stable security definer set search_path = public as $$
  with latest as (
    select r.*
    from public.app_releases r
    where r.expires_at is null or r.expires_at > now()
    order by public.version_key(r.version) desc, r.build_number desc, r.released_at desc
    limit 1
  )
  select coalesce((
    select to_jsonb(l) || jsonb_build_object('mandatory', l.mandatory or exists (
      select 1 from public.app_releases m
      where m.mandatory and p_version is not null
        and (public.version_key(m.version) > public.version_key(p_version)
          or (public.version_key(m.version) = public.version_key(p_version) and coalesce(p_build, 0) > 0 and m.build_number > p_build))
        and (public.version_key(m.version) < public.version_key(l.version)
          or (public.version_key(m.version) = public.version_key(l.version) and m.build_number <= l.build_number))
    ))
    from latest l
  ), 'null'::jsonb);
$$;
grant execute on function public.latest_release(text, int) to anon, authenticated;
