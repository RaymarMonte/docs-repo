-- 0001_init.sql — docs-repo initial schema
-- Run in the Supabase SQL editor (or via the Supabase CLI).
-- Covers: profiles + documents + document_shares, the new-user trigger that
-- populates profiles (so share-by-email works), a non-recursive RLS helper,
-- and split RLS policies. See docs/PLAN.md for the rationale.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id    uuid primary key references auth.users (id) on delete cascade,
  email text not null
);

create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'Untitled',
  content    text not null default '',          -- Tiptap HTML
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_shares (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  shared_with uuid not null references auth.users (id) on delete cascade,
  permission  text not null check (permission in ('view', 'edit')),
  created_at  timestamptz not null default now(),
  unique (document_id, shared_with)
);

-- Lookup indexes for the RLS subqueries / dashboard split.
create index if not exists documents_owner_id_idx
  on public.documents (owner_id);
create index if not exists document_shares_shared_with_idx
  on public.document_shares (shared_with);
create index if not exists document_shares_document_id_idx
  on public.document_shares (document_id);

-- ---------------------------------------------------------------------------
-- New-user trigger — mirror auth.users into public.profiles
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper — breaks the documents <-> document_shares recursion cycle.
-- security definer so it does not re-trigger documents' RLS when called
-- from document_shares policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_document_owner(doc uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.documents
    where id = doc and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.documents       enable row level security;
alter table public.document_shares enable row level security;

-- profiles — public read of (id, email) so share-by-email can resolve a user.
-- Documented tradeoff (PLAN.md, Option A). No client writes: trigger only.
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
  on public.profiles for select
  using (true);

-- documents — split policies (never collapse into a single ALL policy).
drop policy if exists documents_select on public.documents;
create policy documents_select
  on public.documents for select
  using (
    owner_id = auth.uid()
    or id in (
      select document_id from public.document_shares
      where shared_with = auth.uid()
    )
  );

drop policy if exists documents_insert on public.documents;
create policy documents_insert
  on public.documents for insert
  with check (owner_id = auth.uid());

-- UPDATE needs both USING (which rows are visible to update) and WITH CHECK
-- (what the row may become). Edit access lives ONLY here — viewers are excluded.
drop policy if exists documents_update on public.documents;
create policy documents_update
  on public.documents for update
  using (
    owner_id = auth.uid()
    or id in (
      select document_id from public.document_shares
      where shared_with = auth.uid() and permission = 'edit'
    )
  )
  with check (
    owner_id = auth.uid()
    or id in (
      select document_id from public.document_shares
      where shared_with = auth.uid() and permission = 'edit'
    )
  );

drop policy if exists documents_delete on public.documents;
create policy documents_delete
  on public.documents for delete
  using (owner_id = auth.uid());

-- document_shares — non-recursive via is_document_owner() helper.
drop policy if exists document_shares_select on public.document_shares;
create policy document_shares_select
  on public.document_shares for select
  using (
    shared_with = auth.uid()
    or public.is_document_owner(document_id)
  );

drop policy if exists document_shares_insert on public.document_shares;
create policy document_shares_insert
  on public.document_shares for insert
  with check (public.is_document_owner(document_id));

drop policy if exists document_shares_delete on public.document_shares;
create policy document_shares_delete
  on public.document_shares for delete
  using (public.is_document_owner(document_id));
