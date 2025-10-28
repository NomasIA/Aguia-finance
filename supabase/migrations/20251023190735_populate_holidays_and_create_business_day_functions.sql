/*
  # Popular Feriados e Criar Funções de Dia Útil
  
  1. Adicionar campos faltantes na tabela feriados
  2. Popular feriados 2024-2026
  3. Criar funções para verificar e ajustar dias úteis
*/

-- Adicionar campos se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feriados' AND column_name = 'recorrente'
  ) THEN
    ALTER TABLE feriados ADD COLUMN recorrente boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feriados' AND column_name = 'observacao'
  ) THEN
    ALTER TABLE feriados ADD COLUMN observacao text;
  END IF;
END $$;

-- Limpar feriados existentes para repopular
DELETE FROM feriados;

-- Popular feriados nacionais (2024-2026)
INSERT INTO feriados (data, nome, tipo, recorrente, observacao) VALUES
  -- 2024
  ('2024-01-01', 'Confraternização Universal', 'nacional', true, 'Ano Novo'),
  ('2024-02-12', 'Carnaval - Segunda', 'nacional', false, 'Ponto facultativo'),
  ('2024-02-13', 'Carnaval - Terça', 'nacional', false, 'Feriado nacional'),
  ('2024-03-29', 'Sexta-feira Santa', 'nacional', false, 'Paixão de Cristo'),
  ('2024-04-21', 'Tiradentes', 'nacional', true, null),
  ('2024-05-01', 'Dia do Trabalho', 'nacional', true, null),
  ('2024-05-30', 'Corpus Christi', 'nacional', false, 'Ponto facultativo'),
  ('2024-09-07', 'Independência do Brasil', 'nacional', true, null),
  ('2024-10-12', 'Nossa Senhora Aparecida', 'nacional', true, 'Padroeira do Brasil'),
  ('2024-11-02', 'Finados', 'nacional', true, null),
  ('2024-11-15', 'Proclamação da República', 'nacional', true, null),
  ('2024-11-20', 'Consciência Negra', 'nacional', true, 'Feriado nacional desde 2024'),
  ('2024-12-25', 'Natal', 'nacional', true, null),
  
  -- 2025
  ('2025-01-01', 'Confraternização Universal', 'nacional', true, 'Ano Novo'),
  ('2025-03-03', 'Carnaval - Segunda', 'nacional', false, 'Ponto facultativo'),
  ('2025-03-04', 'Carnaval - Terça', 'nacional', false, 'Feriado nacional'),
  ('2025-04-18', 'Sexta-feira Santa', 'nacional', false, 'Paixão de Cristo'),
  ('2025-04-21', 'Tiradentes', 'nacional', true, null),
  ('2025-05-01', 'Dia do Trabalho', 'nacional', true, null),
  ('2025-06-19', 'Corpus Christi', 'nacional', false, 'Ponto facultativo'),
  ('2025-09-07', 'Independência do Brasil', 'nacional', true, null),
  ('2025-10-12', 'Nossa Senhora Aparecida', 'nacional', true, 'Padroeira do Brasil'),
  ('2025-11-02', 'Finados', 'nacional', true, null),
  ('2025-11-15', 'Proclamação da República', 'nacional', true, null),
  ('2025-11-20', 'Consciência Negra', 'nacional', true, null),
  ('2025-12-25', 'Natal', 'nacional', true, null),
  
  -- 2026
  ('2026-01-01', 'Confraternização Universal', 'nacional', true, 'Ano Novo'),
  ('2026-02-16', 'Carnaval - Segunda', 'nacional', false, 'Ponto facultativo'),
  ('2026-02-17', 'Carnaval - Terça', 'nacional', false, 'Feriado nacional'),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional', false, 'Paixão de Cristo'),
  ('2026-04-21', 'Tiradentes', 'nacional', true, null),
  ('2026-05-01', 'Dia do Trabalho', 'nacional', true, null),
  ('2026-06-04', 'Corpus Christi', 'nacional', false, 'Ponto facultativo'),
  ('2026-09-07', 'Independência do Brasil', 'nacional', true, null),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional', true, 'Padroeira do Brasil'),
  ('2026-11-02', 'Finados', 'nacional', true, null),
  ('2026-11-15', 'Proclamação da República', 'nacional', true, null),
  ('2026-11-20', 'Consciência Negra', 'nacional', true, null),
  ('2026-12-25', 'Natal', 'nacional', true, null);

-- Criar índice único se não existir
CREATE UNIQUE INDEX IF NOT EXISTS idx_feriados_data_tipo ON feriados(data, tipo);

-- Função para verificar se é dia útil
CREATE OR REPLACE FUNCTION is_business_day(check_date date)
RETURNS boolean AS $$
DECLARE
  day_of_week int;
  is_holiday boolean;
BEGIN
  day_of_week := EXTRACT(DOW FROM check_date);
  
  IF day_of_week = 0 OR day_of_week = 6 THEN
    RETURN false;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM feriados 
    WHERE data = check_date
  ) INTO is_holiday;
  
  RETURN NOT is_holiday;
END;
$$ LANGUAGE plpgsql;

-- Função para ajustar data considerando regras específicas
CREATE OR REPLACE FUNCTION adjust_to_business_day(
  original_date date,
  direction text DEFAULT 'before'
)
RETURNS date AS $$
DECLARE
  adjusted_date date;
  day_of_week int;
  max_iterations int := 15;
  iterations int := 0;
BEGIN
  adjusted_date := original_date;
  
  WHILE NOT is_business_day(adjusted_date) AND iterations < max_iterations LOOP
    day_of_week := EXTRACT(DOW FROM adjusted_date);
    
    IF direction = 'before' THEN
      IF day_of_week = 0 THEN
        adjusted_date := adjusted_date - INTERVAL '2 days';
      ELSIF day_of_week = 6 THEN
        adjusted_date := adjusted_date - INTERVAL '1 day';
      ELSE
        adjusted_date := adjusted_date - INTERVAL '1 day';
      END IF;
    ELSE
      IF day_of_week = 6 THEN
        adjusted_date := adjusted_date + INTERVAL '2 days';
      ELSIF day_of_week = 0 THEN
        adjusted_date := adjusted_date + INTERVAL '1 day';
      ELSE
        adjusted_date := adjusted_date + INTERVAL '1 day';
      END IF;
    END IF;
    
    iterations := iterations + 1;
  END LOOP;
  
  RETURN adjusted_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_business_day IS 'Verifica se data é dia útil (não é sábado, domingo ou feriado)';
COMMENT ON FUNCTION adjust_to_business_day IS 'Ajusta data para dia útil. Direction: before=anterior (sáb→sex, dom→seg anterior, feriado→anterior) | after=próximo (sáb/dom→seg próxima, feriado→próximo)';
