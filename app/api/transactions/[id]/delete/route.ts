import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FINANCE_TABLES } from '@/app/config/finance.config';
import { revalidateGlobal } from '@/lib/revalidateGlobal';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const t = FINANCE_TABLES.transactions;
  const s = FINANCE_TABLES.bankStatements;

  // Soft delete transaction
  const { error: e1 } = await supabaseAdmin.from(t).update({ deleted_at: new Date().toISOString(), matched: false, matched_id: null }).eq('id', id);
  if (e1) return NextResponse.json({ ok:false, error: e1.message }, { status: 400 });

  // Remove vínculo no extrato
  const { error: e2 } = await supabaseAdmin.from(s).update({ matched: false, matched_tx_id: null }).eq('matched_tx_id', id);
  if (e2) return NextResponse.json({ ok:false, error: e2.message }, { status: 400 });

  const summary = await revalidateGlobal();
  return NextResponse.json({ ok:true, message: 'Exclusão processada e conciliação atualizada', summary });
}
