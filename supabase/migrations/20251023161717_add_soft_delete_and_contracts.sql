/*
  # Sincronização Total + Contratos + Folha Detalhada

  ## 1. Soft Delete em Todas as Tabelas Financeiras

  Adiciona coluna `deleted_at` em:
  - bank_transactions
  - cash_ledger
  - receitas (já tem)
  - receitas_parcelas (já tem)
  - custos_fixos
  - locacoes
  - diarista_lancamentos

  ## 2. Tabela de Contratos de Locação

  Nova tabela `locacoes_contratos`:
  - Registra contratos formalizados de locação de equipamentos
  - Vincula máquina, obra, período e valores
  - Gera parcelas de receita automaticamente

  ## 3. Tabela de Folha de Pagamentos

  Nova tabela `folha_pagamentos`:
  - Registra pagamentos separados: Adiantamento, Salário, VT
  - Previne duplicação com unique constraint
  - Vincula com transações bancárias/caixa

  ## 4. Melhorias nas Parcelas de Receitas

  Adiciona campos em `receitas_parcelas`:
  - contrato_id para vincular com contratos de locação
  - Melhorias nos índices

  ## 5. Security

  - RLS habilitado em todas as novas tabelas
  - Políticas admin-only
*/

-- ============================================
-- 1. SOFT DELETE EM TABELAS EXISTENTES
-- ============================================

-- Adicionar deleted_at em bank_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE bank_transactions ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_bank_transactions_deleted ON bank_transactions(deleted_at);
  END IF;
END $$;

-- Adicionar deleted_at em cash_ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_ledger' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cash_ledger ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_cash_ledger_deleted ON cash_ledger(deleted_at);
  END IF;
END $$;

-- Adicionar deleted_at em custos_fixos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custos_fixos' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE custos_fixos ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_custos_fixos_deleted ON custos_fixos(deleted_at);
  END IF;
END $$;

-- Adicionar deleted_at em locacoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locacoes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE locacoes ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_locacoes_deleted ON locacoes(deleted_at);
  END IF;
END $$;

-- Adicionar deleted_at em diarista_lancamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diarista_lancamentos' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diarista_lancamentos ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_diarista_lancamentos_deleted ON diarista_lancamentos(deleted_at);
  END IF;
END $$;

-- ============================================
-- 2. TABELA DE CONTRATOS DE LOCAÇÃO
-- ============================================

CREATE TABLE IF NOT EXISTS locacoes_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id uuid REFERENCES maquinas(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES obras(id) ON DELETE SET NULL,
  numero_contrato text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias int NOT NULL,
  valor_diaria numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  impostos_pct numeric NOT NULL DEFAULT 0,
  frete numeric NOT NULL DEFAULT 0,
  caucao_pct numeric NOT NULL DEFAULT 0,
  caucao_valor numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado', 'cancelado')),
  observacao text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locacoes_contratos_maquina ON locacoes_contratos(maquina_id);
CREATE INDEX IF NOT EXISTS idx_locacoes_contratos_obra ON locacoes_contratos(obra_id);
CREATE INDEX IF NOT EXISTS idx_locacoes_contratos_status ON locacoes_contratos(status);
CREATE INDEX IF NOT EXISTS idx_locacoes_contratos_deleted ON locacoes_contratos(deleted_at);

ALTER TABLE locacoes_contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_locacoes_contratos" ON locacoes_contratos;
CREATE POLICY "admins_access_locacoes_contratos"
  ON locacoes_contratos FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- ============================================
-- 3. VINCULAR CONTRATOS COM PARCELAS
-- ============================================

-- Adicionar contrato_id em receitas_parcelas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receitas_parcelas' AND column_name = 'contrato_id'
  ) THEN
    ALTER TABLE receitas_parcelas ADD COLUMN contrato_id uuid REFERENCES locacoes_contratos(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_receitas_parcelas_contrato ON receitas_parcelas(contrato_id);
  END IF;
END $$;

-- ============================================
-- 4. TABELA DE FOLHA DE PAGAMENTOS
-- ============================================

CREATE TABLE IF NOT EXISTS folha_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid REFERENCES funcionarios_mensalistas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  tipo text CHECK (tipo IN ('adiantamento', 'salario', 'vt')) NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  salario_base numeric DEFAULT 0,
  ajuda_custo numeric DEFAULT 0,
  vale_salario numeric DEFAULT 0,
  vt_valor numeric DEFAULT 0,
  encargos_valor numeric DEFAULT 0,
  descontos numeric DEFAULT 0,
  forma_pagamento text CHECK (forma_pagamento IN ('banco', 'dinheiro')) DEFAULT 'banco',
  meio_banco text,
  pago boolean DEFAULT true,
  pago_em date DEFAULT now(),
  bank_account_id uuid REFERENCES bank_accounts(id),
  cash_book_id uuid REFERENCES cash_books(id),
  cash_ledger_id uuid REFERENCES cash_ledger(id),
  observacao text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folha_pagamentos_funcionario ON folha_pagamentos(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_folha_pagamentos_competencia ON folha_pagamentos(competencia);
CREATE INDEX IF NOT EXISTS idx_folha_pagamentos_tipo ON folha_pagamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_folha_pagamentos_deleted ON folha_pagamentos(deleted_at);

-- Constraint de unicidade para prevenir duplicação
CREATE UNIQUE INDEX IF NOT EXISTS uidx_folha_pagamento_unico
  ON folha_pagamentos(funcionario_id, competencia, tipo)
  WHERE deleted_at IS NULL;

ALTER TABLE folha_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_access_folha_pagamentos" ON folha_pagamentos;
CREATE POLICY "admins_access_folha_pagamentos"
  ON folha_pagamentos FOR ALL
  USING (auth.email() = ANY (SELECT email FROM app_admins))
  WITH CHECK (auth.email() = ANY (SELECT email FROM app_admins));

-- ============================================
-- 5. ATUALIZAR RECEITAS COM VINCULO DE CONTRATO
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receitas' AND column_name = 'contrato_id'
  ) THEN
    ALTER TABLE receitas ADD COLUMN contrato_id uuid REFERENCES locacoes_contratos(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_receitas_contrato ON receitas(contrato_id);
  END IF;
END $$;

-- ============================================
-- 6. MELHORAR TRACKING DE CONCILIAÇÃO
-- ============================================

-- Adicionar campos de tracking de conciliação em cash_ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_ledger' AND column_name = 'bank_transaction_id'
  ) THEN
    ALTER TABLE cash_ledger ADD COLUMN bank_transaction_id uuid REFERENCES bank_transactions(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_cash_ledger_bank_transaction ON cash_ledger(bank_transaction_id);
  END IF;
END $$;

-- Adicionar receita_parcela_id em cash_ledger para tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_ledger' AND column_name = 'receita_parcela_id'
  ) THEN
    ALTER TABLE cash_ledger ADD COLUMN receita_parcela_id uuid REFERENCES receitas_parcelas(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_cash_ledger_receita_parcela ON cash_ledger(receita_parcela_id);
  END IF;
END $$;

-- ============================================
-- 7. GARANTIR ZERO-FALLBACK
-- ============================================

-- Atualizar valores NULL para 0 em todas as tabelas financeiras
UPDATE receitas SET valor_total = 0 WHERE valor_total IS NULL;
UPDATE receitas_parcelas SET valor = 0 WHERE valor IS NULL;
UPDATE cash_ledger SET valor = 0 WHERE valor IS NULL;
UPDATE custos_fixos SET valor = 0 WHERE valor IS NULL;
UPDATE funcionarios_mensalistas
SET
  salario_base = COALESCE(salario_base, 0),
  ajuda_custo = COALESCE(ajuda_custo, 0),
  vale_salario = COALESCE(vale_salario, 0),
  vt_valor_unitario_dia = COALESCE(vt_valor_unitario_dia, 0);

-- ============================================
-- 8. VIEWS PARA RELATÓRIOS
-- ============================================

-- View para contratos ativos com totais
CREATE OR REPLACE VIEW v_contratos_locacao_resumo AS
SELECT
  lc.id,
  lc.numero_contrato,
  lc.data_inicio,
  lc.data_fim,
  lc.dias,
  lc.valor_diaria,
  lc.valor_total,
  lc.status,
  m.nome as maquina_nome,
  m.categoria as maquina_categoria,
  o.nome_obra,
  o.cliente,
  COALESCE(SUM(CASE WHEN rp.recebido = true THEN rp.valor ELSE 0 END), 0) as total_recebido,
  COALESCE(SUM(CASE WHEN rp.recebido = false THEN rp.valor ELSE 0 END), 0) as total_pendente,
  COUNT(rp.id) as total_parcelas,
  COUNT(CASE WHEN rp.recebido = true THEN 1 END) as parcelas_recebidas
FROM locacoes_contratos lc
LEFT JOIN maquinas m ON m.id = lc.maquina_id
LEFT JOIN obras o ON o.id = lc.obra_id
LEFT JOIN receitas_parcelas rp ON rp.contrato_id = lc.id AND rp.deleted_at IS NULL
WHERE lc.deleted_at IS NULL
GROUP BY lc.id, m.nome, m.categoria, o.nome_obra, o.cliente;