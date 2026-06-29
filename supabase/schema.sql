-- Table: public.cached_apods
create table if not exists public.cached_apods (
  source_date date primary key,
  title text not null,
  explanation text not null,
  image_url text not null,
  copyright text,
  ascii text not null,
  char_set text not null,
  density numeric(3, 2) not null,
  invert boolean not null,
  caption text not null,
  fun_fact text not null,
  ai_style_used boolean not null,
  ai_caption_used boolean not null,
  used_fallback_image boolean not null,
  created_at timestamptz not null default now()
);
alter table public.cached_apods enable row level security;

-- Table: public.renders
create table if not exists public.renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  ascii text not null,
  caption text default '',
  fun_fact text default '',
  source_date date not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.renders enable row level security;

-- RLS policies: cached_apods
-- Allow read access to anyone
create policy "read public cached_apods" on public.cached_apods
  for select using (true);

-- Allow inserts only by authenticated users (via service role or user JWT)
create policy "insert authenticated cached_apods" on public.cached_apods
  for insert to authenticated with check (true);

-- RLS policies: renders
-- Allow users to read their own renders or any render explicitly set to public
create policy "read own or public" on public.renders
  for select using (auth.uid() = user_id or is_public = true);

-- Allow authenticated users to insert renders under their own user_id
create policy "insert own" on public.renders
  for insert to authenticated with check (auth.uid() = user_id);

-- Allow users to delete their own renders only
create policy "delete own" on public.renders
  for delete using (auth.uid() = user_id);
