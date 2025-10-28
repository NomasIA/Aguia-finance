/*
  # Sistema de Locação de Maquinário
  
  1. Ajustar tabela maquinas
  2. Popular com maquinário inicial
  3. Criar tabela contratos_locacao
  4. Criar funções
*/

ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS valor_unitario numeric DEFAULT 0;
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT 0;
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS item text;

DELETE FROM maquinas;

INSERT INTO maquinas (item, nome, quantidade, valor_unitario, valor_total, valor_diaria, status, categoria, custo_aquisicao) VALUES
  ('Inversor de solda 140A Boxer', 'Inversor de solda 140A Boxer', 1, 543.40, 543.40, 50.00, 'Disponível', 'Equipamento de Solda', 543.40),
  ('Serra mármore Aika AL-CM110', 'Serra mármore Aika AL-CM110', 1, 330.00, 330.00, 35.00, 'Disponível', 'Ferramenta de Corte', 330.00),
  ('Andaime 1x1,5', 'Andaime 1x1,5', 20, 155.00, 3100.00, 25.00, 'Disponível', 'Estrutura', 155.00),
  ('Plataforma metálica', 'Plataforma metálica', 12, 165.00, 1980.00, 28.00, 'Disponível', 'Estrutura', 165.00),
  ('Betoneira 400L CSM 220V', 'Betoneira 400L CSM 220V', 1, 4433.57, 4433.57, 120.00, 'Disponível', 'Equipamento Pesado', 4433.57);

CREATE TABLE IF NOT EXISTS contratos_locacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id uuid REFERENCES maquinas(id) NOT NULL,
  cliente text NOT NULL,
  obra text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias_locacao integer NOT NULL,
  valor_diaria numeric NOT NULL,
  valor_total numeric NOT NULL,
  valor_recebido numeric DEFAULT 0,
  forma_pagamento text DEFAULT 'banco',
  status text DEFAULT 'ativo',
  recebido boolean DEFAULT false,
  data_recebimento date,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contratos_maquina ON contratos_locacao(maquina_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON contratos_locacao(status);

ALTER TABLE contratos_locacao DISABLE ROW LEVEL SECURITY;
