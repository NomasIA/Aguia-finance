import { NextResponse } from 'next/server';
import { FINANCE_TABLES } from '@/app/config/finance.config';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';

function sha(s: string) { return crypto.createHash('sha256').update(s).digest('hex'); }

async function isDuplicate(dateISO: string, description: string, amount: number) {
  const s = FINANCE_TABLES.bankStatements;
  const date = new Date(dateISO).toISOString();
  const before = new Date(new Date(date).getTime() - 2*86400000).toISOString();
  const after = new Date(new Date(date).getTime() + 2*86400000).toISOString();

  const { data } = await supabaseAdmin.from(s)
    .select('id')
    .is('deleted_at', null)
    .eq('amount', amount)
    .eq('description', description)
    .gte('op_date', before).lte('op_date', after)
    .limit(1);
  return Boolean(data && data.length);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ ok:false, error: 'Arquivo não enviado' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const name = (file.name||'').toLowerCase();

  type Row = { date: string, description: string, amount: number, balance?: number };
  let rows: Row[] = [];

  if (name.endsWith('.csv')) {
    const recs = parse(buf.toString('utf-8'), { columns: true, skip_empty_lines: true });
    rows = recs.map((r:any)=> ({
      date: r.data || r.date || r.Data || r.Date,
      description: r.historico || r.descricao || r.description || r.Histórico,
      amount: Number((r.valor || r.amount || '0').toString().replace(',','.')),
      balance: r.saldo ? Number(r.saldo.toString().replace(',','.')) : undefined
    }));
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const recs = XLSX.utils.sheet_to_json(ws);
    rows = (recs as any[]).map(r=> ({
      date: r.data || r.date || r.Data || r.Date,
      description: r.historico || r.descricao || r.description || r.Histórico,
      amount: Number((r.valor || r.amount || '0').toString().replace(',','.')),
      balance: r.saldo ? Number(r.saldo.toString().replace(',','.')) : undefined
    }));
  } else if (name.endsWith('.ofx')) {
    // Suporte básico a OFX (texto)
    const text = buf.toString('utf-8');
    const reg = /<STMTTRN>[\s\S]*?<DTPOSTED>(.*?)<\/[\s\S]*?<TRNAMT>(.*?)<\/[\s\S]*?<MEMO>(.*?)<\//g;
    let m;
    while ((m = reg.exec(text))) {
      const date = m[1];
      const amount = Number(m[2]);
      const description = m[3];
      rows.push({ date, description, amount });
    }
  } else {
    return NextResponse.json({ ok:false, error: 'Formato não suportado' }, { status: 400 });
  }

  const s = FINANCE_TABLES.bankStatements;
  let inserted = 0, skipped = 0;
  for (const r of rows) {
    const dISO = new Date(r.date).toISOString();
    const desc = (r.description||'').trim();
    const amt = Number(r.amount);

    if (await isDuplicate(dISO, desc, amt)) { skipped++; continue; }

    const { error } = await supabaseAdmin.from(s).insert({
      op_date: dISO, description: desc, amount: amt, balance: r.balance ?? null,
      source_file: name, hash_key: sha(`${dISO}|${desc}|${amt}`), matched: false, matched_tx_id: null, deleted_at: null
    } as any);
    if (error) skipped++; else inserted++;
  }

  // Auto-match por valor
  const t = FINANCE_TABLES.transactions;
  const { data: stmts } = await supabaseAdmin.from(s).select('id, amount, matched').is('deleted_at', null).eq('matched', false);
  for (const st of (stmts||[])) {
    const { data: tx } = await supabaseAdmin.from(t).select('id').is('deleted_at', null).eq('matched', false).eq('amount', st.amount).limit(1).maybeSingle();
    if (tx) {
      await supabaseAdmin.from(t).update({ matched: true, matched_id: st.id }).eq('id', tx.id);
      await supabaseAdmin.from(s).update({ matched: true, matched_tx_id: tx.id }).eq('id', st.id);
    }
  }

  return NextResponse.json({ ok:true, inserted, skipped });
}
