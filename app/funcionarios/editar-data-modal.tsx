'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EditarDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refTipo: 'salario' | 'vale' | 'vt' | 'decimo_parcela';
  refId: string;
  dataAtual: Date;
  funcionarioNome: string;
  tipoDescricao: string;
  onSuccess: () => void;
}

export function EditarDataModal({
  open,
  onOpenChange,
  refTipo,
  refId,
  dataAtual,
  funcionarioNome,
  tipoDescricao,
  onSuccess
}: EditarDataModalProps) {
  const [novaData, setNovaData] = useState(() => format(dataAtual, 'yyyy-MM-dd'));
  const [motivo, setMotivo] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!novaData) {
      toast({ title: 'Erro', description: 'Informe a nova data', variant: 'destructive' });
      return;
    }

    if (!motivo.trim()) {
      toast({ title: 'Erro', description: 'Informe o motivo da alteração', variant: 'destructive' });
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase.rpc('editar_data_pagamento', {
        p_ref_tipo: refTipo,
        p_ref_id: refId,
        p_nova_data: novaData,
        p_motivo: motivo,
        p_autor_email: null
      });

      if (error) {
        if (error.message.includes('conciliado')) {
          if (!confirm('Este pagamento já está conciliado. Deseja desfazer a conciliação antes de alterar a data?')) {
            throw new Error('Operação cancelada pelo usuário');
          }
        }
        throw error;
      }

      toast({
        title: 'Sucesso!',
        description: `Data alterada com sucesso. Lançamentos atualizados automaticamente.`
      });

      window.dispatchEvent(new Event('kpi-refresh'));
      window.dispatchEvent(new Event('revalidate-all'));

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao alterar data',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gold text-xl flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Editar Data de Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
              <div className="text-xs text-orange-500">
                <p className="font-medium mb-1">Atenção</p>
                <p>Esta alteração atualizará automaticamente:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Entradas & Saídas</li>
                  <li>Caixa & Banco</li>
                  <li>Visão Geral e KPIs</li>
                  <li>Conciliação (se aplicável)</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-muted">Funcionário</Label>
            <p className="text-white font-medium mt-1">{funcionarioNome}</p>
          </div>

          <div>
            <Label className="text-muted">Tipo de Pagamento</Label>
            <p className="text-white font-medium mt-1">{tipoDescricao}</p>
          </div>

          <div>
            <Label className="text-muted">Data Atual</Label>
            <p className="text-white font-medium mt-1">
              {format(dataAtual, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
            </p>
          </div>

          <div>
            <Label>Nova Data de Pagamento *</Label>
            <Input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              required
              className="input-dark"
            />
          </div>

          <div>
            <Label>Motivo da Alteração *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Pagamento antecipado, ajuste de data, feriado, etc."
              required
              className="input-dark min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-secondary"
            disabled={processing}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={processing}
            className="btn-primary"
          >
            {processing ? 'Alterando...' : 'Confirmar Alteração'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
