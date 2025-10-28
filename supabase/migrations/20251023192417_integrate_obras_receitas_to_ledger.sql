/*
  # Integração Obras & Receitas ao Ledger - ETAPA 5
  
  1. Criar funções para sincronizar receitas ao ledger
  2. Ao marcar "recebido" → criar entrada no ledger
  3. Ao desmarcar → soft delete no ledger
  4. Triggers automáticos
  5. Atualiza automaticamente: Visão Geral, Caixa, Conciliação, Relatórios
*/

-- Função para criar entrada no ledger quando marcar receita como recebida
CREATE OR REPLACE FUNCTION sync_receita_to_ledger(
  p_receita_id uuid,
  p_valor numeric,
  p_data_recebimento date,
  p_forma text,
  p_meio_banco text DEFAULT NULL,
  p_obra_id uuid DEFAULT NULL,
  p_descricao text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_ledger_id uuid;
  v_forma_ledger text;
  v_categoria text;
  v_descricao_final text;
  v_obra_nome text;
BEGIN
  -- Determinar forma (banco ou dinheiro)
  v_forma_ledger := LOWER(p_forma);
  IF v_forma_ledger NOT IN ('banco', 'dinheiro') THEN
    v_forma_ledger := 'banco';
  END IF;
  
  -- Categoria
  v_categoria := 'receita_obra';
  
  -- Montar descrição
  IF p_obra_id IS NOT NULL THEN
    SELECT nome_obra INTO v_obra_nome FROM obras WHERE id = p_obra_id;
    v_descricao_final := COALESCE(p_descricao, 'Receita') || ' - ' || COALESCE(v_obra_nome, 'Obra');
  ELSE
    v_descricao_final := COALESCE(p_descricao, 'Receita de Obra');
  END IF;
  
  -- Inserir no ledger
  INSERT INTO cash_ledger (
    data,
    tipo,
    forma,
    categoria,
    descricao,
    valor,
    obra_id,
    receita_id,
    origem,
    origem_id,
    conciliado,
    observacao
  ) VALUES (
    p_data_recebimento,
    'entrada',
    v_forma_ledger,
    v_categoria,
    v_descricao_final,
    p_valor,
    p_obra_id,
    p_receita_id,
    'receita',
    p_receita_id,
    false,
    CASE WHEN p_meio_banco IS NOT NULL THEN 'Meio: ' || p_meio_banco ELSE NULL END
  )
  RETURNING id INTO v_ledger_id;
  
  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql;

-- Função para criar entrada no ledger para parcela
CREATE OR REPLACE FUNCTION sync_parcela_to_ledger(
  p_parcela_id uuid,
  p_receita_id uuid,
  p_valor numeric,
  p_data_recebimento date,
  p_forma text,
  p_meio_banco text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_ledger_id uuid;
  v_forma_ledger text;
  v_categoria text;
  v_descricao text;
  v_obra_id uuid;
  v_obra_nome text;
  v_parcela_numero int;
BEGIN
  -- Buscar info da receita
  SELECT r.obra_id, r.descricao, p.numero
  INTO v_obra_id, v_descricao, v_parcela_numero
  FROM receitas_parcelas p
  INNER JOIN receitas r ON r.id = p.receita_id
  WHERE p.id = p_parcela_id;
  
  -- Buscar nome da obra
  IF v_obra_id IS NOT NULL THEN
    SELECT nome_obra INTO v_obra_nome FROM obras WHERE id = v_obra_id;
  END IF;
  
  -- Determinar forma
  v_forma_ledger := LOWER(p_forma);
  IF v_forma_ledger NOT IN ('banco', 'dinheiro') THEN
    v_forma_ledger := 'banco';
  END IF;
  
  -- Categoria
  v_categoria := 'receita_obra';
  
  -- Montar descrição
  v_descricao := COALESCE(v_descricao, 'Receita') || 
                 ' - Parcela ' || v_parcela_numero ||
                 CASE WHEN v_obra_nome IS NOT NULL THEN ' - ' || v_obra_nome ELSE '' END;
  
  -- Inserir no ledger
  INSERT INTO cash_ledger (
    data,
    tipo,
    forma,
    categoria,
    descricao,
    valor,
    obra_id,
    receita_id,
    receita_parcela_id,
    origem,
    origem_id,
    conciliado,
    observacao
  ) VALUES (
    p_data_recebimento,
    'entrada',
    v_forma_ledger,
    v_categoria,
    v_descricao,
    p_valor,
    v_obra_id,
    p_receita_id,
    p_parcela_id,
    'receita_parcela',
    p_parcela_id,
    false,
    CASE WHEN p_meio_banco IS NOT NULL THEN 'Meio: ' || p_meio_banco ELSE NULL END
  )
  RETURNING id INTO v_ledger_id;
  
  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql;

-- Função para remover (soft delete) entrada do ledger
CREATE OR REPLACE FUNCTION remove_receita_from_ledger(
  p_receita_id uuid
)
RETURNS boolean AS $$
BEGIN
  UPDATE cash_ledger
  SET deleted_at = now()
  WHERE receita_id = p_receita_id
    AND deleted_at IS NULL
    AND tipo = 'entrada';
    
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Função para remover parcela do ledger
CREATE OR REPLACE FUNCTION remove_parcela_from_ledger(
  p_parcela_id uuid
)
RETURNS boolean AS $$
BEGIN
  UPDATE cash_ledger
  SET deleted_at = now()
  WHERE receita_parcela_id = p_parcela_id
    AND deleted_at IS NULL
    AND tipo = 'entrada';
    
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar receitas automaticamente
CREATE OR REPLACE FUNCTION trigger_sync_receita()
RETURNS TRIGGER AS $$
DECLARE
  v_ledger_exists boolean;
BEGIN
  -- Quando marcar como recebido
  IF NEW.recebido = true AND (OLD.recebido IS NULL OR OLD.recebido = false) THEN
    -- Verificar se já existe no ledger
    SELECT EXISTS(
      SELECT 1 FROM cash_ledger 
      WHERE receita_id = NEW.id 
        AND deleted_at IS NULL
    ) INTO v_ledger_exists;
    
    IF NOT v_ledger_exists THEN
      PERFORM sync_receita_to_ledger(
        NEW.id,
        NEW.valor_total,
        COALESCE(NEW.data_recebimento, CURRENT_DATE),
        COALESCE(NEW.forma_recebimento, 'banco'),
        NEW.meio_banco,
        NEW.obra_id,
        NEW.descricao
      );
    END IF;
  END IF;
  
  -- Quando desmarcar recebido
  IF NEW.recebido = false AND OLD.recebido = true THEN
    PERFORM remove_receita_from_ledger(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar parcelas automaticamente
CREATE OR REPLACE FUNCTION trigger_sync_parcela()
RETURNS TRIGGER AS $$
DECLARE
  v_ledger_exists boolean;
BEGIN
  -- Quando marcar como recebido
  IF NEW.recebido = true AND (OLD.recebido IS NULL OR OLD.recebido = false) THEN
    -- Verificar se já existe no ledger
    SELECT EXISTS(
      SELECT 1 FROM cash_ledger 
      WHERE receita_parcela_id = NEW.id 
        AND deleted_at IS NULL
    ) INTO v_ledger_exists;
    
    IF NOT v_ledger_exists THEN
      PERFORM sync_parcela_to_ledger(
        NEW.id,
        NEW.receita_id,
        NEW.valor,
        COALESCE(NEW.data_recebimento, CURRENT_DATE),
        COALESCE(NEW.forma_recebimento, 'banco'),
        NEW.meio_banco
      );
    END IF;
  END IF;
  
  -- Quando desmarcar recebido
  IF NEW.recebido = false AND OLD.recebido = true THEN
    PERFORM remove_parcela_from_ledger(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers
DROP TRIGGER IF EXISTS receitas_sync_ledger ON receitas;
CREATE TRIGGER receitas_sync_ledger
AFTER UPDATE ON receitas
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_receita();

DROP TRIGGER IF EXISTS parcelas_sync_ledger ON receitas_parcelas;
CREATE TRIGGER parcelas_sync_ledger
AFTER UPDATE ON receitas_parcelas
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_parcela();

-- Comentários
COMMENT ON FUNCTION sync_receita_to_ledger IS 'Sincroniza receita marcada como recebida para o ledger (cria entrada)';
COMMENT ON FUNCTION sync_parcela_to_ledger IS 'Sincroniza parcela marcada como recebida para o ledger (cria entrada)';
COMMENT ON FUNCTION remove_receita_from_ledger IS 'Remove (soft delete) receita do ledger quando desmarcar recebido';
COMMENT ON FUNCTION remove_parcela_from_ledger IS 'Remove (soft delete) parcela do ledger quando desmarcar recebido';
