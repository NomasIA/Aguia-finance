import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FINANCE_TABLES } from '@/app/config/finance.config';
import { revalidateGlobal } from '@/lib/revalidateGlobal';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const s = FINANCE_TABLES.bankStatements;
  const { error } = await supabaseAdmin.from(s).update({ deleted_at: new Date().toISOString(), matched: false, matched_tx_id: null }).eq('id', id);
  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 400 });

  const summary = await revalidateGlobal();
  return NextResponse.json({ ok:true, message: 'Linha de extrato excluída', summary });
}
