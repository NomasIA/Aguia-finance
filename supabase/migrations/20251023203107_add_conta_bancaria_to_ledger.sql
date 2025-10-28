/*
  # Adicionar conta bancária ao ledger
  
  1. Adiciona coluna conta_bancaria (itau/bradesco/santander/dinheiro)
  2. Permite identificar qual conta foi movimentada
  3. Importante para conciliação e relatórios separados por banco
*/

ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS conta_bancaria text;

CREATE INDEX IF NOT EXISTS idx_ledger_conta ON cash_ledger(conta_bancaria) WHERE conta_bancaria IS NOT NULL;

COMMENT ON COLUMN cash_ledger.conta_bancaria IS 'Conta bancária utilizada (itau, bradesco, santander, etc) ou NULL para dinheiro';
