'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tx = {
  id: string;
  description?: string;
  amount: number;
  date?: string;           // ISO ajustada
  original_date?: string;  // ISO original
  type: 'IN' | 'OUT';
  method: 'BANK' | 'CASH';
  matched?: boolean;
  matched_id?: string | null;
};

type Props = {
  tx: Tx;
  // opcional: chaves SWR/React Query para invalidar manualmente
  mutateKeys?: string[];
};

export default function TransactionRow({ tx, mutateKeys = [] }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    description: tx.description || '',
    amount: tx.amount,
    dateISO: tx.date ? tx.date.slice(0,10) : ''
  });
  const [busy, setBusy] = useState<'delete'|'match'|'unmatch'|'save'|null>(null);

  const onSaveDate = async () => {
    if (!form.dateISO) return;
    setBusy('save');
    try {
      const res = await fetch(`/api/transactions/${tx.id}/set-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateISO: form.dateISO })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || 'Falha ao ajustar data');
      // aqui você pode salvar descrição/amount se tiver endpoint próprio
      setIsEditing(false);
      router.refresh(); // atualiza todas as abas/kpis
    } catch (e:any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    if (!confirm('Excluir esta transação? Isso desfaz a conciliação vinculada.')) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/transactions/${tx.id}/delete`, { method: 'POST' });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || 'Falha ao excluir');
      // toast opcional: j.message
      setIsEditing(false);
      router.refresh();
    } catch (e:any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const onUnmatch = async () => {
    if (!tx.matched_id) return alert('Não há conciliação para desfazer.');
    setBusy('unmatch');
    try {
      const res = await fetch(`/api/reconcile/${tx.matched_id}`, {
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

  const onMatchExisting = async () => {
    const statementId = prompt('Informe o ID da linha de extrato para conciliar:');
    if (!statementId) return;
    setBusy('match');
    try {
      const res = await fetch(`/api/reconcile/${statementId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MATCH_EXISTING', transactionId: tx.id })
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

  return (
    <tr className="border-b">
      {/* Colunas de exibição */}
      <td className="px-2 py-1 text-sm">{tx.description}</td>
      <td className="px-2 py-1 text-sm">{tx.type}</td>
      <td className="px-2 py-1 text-sm">{tx.method}</td>
      <td className="px-2 py-1 text-sm">{Number(tx.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td className="px-2 py-1 text-sm">{tx.date ? tx.date.slice(0,10) : '-'}</td>
      <td className="px-2 py-1 text-sm">{tx.matched ? 'Conciliada' : '—'}</td>

      {/* Ações */}
      <td className="px-2 py-1 text-sm text-right">
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded px-3 py-1 border hover:bg-gray-50"
          >
            Editar
          </button>
        )}

        {isEditing && (
          <div className="flex items-center gap-2 justify-end">
            {/* Campos editáveis mínimos (ex.: data contábil) */}
            <input
              type="date"
              value={form.dateISO}
              onChange={e=>setForm(s=>({ ...s, dateISO: e.target.value }))}
              className="border rounded px-2 py-1 text-sm"
            />

            {/* Botões que só aparecem em modo edição */}
            <button
              onClick={onMatchExisting}
              disabled={busy==='match'}
              className="rounded px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              title="Conciliar com extrato existente"
            >
              {busy==='match' ? 'Conciliando...' : 'Conciliar'}
            </button>

            <button
              onClick={onUnmatch}
              disabled={busy==='unmatch'}
              className="rounded px-3 py-1 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy==='unmatch' ? 'Desfazendo...' : 'Desfazer'}
            </button>

            <button
              onClick={onDelete}
              disabled={busy==='delete'}
              className="rounded px-3 py-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy==='delete' ? 'Excluindo...' : 'Excluir'}
            </button>

            <button
              onClick={onSaveDate}
              disabled={busy==='save'}
              className="rounded px-3 py-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy==='save' ? 'Salvando...' : 'Salvar'}
            </button>

            <button
              onClick={() => setIsEditing(false)}
              className="rounded px-3 py-1 border hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
