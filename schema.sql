-- Colapsei. E Agora? · Mapa do Colapso · schema mínimo
create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  marketing_consent boolean not null default false,
  marketing_consented_at timestamptz,
  privacy_ack_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_sessions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  map_version text not null,
  route text not null check (route in ('collapsei','cresci','alguem','sistema','reconstruir')),
  answer_1 text not null,
  answer_2 text not null,
  answer_3 text not null,
  result_title text not null,
  result_snapshot jsonb not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  page_url text,
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed')),
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists map_sessions_contact_idx on public.map_sessions(contact_id);
create index if not exists map_sessions_route_idx on public.map_sessions(route);
create index if not exists map_sessions_created_idx on public.map_sessions(created_at desc);

alter table public.contacts enable row level security;
alter table public.map_sessions enable row level security;

-- Nenhuma policy para anon/authenticated: leitura e escrita passam apenas pela função server-side usando service_role.
