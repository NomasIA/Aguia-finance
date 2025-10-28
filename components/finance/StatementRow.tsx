'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Statement = {
  id: string;
  description?: string;
  amount: number;
  op_date: string;       // ISO
  matched?: boolean;
  matched_tx_id?: string | null;
};

export default function StatementRow({ st }: { st: Statement }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState<'delete'|'match'|'unmatch'|null>(null);
  const [txId, setTxId] = useState('');

  const onDelete = async () => {
    if (!confirm('Excluir esta linha de extrato (soft delete)?')) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/statements/${st.id}/delete`, { method: 'POST' });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || 'Falha ao excluir');
      setIsEditing(false);
      router.refresh();
    } catch (e:any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const onMatchExisting = async () => {
    if (!txId) return alert('Informe o ID da transação');
    setBusy('match');
    try {
      const res = await fetch(`/api/reconcile/${st.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MATCH_EXISTING', transactionId: txId })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || 'Falha ao conciliar');
      router.refresh();
    } catch (e:any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const onUnmatch = async () => {
    if (!st.matched) return;
    setBusy('unmatch');
    try {
      const res = await fetch(`/api/reconcile/${st.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UNMATCH' })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || 'Falha ao desfazer conciliação');
      router.refresh();
    } catch (e:any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <tr className="border-b">
      <td className="px-2 py-1 text-sm">{st.description}</td>
      <td className="px-2 py-1 text-sm">{new Date(st.op_date).toISOString().slice(0,10)}</td>
      <td className="px-2 py-1 text-sm">{Number(st.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td className="px-2 py-1 text-sm">{st.matched ? 'Conciliado' : '—'}</td>

      <td className="px-2 py-1 text-sm text-right">
        {!isEditing && (
          <button onClick={()=>setIsEditing(true)} className="rounded px-3 py-1 border hover:bg-gray-50">Editar</button>
        )}

        {isEditing && (
          <div className="flex items-center gap-2 justify-end">
            <input
              placeholder="ID da transação p/ conciliar"
              value={txId}
              onChange={e=>setTxId(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-56"
            />
            <button onClick={onMatchExisting} disabled={busy==='match'} className="rounded px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {busy==='match' ? 'Conciliando...' : 'Conciliar'}
            </button>
            <button onClick={onUnmatch} disabled={busy==='unmatch' || !st.matched} className="rounded px-3 py-1 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
              {busy==='unmatch' ? 'Desfazendo...' : 'Desfazer'}
            </button>
            <button onClick={onDelete} disabled={busy==='delete'} className="rounded px-3 py-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {busy==='delete' ? 'Excluindo...' : 'Excluir'}
            </button>
            <button onClick={()=>setIsEditing(false)} className="rounded px-3 py-1 border hover:bg-gray-50">
              Fechar
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
