'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement|null>(null);
  const [busy, setBusy] = useState(false);

  const onImport = async () => {
    if (!inputRef.current || !inputRef.current.files || inputRef.current.files.length === 0) return;
    const file = inputRef.current.files[0];
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    try {
      const res = await fetch('/api/statements/import', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Falha ao importar');
      alert(`Importado: ${j.inserted}, ignorados: ${j.skipped}`);
      router.refresh();
      inputRef.current.value = '';
    } catch (e:any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input type="file" ref={inputRef} accept=".csv,.xlsx,.xls,.ofx" className="text-sm" />
      <button onClick={onImport} disabled={busy} className="rounded px-3 py-1 bg-black text-white hover:opacity-90 disabled:opacity-50">
        {busy ? 'Importando...' : 'Importar Extrato'}
      </button>
    </div>
  );
}
