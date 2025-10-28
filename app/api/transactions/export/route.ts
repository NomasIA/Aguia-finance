import { NextResponse } from 'next/server';
import { FINANCE_TABLES } from '@/app/config/finance.config';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import XLSX from 'xlsx';

export async function POST(req: Request) {
  const { method, startISO, endISO, format } = await req.json();
  const start = new Date(startISO).toISOString();
  const end = new Date(endISO).toISOString();

  const { data: txs, error } = await supabaseAdmin
    .from(FINANCE_TABLES.transactions)
    .select('date, description, amount, type, method')
    .is('deleted_at', null)
    .eq('method', method)
    .gte('date', start).lte('date', end)
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 400 });

  const rows = (txs||[]).map((t:any)=> ({
    data: new Date(t.date).toISOString().slice(0,10),
    descricao: t.description,
    valor: Number(t.amount),
    tipo: t.type,
    origem: t.method
  }));

  if (format === 'CSV') {
    const header = 'data,descricao,valor,tipo,origem\n';
    const csv = header + rows.map(r => `${r.data},"${(r.descricao||'').replace(/"/g,'""')}",${r.valor},${r.tipo},${r.origem}`).join('\n');
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="extrato_${method}.csv"` } });
  } else {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="extrato_${method}.xlsx"` } });
  }
}
