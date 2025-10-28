/*
  # Desabilitar RLS em todas as tabelas
  
  1. Objetivo
    - Desabilitar Row Level Security em todas as tabelas do projeto
    - Ambiente interno sem necessidade de RLS
    - Para uso com anon key em ambiente controlado
  
  2. Importante
    - Em produção com autenticação de usuários, reativar RLS
    - Criar policies específicas por tabela e perfil de usuário
    
  3. Tabelas afetadas
    - Pessoas/funcionários (mensalistas, diaristas, lançamentos, faltas, ajustes)
    - Obras/receitas/custos
    - Caixa e Banco
    - Maquinário e locações
    - Configurações e mapeamentos
*/

-- Pessoas/funcionários
ALTER TABLE IF EXISTS funcionarios_mensalistas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS diaristas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS diarista_lancamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS diarista_ponto DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS diarista_pagamentos_semanais DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mensalista_faltas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mensalista_pagamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vt_ajustes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS folha_pagamentos DISABLE ROW LEVEL SECURITY;

-- Obras/receitas/custos
ALTER TABLE IF EXISTS obras DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receitas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receitas_parcelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custos_fixos DISABLE ROW LEVEL SECURITY;

-- Caixa (dinheiro)
ALTER TABLE IF EXISTS cash_books DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_batch_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_closings DISABLE ROW LEVEL SECURITY;

-- Banco
ALTER TABLE IF EXISTS bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bank_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reconciliation_rules DISABLE ROW LEVEL SECURITY;

-- Maquinário e locações
ALTER TABLE IF EXISTS maquinas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS locacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS locacoes_contratos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contratos_locacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS caucao_movimentos DISABLE ROW LEVEL SECURITY;

-- Configurações
ALTER TABLE IF EXISTS config DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calendario_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feriados DISABLE ROW LEVEL SECURITY;

-- Mapeamentos/contabilidade
ALTER TABLE IF EXISTS accounting_export_mappings DISABLE ROW LEVEL SECURITY;

-- Admin
ALTER TABLE IF EXISTS app_admins DISABLE ROW LEVEL SECURITY;
