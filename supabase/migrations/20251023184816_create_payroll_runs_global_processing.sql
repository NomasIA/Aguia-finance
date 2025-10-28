/*
  # Criar sistema de processamento global de folha
  
  1. Criar tabela payroll_runs para controle de execuções
  2. Cada execução processa TODOS os funcionários de uma vez
  3. Cria UM lançamento consolidado no ledger
  4. Permite desfazer (undo) por competência
*/

-- Criar tabela de controle de execuções de folha
CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  tipo text CHECK (tipo IN ('SALARIO_5', 'VALE_20', 'VT_ULTIMO_DIA')) NOT NULL,
  total_funcionarios int DEFAULT 0,
  total_pago numeric DEFAULT 0,
  conta_banco text DEFAULT 'Itaú',
  status text CHECK (status IN ('processado', 'desfeito')) DEFAULT 'processado',
  ledger_id uuid REFERENCES cash_ledger(id),
  detalhes jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (competencia, tipo, deleted_at)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payroll_runs_competencia ON payroll_runs(competencia);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tipo ON payroll_runs(tipo);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_deleted ON payroll_runs(deleted_at);

-- Desabilitar RLS
ALTER TABLE payroll_runs DISABLE ROW LEVEL SECURITY;

-- Comentários
COMMENT ON TABLE payroll_runs IS 'Controle de processamento global da folha de mensalistas';
COMMENT ON COLUMN payroll_runs.competencia IS 'Data de referência (primeiro dia do mês)';
COMMENT ON COLUMN payroll_runs.tipo IS 'SALARIO_5 = dia 5 | VALE_20 = dia 20 | VT_ULTIMO_DIA = último dia útil';
COMMENT ON COLUMN payroll_runs.total_funcionarios IS 'Quantidade de funcionários processados';
COMMENT ON COLUMN payroll_runs.total_pago IS 'Valor total consolidado';
COMMENT ON COLUMN payroll_runs.ledger_id IS 'Referência ao lançamento consolidado no ledger';
COMMENT ON COLUMN payroll_runs.detalhes IS 'JSON com detalhes individuais (funcionário, valor)';
COMMENT ON COLUMN payroll_runs.status IS 'processado = ativo | desfeito = cancelado via undo';
