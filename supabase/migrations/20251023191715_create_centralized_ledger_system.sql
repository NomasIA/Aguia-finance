/*
  # Sistema Centralizado de Ledger - ETAPA 1
  
  1. Ajustar tabela cash_ledger para ser a fonte única de verdade
  2. Criar função recalc_all() que recalcula todos os KPIs
  3. Criar triggers automáticos para sincronização
  4. Criar views para facilitar consultas
  
  IMPORTANTE: Todo o sistema financeiro agora roda a partir do ledger
*/

-- Garantir que categoria permite null (já que origem pode ter a info)
ALTER TABLE cash_ledger ALTER COLUMN categoria DROP NOT NULL;
ALTER TABLE cash_ledger ALTER COLUMN descricao DROP NOT NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ledger_data ON cash_ledger(data) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_tipo ON cash_ledger(tipo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_forma ON cash_ledger(forma) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_origem ON cash_ledger(origem) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_deleted ON cash_ledger(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ledger_conciliado ON cash_ledger(conciliado) WHERE deleted_at IS NULL;

-- View para movimentações ativas (não deletadas)
CREATE OR REPLACE VIEW ledger_active AS
SELECT * FROM cash_ledger
WHERE deleted_at IS NULL
ORDER BY data DESC, created_at DESC;

-- View para KPIs em tempo real
CREATE OR REPLACE VIEW kpis_realtime AS
SELECT
  -- Saldos
  COALESCE(SUM(CASE 
    WHEN tipo = 'entrada' AND forma = 'banco' THEN valor
    WHEN tipo = 'saida' AND forma = 'banco' THEN -valor
    ELSE 0
  END), 0) as saldo_banco,
  
  COALESCE(SUM(CASE 
    WHEN tipo = 'entrada' AND forma = 'dinheiro' THEN valor
    WHEN tipo = 'saida' AND forma = 'dinheiro' THEN -valor
    ELSE 0
  END), 0) as saldo_dinheiro,
  
  -- Entradas e Saídas totais
  COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) as total_entradas,
  COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) as total_saidas,
  
  -- Lucro Operacional
  COALESCE(SUM(CASE 
    WHEN tipo = 'entrada' THEN valor
    WHEN tipo = 'saida' THEN -valor
    ELSE 0
  END), 0) as lucro_operacional,
  
  -- Contadores
  COUNT(CASE WHEN tipo = 'entrada' THEN 1 END) as count_entradas,
  COUNT(CASE WHEN tipo = 'saida' THEN 1 END) as count_saidas,
  COUNT(CASE WHEN conciliado = true THEN 1 END) as count_conciliados,
  COUNT(CASE WHEN conciliado = false OR conciliado IS NULL THEN 1 END) as count_pendentes,
  
  -- Última atualização
  MAX(created_at) as ultima_atualizacao
FROM cash_ledger
WHERE deleted_at IS NULL;

-- View para últimas movimentações
CREATE OR REPLACE VIEW ultimas_movimentacoes AS
SELECT 
  id,
  data,
  tipo,
  forma,
  categoria,
  origem,
  descricao,
  valor,
  conciliado,
  created_at
FROM cash_ledger
WHERE deleted_at IS NULL
ORDER BY data DESC, created_at DESC
LIMIT 10;

-- Função principal: recalc_all()
CREATE OR REPLACE FUNCTION recalc_all()
RETURNS void AS $$
DECLARE
  v_saldo_banco numeric;
  v_saldo_dinheiro numeric;
  v_saldo_total numeric;
  v_total_entradas numeric;
  v_total_saidas numeric;
  v_lucro_operacional numeric;
BEGIN
  -- Calcular KPIs a partir do ledger
  SELECT 
    saldo_banco,
    saldo_dinheiro,
    total_entradas,
    total_saidas,
    lucro_operacional
  INTO 
    v_saldo_banco,
    v_saldo_dinheiro,
    v_total_entradas,
    v_total_saidas,
    v_lucro_operacional
  FROM kpis_realtime;

  v_saldo_total := v_saldo_banco + v_saldo_dinheiro;

  -- Atualizar bank_accounts (Itaú)
  UPDATE bank_accounts
  SET 
    saldo_atual = v_saldo_banco,
    updated_at = now()
  WHERE nome = 'Itaú – Conta Principal';

  -- Atualizar cash_books (Dinheiro)
  UPDATE cash_books
  SET 
    saldo_atual = v_saldo_dinheiro,
    updated_at = now()
  WHERE nome = 'Caixa Principal';

  -- Log opcional (pode ser removido em produção)
  RAISE NOTICE 'recalc_all() executado: Banco=%, Dinheiro=%, Lucro=%', 
    v_saldo_banco, v_saldo_dinheiro, v_lucro_operacional;

END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-recalcular após mudanças no ledger
CREATE OR REPLACE FUNCTION trigger_recalc_all()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalc_all();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS ledger_auto_recalc ON cash_ledger;
CREATE TRIGGER ledger_auto_recalc
AFTER INSERT OR UPDATE OR DELETE ON cash_ledger
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_recalc_all();

-- Executar recalc_all() uma vez para sincronizar
SELECT recalc_all();

-- Comentários
COMMENT ON VIEW kpis_realtime IS 'KPIs calculados em tempo real a partir do ledger';
COMMENT ON VIEW ultimas_movimentacoes IS 'Últimas 10 movimentações financeiras';
COMMENT ON FUNCTION recalc_all IS 'Recalcula todos os KPIs e saldos a partir do ledger - FONTE ÚNICA DE VERDADE';
COMMENT ON TRIGGER ledger_auto_recalc ON cash_ledger IS 'Dispara recalc_all() automaticamente após qualquer mudança no ledger';
