/*
  # Create Financial Views

  1. Views Created
    - `vw_entradas` - All income transactions aggregated
    - `vw_saidas` - All expense transactions aggregated  
    - `vw_fluxo_real` - Real cash flow (Banco + Dinheiro)
    - `vw_fluxo_banco` - Bank-only cash flow for reconciliation

  2. Purpose
    - Simplify complex queries in frontend
    - Provide aggregated financial data
    - Support reporting and analytics
*/

-- View: All income transactions
CREATE OR REPLACE VIEW vw_entradas AS
SELECT 
  data,
  forma,
  categoria,
  descricao,
  valor,
  bank_account_id,
  cash_book_id,
  created_at
FROM cash_ledger
WHERE tipo = 'entrada'
ORDER BY data DESC;

-- View: All expense transactions
CREATE OR REPLACE VIEW vw_saidas AS
SELECT 
  data,
  forma,
  categoria,
  descricao,
  valor,
  bank_account_id,
  cash_book_id,
  created_at
FROM cash_ledger
WHERE tipo = 'saida'
ORDER BY data DESC;

-- View: Real cash flow (both Banco and Dinheiro)
CREATE OR REPLACE VIEW vw_fluxo_real AS
SELECT 
  data,
  tipo,
  forma,
  categoria,
  descricao,
  valor,
  CASE 
    WHEN tipo = 'entrada' THEN valor 
    WHEN tipo = 'saida' THEN -valor 
  END as valor_liquido,
  created_at
FROM cash_ledger
ORDER BY data DESC, created_at DESC;

-- View: Bank-only cash flow for reconciliation
CREATE OR REPLACE VIEW vw_fluxo_banco AS
SELECT 
  id,
  data,
  tipo,
  categoria,
  descricao,
  valor,
  CASE 
    WHEN tipo = 'entrada' THEN valor 
    WHEN tipo = 'saida' THEN -valor 
  END as valor_liquido,
  bank_account_id,
  created_at
FROM cash_ledger
WHERE forma = 'banco'
ORDER BY data DESC, created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON vw_entradas TO authenticated;
GRANT SELECT ON vw_saidas TO authenticated;
GRANT SELECT ON vw_fluxo_real TO authenticated;
GRANT SELECT ON vw_fluxo_banco TO authenticated;
