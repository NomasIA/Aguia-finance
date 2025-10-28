
// @ts-nocheck
import TransactionRow from '@/components/finance/TransactionRow';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FINANCE_TABLES } from '@/app/config/finance.config';

export const dynamic = 'force-dynamic'; // no-store
export default async function EntradasSaidasPage() {
  const { data: txs, error } = await supabaseAdmin
    .from(FINANCE_TABLES.transactions)
    .select('id, description, amount, date, original_date, type, method, matched, matched_id')
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(500);
  if (error) {
    return <div className="p-4 text-red-600 text-sm">Erro ao carregar transações: {error.message}</div>
  }
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Entradas &amp; Saídas</h1>
      <table className="w-full text-sm border rounded">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-2 py-2">Descrição</th>
            <th className="px-2 py-2">Tipo</th>
            <th className="px-2 py-2">Origem</th>
            <th className="px-2 py-2">Valor</th>
            <th className="px-2 py-2">Data</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {(txs||[]).map((tx:any) => <TransactionRow key={tx.id} tx={tx} />)}
        </tbody>
      </table>
    </div>
  );
}
