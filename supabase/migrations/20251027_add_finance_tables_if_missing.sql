-- Cria tabelas necessárias se não existirem (não altera seus dados existentes)
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('IN','OUT')) not null,
  method text check (method in ('BANK','CASH')) not null default 'BANK',
  date timestamptz not null,
  original_date timestamptz,
  description text,
  amount numeric not null,
  matched boolean not null default false,
  matched_id uuid,
  deleted_at timestamptz
);

create table if not exists public.bank_statements (
  id uuid primary key default gen_random_uuid(),
  op_date timestamptz not null,
  description text,
  amount numeric not null,
  balance numeric,
  source_file text,
  hash_key text,
  matched boolean not null default false,
  matched_tx_id uuid,
  deleted_at timestamptz
);

create table if not exists public.employees_daily (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  diaria_semana numeric not null,
  diaria_fimsemana numeric not null,
  active boolean not null default true
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date unique not null,
  name text not null
);
