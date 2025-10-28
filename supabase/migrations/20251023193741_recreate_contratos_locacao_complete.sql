/*
  # Recriar tabela contratos_locacao completa
*/

DROP TABLE IF EXISTS contratos_locacao CASCADE;

CREATE TABLE contratos_locacao (
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

CREATE INDEX idx_contratos_maquina ON contratos_locacao(maquina_id);
CREATE INDEX idx_contratos_status ON contratos_locacao(status);

ALTER TABLE contratos_locacao DISABLE ROW LEVEL SECURITY;
