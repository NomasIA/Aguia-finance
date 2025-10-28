/*
  # Receitas Parcelas and Payment Tracking System

  ## 1. Receitas Parcelas (Installments)

  New table `receitas_parcelas` to manage individual installments:
  - `id` - Unique identifier
  - `receita_id` - Link to parent receita
  - `numero` - Installment number (1, 2, 3, etc.)
  - `valor` - Installment amount
  - `vencimento` - Due date
  - `recebido` - Received status
  - `data_recebimento` - Date received
  - `conciliado` - Reconciliation status
  - `forma_recebimento` - Payment method (banco/dinheiro)
  - `meio_banco` - Bank payment method detail
  - `deleted_at` - Soft delete timestamp
  - `created_at` - Creation timestamp

  ## 2. Installment Generation Fields

  Add to `receitas` table:
  - `periodicidade` - Payment frequency (mensal, quinzenal, etc.)
  - `dia_fixo` - Fixed day of month for due dates
  - `ajustar_fim_de_semana` - Auto-adjust weekend due dates
  - `fim_do_mes` - Use last day of month if day doesn't exist

  ## 3. Payment Tracking Tables

  New table `mensalista_pagamentos` for monthly employee payments:
  - Track each monthly payment with duplicate prevention
  - Link to funcionario_id and mes_referencia

  New table `contratos_locacao` for machinery rental contracts:
  - Store rental contracts with obra linkage
  - Track rental periods and values

  ## 4. Security

  - RLS enabled on all new tables
  - Admin-only access policies

  ## 5. Important Notes

  - Soft delete preserves data for auditing
  - Unique constraints prevent duplicate payments
  - Indexes optimize query performance
*/

-- Add soft delete and installment fields to receitas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receitas' AND column_name = 'deleted_at') THEN
    ALTER TABLE receitas ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receitas' AND column_name = 'periodicidade') THEN
    ALTER TABLE receitas ADD COLUMN periodicidade text DEFAULT 'mensal';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receitas' AND column_name = 'dia_fixo') THEN
    ALTER TABLE receitas ADD COLUMN dia_fixo int;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receitas' AND column_name = 'ajustar_fim_de_semana') THEN
    ALTER TABLE receitas ADD COLUMN ajustar_fim_de_semana boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receitas' AND column_name = 'fim_do_mes') THEN
    ALTER TABLE receitas ADD COLUMN fim_do_mes boolean DEFAULT false;
  END IF;
END $$;

-- Create receitas_parcelas table
CREATE TABLE IF NOT EXISTS receitas_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receita_id uuid REFERENCES receitas(id) ON DELETE CASCADE,
  numero int NOT NULL,
  valor numeric NOT NULL,
  vencimento date NOT NULL,
  recebido boolean DEFAULT false,
  data_recebimento date,
  conciliado boolean DEFAULT false,
  forma_recebimento text CHECK (forma_recebimento IN ('banco', 'dinheiro')) DEFAULT 'banco',
  meio_banco text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receitas_parcelas_receita ON receitas_parcelas(receita_id);
CREATE INDEX IF NOT EXISTS idx_receitas_parcelas_deleted ON receitas_parcelas(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_receitas_parcelas_unica ON receitas_parcelas(receita_id, numero) WHERE deleted_at IS NULL;

ALTER TABLE receitas_parcelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_receitas_parcelas" ON receitas_parcelas;
CREATE POLICY "admins_access_receitas_parcelas"
  ON receitas_parcelas FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Create mensalista_pagamentos table for monthly payment tracking
CREATE TABLE IF NOT EXISTS mensalista_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid REFERENCES funcionarios_mensalistas(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  salario_base numeric DEFAULT 0,
  ajuda_custo numeric DEFAULT 0,
  vale_salario numeric DEFAULT 0,
  vt_valor numeric DEFAULT 0,
  encargos_valor numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  data_pagamento date NOT NULL,
  pago boolean DEFAULT true,
  observacao text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensalista_pagamentos_funcionario ON mensalista_pagamentos(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_mensalista_pagamentos_mes ON mensalista_pagamentos(mes_referencia);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_mensalista_pagamento_unico ON mensalista_pagamentos(funcionario_id, mes_referencia);

ALTER TABLE mensalista_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_mensalista_pagamentos" ON mensalista_pagamentos;
CREATE POLICY "admins_access_mensalista_pagamentos"
  ON mensalista_pagamentos FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Create contratos_locacao table for machinery rental contracts
CREATE TABLE IF NOT EXISTS contratos_locacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id uuid REFERENCES maquinas(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES obras(id) ON DELETE SET NULL,
  numero_contrato text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  dias_locacao int NOT NULL,
  valor_diaria numeric NOT NULL,
  valor_total numeric NOT NULL,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado', 'cancelado')),
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_locacao_maquina ON contratos_locacao(maquina_id);
CREATE INDEX IF NOT EXISTS idx_contratos_locacao_obra ON contratos_locacao(obra_id);
CREATE INDEX IF NOT EXISTS idx_contratos_locacao_status ON contratos_locacao(status);

ALTER TABLE contratos_locacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_contratos_locacao" ON contratos_locacao;
CREATE POLICY "admins_access_contratos_locacao"
  ON contratos_locacao FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Create diarista_pagamentos_semanais for weekly payment tracking
CREATE TABLE IF NOT EXISTS diarista_pagamentos_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  total_pago numeric DEFAULT 0,
  data_processamento date NOT NULL,
  processado boolean DEFAULT true,
  observacao text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diarista_pagamentos_semana ON diarista_pagamentos_semanais(semana_inicio, semana_fim);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_diarista_pagamento_semana ON diarista_pagamentos_semanais(semana_inicio, semana_fim);

ALTER TABLE diarista_pagamentos_semanais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_diarista_pagamentos_semanais" ON diarista_pagamentos_semanais;
CREATE POLICY "admins_access_diarista_pagamentos_semanais"
  ON diarista_pagamentos_semanais FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- Add conciliado column to receitas if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receitas' AND column_name = 'conciliado') THEN
    ALTER TABLE receitas ADD COLUMN conciliado boolean DEFAULT false;
  END IF;
END $$;
