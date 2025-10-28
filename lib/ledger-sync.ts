/**
 * Utilitário central para sincronização do Ledger
 * Garante que todas as operações reflitam em tempo real em:
 * - Visão Geral (KPIs)
 * - Entradas & Saídas
 * - Conciliação
 * - Saldos (Banco e Dinheiro)
 * - Relatórios
 */

import { supabase } from './supabase';

export interface RecalcResult {
  saldo_banco: number;
  saldo_dinheiro: number;
  saldo_total: number;
  entradas_banco: number;
  entradas_dinheiro: number;
  saidas_banco: number;
  saidas_dinheiro: number;
  total_entradas: number;
  total_saidas: number;
  lucro: number;
  margem: number;
}

/**
 * Recalcula todos os KPIs e saldos baseados no ledger
 * @param dataInicio - Data inicial do período (opcional)
 * @param dataFim - Data final do período (opcional)
 */
export async function recalcAll(
  dataInicio?: string,
  dataFim?: string
): Promise<RecalcResult> {
  try {
    let query = supabase
      .from('cash_ledger')
      .select('tipo, forma, valor')
      .is('deleted_at', null);

    if (dataInicio) {
      query = query.gte('data', dataInicio);
    }

    if (dataFim) {
      query = query.lte('data', dataFim);
    }

    const { data: ledgerData, error } = await query;

    if (error) throw error;

    const ledger = ledgerData || [];

    const entradasBanco = ledger
      .filter(l => l.tipo === 'entrada' && l.forma === 'banco')
      .reduce((sum, l) => sum + parseFloat(l.valor || '0'), 0);

    const entradasDinheiro = ledger
      .filter(l => l.tipo === 'entrada' && l.forma === 'dinheiro')
      .reduce((sum, l) => sum + parseFloat(l.valor || '0'), 0);

    const saidasBanco = ledger
      .filter(l => l.tipo === 'saida' && l.forma === 'banco')
      .reduce((sum, l) => sum + parseFloat(l.valor || '0'), 0);

    const saidasDinheiro = ledger
      .filter(l => l.tipo === 'saida' && l.forma === 'dinheiro')
      .reduce((sum, l) => sum + parseFloat(l.valor || '0'), 0);

    const saldoBanco = entradasBanco - saidasBanco;
    const saldoDinheiro = entradasDinheiro - saidasDinheiro;
    const saldoTotal = saldoBanco + saldoDinheiro;

    const totalEntradas = entradasBanco + entradasDinheiro;
    const totalSaidas = saidasBanco + saidasDinheiro;
    const lucro = totalEntradas - totalSaidas;
    const margem = totalEntradas > 0 ? (lucro / totalEntradas) * 100 : 0;

    await updateBankAndCashSaldos(saldoBanco, saldoDinheiro);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledger-sync', {
        detail: {
          saldo_banco: saldoBanco,
          saldo_dinheiro: saldoDinheiro,
          saldo_total: saldoTotal
        }
      }));
    }

    return {
      saldo_banco: saldoBanco,
      saldo_dinheiro: saldoDinheiro,
      saldo_total: saldoTotal,
      entradas_banco: entradasBanco,
      entradas_dinheiro: entradasDinheiro,
      saidas_banco: saidasBanco,
      saidas_dinheiro: saidasDinheiro,
      total_entradas: totalEntradas,
      total_saidas: totalSaidas,
      lucro,
      margem
    };
  } catch (error) {
    console.error('Erro ao recalcular:', error);
    throw error;
  }
}

/**
 * Atualiza os saldos nas tabelas bank_accounts e cash_books
 */
async function updateBankAndCashSaldos(saldoBanco: number, saldoDinheiro: number) {
  try {
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('nome', 'Itaú – Conta Principal')
      .maybeSingle();

    if (bankAccount) {
      await supabase
        .from('bank_accounts')
        .update({ saldo_atual: saldoBanco })
        .eq('id', bankAccount.id);
    }

    const { data: cashBook } = await supabase
      .from('cash_books')
      .select('id')
      .eq('nome', 'Caixa Dinheiro (Físico)')
      .maybeSingle();

    if (cashBook) {
      await supabase
        .from('cash_books')
        .update({ saldo_atual: saldoDinheiro })
        .eq('id', cashBook.id);
    }
  } catch (error) {
    console.error('Erro ao atualizar saldos:', error);
  }
}

/**
 * Cria um lançamento no ledger
 */
export async function createLedgerEntry(entry: {
  data: string;
  tipo: 'entrada' | 'saida';
  forma: 'banco' | 'dinheiro';
  categoria: string;
  descricao: string;
  valor: number;
  origem?: string;
  origem_id?: string | null;
  obra_id?: string;
  funcionario_id?: string;
  maquina_id?: string;
  receita_id?: string;
  receita_parcela_id?: string;
}) {
  try {
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('nome', 'Itaú – Conta Principal')
      .maybeSingle();

    const { data: cashBook } = await supabase
      .from('cash_books')
      .select('id')
      .eq('nome', 'Caixa Dinheiro (Físico)')
      .maybeSingle();

    const { data, error } = await supabase
      .from('cash_ledger')
      .insert([{
        data: entry.data,
        tipo: entry.tipo,
        forma: entry.forma,
        categoria: entry.categoria,
        descricao: entry.descricao,
        valor: entry.valor,
        origem: entry.origem,
        origem_id: entry.origem_id,
        bank_account_id: entry.forma === 'banco' ? bankAccount?.id : null,
        cash_book_id: entry.forma === 'dinheiro' ? cashBook?.id : null,
        obra_id: entry.obra_id,
        funcionario_id: entry.funcionario_id,
        maquina_id: entry.maquina_id,
        receita_id: entry.receita_id,
        receita_parcela_id: entry.receita_parcela_id,
        conciliado: false
      }])
      .select()
      .single();

    if (error) throw error;

    await recalcAll();

    return data;
  } catch (error) {
    console.error('Erro ao criar lançamento:', error);
    throw error;
  }
}

/**
 * Soft delete de um lançamento no ledger
 */
export async function deleteLedgerEntry(id: string) {
  try {
    const { error } = await supabase
      .from('cash_ledger')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await recalcAll();

    return true;
  } catch (error) {
    console.error('Erro ao excluir lançamento:', error);
    throw error;
  }
}

/**
 * Marca um lançamento como conciliado
 */
export async function conciliarLedgerEntry(id: string, bankTransactionId?: string) {
  try {
    const { error } = await supabase
      .from('cash_ledger')
      .update({
        conciliado: true,
        bank_transaction_id: bankTransactionId
      })
      .eq('id', id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Erro ao conciliar lançamento:', error);
    throw error;
  }
}

/**
 * Desmarca um lançamento como conciliado
 */
export async function desconciliarLedgerEntry(id: string) {
  try {
    const { error } = await supabase
      .from('cash_ledger')
      .update({
        conciliado: false,
        bank_transaction_id: null
      })
      .eq('id', id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Erro ao desconciliar lançamento:', error);
    throw error;
  }
}
