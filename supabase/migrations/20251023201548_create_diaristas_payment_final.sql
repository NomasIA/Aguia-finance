/*
  # Sistema de Pagamento Semanal de Diaristas - Final
*/

DROP TABLE IF EXISTS diarista_pagamentos_semanais CASCADE;
DROP TABLE IF EXISTS diarista_dias_semana CASCADE;

CREATE TABLE diarista_dias_semana (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diarista_id uuid REFERENCES diaristas(id) ON DELETE CASCADE,
  semana_ano text NOT NULL,
  segunda numeric(10,2) DEFAULT 0,
  terca numeric(10,2) DEFAULT 0,
  quarta numeric(10,2) DEFAULT 0,
  quinta numeric(10,2) DEFAULT 0,
  sexta numeric(10,2) DEFAULT 0,
  sabado numeric(10,2) DEFAULT 0,
  domingo numeric(10,2) DEFAULT 0,
  total_semana numeric(10,2) DEFAULT 0,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_diarista_semana_unique ON diarista_dias_semana(diarista_id, semana_ano);

CREATE OR REPLACE FUNCTION calculate_diarista_total_semana()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_semana := COALESCE(NEW.segunda, 0) + COALESCE(NEW.terca, 0) + 
                      COALESCE(NEW.quarta, 0) + COALESCE(NEW.quinta, 0) + 
                      COALESCE(NEW.sexta, 0) + COALESCE(NEW.sabado, 0) + 
                      COALESCE(NEW.domingo, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_diarista_total
  BEFORE INSERT OR UPDATE ON diarista_dias_semana
  FOR EACH ROW
  EXECUTE FUNCTION calculate_diarista_total_semana();

CREATE TABLE diarista_pagamentos_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_ano text NOT NULL,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  valor_total numeric(10,2) NOT NULL,
  ledger_id uuid,
  detalhes jsonb,
  observacao text,
  pago boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_pagamentos_semana ON diarista_pagamentos_semanais(semana_ano);

TRUNCATE diaristas CASCADE;

INSERT INTO diaristas (nome, funcao, valor_diaria, ativo) VALUES
('Iury Freires Do Nascimento', 'Ajudante', 150.00, true),
('Endnaldo Da Silva', 'Ajudante', 150.00, true),
('Vitor Emanuel Tavares', 'Pedreiro', 190.00, true),
('Ronaldo de Souza', 'Pedreiro', 220.00, true),
('José Nivaldo dos Santos', 'Pedreiro', 240.00, true);

CREATE OR REPLACE FUNCTION get_semana_ano(data date DEFAULT CURRENT_DATE)
RETURNS text AS $$
BEGIN
  RETURN TO_CHAR(data, 'IYYY'::text) || '-' || TO_CHAR(data, 'IW'::text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION confirmar_pagamento_semanal_diaristas(
  p_semana_ano text,
  p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS uuid AS $$
DECLARE
  v_pagamento_id uuid;
  v_ledger_id uuid;
  v_total numeric(10,2);
  v_descricao text;
  v_diarista record;
  v_detalhes jsonb := '[]'::jsonb;
  v_obs_array text[] := ARRAY[]::text[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM diarista_pagamentos_semanais 
    WHERE semana_ano = p_semana_ano AND pago = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Pagamento da semana % já foi realizado', p_semana_ano;
  END IF;

  SELECT SUM(total_semana) INTO v_total
  FROM diarista_dias_semana
  WHERE semana_ano = p_semana_ano;

  IF v_total IS NULL OR v_total = 0 THEN
    RAISE EXCEPTION 'Nenhum valor registrado para a semana %', p_semana_ano;
  END IF;

  FOR v_diarista IN 
    SELECT d.id, d.nome, d.funcao, ds.total_semana,
           ds.segunda, ds.terca, ds.quarta, ds.quinta, 
           ds.sexta, ds.sabado, ds.domingo
    FROM diarista_dias_semana ds
    INNER JOIN diaristas d ON d.id = ds.diarista_id
    WHERE ds.semana_ano = p_semana_ano AND ds.total_semana > 0
    ORDER BY d.nome
  LOOP
    v_detalhes := v_detalhes || jsonb_build_object(
      'diarista_id', v_diarista.id,
      'nome', v_diarista.nome,
      'funcao', v_diarista.funcao,
      'total', v_diarista.total_semana,
      'dias', jsonb_build_object(
        'segunda', v_diarista.segunda,
        'terca', v_diarista.terca,
        'quarta', v_diarista.quarta,
        'quinta', v_diarista.quinta,
        'sexta', v_diarista.sexta,
        'sabado', v_diarista.sabado,
        'domingo', v_diarista.domingo
      )
    );
    
    v_obs_array := array_append(v_obs_array, 
      v_diarista.nome || ' (' || v_diarista.funcao || '): R$ ' || v_diarista.total_semana::text
    );
  END LOOP;

  v_descricao := 'Pagamento Diaristas - Semana ' || p_semana_ano;

  INSERT INTO cash_ledger (
    data, tipo, forma, categoria, descricao, valor, 
    origem, origem_id, conciliado, observacao
  ) VALUES (
    p_data_pagamento, 'saida', 'dinheiro', 'diarista', 
    v_descricao, v_total, 'pagamento_diarista_semanal', 
    NULL, false, array_to_string(v_obs_array, E'\n')
  )
  RETURNING id INTO v_ledger_id;

  INSERT INTO diarista_pagamentos_semanais (
    semana_ano, data_pagamento, valor_total, 
    ledger_id, detalhes, observacao, pago
  ) VALUES (
    p_semana_ano, p_data_pagamento, v_total, 
    v_ledger_id, v_detalhes, array_to_string(v_obs_array, E'\n'), true
  )
  RETURNING id INTO v_pagamento_id;

  RETURN v_pagamento_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION desfazer_pagamento_semanal_diaristas(
  p_semana_ano text
)
RETURNS boolean AS $$
DECLARE
  v_pagamento record;
BEGIN
  SELECT * INTO v_pagamento
  FROM diarista_pagamentos_semanais
  WHERE semana_ano = p_semana_ano AND pago = true AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento da semana % não encontrado', p_semana_ano;
  END IF;

  UPDATE cash_ledger
  SET deleted_at = now()
  WHERE id = v_pagamento.ledger_id;

  UPDATE diarista_pagamentos_semanais
  SET deleted_at = now(), pago = false
  WHERE id = v_pagamento.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
