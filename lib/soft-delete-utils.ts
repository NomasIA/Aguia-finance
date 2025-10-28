import { supabase } from './supabase';
import { revalidateAll } from './revalidation-utils';

export interface SoftDeleteOptions {
  table: string;
  id: string;
  undoRecebido?: boolean;
  undoConciliado?: boolean;
}

export interface SoftDeleteResult {
  success: boolean;
  error?: string;
  affectedRows?: number;
}

/**
 * Executa soft delete em qualquer tabela
 * Marca deleted_at com timestamp atual
 */
export async function softDelete(options: SoftDeleteOptions): Promise<SoftDeleteResult> {
  const { table, id, undoRecebido, undoConciliado } = options;

  try {
    // Se precisa desfazer recebido/conciliado antes
    if (undoRecebido || undoConciliado) {
      const updates: any = {};

      if (undoRecebido) {
        updates.recebido = false;
        updates.data_recebimento = null;
      }

      if (undoConciliado) {
        updates.conciliado = false;
      }

      await supabase.from(table).update(updates).eq('id', id);
    }

    // Executar soft delete
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    // Trigger revalidação global
    revalidateAll();

    return { success: true, affectedRows: 1 };
  } catch (error: any) {
    console.error('Erro no soft delete:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Soft delete de receita completa (cascata para parcelas)
 */
export async function softDeleteReceita(receitaId: string): Promise<SoftDeleteResult> {
  try {
    // Marcar receita como deletada
    const { error: receitaError } = await supabase
      .from('receitas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', receitaId);

    if (receitaError) throw receitaError;

    // Marcar todas as parcelas como deletadas
    const { error: parcelasError } = await supabase
      .from('receitas_parcelas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('receita_id', receitaId);

    if (parcelasError) throw parcelasError;

    // Trigger revalidação
    revalidateAll();

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao deletar receita:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Soft delete de parcela individual
 * Se estiver recebida/conciliada, desfaz antes
 */
export async function softDeleteParcela(
  parcelaId: string,
  undoIfReceived: boolean = false
): Promise<SoftDeleteResult> {
  try {
    // Buscar parcela para verificar status
    const { data: parcela, error: fetchError } = await supabase
      .from('receitas_parcelas')
      .select('*')
      .eq('id', parcelaId)
      .single();

    if (fetchError) throw fetchError;

    // Se está recebida ou conciliada e foi solicitado desfazer
    if (undoIfReceived && (parcela.recebido || parcela.conciliado)) {
      await supabase
        .from('receitas_parcelas')
        .update({
          recebido: false,
          data_recebimento: null,
          conciliado: false,
        })
        .eq('id', parcelaId);

      // Se estava vinculada a cash_ledger, deletar o lançamento também
      if (parcela.recebido) {
        await supabase
          .from('cash_ledger')
          .update({ deleted_at: new Date().toISOString() })
          .eq('receita_parcela_id', parcelaId);
      }
    }

    // Executar soft delete
    const { error } = await supabase
      .from('receitas_parcelas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', parcelaId);

    if (error) throw error;

    // Trigger revalidação
    revalidateAll();

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao deletar parcela:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Soft delete de entrada/saída do cash_ledger
 * Se estiver conciliada, remove o vínculo
 */
export async function softDeleteCashLedger(ledgerId: string): Promise<SoftDeleteResult> {
  try {
    // Buscar lançamento
    const { data: ledger, error: fetchError } = await supabase
      .from('cash_ledger')
      .select('*')
      .eq('id', ledgerId)
      .single();

    if (fetchError) throw fetchError;

    // Se estiver conciliado, remover vínculo
    if (ledger.conciliado && ledger.bank_transaction_id) {
      await supabase
        .from('bank_transactions')
        .update({
          conciliado: false,
          ledger_id: null,
        })
        .eq('id', ledger.bank_transaction_id);
    }

    // Se estiver vinculado a uma parcela, desfazer recebimento
    if (ledger.receita_parcela_id) {
      await supabase
        .from('receitas_parcelas')
        .update({
          recebido: false,
          data_recebimento: null,
          conciliado: false,
        })
        .eq('id', ledger.receita_parcela_id);
    }

    // Executar soft delete
    const { error } = await supabase
      .from('cash_ledger')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', ledgerId);

    if (error) throw error;

    // Atualizar saldo
    await recalcularSaldos();

    // Trigger revalidação
    revalidateAll();

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao deletar lançamento:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recalcula saldos de banco e caixa
 */
async function recalcularSaldos() {
  try {
    // Recalcular saldo do Banco Itaú
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('id, saldo_inicial')
      .eq('nome', 'Itaú – Conta Principal')
      .single();

    if (bankAccount) {
      const { data: ledgers } = await supabase
        .from('cash_ledger')
        .select('tipo, valor')
        .eq('forma', 'banco')
        .is('deleted_at', null);

      let saldo = bankAccount.saldo_inicial || 0;
      ledgers?.forEach((l) => {
        if (l.tipo === 'entrada') saldo += l.valor;
        if (l.tipo === 'saida') saldo -= l.valor;
      });

      await supabase
        .from('bank_accounts')
        .update({ saldo_atual: saldo })
        .eq('id', bankAccount.id);
    }

    // Recalcular saldo do Caixa Dinheiro
    const { data: cashBook } = await supabase
      .from('cash_books')
      .select('id, saldo_inicial')
      .eq('nome', 'Caixa Dinheiro (Físico)')
      .single();

    if (cashBook) {
      const { data: ledgers } = await supabase
        .from('cash_ledger')
        .select('tipo, valor')
        .eq('forma', 'dinheiro')
        .is('deleted_at', null);

      let saldo = cashBook.saldo_inicial || 0;
      ledgers?.forEach((l) => {
        if (l.tipo === 'entrada') saldo += l.valor;
        if (l.tipo === 'saida') saldo -= l.valor;
      });

      await supabase
        .from('cash_books')
        .update({ saldo_atual: saldo })
        .eq('id', cashBook.id);
    }
  } catch (error) {
    console.error('Erro ao recalcular saldos:', error);
  }
}

/**
 * Verifica se um item pode ser deletado
 */
export async function canDelete(table: string, id: string): Promise<{
  canDelete: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];

  try {
    if (table === 'receitas_parcelas') {
      const { data: parcela } = await supabase
        .from('receitas_parcelas')
        .select('recebido, conciliado')
        .eq('id', id)
        .single();

      if (parcela?.recebido) {
        warnings.push('Esta parcela está marcada como recebida');
      }

      if (parcela?.conciliado) {
        warnings.push('Esta parcela está conciliada com transação bancária');
      }
    }

    if (table === 'cash_ledger') {
      const { data: ledger } = await supabase
        .from('cash_ledger')
        .select('conciliado, receita_parcela_id')
        .eq('id', id)
        .single();

      if (ledger?.conciliado) {
        warnings.push('Este lançamento está conciliado com transação bancária');
      }

      if (ledger?.receita_parcela_id) {
        warnings.push('Este lançamento está vinculado a uma parcela de receita');
      }
    }

    return { canDelete: true, warnings };
  } catch (error) {
    console.error('Erro ao verificar se pode deletar:', error);
    return { canDelete: false, warnings: ['Erro ao verificar permissões'] };
  }
}
