/*
  # Dashboard Águia - Core Schema Setup
  
  1. Admin Access Control
    - `app_admins` - Admin email whitelist for RLS
    
  2. Account Management
    - `bank_accounts` - Itaú bank account tracking
    - `cash_books` - Physical cash vault tracking
    
  3. Projects & Revenue
    - `obras` - Construction projects
    - `receitas` - Revenue and receivables per project
    
  4. Personnel Management
    - `funcionarios_mensalistas` - Monthly employees with VT support
    - `diaristas` - Daily workers database
    - `diarista_ponto` - Daily worker time tracking
    - `diarista_lancamentos` - Daily worker payment batches
    - `mensalista_faltas` - Monthly employee absences for VT adjustment
    - `vt_ajustes` - Transportation voucher adjustments
    
  5. Equipment & Rentals
    - `maquinas` - Machinery inventory
    - `locacoes` - Rental transactions
    - `caucao_movimentos` - Security deposit movements
    
  6. Financial Tracking
    - `custos_fixos` - Fixed costs configuration
    - `cash_ledger` - All financial transactions (unified)
    - `cash_batches` - Payment batch grouping
    - `cash_batch_items` - Individual items in batches
    - `cash_closings` - Cash register closings
    
  7. Bank Reconciliation
    - `bank_transactions` - Imported bank statements
    - `reconciliation_rules` - Auto-matching rules
    - `accounting_export_mappings` - Export configurations
    
  8. System Configuration
    - `config` - Global system settings
    - `calendario_config` - Calendar/workday configuration
    - `feriados` - Holiday tracking
    
  9. Security
    - RLS enabled on all tables
    - Admin-only policies using app_admins
*/

-- Admin access control
CREATE TABLE IF NOT EXISTS app_admins (
  email text PRIMARY KEY
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_admins" ON app_admins;
CREATE POLICY "admins_manage_admins"
  ON app_admins FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Seed admin
INSERT INTO app_admins(email) VALUES ('yuricv89@hotmail.com')
ON CONFLICT (email) DO NOTHING;

-- Bank accounts (Itaú)
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  banco text NOT NULL,
  tipo text NOT NULL,
  saldo_inicial numeric DEFAULT 0,
  saldo_atual numeric DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_bank_accounts" ON bank_accounts;
CREATE POLICY "admins_access_bank_accounts"
  ON bank_accounts FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Cash books (Physical money)
CREATE TABLE IF NOT EXISTS cash_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL,
  saldo_inicial numeric DEFAULT 0,
  saldo_atual numeric DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cash_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_cash_books" ON cash_books;
CREATE POLICY "admins_access_cash_books"
  ON cash_books FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Seed default vaults
INSERT INTO bank_accounts (nome, banco, tipo, saldo_inicial, saldo_atual)
SELECT 'Itaú – Conta Principal', 'Itaú', 'corrente', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM bank_accounts WHERE nome = 'Itaú – Conta Principal');

INSERT INTO cash_books (nome, tipo, saldo_inicial, saldo_atual)
SELECT 'Caixa Dinheiro (Físico)', 'dinheiro', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM cash_books WHERE nome = 'Caixa Dinheiro (Físico)');

-- Construction projects
CREATE TABLE IF NOT EXISTS obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  nome_obra text NOT NULL,
  endereco text,
  responsavel text,
  condicoes_pagamento text,
  status text DEFAULT 'ativa',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_obras" ON obras;
CREATE POLICY "admins_access_obras"
  ON obras FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Revenues and receivables
CREATE TABLE IF NOT EXISTS receitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor_total numeric DEFAULT 0,
  parcela int DEFAULT 1,
  parcelas int DEFAULT 1,
  vencimento date,
  recebido boolean DEFAULT false,
  data_recebimento date,
  origem text,
  forma_recebimento text CHECK (forma_recebimento IN ('banco', 'dinheiro')),
  meio_banco text,
  bank_account_id uuid REFERENCES bank_accounts(id),
  cash_book_id uuid REFERENCES cash_books(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_receitas" ON receitas;
CREATE POLICY "admins_access_receitas"
  ON receitas FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Monthly employees
CREATE TABLE IF NOT EXISTS funcionarios_mensalistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  funcao text NOT NULL,
  tipo_vinculo text DEFAULT 'CLT',
  salario_base numeric DEFAULT 0,
  ajuda_custo numeric DEFAULT 0,
  vale_salario numeric DEFAULT 0,
  aplica_encargos boolean DEFAULT true,
  encargos_pct numeric DEFAULT 0,
  inss_pct numeric DEFAULT 0,
  fgts_pct numeric DEFAULT 0,
  outros_encargos_pct numeric DEFAULT 0,
  usa_adiantamento boolean DEFAULT false,
  recebe_vt boolean DEFAULT false,
  vt_valor_unitario_dia numeric DEFAULT 0,
  vt_dias_uteis_override int,
  obra_id uuid REFERENCES obras(id),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE funcionarios_mensalistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_mensalistas" ON funcionarios_mensalistas;
CREATE POLICY "admins_access_mensalistas"
  ON funcionarios_mensalistas FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Seed monthly employees
INSERT INTO funcionarios_mensalistas
(nome, funcao, salario_base, ajuda_custo, vale_salario, recebe_vt, vt_valor_unitario_dia, ativo)
SELECT * FROM (VALUES
  ('Yuri Linero', 'Administrativo', 4500, 0, 0, false, 0, true),
  ('David Parzanese', 'Engenheiro', 25000, 0, 0, false, 0, true),
  ('Vanderlei Piovezani', 'Operacional', 3200, 0, 0, false, 0, true),
  ('Marcelo Parzanese', 'Operacional', 4500, 500, 0, false, 0, true),
  ('Antônio Ferreira (Neto)', 'Mestre de Obra', 4800, 500, 3200, false, 0, true),
  ('Silas Martins', 'Almoxarifado', 1680, 0, 1120, true, 22.90, true)
) AS t(nome, funcao, salario_base, ajuda_custo, vale_salario, recebe_vt, vt_valor_unitario_dia, ativo)
WHERE NOT EXISTS (SELECT 1 FROM funcionarios_mensalistas f WHERE f.nome = t.nome);

-- Daily workers
CREATE TABLE IF NOT EXISTS diaristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  funcao text NOT NULL,
  valor_diaria numeric DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE diaristas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_diaristas" ON diaristas;
CREATE POLICY "admins_access_diaristas"
  ON diaristas FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Seed daily workers
INSERT INTO diaristas (nome, funcao, valor_diaria, ativo)
SELECT * FROM (VALUES
  ('Iury Freires do Nascimento', 'Ajudante', 150, true),
  ('Endnaldo da Silva', 'Ajudante', 150, true),
  ('Vitor Emanuel Tavares', 'Pedreiro', 190, true),
  ('Ronaldo de Souza', 'Pedreiro', 220, true),
  ('José Nivaldo dos Santos', 'Pedreiro', 240, true),
  ('Robério Ribeiro dos Santos', 'Pedreiro', 400, true),
  ('Luzinaldo Alves Pinheiro', 'Ajudante', 200, true),
  ('José Maria Chagas', 'Ajudante', 150, true),
  ('Orlando de Souza', 'Pedreiro', 210, true),
  ('José Valricelio do Nascimento', 'Ajudante', 150, true),
  ('Valdina Barroso do Nascimento', 'Ajudante', 150, true)
) AS t(nome, funcao, valor_diaria, ativo)
WHERE NOT EXISTS (SELECT 1 FROM diaristas d WHERE d.nome = t.nome);

-- Daily worker time tracking
CREATE TABLE IF NOT EXISTS diarista_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diarista_id uuid REFERENCES diaristas(id) ON DELETE CASCADE,
  data date NOT NULL,
  presente boolean DEFAULT true,
  obra_id uuid REFERENCES obras(id),
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE diarista_ponto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_diarista_ponto" ON diarista_ponto;
CREATE POLICY "admins_access_diarista_ponto"
  ON diarista_ponto FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Daily worker payments
CREATE TABLE IF NOT EXISTS diarista_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diarista_id uuid REFERENCES diaristas(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  dias_trabalhados int DEFAULT 0,
  valor_diaria numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  data_pagamento date NOT NULL,
  pago boolean DEFAULT false,
  cash_book_id uuid REFERENCES cash_books(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE diarista_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_diarista_lancamentos" ON diarista_lancamentos;
CREATE POLICY "admins_access_diarista_lancamentos"
  ON diarista_lancamentos FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Monthly employee absences
CREATE TABLE IF NOT EXISTS mensalista_faltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid REFERENCES funcionarios_mensalistas(id) ON DELETE CASCADE,
  data date NOT NULL,
  justificada boolean DEFAULT false,
  observacao text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mensalista_faltas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_mensalista_faltas" ON mensalista_faltas;
CREATE POLICY "admins_access_mensalista_faltas"
  ON mensalista_faltas FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- VT adjustments
CREATE TABLE IF NOT EXISTS vt_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid REFERENCES funcionarios_mensalistas(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  mes_aplicacao date NOT NULL,
  faltas_quantidade int DEFAULT 0,
  valor_ajuste numeric DEFAULT 0,
  aplicado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vt_ajustes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_vt_ajustes" ON vt_ajustes;
CREATE POLICY "admins_access_vt_ajustes"
  ON vt_ajustes FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));