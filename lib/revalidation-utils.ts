/**
 * Utilities para revalidação global de cache e sincronização
 * Garante que todas as operações financeiras reflitam imediatamente em:
 * - Visão Geral (Overview/KPIs)
 * - Entradas & Saídas
 * - Conciliação
 * - Relatórios
 * - Saldos (Banco e Dinheiro)
 */

export type RevalidationContext =
  | 'overview'
  | 'entradas-saidas'
  | 'conciliacao'
  | 'relatorios'
  | 'saldos'
  | 'obras'
  | 'receitas'
  | 'maquinarios'
  | 'contratos'
  | 'folha'
  | 'funcionarios'
  | 'diaristas'
  | 'all';

/**
 * Função para notificar componentes sobre mudanças
 * Em uma aplicação real, isso usaria um sistema de eventos ou React Query
 */
export function triggerRevalidation(contexts: RevalidationContext[]) {
  if (contexts.includes('all')) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('revalidate-all'));
    }
    return;
  }

  contexts.forEach((context) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`revalidate-${context}`));
    }
  });
}

/**
 * Hook para escutar mudanças
 */
export function useRevalidation(context: RevalidationContext, callback: () => void) {
  if (typeof window === 'undefined') return;

  const handleRevalidate = () => callback();
  const handleRevalidateAll = () => callback();

  window.addEventListener(`revalidate-${context}`, handleRevalidate);
  window.addEventListener('revalidate-all', handleRevalidateAll);

  return () => {
    window.removeEventListener(`revalidate-${context}`, handleRevalidate);
    window.removeEventListener('revalidate-all', handleRevalidateAll);
  };
}

/**
 * Trigger revalidation após operações financeiras
 */
export function revalidateAfterFinancialOperation() {
  triggerRevalidation(['overview', 'entradas-saidas', 'saldos', 'relatorios']);
}

/**
 * Trigger revalidation após operações de conciliação
 */
export function revalidateAfterConciliation() {
  triggerRevalidation(['conciliacao', 'overview', 'saldos', 'entradas-saidas']);
}

/**
 * Trigger revalidation após operações de receitas/obras
 */
export function revalidateAfterReceitas() {
  triggerRevalidation(['obras', 'receitas', 'overview', 'entradas-saidas', 'relatorios']);
}

/**
 * Trigger revalidation após operações de contratos
 */
export function revalidateAfterContratos() {
  triggerRevalidation(['contratos', 'maquinarios', 'obras', 'receitas', 'overview', 'entradas-saidas']);
}

/**
 * Trigger revalidation após operações de folha
 */
export function revalidateAfterFolha() {
  triggerRevalidation(['folha', 'funcionarios', 'overview', 'entradas-saidas', 'saldos']);
}

/**
 * Trigger revalidation completa
 */
export function revalidateAll() {
  triggerRevalidation(['all']);
}
