/*
  # Popular Mensalistas e Criar Controle de Pagamentos
  
  1. Adicionar soft delete se não existir
  2. Popular funcionarios_mensalistas com 6 funcionários
  3. Criar tabela mensalista_pagamentos_competencia para controle
*/

-- 1. Adicionar deleted_at se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funcionarios_mensalistas' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE funcionarios_mensalistas ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- 2. Limpar dados existentes (apenas desenvolvimento)
DELETE FROM funcionarios_mensalistas;

-- 3. Popular com os 6 funcionários
INSERT INTO funcionarios_mensalistas (
  nome,
  funcao,
  salario_base,
  ajuda_custo,
  vale_salario,
  recebe_vt,
  vt_valor_unitario_dia,
  vt_dias_uteis_override,
  tipo_vinculo,
  ativo,
  aplica_encargos,
  usa_adiantamento
) VALUES
  ('Yuri Linero', 'Administrativo', 4500, 0, 0, false, 0, 22, 'CLT', true, false, false),
  ('David Parzanese', 'Engenheiro', 25000, 0, 0, false, 0, 22, 'CLT', true, false, false),
  ('Vanderlei Piovezani', 'Operacional', 3200, 0, 0, false, 0, 22, 'CLT', true, false, false),
  ('Marcelo Parzanese', 'Operacional', 4500, 500, 0, false, 0, 22, 'CLT', true, false, false),
  ('Antônio Ferreira (Neto)', 'Mestre de Obra', 4800, 500, 3200, true, 22.90, 22, 'CLT', true, false, true),
  ('Silas Martins', 'Almoxarifado', 1680, 0, 1120, true, 22.90, 22, 'CLT', true, false, true);

-- 4. Criar tabela de controle de pagamentos por competência
CREATE TABLE IF NOT EXISTS mensalista_pagamentos_competencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensalista_id uuid NOT NULL REFERENCES funcionarios_mensalistas(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  tipo_pagamento text NOT NULL CHECK (tipo_pagamento IN ('salario', 'vale_salario', 'vt')),
  data_pagamento date NOT NULL,
  valor numeric NOT NULL,
  forma text NOT NULL CHECK (forma IN ('banco', 'dinheiro')) DEFAULT 'banco',
  ledger_id uuid REFERENCES cash_ledger(id),
  observacao text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mensalista_pagamentos_mensalista ON mensalista_pagamentos_competencia(mensalista_id);
CREATE INDEX IF NOT EXISTS idx_mensalista_pagamentos_competencia ON mensalista_pagamentos_competencia(competencia);
CREATE INDEX IF NOT EXISTS idx_mensalista_pagamentos_tipo ON mensalista_pagamentos_competencia(tipo_pagamento);
CREATE INDEX IF NOT EXISTS idx_mensalista_pagamentos_deleted ON mensalista_pagamentos_competencia(deleted_at);

-- Constraint única: um pagamento de cada tipo por competência
CREATE UNIQUE INDEX IF NOT EXISTS idx_mensalista_pagamentos_unique 
  ON mensalista_pagamentos_competencia(mensalista_id, competencia, tipo_pagamento) 
  WHERE deleted_at IS NULL;

-- Desabilitar RLS
ALTER TABLE mensalista_pagamentos_competencia DISABLE ROW LEVEL SECURITY;

-- Comentários
COMMENT ON TABLE mensalista_pagamentos_competencia IS 'Controle de pagamentos mensais por competência';
COMMENT ON COLUMN mensalista_pagamentos_competencia.competencia IS 'Formato YYYY-MM (ex: 2025-10)';
COMMENT ON COLUMN mensalista_pagamentos_competencia.tipo_pagamento IS 'salario (dia 5) | vale_salario (dia 20) | vt (último dia útil)';
