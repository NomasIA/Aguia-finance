import { NextResponse } from 'next/server';
import { FINANCE_TABLES } from '@/app/config/finance.config';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import XLSX from 'xlsx';

function aoaToSheet(aoa: any[][]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws['!ref'] as string);
  ws['!autofilter'] = { ref: ws['!ref'] as string };
  ws['!cols'] = Array(range.e.c + 1).fill({ wch: 22 });
  return ws;
}

export async function POST(req: Request) {
  const { startISO, endISO, kind } = await req.json();
  const start = new Date(startISO).toISOString();
  const end = new Date(endISO).toISOString();

  const t = FINANCE_TABLES.transactions;
  const { data: txs, error } = await supabaseAdmin
    .from(t).select('*').is('deleted_at', null).gte('date', start).lte('date', end);
  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 400 });

  const wb = XLSX.utils.book_new();

  if (kind === 'financeiro-geral') {
    const entradas = (txs||[]).filter(r=>r.type==='IN').reduce((s,r)=> s+Number(r.amount), 0);
    const saidas   = (txs||[]).filter(r=>r.type==='OUT').reduce((s,r)=> s+Number(r.amount), 0);
    const ws = aoaToSheet([
      ['Relatório Financeiro Geral'],
      [],
      ['Período', `${startISO} a ${endISO}`],
      ['Entradas', entradas],
      ['Saídas', saidas],
      ['Lucro/Saldo Período', entradas + saidas],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Financeiro');
  }

  // Você pode adicionar outras abas aqui conforme seus dados (mensalistas, diaristas etc.)

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="relatorio_'+(kind||'geral')+'.xlsx"'
    }
  });
}
