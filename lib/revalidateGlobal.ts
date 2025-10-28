import { supabaseAdmin } from './supabaseAdmin';
import { FINANCE_TABLES } from '@/app/config/finance.config';

export async function revalidateGlobal() {
  const t = FINANCE_TABLES.transactions;

  // Saldos
  const { data: bankIn, error: e1 } = await supabaseAdmin
    .from(t).select('amount, method, type').is('deleted_at', null);
  if (e1) throw e1;

  let bankBalance = 0, cashBalance = 0, entradasMes = 0, saidasMes = 0;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth()+1, 1);

  for (const row of bankIn ?? []) {
    const amt = Number(row.amount);
    if (row.method === 'BANK') bankBalance += amt;
    if (row.method === 'CASH') cashBalance += amt;
  }

  const { data: monthTx } = await supabaseAdmin
    .from(t).select('amount, type, date')
    .gte('date', monthStart.toISOString())
    .lt('date', nextMonth.toISOString())
    .is('deleted_at', null);

  for (const r of monthTx ?? []) {
    const amt = Number(r.amount);
    if (r.type === 'IN') entradasMes += amt;
    if (r.type === 'OUT') saidasMes += amt;
  }

  return { bankBalance, cashBalance, entradasMes, saidasMes };
}
