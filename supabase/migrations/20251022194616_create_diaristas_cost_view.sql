/*
  # Create Diaristas Cost View
  
  1. View
    - `vw_custos_diaristas_periodo`
      - Aggregates paid batches from diarista_lancamentos
      - Shows period start, period end, total, and payment status
      - Only includes paid batches for KPI calculations
  
  2. Purpose
    - Used by Dashboard to show Custo Execução Interna - Diaristas
    - Enables period filtering for financial reports
*/

create or replace view vw_custos_diaristas_periodo as
select
  dl.id,
  dl.periodo_inicio as semana_inicio,
  dl.periodo_fim as semana_fim,
  dl.valor_total as total,
  dl.pago as status,
  dl.data_pagamento as pago_em,
  dl.created_at as criado_em,
  dl.dias_trabalhados,
  dl.diarista_id
from diarista_lancamentos dl
where dl.pago = true
order by dl.periodo_inicio desc;
