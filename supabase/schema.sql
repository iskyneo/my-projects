
-- Optional uploads metadata table and policies
create table if not exists public.uploads (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  piece_title text not null,
  kind text check (kind in ('audio','video')) not null,
  name text not null,
  size bigint,
  storage_path text not null,
  created_at timestamptz default now()
);
alter table public.uploads enable row level security;
create policy "insert own" on public.uploads for insert with check (auth.uid() = user_id);
create policy "select own" on public.uploads for select using (auth.uid() = user_id);
create policy "delete own" on public.uploads for delete using (auth.uid() = user_id);
