/*
  # Aprimorar cash_ledger como tabela central (ledger)
  
  1. Adicionar campos de origem
    - origem: tipo de entidade origem ('mensalista', 'diarista', 'obra', 'maquinario', 'manual')
    - origem_id: UUID da entidade origem (unificado)
  
  2. Criar índices para performance
    - Índice em data
    - Índice em forma (banco/dinheiro)
    - Índice em tipo (entrada/saida)
    - Índice composto em origem e origem_id
    - Índice em deleted_at para soft delete
  
  3. Garantir constraints
    - Check em tipo (entrada/saida)
    - Check em forma (banco/dinheiro)
*/

-- Adicionar campos de origem se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_ledger' AND column_name = 'origem'
  ) THEN
    ALTER TABLE cash_ledger ADD COLUMN origem text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_ledger' AND column_name = 'origem_id'
  ) THEN
    ALTER TABLE cash_ledger ADD COLUMN origem_id uuid;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_cash_ledger_data ON cash_ledger(data);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_forma ON cash_ledger(forma);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_tipo ON cash_ledger(tipo);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_origem ON cash_ledger(origem, origem_id);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_deleted_at ON cash_ledger(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_conciliado ON cash_ledger(conciliado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cash_ledger_categoria ON cash_ledger(categoria);

-- Adicionar constraints se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cash_ledger_tipo_check'
  ) THEN
    ALTER TABLE cash_ledger ADD CONSTRAINT cash_ledger_tipo_check 
    CHECK (tipo IN ('entrada', 'saida'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cash_ledger_forma_check'
  ) THEN
    ALTER TABLE cash_ledger ADD CONSTRAINT cash_ledger_forma_check 
    CHECK (forma IN ('banco', 'dinheiro'));
  END IF;
END $$;

-- Comentários para documentação
COMMENT ON COLUMN cash_ledger.origem IS 'Tipo de entidade origem: mensalista, diarista, obra, maquinario, manual';
COMMENT ON COLUMN cash_ledger.origem_id IS 'UUID da entidade origem (unificado para todas as origens)';
COMMENT ON COLUMN cash_ledger.forma IS 'banco = Itaú (entra na conciliação), dinheiro = Caixa Físico';
COMMENT ON COLUMN cash_ledger.conciliado IS 'Se true, lançamento foi conciliado com extrato bancário';
