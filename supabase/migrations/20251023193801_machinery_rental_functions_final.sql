/*
  # Funções do Sistema de Locação - Final
*/

CREATE OR REPLACE FUNCTION create_contrato_locacao(
  p_maquina_id uuid,
  p_cliente text,
  p_obra text,
  p_data_inicio date,
  p_data_fim date,
  p_dias_locacao integer,
  p_valor_diaria numeric,
  p_valor_total numeric,
  p_forma_pagamento text DEFAULT 'banco'
)
RETURNS uuid AS $$
DECLARE
  v_contrato_id uuid;
BEGIN
  INSERT INTO contratos_locacao (
    maquina_id, cliente, obra, data_inicio, data_fim,
    dias_locacao, valor_diaria, valor_total, forma_pagamento, status
  ) VALUES (
    p_maquina_id, p_cliente, p_obra, p_data_inicio, p_data_fim,
    p_dias_locacao, p_valor_diaria, p_valor_total, p_forma_pagamento, 'ativo'
  )
  RETURNING id INTO v_contrato_id;
  
  UPDATE maquinas SET status = 'Locado', updated_at = now() WHERE id = p_maquina_id;
  
  RETURN v_contrato_id;
END;
$$ LANGUAGE plpgsql;

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
  
  UPDATE maquinas SET status = 'Disponível', updated_at = now() WHERE id = v_contrato.maquina_id;
  
  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION desfazer_recebimento_locacao(
  p_contrato_id uuid
)
RETURNS boolean AS $$
BEGIN
  UPDATE cash_ledger SET deleted_at = now()
  WHERE origem = 'contrato_locacao' AND origem_id = p_contrato_id AND deleted_at IS NULL;
  
  UPDATE contratos_locacao
  SET recebido = false, data_recebimento = null, valor_recebido = 0,
      status = 'ativo', updated_at = now()
  WHERE id = p_contrato_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_contrato_locacao IS 'Cria contrato e marca máquina como Locado';
COMMENT ON FUNCTION receber_contrato_locacao IS 'Recebe contrato, cria entrada no ledger e libera máquina';
COMMENT ON FUNCTION desfazer_recebimento_locacao IS 'Desfaz recebimento e remove do ledger';
