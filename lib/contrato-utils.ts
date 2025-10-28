import { supabase } from './supabase';
import { generateInstallments } from './installment-utils';
import { revalidateAfterContratos } from './revalidation-utils';
import { format, addMonths } from 'date-fns';

export interface CriarContratoOptions {
  maquinaId: string;
  obraId: string;
  dataInicio: Date;
  dias: number;
  valorDiaria: number;
  impostosPct: number;
  frete: number;
  caucaoPct: number;
}

export interface CriarContratoResult {
  success: boolean;
  error?: string;
  contratoId?: string;
  receitaId?: string;
}

/**
 * Gera número de contrato único
 */
async function gerarNumeroContrato(): Promise<string> {
  const ano = new Date().getFullYear();
  const { count } = await supabase
    .from('locacoes_contratos')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  const numero = (count || 0) + 1;
  return `LC${ano}-${String(numero).padStart(4, '0')}`;
}

/**
 * Cria contrato de locação e gera receitas/parcelas
 */
export async function criarContrato(
  options: CriarContratoOptions
): Promise<CriarContratoResult> {
  const { maquinaId, obraId, dataInicio, dias, valorDiaria, impostosPct, frete, caucaoPct } =
    options;

  try {
    // Buscar máquina
    const { data: maquina, error: maqError } = await supabase
      .from('maquinas')
      .select('*')
      .eq('id', maquinaId)
      .single();

    if (maqError || !maquina) {
      return { success: false, error: 'Máquina não encontrada' };
    }

    // Buscar obra
    const { data: obra, error: obraError } = await supabase
      .from('obras')
      .select('*')
      .eq('id', obraId)
      .single();

    if (obraError || !obra) {
      return { success: false, error: 'Obra não encontrada' };
    }

    // Calcular valores
    const valorBase = dias * valorDiaria;
    const valorImpostos = valorBase * (impostosPct / 100);
    const valorTotal = valorBase + valorImpostos + frete;
    const caucaoValor = valorTotal * (caucaoPct / 100);

    // Calcular data fim
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + dias - 1);

    // Gerar número de contrato
    const numeroContrato = await gerarNumeroContrato();

    // Criar contrato
    const { data: contrato, error: contratoError } = await supabase
      .from('locacoes_contratos')
      .insert([
        {
          maquina_id: maquinaId,
          obra_id: obraId,
          numero_contrato: numeroContrato,
          data_inicio: format(dataInicio, 'yyyy-MM-dd'),
          data_fim: format(dataFim, 'yyyy-MM-dd'),
          dias,
          valor_diaria: valorDiaria,
          valor_total: valorTotal,
          impostos_pct: impostosPct,
          frete,
          caucao_pct: caucaoPct,
          caucao_valor: caucaoValor,
          status: 'ativo',
        },
      ])
      .select()
      .single();

    if (contratoError) throw contratoError;

    // Atualizar status da máquina para "locado"
    await supabase.from('maquinas').update({ status: 'locado' }).eq('id', maquinaId);

    // Determinar número de parcelas (se >= 28 dias, mensal; senão, única)
    const numeroParcelas = dias >= 28 ? Math.ceil(dias / 30) : 1;

    // Gerar parcelas
    const installments = generateInstallments({
      valorTotal,
      numeroParcelas,
      vencimentoInicial: addMonths(dataInicio, 1), // Primeira parcela 1 mês após início
      periodicidade: 'mensal',
      ajustarFimDeSemana: true,
      fimDoMes: false,
    });

    // Criar receita mãe
    const { data: receita, error: receitaError } = await supabase
      .from('receitas')
      .insert([
        {
          obra_id: obraId,
          contrato_id: contrato.id,
          descricao: `Locação ${maquina.nome} - Contrato ${numeroContrato}`,
          valor_total: valorTotal,
          parcelas: numeroParcelas,
          vencimento: format(installments[0].vencimento, 'yyyy-MM-dd'),
          forma_recebimento: 'banco',
          recebido: false,
        },
      ])
      .select()
      .single();

    if (receitaError) throw receitaError;

    // Criar parcelas
    const parcelasData = installments.map((inst) => ({
      receita_id: receita.id,
      contrato_id: contrato.id,
      numero: inst.numero,
      valor: inst.valor,
      vencimento: format(inst.vencimento, 'yyyy-MM-dd'),
      forma_recebimento: 'banco',
      recebido: false,
      conciliado: false,
    }));

    const { error: parcelasError } = await supabase
      .from('receitas_parcelas')
      .insert(parcelasData);

    if (parcelasError) throw parcelasError;

    // Trigger revalidação
    revalidateAfterContratos();

    return {
      success: true,
      contratoId: contrato.id,
      receitaId: receita.id,
    };
  } catch (error: any) {
    console.error('Erro ao criar contrato:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Marca parcela de contrato como recebida
 */
export async function marcarParcelaContratoRecebida(parcelaId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Buscar parcela
    const { data: parcela, error: fetchError } = await supabase
      .from('receitas_parcelas')
      .select('*')
      .eq('id', parcelaId)
      .single();

    if (fetchError || !parcela) {
      return { success: false, error: 'Parcela não encontrada' };
    }

    if (parcela.recebido) {
      return { success: false, error: 'Parcela já está marcada como recebida' };
    }

    // Buscar banco
    const { data: bank } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('nome', 'Itaú – Conta Principal')
      .single();

    const bankAccountId = bank?.id || null;

    // Buscar contrato para descrição
    const { data: contrato } = await supabase
      .from('locacoes_contratos')
      .select('numero_contrato')
      .eq('id', parcela.contrato_id)
      .single();

    // Criar entrada no cash_ledger
    const { data: ledger, error: ledgerError } = await supabase
      .from('cash_ledger')
      .insert([
        {
          data: format(new Date(), 'yyyy-MM-dd'),
          tipo: 'entrada',
          forma: parcela.forma_recebimento,
          categoria: 'locacao_contrato',
          descricao: `Recebimento Contrato ${contrato?.numero_contrato || ''} - Parcela ${parcela.numero}`,
          valor: parcela.valor,
          bank_account_id: bankAccountId,
          receita_parcela_id: parcela.id,
        },
      ])
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    // Marcar parcela como recebida
    const { error: updateError } = await supabase
      .from('receitas_parcelas')
      .update({
        recebido: true,
        data_recebimento: format(new Date(), 'yyyy-MM-dd'),
      })
      .eq('id', parcelaId);

    if (updateError) throw updateError;

    // Atualizar saldo do banco
    if (bankAccountId) {
      const { data: current } = await supabase
        .from('bank_accounts')
        .select('saldo_atual')
        .eq('id', bankAccountId)
        .single();

      const novoSaldo = (current?.saldo_atual || 0) + parcela.valor;

      await supabase
        .from('bank_accounts')
        .update({ saldo_atual: novoSaldo })
        .eq('id', bankAccountId);
    }

    // Trigger revalidação
    revalidateAfterContratos();

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao marcar parcela como recebida:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca contratos ativos com filtros
 */
export async function buscarContratos(filtros?: {
  obraId?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}) {
  let query = supabase
    .from('locacoes_contratos')
    .select(
      `
      *,
      maquinas (nome, categoria),
      obras (nome_obra, cliente)
    `
    )
    .is('deleted_at', null)
    .order('data_inicio', { ascending: false });

  if (filtros?.obraId) {
    query = query.eq('obra_id', filtros.obraId);
  }

  if (filtros?.status) {
    query = query.eq('status', filtros.status);
  }

  if (filtros?.dataInicio) {
    query = query.gte('data_inicio', filtros.dataInicio);
  }

  if (filtros?.dataFim) {
    query = query.lte('data_fim', filtros.dataFim);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar contratos:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca parcelas de um contrato
 */
export async function buscarParcelasContrato(contratoId: string) {
  const { data, error } = await supabase
    .from('receitas_parcelas')
    .select('*')
    .eq('contrato_id', contratoId)
    .is('deleted_at', null)
    .order('numero');

  if (error) {
    console.error('Erro ao buscar parcelas:', error);
    return [];
  }

  return data || [];
}

/**
 * Encerra contrato (marca máquina como disponível)
 */
export async function encerrarContrato(contratoId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: contrato, error: fetchError } = await supabase
      .from('locacoes_contratos')
      .select('maquina_id')
      .eq('id', contratoId)
      .single();

    if (fetchError || !contrato) {
      return { success: false, error: 'Contrato não encontrado' };
    }

    // Atualizar status do contrato
    await supabase
      .from('locacoes_contratos')
      .update({ status: 'encerrado' })
      .eq('id', contratoId);

    // Atualizar status da máquina para disponível
    await supabase
      .from('maquinas')
      .update({ status: 'disponivel' })
      .eq('id', contrato.maquina_id);

    // Trigger revalidação
    revalidateAfterContratos();

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao encerrar contrato:', error);
    return { success: false, error: error.message };
  }
}
