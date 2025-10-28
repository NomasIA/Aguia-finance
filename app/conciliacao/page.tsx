
// @ts-nocheck
import StatementRow from '@/components/finance/StatementRow';
import ImportBar from '@/components/finance/ImportBar';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FINANCE_TABLES } from '@/app/config/finance.config';

export const dynamic = 'force-dynamic';

export default async function ConciliacaoPage() {
  const { data: stmts, error } = await supabaseAdmin
    .from(FINANCE_TABLES.bankStatements)
    .select('id, description, amount, op_date, matched, matched_tx_id, deleted_at')
    .is('deleted_at', null)
    .order('op_date', { ascending: false })
    .limit(500);
  if (error) {
    return <div className="p-4 text-red-600 text-sm">Erro ao carregar extrato: {error.message}</div>
  }
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Conciliação Bancária</h1>
      <ImportBar />
      <table className="w-full text-sm border rounded">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-2 py-2">Descrição</th>
            <th className="px-2 py-2">Data</th>
            <th className="px-2 py-2">Valor</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {(stmts||[]).map((st:any) => <StatementRow key={st.id} st={st} />)}
        </tbody>
      </table>
    </div>
  );
}
