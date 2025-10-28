/*
  # Dashboard Águia - Machinery, Financial, and Configuration Tables
  
  1. Machinery & Rentals
    - `maquinas` - Equipment inventory with quantity support
    - `locacoes` - Rental transactions
    - `caucao_movimentos` - Security deposit tracking
    
  2. Financial Ledger System
    - `cash_ledger` - Unified transaction ledger (all movements)
    - `cash_batches` - Payment batch headers
    - `cash_batch_items` - Individual items in batches
    - `cash_closings` - Daily/periodic cash closings
    - `custos_fixos` - Fixed cost definitions
    
  3. Bank Reconciliation
    - `bank_transactions` - Imported bank statement lines
    - `reconciliation_rules` - Auto-match rule definitions
    - `accounting_export_mappings` - Export format mappings
    
  4. System Configuration
    - `config` - Global system settings (singleton)
    - `calendario_config` - Workday calendar settings
    - `feriados` - Holiday definitions
    
  5. Security
    - RLS enabled on all tables
    - Admin-only access policies
*/

-- Machinery inventory
CREATE TABLE IF NOT EXISTS maquinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text,
  custo_aquisicao numeric DEFAULT 0,
  vida_util_meses int DEFAULT 36,
  manutencao_pct_mensal numeric DEFAULT 0.015,
  preco_mercado_diaria numeric DEFAULT 0,
  preco_mercado_mensal numeric DEFAULT 0,
  status text DEFAULT 'disponivel',
  quantidade int DEFAULT 1,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_maquinas" ON maquinas;
CREATE POLICY "admins_access_maquinas"
  ON maquinas FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Seed machinery
DO $$
BEGIN
  INSERT INTO maquinas (nome, categoria, custo_aquisicao, vida_util_meses, manutencao_pct_mensal, preco_mercado_diaria, preco_mercado_mensal, status, quantidade)
  SELECT * FROM (VALUES
    ('Inversor de solda 140A Boxer', 'Solda', 543.40::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 1),
    ('Serra mármore Aika AL-CM110 1240w', 'Corte', 330.00::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 1),
    ('Andaime 1,0 x 1,5 (unidade)', 'Andaime', 155.00::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 20),
    ('Andaime 1,0 x 1,0 (unidade)', 'Andaime', 135.00::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 20),
    ('Plataforma metálica (unidade)', 'Andaime', 165.00::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 12),
    ('Nível laser GLL 1222 G', 'Medição', 585.00::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 1),
    ('Cortador TEC-75 (unidade)', 'Corte', 129.95::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 2),
    ('Betoneira 400L CSM 220V', 'Concretagem', 4433.57::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 1),
    ('Desempenadeira plástica (unidade)', 'Acabamento', 24.90::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 2),
    ('Desempenadeira aço dentada 38', 'Acabamento', 42.00::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 1),
    ('Desempenadeira aço L', 'Acabamento', 42.90::numeric, 36, 0.015::numeric, 0::numeric, 0::numeric, 'disponivel', 1)
  ) AS t(nome, categoria, custo_aquisicao, vida_util_meses, manutencao_pct_mensal, preco_mercado_diaria, preco_mercado_mensal, status, quantidade)
  WHERE NOT EXISTS (SELECT 1 FROM maquinas m WHERE m.nome = t.nome);
END $$;

-- Rental transactions
CREATE TABLE IF NOT EXISTS locacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id uuid REFERENCES maquinas(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES obras(id) ON DELETE SET NULL,
  data_inicio date NOT NULL,
  data_fim date,
  dias_locacao int DEFAULT 0,
  valor_diaria numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  caucao_valor numeric DEFAULT 0,
  caucao_status text DEFAULT 'pendente',
  status text DEFAULT 'ativa',
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE locacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_locacoes" ON locacoes;
CREATE POLICY "admins_access_locacoes"
  ON locacoes FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Security deposit movements
CREATE TABLE IF NOT EXISTS caucao_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locacao_id uuid REFERENCES locacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'devolucao', 'retencao')),
  valor numeric DEFAULT 0,
  data date NOT NULL,
  forma text CHECK (forma IN ('banco', 'dinheiro')),
  bank_account_id uuid REFERENCES bank_accounts(id),
  cash_book_id uuid REFERENCES cash_books(id),
  observacao text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE caucao_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_caucao" ON caucao_movimentos;
CREATE POLICY "admins_access_caucao"
  ON caucao_movimentos FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Unified cash ledger (all transactions)
CREATE TABLE IF NOT EXISTS cash_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  forma text NOT NULL CHECK (forma IN ('banco', 'dinheiro')),
  categoria text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id),
  cash_book_id uuid REFERENCES cash_books(id),
  obra_id uuid REFERENCES obras(id),
  funcionario_id uuid REFERENCES funcionarios_mensalistas(id),
  diarista_id uuid REFERENCES diaristas(id),
  maquina_id uuid REFERENCES maquinas(id),
  receita_id uuid REFERENCES receitas(id),
  conciliado boolean DEFAULT false,
  conciliacao_id uuid,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cash_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_cash_ledger" ON cash_ledger;
CREATE POLICY "admins_access_cash_ledger"
  ON cash_ledger FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Payment batches
CREATE TABLE IF NOT EXISTS cash_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  descricao text NOT NULL,
  data date NOT NULL,
  valor_total numeric DEFAULT 0,
  forma text CHECK (forma IN ('banco', 'dinheiro')),
  bank_account_id uuid REFERENCES bank_accounts(id),
  cash_book_id uuid REFERENCES cash_books(id),
  processado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_cash_batches" ON cash_batches;
CREATE POLICY "admins_access_cash_batches"
  ON cash_batches FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Batch items
CREATE TABLE IF NOT EXISTS cash_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES cash_batches(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  referencia_id uuid,
  referencia_tipo text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_batch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_batch_items" ON cash_batch_items;
CREATE POLICY "admins_access_batch_items"
  ON cash_batch_items FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Cash closings
CREATE TABLE IF NOT EXISTS cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_book_id uuid REFERENCES cash_books(id) ON DELETE CASCADE,
  data date NOT NULL,
  saldo_inicial numeric DEFAULT 0,
  total_entradas numeric DEFAULT 0,
  total_saidas numeric DEFAULT 0,
  saldo_final numeric DEFAULT 0,
  saldo_fisico numeric DEFAULT 0,
  diferenca numeric DEFAULT 0,
  observacao text,
  fechado_por text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_cash_closings" ON cash_closings;
CREATE POLICY "admins_access_cash_closings"
  ON cash_closings FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Fixed costs
CREATE TABLE IF NOT EXISTS custos_fixos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL,
  valor numeric DEFAULT 0,
  periodicidade text DEFAULT 'mensal',
  dia_vencimento int,
  ativo boolean DEFAULT true,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custos_fixos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_custos_fixos" ON custos_fixos;
CREATE POLICY "admins_access_custos_fixos"
  ON custos_fixos FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Bank transactions (imported statements)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE,
  data date NOT NULL,
  historico text NOT NULL,
  valor numeric NOT NULL,
  saldo numeric,
  referencia text,
  importacao_id uuid,
  conciliado boolean DEFAULT false,
  ledger_id uuid REFERENCES cash_ledger(id),
  divergencia text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_bank_transactions" ON bank_transactions;
CREATE POLICY "admins_access_bank_transactions"
  ON bank_transactions FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Reconciliation rules
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL,
  padrao text NOT NULL,
  categoria text,
  prioridade int DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_reconciliation_rules" ON reconciliation_rules;
CREATE POLICY "admins_access_reconciliation_rules"
  ON reconciliation_rules FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Export mappings
CREATE TABLE IF NOT EXISTS accounting_export_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  conta_contabil text NOT NULL,
  centro_custo text,
  historico_padrao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_export_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_export_mappings" ON accounting_export_mappings;
CREATE POLICY "admins_access_export_mappings"
  ON accounting_export_mappings FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Global configuration (singleton)
CREATE TABLE IF NOT EXISTS config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  margem_default numeric DEFAULT 0.30,
  desconto_semanal numeric DEFAULT 0.10,
  desconto_mensal numeric DEFAULT 0.15,
  impostos_pct numeric DEFAULT 0.08,
  caucao_pct numeric DEFAULT 0.20,
  impostos_empresa_modo text DEFAULT 'fixo' CHECK (impostos_empresa_modo IN ('fixo', 'percentual')),
  impostos_empresa_valor numeric DEFAULT 0,
  dias_uteis_padrao int DEFAULT 22,
  enable_conciliacao boolean DEFAULT true,
  nome_empresa text DEFAULT 'Águia Construções e Reforma',
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_config" ON config;
CREATE POLICY "admins_access_config"
  ON config FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Seed default config
INSERT INTO config (id, margem_default, desconto_semanal, desconto_mensal, impostos_pct, caucao_pct)
SELECT gen_random_uuid(), 0.30, 0.10, 0.15, 0.08, 0.20
WHERE NOT EXISTS (SELECT 1 FROM config);

-- Calendar configuration
CREATE TABLE IF NOT EXISTS calendario_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano int NOT NULL,
  mes int NOT NULL,
  dias_uteis int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ano, mes)
);

ALTER TABLE calendario_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_calendario_config" ON calendario_config;
CREATE POLICY "admins_access_calendario_config"
  ON calendario_config FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Holidays
CREATE TABLE IF NOT EXISTS feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text DEFAULT 'nacional',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_feriados" ON feriados;
CREATE POLICY "admins_access_feriados"
  ON feriados FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));