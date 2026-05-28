create table if not exists public.precomap_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.precomap_snapshots enable row level security;

drop policy if exists "precomap_snapshots_select_own" on public.precomap_snapshots;
drop policy if exists "precomap_snapshots_insert_own" on public.precomap_snapshots;
drop policy if exists "precomap_snapshots_update_own" on public.precomap_snapshots;

create policy "precomap_snapshots_select_own"
on public.precomap_snapshots
for select
to authenticated
using (auth.uid() = user_id);

create policy "precomap_snapshots_insert_own"
on public.precomap_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "precomap_snapshots_update_own"
on public.precomap_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
