import { NextResponse } from 'next/server';
import { FINANCE_TABLES } from '@/app/config/finance.config';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Action = 'MATCH_EXISTING' | 'CREATE_AND_MATCH' | 'UNMATCH';

export async function POST(req: Request, { params }: { params: { statementId: string } }) {
  const { statementId } = params;
  const body = await req.json();
  const action: Action = body.action;
  const t = FINANCE_TABLES.transactions;
  const s = FINANCE_TABLES.bankStatements;

  const { data: st, error: e0 } = await supabaseAdmin.from(s).select('*').eq('id', statementId).maybeSingle();
  if (e0 || !st || st.deleted_at) return NextResponse.json({ ok:false, error: 'Extrato inexistente' }, { status: 404 });

  if (action === 'MATCH_EXISTING') {
    const txId = body.transactionId as string;
    if (!txId) return NextResponse.json({ ok:false, error: 'transactionId obrigatório' }, { status: 400 });
    const { data: tx, error: e1 } = await supabaseAdmin.from(t).select('*').eq('id', txId).maybeSingle();
    if (e1 || !tx || tx.deleted_at) return NextResponse.json({ ok:false, error: 'Transação inválida' }, { status: 400 });
    await supabaseAdmin.from(t).update({ matched: true, matched_id: st.id }).eq('id', tx.id);
    await supabaseAdmin.from(s).update({ matched: true, matched_tx_id: tx.id }).eq('id', st.id);
    return NextResponse.json({ ok:true, message: 'Conciliado com transação existente' });
  }

  if (action === 'CREATE_AND_MATCH') {
    const newTx = body.newTx || {};
    const { data: tx, error: e2 } = await supabaseAdmin.from(t).insert({
      type: newTx.type, method: newTx.method || 'BANK', description: newTx.description || st.description,
      amount: st.amount, original_date: st.op_date, date: st.op_date, matched: true, matched_id: st.id, deleted_at: null
    }).select('id').maybeSingle();
    if (e2 || !tx) return NextResponse.json({ ok:false, error: e2?.message||'Erro ao criar transação' }, { status: 400 });
    await supabaseAdmin.from(s).update({ matched: true, matched_tx_id: tx.id }).eq('id', st.id);
    return NextResponse.json({ ok:true, message: 'Criada e conciliada' });
  }

  if (action === 'UNMATCH') {
    const { data: linked } = await supabaseAdmin.from(t).select('id').eq('id', st.matched_tx_id);
    if (linked && linked.length) await supabaseAdmin.from(t).update({ matched: false, matched_id: null }).eq('id', st.matched_tx_id);
    await supabaseAdmin.from(s).update({ matched: false, matched_tx_id: null }).eq('id', st.id);
    return NextResponse.json({ ok:true, message: 'Conciliação desfeita' });
  }

  return NextResponse.json({ ok:false, error: 'Ação inválida' }, { status: 400 });
}
