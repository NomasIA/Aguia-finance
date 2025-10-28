/*
  # Adicionar exclusão de maquinário e validações
  
  1. Função para excluir maquinário (soft delete)
  2. Validações para evitar quantidade_disponivel > quantidade
  3. Constraint para garantir integridade
*/

ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION validar_quantidade_disponivel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantidade_disponivel > NEW.quantidade THEN
    RAISE EXCEPTION 'Quantidade disponível (%) não pode ser maior que quantidade total (%)', 
      NEW.quantidade_disponivel, NEW.quantidade;
  END IF;
  
  IF NEW.quantidade_disponivel < 0 THEN
    RAISE EXCEPTION 'Quantidade disponível não pode ser negativa';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_quantidade_maquina ON maquinas;
CREATE TRIGGER trigger_validar_quantidade_maquina
  BEFORE INSERT OR UPDATE ON maquinas
  FOR EACH ROW
  EXECUTE FUNCTION validar_quantidade_disponivel();

CREATE OR REPLACE FUNCTION excluir_maquina(p_maquina_id uuid)
RETURNS boolean AS $$
DECLARE
  v_contratos_ativos integer;
BEGIN
  SELECT COUNT(*) INTO v_contratos_ativos
  FROM contratos_locacao
  WHERE maquina_id = p_maquina_id AND deleted_at IS NULL;
  
  IF v_contratos_ativos > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir. Existem % contrato(s) ativo(s) para este equipamento', v_contratos_ativos;
  END IF;
  
  UPDATE maquinas
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = p_maquina_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

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
  v_item text;
BEGIN
  SELECT quantidade_disponivel, item INTO v_qtd_disponivel, v_item
  FROM maquinas
  WHERE id = p_maquina_id;
  
  IF v_qtd_disponivel < p_quantidade_locada THEN
    RAISE EXCEPTION 'Quantidade insuficiente. Disponível: %, Solicitado: %', v_qtd_disponivel, p_quantidade_locada;
  END IF;
  
  INSERT INTO contratos_locacao (
    maquina_id, cliente, obra, data_inicio, data_fim,
    dias_locacao, valor_diaria, valor_total, forma_pagamento,
    quantidade_locada, status, recebido
  ) VALUES (
    p_maquina_id, p_cliente, p_obra, p_data_inicio, p_data_fim,
    p_dias_locacao, p_valor_diaria, p_valor_total, p_forma_pagamento,
    p_quantidade_locada, 'ativo', false
  )
  RETURNING id INTO v_contrato_id;
  
  UPDATE maquinas
  SET quantidade_disponivel = quantidade_disponivel - p_quantidade_locada,
      status = CASE 
        WHEN quantidade_disponivel - p_quantidade_locada = 0 THEN 'Locado'
        WHEN quantidade_disponivel - p_quantidade_locada < quantidade THEN 'Parcialmente Locado'
        ELSE 'Disponível'
      END,
      updated_at = now()
  WHERE id = p_maquina_id;
  
  RETURN v_contrato_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION excluir_maquina IS 'Exclui maquinário (soft delete) apenas se não houver contratos ativos';
COMMENT ON FUNCTION validar_quantidade_disponivel IS 'Garante que quantidade_disponivel <= quantidade';
