'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Gift, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Mensalista {
  id: string;
  nome: string;
  salario_base: number;
  ajuda_custo: number;
}

interface DecimoTerceiroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensalistas: Mensalista[];
  competenciaAno: number;
  onSuccess: () => void;
}

export function DecimoTerceiroModal({
  open,
  onOpenChange,
  mensalistas,
  competenciaAno,
  onSuccess
}: DecimoTerceiroModalProps) {
  const [selectedFuncionarios, setSelectedFuncionarios] = useState<Set<string>>(new Set());
  const [valores, setValores] = useState<Record<string, number>>({});
  const [parcelas, setParcelas] = useState<1 | 2>(1);
  const [dataParcela1, setDataParcela1] = useState('');
  const [dataParcela2, setDataParcela2] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && mensalistas.length > 0) {
      const allIds = new Set(mensalistas.map(m => m.id));
      setSelectedFuncionarios(allIds);

      const valoresIniciais: Record<string, number> = {};
      mensalistas.forEach(m => {
        valoresIniciais[m.id] = m.salario_base + (m.ajuda_custo || 0);
      });
      setValores(valoresIniciais);

      const now = new Date();
      const dataDefault = `${competenciaAno}-12-${now.getDate().toString().padStart(2, '0')}`;
      setDataParcela1(dataDefault);
      setDataParcela2(dataDefault);
    }
  }, [open, mensalistas, competenciaAno]);

  const toggleFuncionario = (id: string) => {
    const newSet = new Set(selectedFuncionarios);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFuncionarios(newSet);
  };

  const toggleAll = () => {
    if (selectedFuncionarios.size === mensalistas.length) {
      setSelectedFuncionarios(new Set());
    } else {
      setSelectedFuncionarios(new Set(mensalistas.map(m => m.id)));
    }
  };

  const updateValor = (id: string, valor: number) => {
    setValores(prev => ({ ...prev, [id]: valor }));
  };

  const getTotalSelecionado = () => {
    return Array.from(selectedFuncionarios).reduce((sum, id) => {
      return sum + (valores[id] || 0);
    }, 0);
  };

  const handleSubmit = async () => {
    if (selectedFuncionarios.size === 0) {
      toast({ title: 'Erro', description: 'Selecione pelo menos um funcionário', variant: 'destructive' });
      return;
    }

    if (!dataParcela1) {
      toast({ title: 'Erro', description: 'Informe a data da 1ª parcela', variant: 'destructive' });
      return;
    }

    if (parcelas === 2 && !dataParcela2) {
      toast({ title: 'Erro', description: 'Informe a data da 2ª parcela', variant: 'destructive' });
      return;
    }

    try {
      setProcessing(true);

      const funcionarioIds = Array.from(selectedFuncionarios);
      const valoresObj: Record<string, number> = {};
      funcionarioIds.forEach(id => {
        valoresObj[id] = valores[id];
      });

      const datas = parcelas === 1
        ? [dataParcela1]
        : [dataParcela1, dataParcela2];

      const { data, error } = await supabase.rpc('processar_decimo_terceiro', {
        p_funcionario_ids: funcionarioIds,
        p_competencia_ano: competenciaAno,
        p_valores: valoresObj,
        p_parcelas: parcelas,
        p_datas_pagamento: datas,
        p_observacoes: observacoes || null
      });

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: `13º salário processado para ${funcionarioIds.length} funcionário(s). Lançamentos criados no Banco Itaú.`
      });

      window.dispatchEvent(new Event('kpi-refresh'));
      window.dispatchEvent(new Event('revalidate-all'));

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao processar 13º salário',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gold text-2xl flex items-center gap-2">
            <Gift className="w-6 h-6" />
            13º Salário - Dezembro {competenciaAno}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-gold/10 border border-gold/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <p className="text-sm font-medium text-gold">Pagamento via Banco Itaú (fixo)</p>
            </div>
            <p className="text-xs text-muted">
              Os lançamentos serão criados automaticamente em: Entradas & Saídas, Caixa & Banco, Visão Geral e Relatórios.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base">Selecionar Funcionários</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="text-gold hover:bg-gold/10"
              >
                {selectedFuncionarios.size === mensalistas.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                {mensalistas.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 border-b border-border/50 hover:bg-accent/5"
                  >
                    <Checkbox
                      checked={selectedFuncionarios.has(m.id)}
                      onCheckedChange={() => toggleFuncionario(m.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">{m.nome}</p>
                      <p className="text-xs text-muted">Salário base: {formatCurrency(m.salario_base)}</p>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        step="0.01"
                        value={valores[m.id] || 0}
                        onChange={(e) => updateValor(m.id, parseFloat(e.target.value) || 0)}
                        disabled={!selectedFuncionarios.has(m.id)}
                        className="input-dark text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Parcelas</Label>
              <div className="flex gap-3 mt-2">
                <Button
                  type="button"
                  variant={parcelas === 1 ? 'default' : 'outline'}
                  onClick={() => setParcelas(1)}
                  className={parcelas === 1 ? 'btn-primary' : 'btn-secondary'}
                >
                  1x Integral
                </Button>
                <Button
                  type="button"
                  variant={parcelas === 2 ? 'default' : 'outline'}
                  onClick={() => setParcelas(2)}
                  className={parcelas === 2 ? 'btn-primary' : 'btn-secondary'}
                >
                  2x Parcelas
                </Button>
              </div>
            </div>

            <div>
              <Label>Total Selecionado</Label>
              <div className="text-2xl font-bold text-gold mt-2">
                {formatCurrency(getTotalSelecionado())}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Pagamento - 1ª Parcela *</Label>
              <Input
                type="date"
                value={dataParcela1}
                onChange={(e) => setDataParcela1(e.target.value)}
                required
                className="input-dark"
              />
              {parcelas === 1 && (
                <p className="text-xs text-muted mt-1">Valor integral: {formatCurrency(getTotalSelecionado())}</p>
              )}
              {parcelas === 2 && (
                <p className="text-xs text-muted mt-1">
                  Valor: {formatCurrency(getTotalSelecionado() / 2)}
                </p>
              )}
            </div>

            {parcelas === 2 && (
              <div>
                <Label>Data de Pagamento - 2ª Parcela *</Label>
                <Input
                  type="date"
                  value={dataParcela2}
                  onChange={(e) => setDataParcela2(e.target.value)}
                  required
                  className="input-dark"
                />
                <p className="text-xs text-muted mt-1">
                  Valor: {formatCurrency(getTotalSelecionado() / 2)}
                </p>
              </div>
            )}
          </div>

          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Adiantamento, bonificação, etc."
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
            disabled={processing || selectedFuncionarios.size === 0}
            className="btn-primary"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {processing ? 'Processando...' : 'Confirmar 13º Salário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
