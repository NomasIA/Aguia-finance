/*
  # Adicionar Quantidade Disponível
  
  1. Adicionar campo quantidade_disponivel
  2. Adicionar quantidade_locada ao contrato
  3. Atualizar funções para controlar estoque
*/

ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS quantidade_disponivel integer DEFAULT 0;

UPDATE maquinas SET quantidade_disponivel = quantidade WHERE quantidade_disponivel = 0;

ALTER TABLE contratos_locacao ADD COLUMN IF NOT EXISTS quantidade_locada integer DEFAULT 1;

DROP FUNCTION IF EXISTS create_contrato_locacao(uuid, text, text, date, date, integer, numeric, numeric, text);

CREATE OR REPLACE FUNCTION create_contrato_locacao(
  p_maquina_id uuid,
  p_cliente text,
  p_obra text,
  p_data_inicio date,
  p_data_fim date,
  p_dias_locacao integer,
  p_valor_diaria numeric,
  p_valor_total numeric,
  p_forma_pagamento text,
  p_quantidade_locada integer DEFAULT 1
)
RETURNS uuid AS $$
DECLARE
  v_contrato_id uuid;
  v_qtd_disponivel integer;
BEGIN
  SELECT quantidade_disponivel INTO v_qtd_disponivel FROM maquinas WHERE id = p_maquina_id;
  
  IF v_qtd_disponivel < p_quantidade_locada THEN
    RAISE EXCEPTION 'Quantidade insuficiente. Disponível: %', v_qtd_disponivel;
  END IF;
  
  INSERT INTO contratos_locacao (
    maquina_id, cliente, obra, data_inicio, data_fim,
    dias_locacao, valor_diaria, valor_total, forma_pagamento,
    quantidade_locada, status
  ) VALUES (
    p_maquina_id, p_cliente, p_obra, p_data_inicio, p_data_fim,
    p_dias_locacao, p_valor_diaria, p_valor_total, p_forma_pagamento,
    p_quantidade_locada, 'ativo'
  )
  RETURNING id INTO v_contrato_id;
  
  UPDATE maquinas 
  SET quantidade_disponivel = quantidade_disponivel - p_quantidade_locada,
      status = CASE WHEN quantidade_disponivel - p_quantidade_locada <= 0 THEN 'Locado' ELSE status END,
      updated_at = now()
  WHERE id = p_maquina_id;
  
  RETURN v_contrato_id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS receber_contrato_locacao(uuid, date);

CREATE OR REPLACE FUNCTION receber_contrato_locacao(
  p_contrato_id uuid,
  p_data_recebimento date DEFAULT CURRENT_DATE
)
RETURNS uuid AS $$
DECLARE
  v_ledger_id uuid;
  v_contrato record;
  v_descricao text;
BEGIN
  SELECT c.*, m.nome as maquina_nome
  INTO v_contrato
  FROM contratos_locacao c
  INNER JOIN maquinas m ON m.id = c.maquina_id
  WHERE c.id = p_contrato_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;
  
  IF v_contrato.recebido THEN
    RAISE EXCEPTION 'Contrato já foi recebido';
  END IF;
  
  v_descricao := 'Locação ' || v_contrato.maquina_nome || ' - ' || v_contrato.cliente;
  IF v_contrato.obra IS NOT NULL AND v_contrato.obra != '' THEN
    v_descricao := v_descricao || ' (' || v_contrato.obra || ')';
  END IF;
  
  INSERT INTO cash_ledger (
    data, tipo, forma, categoria, descricao, valor,
    maquina_id, origem, origem_id, conciliado, observacao
  ) VALUES (
    p_data_recebimento, 'entrada', COALESCE(v_contrato.forma_pagamento, 'banco'),
    'locacao_maquina', v_descricao, v_contrato.valor_total, v_contrato.maquina_id,
    'contrato_locacao', p_contrato_id, false,
    v_contrato.dias_locacao || ' diárias × R$ ' || v_contrato.valor_diaria
  )
  RETURNING id INTO v_ledger_id;
  
  UPDATE contratos_locacao
  SET recebido = true, data_recebimento = p_data_recebimento,
      valor_recebido = valor_total, status = 'finalizado', updated_at = now()
  WHERE id = p_contrato_id;
  
  UPDATE maquinas
  SET quantidade_disponivel = quantidade_disponivel + v_contrato.quantidade_locada,
      status = CASE WHEN quantidade_disponivel + v_contrato.quantidade_locada >= quantidade THEN 'Disponível' ELSE status END,
      updated_at = now()
  WHERE id = v_contrato.maquina_id;
  
  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN maquinas.quantidade_disponivel IS 'Quantidade disponível para locação (atualizada automaticamente)';
COMMENT ON COLUMN contratos_locacao.quantidade_locada IS 'Quantidade de unidades locadas neste contrato';
