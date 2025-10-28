/*
  # Sistema de 13º Salário e Auditoria
  
  1. Tabela de 13º salário
     - Registro principal por funcionário/ano
     - Validação: apenas competência dezembro (mês 12)
     - Suporte a 1 ou 2 parcelas
     - Unique constraint para evitar duplicação
  
  2. Tabela de parcelas do 13º
     - Cada parcela vinculada ao registro principal
     - Controle de pagamento e conciliação
     - Vínculo com lançamentos financeiros
  
  3. Tabela de auditoria
     - Registro de todas alterações de pagamentos
     - Histórico completo de edições
  
  4. Funções de processamento
     - Gerar 13º salário automaticamente
     - Integração com ledger (Banco Itaú)
     - Atualização automática de todos os módulos
  
  5. Funções de edição de data
     - Permitir alterar data de qualquer pagamento
     - Auditoria automática
     - Recalcular conciliações
*/

CREATE TABLE IF NOT EXISTS decimo_terceiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid REFERENCES funcionarios_mensalistas(id) ON DELETE CASCADE,
  competencia_ano int NOT NULL,
  competencia_mes int NOT NULL CHECK (competencia_mes = 12),
  valor_total numeric(10,2) NOT NULL CHECK (valor_total > 0),
  parcelas int NOT NULL CHECK (parcelas IN (1, 2)),
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_decimo_unique 
  ON decimo_terceiro(funcionario_id, competencia_ano, competencia_mes) 
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS decimo_terceiro_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decimo_id uuid REFERENCES decimo_terceiro(id) ON DELETE CASCADE,
  parcela_num int NOT NULL CHECK (parcela_num IN (1, 2)),
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  data_prevista date NOT NULL,
  pago boolean DEFAULT false,
  data_pagamento date,
  ledger_id uuid REFERENCES cash_ledger(id) ON DELETE SET NULL,
  conciliado boolean DEFAULT false,
  conciliacao_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parcela_unique 
  ON decimo_terceiro_parcelas(decimo_id, parcela_num) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_parcelas_pagamento ON decimo_terceiro_parcelas(data_pagamento, pago);
CREATE INDEX IF NOT EXISTS idx_parcelas_decimo ON decimo_terceiro_parcelas(decimo_id);

CREATE TABLE IF NOT EXISTS payroll_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_tipo text NOT NULL,
  ref_id uuid NOT NULL,
  acao text NOT NULL,
  campo text,
  valor_antigo text,
  valor_novo text,
  motivo text,
  autor_email text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_ref ON payroll_audit(ref_tipo, ref_id);
CREATE INDEX IF NOT EXISTS idx_audit_data ON payroll_audit(created_at DESC);

CREATE OR REPLACE FUNCTION processar_decimo_terceiro(
  p_funcionario_ids uuid[],
  p_competencia_ano int,
  p_valores jsonb,
  p_parcelas int,
  p_datas_pagamento date[],
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_func_id uuid;
  v_decimo_id uuid;
  v_valor_total numeric;
  v_valor_parcela numeric;
  v_func_nome text;
  v_ledger_id uuid;
  v_descricao text;
  v_result jsonb := '[]'::jsonb;
  v_parcela_info jsonb;
BEGIN
  FOREACH v_func_id IN ARRAY p_funcionario_ids
  LOOP
    SELECT nome INTO v_func_nome FROM funcionarios_mensalistas WHERE id = v_func_id;
    
    IF v_func_nome IS NULL THEN
      CONTINUE;
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM decimo_terceiro 
      WHERE funcionario_id = v_func_id 
        AND competencia_ano = p_competencia_ano 
        AND competencia_mes = 12 
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Já existe um registro de 13º para % neste ano', v_func_nome;
    END IF;
    
    v_valor_total := (p_valores->v_func_id::text)::numeric;
    
    IF v_valor_total IS NULL OR v_valor_total <= 0 THEN
      CONTINUE;
    END IF;
    
    INSERT INTO decimo_terceiro (
      funcionario_id, competencia_ano, competencia_mes,
      valor_total, parcelas, observacoes
    ) VALUES (
      v_func_id, p_competencia_ano, 12,
      v_valor_total, p_parcelas, p_observacoes
    )
    RETURNING id INTO v_decimo_id;
    
    IF p_parcelas = 1 THEN
      v_valor_parcela := v_valor_total;
      
      v_descricao := '13º Salário - ' || v_func_nome || ' (' || p_competencia_ano || ')';
      
      INSERT INTO cash_ledger (
        data, tipo, forma, categoria, descricao, valor,
        origem, origem_id, conciliado, conta_bancaria
      ) VALUES (
        p_datas_pagamento[1], 'saida', 'banco', '13_salario',
        v_descricao, v_valor_total, 'decimo_terceiro', v_decimo_id,
        false, 'itau'
      )
      RETURNING id INTO v_ledger_id;
      
      INSERT INTO decimo_terceiro_parcelas (
        decimo_id, parcela_num, valor, data_prevista,
        pago, data_pagamento, ledger_id
      ) VALUES (
        v_decimo_id, 1, v_valor_parcela, p_datas_pagamento[1],
        true, p_datas_pagamento[1], v_ledger_id
      );
      
    ELSE
      v_valor_parcela := ROUND(v_valor_total / 2, 2);
      
      v_descricao := '13º Salário (1ª Parcela) - ' || v_func_nome || ' (' || p_competencia_ano || ')';
      
      INSERT INTO cash_ledger (
        data, tipo, forma, categoria, descricao, valor,
        origem, origem_id, conciliado, conta_bancaria
      ) VALUES (
        p_datas_pagamento[1], 'saida', 'banco', '13_salario',
        v_descricao, v_valor_parcela, 'decimo_terceiro', v_decimo_id,
        false, 'itau'
      )
      RETURNING id INTO v_ledger_id;
      
      INSERT INTO decimo_terceiro_parcelas (
        decimo_id, parcela_num, valor, data_prevista,
        pago, data_pagamento, ledger_id
      ) VALUES (
        v_decimo_id, 1, v_valor_parcela, p_datas_pagamento[1],
        true, p_datas_pagamento[1], v_ledger_id
      );
      
      v_descricao := '13º Salário (2ª Parcela) - ' || v_func_nome || ' (' || p_competencia_ano || ')';
      
      INSERT INTO cash_ledger (
        data, tipo, forma, categoria, descricao, valor,
        origem, origem_id, conciliado, conta_bancaria
      ) VALUES (
        p_datas_pagamento[2], 'saida', 'banco', '13_salario',
        v_descricao, v_valor_total - v_valor_parcela, 'decimo_terceiro', v_decimo_id,
        false, 'itau'
      )
      RETURNING id INTO v_ledger_id;
      
      INSERT INTO decimo_terceiro_parcelas (
        decimo_id, parcela_num, valor, data_prevista,
        pago, data_pagamento, ledger_id
      ) VALUES (
        v_decimo_id, 2, v_valor_total - v_valor_parcela, p_datas_pagamento[2],
        true, p_datas_pagamento[2], v_ledger_id
      );
    END IF;
    
    v_result := v_result || jsonb_build_object(
      'funcionario_id', v_func_id,
      'funcionario_nome', v_func_nome,
      'decimo_id', v_decimo_id,
      'valor_total', v_valor_total,
      'parcelas', p_parcelas
    );
  END LOOP;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION editar_data_pagamento(
  p_ref_tipo text,
  p_ref_id uuid,
  p_nova_data date,
  p_motivo text,
  p_autor_email text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_ledger_id uuid;
  v_data_antiga date;
  v_conciliado boolean;
BEGIN
  IF p_ref_tipo = 'salario' THEN
    SELECT ledger_id, data_pagamento, conciliado 
    INTO v_ledger_id, v_data_antiga, v_conciliado
    FROM mensalista_salarios WHERE id = p_ref_id;
    
    IF v_conciliado THEN
      RAISE EXCEPTION 'Este pagamento já está conciliado. Desfaça a conciliação antes de alterar a data.';
    END IF;
    
    UPDATE mensalista_salarios 
    SET data_pagamento = p_nova_data, updated_at = now()
    WHERE id = p_ref_id;
    
  ELSIF p_ref_tipo = 'vale' THEN
    SELECT ledger_id, data_pagamento, conciliado 
    INTO v_ledger_id, v_data_antiga, v_conciliado
    FROM mensalista_vales WHERE id = p_ref_id;
    
    IF v_conciliado THEN
      RAISE EXCEPTION 'Este pagamento já está conciliado. Desfaça a conciliação antes de alterar a data.';
    END IF;
    
    UPDATE mensalista_vales 
    SET data_pagamento = p_nova_data, updated_at = now()
    WHERE id = p_ref_id;
    
  ELSIF p_ref_tipo = 'vt' THEN
    SELECT ledger_id, data_pagamento, conciliado 
    INTO v_ledger_id, v_data_antiga, v_conciliado
    FROM mensalista_vts WHERE id = p_ref_id;
    
    IF v_conciliado THEN
      RAISE EXCEPTION 'Este pagamento já está conciliado. Desfaça a conciliação antes de alterar a data.';
    END IF;
    
    UPDATE mensalista_vts 
    SET data_pagamento = p_nova_data, updated_at = now()
    WHERE id = p_ref_id;
    
  ELSIF p_ref_tipo = 'decimo_parcela' THEN
    SELECT ledger_id, data_pagamento, conciliado 
    INTO v_ledger_id, v_data_antiga, v_conciliado
    FROM decimo_terceiro_parcelas WHERE id = p_ref_id;
    
    IF v_conciliado THEN
      RAISE EXCEPTION 'Este pagamento já está conciliado. Desfaça a conciliação antes de alterar a data.';
    END IF;
    
    UPDATE decimo_terceiro_parcelas 
    SET data_pagamento = p_nova_data, data_prevista = p_nova_data, updated_at = now()
    WHERE id = p_ref_id;
    
  ELSE
    RAISE EXCEPTION 'Tipo de referência inválido: %', p_ref_tipo;
  END IF;
  
  IF v_ledger_id IS NOT NULL THEN
    UPDATE cash_ledger SET data = p_nova_data WHERE id = v_ledger_id;
  END IF;
  
  INSERT INTO payroll_audit (
    ref_tipo, ref_id, acao, campo, valor_antigo, valor_novo, motivo, autor_email
  ) VALUES (
    p_ref_tipo, p_ref_id, 'editar_data', 'data_pagamento',
    v_data_antiga::text, p_nova_data::text, p_motivo, p_autor_email
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_decimo_terceiro_por_competencia(
  p_ano int,
  p_mes int DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  funcionario_id uuid,
  funcionario_nome text,
  valor_total numeric,
  parcelas int,
  observacoes text,
  parcela_1_valor numeric,
  parcela_1_data date,
  parcela_1_pago boolean,
  parcela_2_valor numeric,
  parcela_2_data date,
  parcela_2_pago boolean,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.funcionario_id,
    fm.nome as funcionario_nome,
    d.valor_total,
    d.parcelas,
    d.observacoes,
    p1.valor as parcela_1_valor,
    p1.data_pagamento as parcela_1_data,
    p1.pago as parcela_1_pago,
    p2.valor as parcela_2_valor,
    p2.data_pagamento as parcela_2_data,
    p2.pago as parcela_2_pago,
    d.created_at
  FROM decimo_terceiro d
  INNER JOIN funcionarios_mensalistas fm ON fm.id = d.funcionario_id
  LEFT JOIN decimo_terceiro_parcelas p1 ON p1.decimo_id = d.id AND p1.parcela_num = 1 AND p1.deleted_at IS NULL
  LEFT JOIN decimo_terceiro_parcelas p2 ON p2.decimo_id = d.id AND p2.parcela_num = 2 AND p2.deleted_at IS NULL
  WHERE d.competencia_ano = p_ano 
    AND d.competencia_mes = p_mes
    AND d.deleted_at IS NULL
  ORDER BY fm.nome;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE decimo_terceiro IS 'Registro de 13º salário por funcionário (apenas dezembro)';
COMMENT ON TABLE decimo_terceiro_parcelas IS 'Parcelas do 13º salário (1x ou 2x)';
COMMENT ON TABLE payroll_audit IS 'Auditoria de todas alterações em pagamentos';
COMMENT ON FUNCTION processar_decimo_terceiro IS 'Gera 13º salário e integra com ledger (Banco Itaú)';
COMMENT ON FUNCTION editar_data_pagamento IS 'Permite editar data de qualquer pagamento com auditoria';
COMMENT ON FUNCTION get_decimo_terceiro_por_competencia IS 'Retorna todos os 13º de uma competência com parcelas';
