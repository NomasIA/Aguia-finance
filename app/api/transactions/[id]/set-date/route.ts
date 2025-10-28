import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FINANCE_TABLES } from '@/app/config/finance.config';
import { applyBusinessRules } from '@/lib/dateRules';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { dateISO } = await req.json();
  if (!dateISO) return NextResponse.json({ ok:false, error: 'dateISO obrigatório' }, { status: 400 });

  const { data: holidays } = await supabaseAdmin.from(FINANCE_TABLES.holidays).select('date');
  const set = new Set((holidays||[]).map(h => (new Date(h.date).toISOString().slice(0,10))));
  const adjusted = applyBusinessRules(dateISO, set);

  const { error } = await supabaseAdmin.from(FINANCE_TABLES.transactions)
    .update({ original_date: new Date(dateISO).toISOString(), date: adjusted.toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok:true });
}
