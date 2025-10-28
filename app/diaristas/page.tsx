'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, DollarSign, Users, Calendar, Undo2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Diarista {
  id: string;
  nome: string;
  funcao: string;
  valor_diaria: number;
  ativo: boolean;
}

interface DiaristaDiasSemana {
  id: string;
  diarista_id: string;
  diarista_nome: string;
  diarista_funcao: string;
  semana_ano: string;
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
  total_semana: number;
}

interface PagamentoSemanal {
  id: string;
  semana_ano: string;
  data_pagamento: string;
  valor_total: number;
  pago: boolean;
  observacao: string;
  created_at: string;
}

export default function DiaristasPage() {
  const [diaristas, setDiaristas] = useState<Diarista[]>([]);
  const [diasSemana, setDiasSemana] = useState<DiaristaDiasSemana[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoSemanal[]>([]);
  const [semanaAtual, setSemanaAtual] = useState('');
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<{ [key: string]: any }>({});
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: semanaData } = await supabase.rpc('get_semana_ano');
      const semana = semanaData || '';
      setSemanaAtual(semana);

      const [diaristasRes, diasRes, pagamentosRes] = await Promise.all([
        supabase.from('diaristas').select('*').eq('ativo', true).order('nome'),
        supabase.from('diarista_dias_semana').select('*').eq('semana_ano', semana),
        supabase.from('diarista_pagamentos_semanais').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(10)
      ]);

      if (diaristasRes.data) setDiaristas(diaristasRes.data);

      if (diasRes.data && diaristasRes.data) {
        const diasComNomes = diasRes.data.map((dia: any) => {
          const diarista = diaristasRes.data.find((d: any) => d.id === dia.diarista_id);
          return {
            ...dia,
            diarista_nome: diarista?.nome || '',
            diarista_funcao: diarista?.funcao || ''
          };
        });
        setDiasSemana(diasComNomes);

        const initialValues: any = {};
        diasRes.data.forEach((dia: any) => {
          ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'].forEach(d => {
            initialValues[`${dia.diarista_id}_${d}`] = dia[d] || 0;
          });
        });
        setEditValues(initialValues);
      } else if (diaristasRes.data) {
        const initialValues: any = {};
        diaristasRes.data.forEach((diarista: any) => {
          ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'].forEach(d => {
            initialValues[`${diarista.id}_${d}`] = 0;
          });
        });
        setEditValues(initialValues);
      }

      if (pagamentosRes.data) setPagamentos(pagamentosRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (diaristaId: string, dia: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditValues(prev => ({
      ...prev,
      [`${diaristaId}_${dia}`]: numValue
    }));
  };

  const salvarValores = async () => {
    try {
      const updates = diaristas.map(diarista => {
        const segunda = editValues[`${diarista.id}_segunda`] || 0;
        const terca = editValues[`${diarista.id}_terca`] || 0;
        const quarta = editValues[`${diarista.id}_quarta`] || 0;
        const quinta = editValues[`${diarista.id}_quinta`] || 0;
        const sexta = editValues[`${diarista.id}_sexta`] || 0;
        const sabado = editValues[`${diarista.id}_sabado`] || 0;
        const domingo = editValues[`${diarista.id}_domingo`] || 0;

        return {
          diarista_id: diarista.id,
          semana_ano: semanaAtual,
          segunda,
          terca,
          quarta,
          quinta,
          sexta,
          sabado,
          domingo
        };
      });

      for (const update of updates) {
        await supabase
          .from('diarista_dias_semana')
          .upsert(update, { onConflict: 'diarista_id,semana_ano' });
      }

      toast({ title: 'Sucesso', description: 'Valores salvos com sucesso' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const confirmarPagamento = async () => {
    try {
      const { error } = await supabase.rpc('confirmar_pagamento_semanal_diaristas', {
        p_semana_ano: semanaAtual,
        p_data_pagamento: new Date().toISOString().split('T')[0]
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Pagamento confirmado. Saída criada no ledger (Dinheiro).' });

      window.dispatchEvent(new Event('kpi-refresh'));
      window.dispatchEvent(new Event('revalidate-all'));

      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const desfazerPagamento = async (semanaAno: string) => {
    try {
      const { error } = await supabase.rpc('desfazer_pagamento_semanal_diaristas', {
        p_semana_ano: semanaAno
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Pagamento desfeito. Entrada removida do ledger.' });

      window.dispatchEvent(new Event('kpi-refresh'));
      window.dispatchEvent(new Event('revalidate-all'));

      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getTotalSemana = (diaristaId: string) => {
    const dias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
    return dias.reduce((sum, dia) => sum + (editValues[`${diaristaId}_${dia}`] || 0), 0);
  };

  const getTotalGeral = () => {
    return diaristas.reduce((sum, d) => sum + getTotalSemana(d.id), 0);
  };

  const isPagamentoConfirmado = pagamentos.some(p => p.semana_ano === semanaAtual && p.pago);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gold text-lg">Carregando...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gold mb-2">Diaristas</h1>
            <p className="text-muted">Gestão de pagamentos semanais</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gold/10 border border-gold/20 rounded-lg px-4 py-2">
              <p className="text-xs text-muted mb-1">Semana Atual</p>
              <p className="text-lg font-bold text-gold">{semanaAtual}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Diaristas</CardTitle>
              <Users className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{diaristas.length}</div>
              <p className="text-xs text-muted mt-1">Ativos</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Semana Atual</CardTitle>
              <Calendar className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">{semanaAtual}</div>
              <p className="text-xs text-muted mt-1">Ano-Semana</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
              <DollarSign className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(getTotalGeral())}</div>
              <p className="text-xs text-muted mt-1">Esta semana</p>
            </CardContent>
          </Card>
        </div>

        {isPagamentoConfirmado && (
          <Card className="card border-orange-500/30 bg-orange-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="font-semibold text-orange-500">Pagamento da Semana {semanaAtual} já foi confirmado</p>
                  <p className="text-sm text-muted mt-1">Os valores não podem ser alterados. Para fazer alterações, desfaça o pagamento primeiro.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="card">
          <CardHeader>
            <CardTitle className="text-gold">Valores da Semana {semanaAtual}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 min-w-[200px]">Nome</th>
                    <th className="text-left p-3">Cargo</th>
                    <th className="text-center p-3">Segunda</th>
                    <th className="text-center p-3">Terça</th>
                    <th className="text-center p-3">Quarta</th>
                    <th className="text-center p-3">Quinta</th>
                    <th className="text-center p-3">Sexta</th>
                    <th className="text-center p-3">Sábado</th>
                    <th className="text-center p-3">Domingo</th>
                    <th className="text-right p-3 min-w-[120px]">Total Semana</th>
                  </tr>
                </thead>
                <tbody>
                  {diaristas.map((diarista) => {
                    const totalSemana = getTotalSemana(diarista.id);
                    return (
                      <tr key={diarista.id} className="border-b border-border/50 hover:bg-accent/5">
                        <td className="p-3">
                          <p className="font-medium text-white">{diarista.nome}</p>
                        </td>
                        <td className="p-3 text-muted">{diarista.funcao}</td>
                        {['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'].map(dia => (
                          <td key={dia} className="p-3 text-center">
                            <Input
                              type="number"
                              step="0.01"
                              value={editValues[`${diarista.id}_${dia}`] || 0}
                              onChange={(e) => handleValueChange(diarista.id, dia, e.target.value)}
                              disabled={isPagamentoConfirmado}
                              className="input-dark w-24 text-center"
                            />
                          </td>
                        ))}
                        <td className="p-3 text-right">
                          <span className="font-semibold text-gold">{formatCurrency(totalSemana)}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gold/30 bg-gold/5">
                    <td colSpan={9} className="p-3 text-right font-bold text-white">TOTAL GERAL</td>
                    <td className="p-3 text-right">
                      <span className="text-xl font-bold text-gold">{formatCurrency(getTotalGeral())}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={salvarValores}
                disabled={isPagamentoConfirmado}
                className="btn-secondary"
              >
                Salvar Valores
              </Button>
              <Button
                onClick={confirmarPagamento}
                disabled={isPagamentoConfirmado || getTotalGeral() === 0}
                className="btn-primary flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Pagamento Semanal
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card">
          <CardHeader>
            <CardTitle className="text-gold">Histórico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {pagamentos.length === 0 ? (
              <p className="text-center text-muted py-8">Nenhum pagamento registrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3">Semana</th>
                      <th className="text-left p-3">Data Pagamento</th>
                      <th className="text-right p-3">Valor Total</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-center p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentos.map((pagamento) => (
                      <tr key={pagamento.id} className="border-b border-border/50 hover:bg-accent/5">
                        <td className="p-3 font-medium text-white">{pagamento.semana_ano}</td>
                        <td className="p-3 text-muted">
                          {format(new Date(pagamento.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="p-3 text-right font-semibold text-gold">
                          {formatCurrency(pagamento.valor_total)}
                        </td>
                        <td className="p-3">
                          {pagamento.pago ? (
                            <span className="text-green-500 text-xs">✓ Pago</span>
                          ) : (
                            <span className="text-orange-500 text-xs">Desfeito</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {pagamento.pago && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => desfazerPagamento(pagamento.semana_ano)}
                              className="text-xs hover:bg-orange-500/10"
                            >
                              <Undo2 className="w-3 h-3 mr-1" />
                              Desfazer
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
