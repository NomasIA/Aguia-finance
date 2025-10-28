/*
  # Adicionar campos de pagamento aos contratos de locação
  
  1. Changes
    - Add `forma_pagamento` column (banco/dinheiro)
    - Add `recebido` column (boolean)
    - Add `data_recebimento` column (date)
    - These fields will integrate with cash_ledger for payment tracking
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locacoes_contratos' AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE locacoes_contratos ADD COLUMN forma_pagamento text CHECK (forma_pagamento IN ('banco', 'dinheiro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locacoes_contratos' AND column_name = 'recebido'
  ) THEN
    ALTER TABLE locacoes_contratos ADD COLUMN recebido boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locacoes_contratos' AND column_name = 'data_recebimento'
  ) THEN
    ALTER TABLE locacoes_contratos ADD COLUMN data_recebimento date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locacoes_contratos' AND column_name = 'cash_ledger_id'
  ) THEN
    ALTER TABLE locacoes_contratos ADD COLUMN cash_ledger_id uuid REFERENCES cash_ledger(id);
  END IF;
END $$;
