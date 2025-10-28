import { supabase } from './supabase';
import { revalidateAfterFolha } from './revalidation-utils';
import { format, startOfMonth, lastDayOfMonth } from 'date-fns';

export interface ProcessarPagamentoOptions {
  funcionarioId: string;
  competencia: Date;
  tipo: 'adiantamento' | 'salario' | 'vt';
  formaPagamento: 'banco' | 'dinheiro';
  meioBanco?: string;
}

export interface ProcessarPagamentoResult {
  success: boolean;
  error?: string;
  folhaId?: string;
  valor?: number;
}

/**
 * Calcula o valor do adiantamento (40% do salário base)
 */
function calcularAdiantamento(salarioBase: number): number {
  return Math.round(salarioBase * 0.4 * 100) / 100;
}

/**
 * Calcula o valor do salário (60% + encargos)
 */
function calcularSalario(funcionario: any): {
  valor: number;
  salarioBase: number;
  ajudaCusto: number;
  valeSalario: number;
  encargoValor: number;
} {
  const salarioBase = (funcionario.salario_base || 0) * 0.6;
  const ajudaCusto = funcionario.ajuda_custo || 0;
  const valeSalario = funcionario.vale_salario || 0;

  let encargoValor = 0;
  if (funcionario.aplica_encargos) {
    const base = funcionario.salario_base || 0;
    encargoValor =
      base * ((funcionario.encargos_pct || 0) / 100) +
      base * ((funcionario.inss_pct || 0) / 100) +
      base * ((funcionario.fgts_pct || 0) / 100) +
      base * ((funcionario.outros_encargos_pct || 0) / 100);
  }

  const valor = salarioBase + ajudaCusto + valeSalario + encargoValor;

  return {
    valor: Math.round(valor * 100) / 100,
    salarioBase: Math.round(salarioBase * 100) / 100,
    ajudaCusto: Math.round(ajudaCusto * 100) / 100,
    valeSalario: Math.round(valeSalario * 100) / 100,
    encargoValor: Math.round(encargoValor * 100) / 100,
  };
}

/**
 * Calcula o valor do VT (considerando faltas do mês anterior)
 */
async function calcularVT(funcionarioId: string, competencia: Date): Promise<number> {
  // Buscar dados do funcionário
  const { data: funcionario, error: funcError } = await supabase
    .from('funcionarios_mensalistas')
    .select('*')
    .eq('id', funcionarioId)
    .single();

  if (funcError || !funcionario || !funcionario.recebe_vt) {
    return 0;
  }

  const diasUteis = funcionario.vt_dias_uteis_override || 22;
  const valorUnitario = funcionario.vt_valor_unitario_dia || 0;

  // Buscar faltas do mês anterior
  const mesAnterior = new Date(competencia);
  mesAnterior.setMonth(mesAnterior.getMonth() - 1);

  const inicioMesAnterior = startOfMonth(mesAnterior);
  const fimMesAnterior = lastDayOfMonth(mesAnterior);

  const { data: faltas } = await supabase
    .from('mensalista_faltas')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .gte('data', format(inicioMesAnterior, 'yyyy-MM-dd'))
    .lte('data', format(fimMesAnterior, 'yyyy-MM-dd'));

  const diasDesconto = faltas?.filter((f) => !f.justificada).length || 0;
  const diasPagar = Math.max(0, diasUteis - diasDesconto);

  return Math.round(diasPagar * valorUnitario * 100) / 100;
}

/**
 * Verifica se já existe pagamento processado
 */
async function verificarDuplicacao(
  funcionarioId: string,
  competencia: Date,
  tipo: string
): Promise<boolean> {
  const competenciaStr = format(startOfMonth(competencia), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('folha_pagamentos')
    .select('id')
    .eq('funcionario_id', funcionarioId)
    .eq('competencia', competenciaStr)
    .eq('tipo', tipo)
    .is('deleted_at', null)
    .maybeSingle();

  return !!data;
}

/**
 * Processa pagamento de funcionário mensalista
 */
export async function processarPagamento(
  options: ProcessarPagamentoOptions
): Promise<ProcessarPagamentoResult> {
  const { funcionarioId, competencia, tipo, formaPagamento, meioBanco } = options;

  try {
    // Verificar duplicação
    const jaProcessado = await verificarDuplicacao(funcionarioId, competencia, tipo);
    if (jaProcessado) {
      return {
        success: false,
        error: `Pagamento de ${tipo} já foi processado para esta competência`,
      };
    }

    // Buscar funcionário
    const { data: funcionario, error: funcError } = await supabase
      .from('funcionarios_mensalistas')
      .select('*')
      .eq('id', funcionarioId)
      .single();

    if (funcError || !funcionario) {
      return { success: false, error: 'Funcionário não encontrado' };
    }

    // Calcular valores
    let valor = 0;
    let detalhes: any = {};

    if (tipo === 'adiantamento') {
      valor = calcularAdiantamento(funcionario.salario_base || 0);
      detalhes = { salario_base: valor };
    } else if (tipo === 'salario') {
      const calc = calcularSalario(funcionario);
      valor = calc.valor;
      detalhes = {
        salario_base: calc.salarioBase,
        ajuda_custo: calc.ajudaCusto,
        vale_salario: calc.valeSalario,
        encargos_valor: calc.encargoValor,
      };
    } else if (tipo === 'vt') {
      valor = await calcularVT(funcionarioId, competencia);
      detalhes = { vt_valor: valor };
    }

    if (valor <= 0) {
      return { success: false, error: 'Valor do pagamento é zero ou negativo' };
    }

    // Buscar conta/caixa
    let bankAccountId: string | null = null;
    let cashBookId: string | null = null;

    if (formaPagamento === 'banco') {
      const { data: bank } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('nome', 'Itaú – Conta Principal')
        .single();
      bankAccountId = bank?.id || null;
    } else {
      const { data: cash } = await supabase
        .from('cash_books')
        .select('id')
        .eq('nome', 'Caixa Dinheiro (Físico)')
        .single();
      cashBookId = cash?.id || null;
    }

    const competenciaStr = format(startOfMonth(competencia), 'yyyy-MM-dd');

    // Criar lançamento no cash_ledger
    const { data: ledger, error: ledgerError } = await supabase
      .from('cash_ledger')
      .insert([
        {
          data: format(new Date(), 'yyyy-MM-dd'),
          tipo: 'saida',
          forma: formaPagamento,
          categoria: `folha_${tipo}`,
          descricao: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} - ${funcionario.nome} (${format(competencia, 'MM/yyyy')})`,
          valor,
          bank_account_id: bankAccountId,
          cash_book_id: cashBookId,
          funcionario_id: funcionarioId,
        },
      ])
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    // Criar registro na folha_pagamentos
    const { data: folha, error: folhaError } = await supabase
      .from('folha_pagamentos')
      .insert([
        {
          funcionario_id: funcionarioId,
          competencia: competenciaStr,
          tipo,
          valor,
          ...detalhes,
          forma_pagamento: formaPagamento,
          meio_banco: meioBanco,
          pago: true,
          pago_em: format(new Date(), 'yyyy-MM-dd'),
          bank_account_id: bankAccountId,
          cash_book_id: cashBookId,
          cash_ledger_id: ledger.id,
        },
      ])
      .select()
      .single();

    if (folhaError) throw folhaError;

    // Atualizar saldo
    await atualizarSaldo(formaPagamento, -valor, bankAccountId, cashBookId);

    // Trigger revalidação
    revalidateAfterFolha();

    return {
      success: true,
      folhaId: folha.id,
      valor,
    };
  } catch (error: any) {
    console.error('Erro ao processar pagamento:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza saldo após pagamento
 */
async function atualizarSaldo(
  forma: string,
  delta: number,
  bankAccountId: string | null,
  cashBookId: string | null
) {
  if (forma === 'banco' && bankAccountId) {
    const { data: current } = await supabase
      .from('bank_accounts')
      .select('saldo_atual')
      .eq('id', bankAccountId)
      .single();

    const novoSaldo = (current?.saldo_atual || 0) + delta;

    await supabase
      .from('bank_accounts')
      .update({ saldo_atual: novoSaldo })
      .eq('id', bankAccountId);
  } else if (forma === 'dinheiro' && cashBookId) {
    const { data: current } = await supabase
      .from('cash_books')
      .select('saldo_atual')
      .eq('id', cashBookId)
      .single();

    const novoSaldo = (current?.saldo_atual || 0) + delta;

    await supabase.from('cash_books').update({ saldo_atual: novoSaldo }).eq('id', cashBookId);
  }
}

/**
 * Busca histórico de pagamentos de um funcionário
 */
export async function buscarHistoricoPagamentos(funcionarioId: string, ano: number, mes: number) {
  const competenciaStr = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('folha_pagamentos')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .eq('competencia', competenciaStr)
    .is('deleted_at', null);

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }

  return data || [];
}

/**
 * Verifica quais tipos de pagamento já foram processados
 */
export async function verificarPagamentosProcessados(
  funcionarioId: string,
  ano: number,
  mes: number
): Promise<{
  adiantamento: boolean;
  salario: boolean;
  vt: boolean;
}> {
  const historico = await buscarHistoricoPagamentos(funcionarioId, ano, mes);

  return {
    adiantamento: historico.some((h) => h.tipo === 'adiantamento'),
    salario: historico.some((h) => h.tipo === 'salario'),
    vt: historico.some((h) => h.tipo === 'vt'),
  };
}
