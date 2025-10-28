/*
  # Atualizar Recebimento para Excluir Contrato
  
  Ao marcar como recebido:
  1. Cria entrada no ledger
  2. Devolve quantidade
  3. Soft delete do contrato
*/

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
  WHERE c.id = p_contrato_id AND c.deleted_at IS NULL;
  
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
  
  UPDATE maquinas
  SET quantidade_disponivel = quantidade_disponivel + COALESCE(v_contrato.quantidade_locada, 1),
      status = CASE 
        WHEN quantidade_disponivel + COALESCE(v_contrato.quantidade_locada, 1) >= quantidade 
        THEN 'Disponível' 
        ELSE status 
      END,
      updated_at = now()
  WHERE id = v_contrato.maquina_id;
  
  UPDATE contratos_locacao
  SET deleted_at = now(),
      recebido = true,
      data_recebimento = p_data_recebimento,
      valor_recebido = valor_total,
      status = 'finalizado',
      updated_at = now()
  WHERE id = p_contrato_id;
  
  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION receber_contrato_locacao IS 'Recebe contrato, cria entrada no ledger, devolve quantidade e exclui contrato (soft delete)';
