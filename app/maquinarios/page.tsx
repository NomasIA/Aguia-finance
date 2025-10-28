'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wrench, Plus, Calendar, DollarSign, CheckCircle, Lock, Edit2, Package, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, parse } from 'date-fns';

interface Maquina {
  id: string;
  item: string;
  nome: string;
  quantidade: number;
  quantidade_disponivel: number;
  valor_unitario: number;
  valor_total: number;
  valor_diaria: number;
  status: string;
  categoria: string;
  observacao?: string;
}

interface Contrato {
  id: string;
  maquina_id: string;
  maquina_nome: string;
  maquina_item: string;
  cliente: string;
  obra: string;
  data_inicio: string;
  data_fim: string;
  dias_locacao: number;
  valor_diaria: number;
  valor_total: number;
  valor_recebido: number;
  forma_pagamento: string;
  status: string;
  recebido: boolean;
  data_recebimento: string;
  quantidade_locada: number;
}

export default function MaquinariosPage() {
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMaquina, setSelectedMaquina] = useState<Maquina | null>(null);
  const { toast } = useToast();

  const [simulationForm, setSimulationForm] = useState({
    cliente: '',
    obra: '',
    data_inicio: '',
    data_fim: '',
    dias: 0,
    quantidade_locada: 1,
    valor_total: 0,
    forma_pagamento: 'banco' as 'banco' | 'dinheiro'
  });

  const [maquinaForm, setMaquinaForm] = useState({
    item: '',
    nome: '',
    quantidade: 1,
    valor_unitario: 0,
    valor_diaria: 0,
    categoria: '',
    observacao: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [maquinasRes, contratosRes] = await Promise.all([
        supabase.from('maquinas').select('*').is('deleted_at', null).order('item'),
        supabase.from('contratos_locacao').select('*').is('deleted_at', null).order('created_at', { ascending: false })
      ]);

      if (maquinasRes.data) setMaquinas(maquinasRes.data);

      if (contratosRes.data) {
        const contratosWithMaquinas = await Promise.all(
          contratosRes.data.map(async (c: any) => {
            const { data: maq } = await supabase
              .from('maquinas')
              .select('nome, item')
              .eq('id', c.maquina_id)
              .single();
            return {
              ...c,
              maquina_nome: maq?.nome || 'N/A',
              maquina_item: maq?.item || 'N/A',
              quantidade_locada: c.quantidade_locada || 1
            };
          })
        );
        setContratos(contratosWithMaquinas);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSimulation = (maquina: Maquina) => {
    setSelectedMaquina(maquina);
    setSimulationForm({
      cliente: '',
      obra: '',
      data_inicio: '',
      data_fim: '',
      dias: 0,
      quantidade_locada: 1,
      valor_total: 0,
      forma_pagamento: 'banco'
    });
    setSimulationOpen(true);
  };

  const openEdit = (maquina: Maquina) => {
    setSelectedMaquina(maquina);
    setMaquinaForm({
      item: maquina.item,
      nome: maquina.nome,
      quantidade: maquina.quantidade,
      valor_unitario: maquina.valor_unitario,
      valor_diaria: maquina.valor_diaria,
      categoria: maquina.categoria,
      observacao: maquina.observacao || ''
    });
    setEditOpen(true);
  };

  const calculateSimulation = () => {
    if (!simulationForm.data_inicio || !simulationForm.data_fim || !selectedMaquina) return;

    const inicio = parse(simulationForm.data_inicio, 'yyyy-MM-dd', new Date());
    const fim = parse(simulationForm.data_fim, 'yyyy-MM-dd', new Date());
    const dias = differenceInDays(fim, inicio) + 1;
    const valor_total = dias * selectedMaquina.valor_diaria * simulationForm.quantidade_locada;

    setSimulationForm(prev => ({
      ...prev,
      dias,
      valor_total
    }));
  };

  useEffect(() => {
    if (simulationForm.data_inicio && simulationForm.data_fim) {
      calculateSimulation();
    }
  }, [simulationForm.data_inicio, simulationForm.data_fim, simulationForm.quantidade_locada]);

  const confirmarContrato = async () => {
    if (!selectedMaquina || !simulationForm.cliente || !simulationForm.data_inicio || !simulationForm.data_fim) {
      toast({ title: 'Aviso', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.rpc('create_contrato_locacao', {
        p_maquina_id: selectedMaquina.id,
        p_cliente: simulationForm.cliente,
        p_obra: simulationForm.obra || null,
        p_data_inicio: simulationForm.data_inicio,
        p_data_fim: simulationForm.data_fim,
        p_dias_locacao: simulationForm.dias,
        p_valor_diaria: selectedMaquina.valor_diaria,
        p_valor_total: simulationForm.valor_total,
        p_forma_pagamento: simulationForm.forma_pagamento,
        p_quantidade_locada: simulationForm.quantidade_locada
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: `Contrato criado. ${simulationForm.quantidade_locada} unidade(s) locada(s).` });
      setSimulationOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível criar o contrato', variant: 'destructive' });
    }
  };

  const adicionarMaquina = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!maquinaForm.item || !maquinaForm.nome || maquinaForm.quantidade <= 0) {
      toast({ title: 'Aviso', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      const valor_total = maquinaForm.valor_unitario * maquinaForm.quantidade;

      const { error } = await supabase.from('maquinas').insert([{
        item: maquinaForm.item,
        nome: maquinaForm.nome,
        quantidade: maquinaForm.quantidade,
        quantidade_disponivel: maquinaForm.quantidade,
        valor_unitario: maquinaForm.valor_unitario,
        valor_total: valor_total,
        valor_diaria: maquinaForm.valor_diaria,
        categoria: maquinaForm.categoria,
        custo_aquisicao: maquinaForm.valor_unitario,
        status: 'Disponível',
        observacao: maquinaForm.observacao
      }]);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Maquinário adicionado com sucesso' });
      setMaquinaForm({ item: '', nome: '', quantidade: 1, valor_unitario: 0, valor_diaria: 0, categoria: '', observacao: '' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível adicionar', variant: 'destructive' });
    }
  };

  const atualizarMaquina = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMaquina || !maquinaForm.item || !maquinaForm.nome) {
      toast({ title: 'Aviso', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      const valor_total = maquinaForm.valor_unitario * maquinaForm.quantidade;
      const quantidade_diff = maquinaForm.quantidade - selectedMaquina.quantidade;

      const { error } = await supabase
        .from('maquinas')
        .update({
          item: maquinaForm.item,
          nome: maquinaForm.nome,
          quantidade: maquinaForm.quantidade,
          quantidade_disponivel: selectedMaquina.quantidade_disponivel + quantidade_diff,
          valor_unitario: maquinaForm.valor_unitario,
          valor_total: valor_total,
          valor_diaria: maquinaForm.valor_diaria,
          categoria: maquinaForm.categoria,
          custo_aquisicao: maquinaForm.valor_unitario,
          observacao: maquinaForm.observacao,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedMaquina.id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Maquinário atualizado com sucesso' });
      setEditOpen(false);
      setSelectedMaquina(null);
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível atualizar', variant: 'destructive' });
    }
  };

  const marcarRecebido = async (contratoId: string) => {
    try {
      const { error } = await supabase.rpc('receber_contrato_locacao', {
        p_contrato_id: contratoId,
        p_data_recebimento: new Date().toISOString().split('T')[0]
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Recebimento confirmado. Entrada criada, quantidade devolvida e contrato excluído.' });
      window.dispatchEvent(new Event('kpi-refresh'));
      window.dispatchEvent(new Event('revalidate-all'));
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const excluirMaquina = async (maquinaId: string, maquinaNome: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${maquinaNome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('excluir_maquina', {
        p_maquina_id: maquinaId
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Maquinário excluído com sucesso' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (maquina: Maquina) => {
    if (maquina.quantidade_disponivel === 0) {
      return <span className="px-2 py-1 rounded-md text-xs font-medium border bg-red-500/10 text-red-500 border-red-500/20">Locado (0/{maquina.quantidade})</span>;
    } else if (maquina.quantidade_disponivel < maquina.quantidade) {
      return <span className="px-2 py-1 rounded-md text-xs font-medium border bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Parcial ({maquina.quantidade_disponivel}/{maquina.quantidade})</span>;
    } else {
      return <span className="px-2 py-1 rounded-md text-xs font-medium border bg-green-500/10 text-green-500 border-green-500/20">Disponível ({maquina.quantidade_disponivel}/{maquina.quantidade})</span>;
    }
  };

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
      <Tabs defaultValue="locacao" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gold mb-2">Maquinário</h1>
            <p className="text-muted">Gestão de equipamentos e contratos</p>
          </div>
          <TabsList className="bg-surface border border-border">
            <TabsTrigger value="locacao">Locação</TabsTrigger>
            <TabsTrigger value="cadastro">Adicionar</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="locacao" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {maquinas.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Package className="w-16 h-16 text-muted mx-auto mb-4" />
                <p className="text-muted text-lg">Nenhum equipamento cadastrado</p>
              </div>
            ) : (
              maquinas.map((maquina) => {
                const isBlocked = maquina.quantidade_disponivel === 0;

                return (
                  <Card key={maquina.id} className={`card ${isBlocked ? 'opacity-75' : ''}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-gold text-lg mb-2">{maquina.item}</CardTitle>
                          <p className="text-sm text-muted">{maquina.categoria}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(maquina)}
                            className="h-8 w-8 p-0 hover:bg-gold/10"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4 text-gold" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => excluirMaquina(maquina.id, maquina.item)}
                            className="h-8 w-8 p-0 hover:bg-red-500/10"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                          <Wrench className="w-5 h-5 text-gold" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted">Disponível</p>
                          <p className="font-semibold text-white">{maquina.quantidade_disponivel} / {maquina.quantidade}</p>
                        </div>
                        <div>
                          <p className="text-muted">Valor Unit.</p>
                          <p className="font-semibold text-white">{formatCurrency(maquina.valor_unitario)}</p>
                        </div>
                        <div>
                          <p className="text-muted">Valor Total</p>
                          <p className="font-semibold text-gold">{formatCurrency(maquina.valor_total)}</p>
                        </div>
                        <div>
                          <p className="text-muted">Diária</p>
                          <p className="font-semibold text-green-500">{formatCurrency(maquina.valor_diaria)}</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-muted">Status</span>
                          {getStatusBadge(maquina)}
                        </div>
                        <Button
                          onClick={() => openSimulation(maquina)}
                          disabled={isBlocked}
                          className={`w-full ${isBlocked ? 'bg-red-500/20 text-red-500 border border-red-500/30 cursor-not-allowed hover:bg-red-500/20' : 'btn-primary'}`}
                        >
                          {isBlocked ? (
                            <>
                              <Lock className="w-4 h-4 mr-2" />
                              Bloqueado - Sem Estoque
                            </>
                          ) : (
                            <>
                              <Calendar className="w-4 h-4 mr-2" />
                              Simular Locação
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <Card className="card">
            <CardHeader>
              <CardTitle className="text-gold">Contratos Ativos de Locação</CardTitle>
            </CardHeader>
            <CardContent>
              {contratos.length === 0 ? (
                <p className="text-center text-muted py-8">Nenhum contrato ativo</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3">Máquina</th>
                        <th className="text-left p-3">Cliente</th>
                        <th className="text-left p-3">Período</th>
                        <th className="text-right p-3">Qtd/Diárias</th>
                        <th className="text-right p-3">Valor Total</th>
                        <th className="text-center p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contratos.map((contrato) => (
                        <tr key={contrato.id} className="border-b border-border/50 hover:bg-accent/5">
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-white">{contrato.maquina_item}</p>
                              {contrato.obra && <p className="text-xs text-muted">{contrato.obra}</p>}
                            </div>
                          </td>
                          <td className="p-3 text-muted">{contrato.cliente}</td>
                          <td className="p-3">
                            <div className="text-xs">
                              <p className="text-white">{format(new Date(contrato.data_inicio), 'dd/MM/yyyy')}</p>
                              <p className="text-muted">até {format(new Date(contrato.data_fim), 'dd/MM/yyyy')}</p>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <p className="text-white">{contrato.quantidade_locada}x • {contrato.dias_locacao}d</p>
                            <p className="text-xs text-muted">{formatCurrency(contrato.valor_diaria)}/dia</p>
                          </td>
                          <td className="p-3 text-right font-semibold text-gold">{formatCurrency(contrato.valor_total)}</td>
                          <td className="p-3 text-center">
                            <Button size="sm" onClick={() => marcarRecebido(contrato.id)} className="btn-primary text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Receber e Finalizar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cadastro">
          <Card className="card max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-gold">Adicionar Novo Maquinário</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={adicionarMaquina} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nome do Item *</Label>
                    <Input value={maquinaForm.item} onChange={(e) => setMaquinaForm({ ...maquinaForm, item: e.target.value })} placeholder="Ex: Betoneira 400L" required className="input-dark" />
                  </div>
                  <div className="col-span-2">
                    <Label>Nome Completo *</Label>
                    <Input value={maquinaForm.nome} onChange={(e) => setMaquinaForm({ ...maquinaForm, nome: e.target.value })} required className="input-dark" />
                  </div>
                  <div>
                    <Label>Categoria *</Label>
                    <Input value={maquinaForm.categoria} onChange={(e) => setMaquinaForm({ ...maquinaForm, categoria: e.target.value })} placeholder="Ex: Equipamento Pesado" required className="input-dark" />
                  </div>
                  <div>
                    <Label>Quantidade *</Label>
                    <Input type="number" value={maquinaForm.quantidade} onChange={(e) => setMaquinaForm({ ...maquinaForm, quantidade: parseInt(e.target.value) || 1 })} min="1" required className="input-dark" />
                  </div>
                  <div>
                    <Label>Valor Unitário (R$) *</Label>
                    <Input type="number" step="0.01" value={maquinaForm.valor_unitario} onChange={(e) => setMaquinaForm({ ...maquinaForm, valor_unitario: parseFloat(e.target.value) || 0 })} min="0" required className="input-dark" />
                  </div>
                  <div>
                    <Label>Valor da Diária (R$) *</Label>
                    <Input type="number" step="0.01" value={maquinaForm.valor_diaria} onChange={(e) => setMaquinaForm({ ...maquinaForm, valor_diaria: parseFloat(e.target.value) || 0 })} min="0" required className="input-dark" />
                  </div>
                  <div className="col-span-2">
                    <Label>Observações</Label>
                    <Input value={maquinaForm.observacao} onChange={(e) => setMaquinaForm({ ...maquinaForm, observacao: e.target.value })} className="input-dark" />
                  </div>
                </div>

                {maquinaForm.quantidade > 0 && maquinaForm.valor_unitario > 0 && (
                  <div className="bg-gold/10 border border-gold/20 rounded-lg p-4">
                    <p className="text-sm text-muted mb-1">Valor Total do Investimento</p>
                    <p className="text-2xl font-bold text-gold">{formatCurrency(maquinaForm.quantidade * maquinaForm.valor_unitario)}</p>
                    <p className="text-xs text-muted mt-2">{maquinaForm.quantidade} unidade(s) × {formatCurrency(maquinaForm.valor_unitario)}</p>
                  </div>
                )}

                <Button type="submit" className="btn-primary w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Maquinário
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={simulationOpen} onOpenChange={setSimulationOpen}>
        <DialogContent className="bg-surface border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gold text-xl">Simular Locação - {selectedMaquina?.item}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gold/10 border border-gold/20 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted">Equipamento</p>
                  <p className="font-semibold text-white">{selectedMaquina?.item}</p>
                </div>
                <div>
                  <p className="text-muted">Valor da Diária</p>
                  <p className="font-semibold text-gold">{selectedMaquina && formatCurrency(selectedMaquina.valor_diaria)}</p>
                </div>
                <div>
                  <p className="text-muted">Disponível</p>
                  <p className="font-semibold text-white">{selectedMaquina?.quantidade_disponivel} unidade(s)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cliente *</Label>
                <Input value={simulationForm.cliente} onChange={(e) => setSimulationForm({ ...simulationForm, cliente: e.target.value })} className="input-dark" />
              </div>
              <div>
                <Label>Obra (opcional)</Label>
                <Input value={simulationForm.obra} onChange={(e) => setSimulationForm({ ...simulationForm, obra: e.target.value })} className="input-dark" />
              </div>
            </div>

            <div>
              <Label>Quantidade a Locar *</Label>
              <Input type="number" value={simulationForm.quantidade_locada} onChange={(e) => setSimulationForm({ ...simulationForm, quantidade_locada: parseInt(e.target.value) || 1 })} min="1" max={selectedMaquina?.quantidade_disponivel || 1} className="input-dark" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início *</Label>
                <Input type="date" value={simulationForm.data_inicio} onChange={(e) => setSimulationForm({ ...simulationForm, data_inicio: e.target.value })} className="input-dark" />
              </div>
              <div>
                <Label>Data Fim *</Label>
                <Input type="date" value={simulationForm.data_fim} onChange={(e) => setSimulationForm({ ...simulationForm, data_fim: e.target.value })} min={simulationForm.data_inicio} className="input-dark" />
              </div>
            </div>

            <div>
              <Label>Forma de Pagamento</Label>
              <select value={simulationForm.forma_pagamento} onChange={(e) => setSimulationForm({ ...simulationForm, forma_pagamento: e.target.value as any })} className="select-dark w-full">
                <option value="banco">Banco</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>

            {simulationForm.dias > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-500">Simulação</span>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted mb-1">Quantidade</p>
                    <p className="text-xl font-bold text-white">{simulationForm.quantidade_locada}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Diárias</p>
                    <p className="text-xl font-bold text-white">{simulationForm.dias}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted mb-1">Valor Total</p>
                    <p className="text-2xl font-bold text-gold">{formatCurrency(simulationForm.valor_total)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted mt-3">
                  {simulationForm.quantidade_locada} × {simulationForm.dias} diárias × {selectedMaquina && formatCurrency(selectedMaquina.valor_diaria)}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={confirmarContrato} disabled={!simulationForm.cliente || !simulationForm.data_inicio || !simulationForm.data_fim} className="btn-primary flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Contrato
              </Button>
              <Button type="button" onClick={() => setSimulationOpen(false)} className="btn-secondary">Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-surface border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gold text-xl">Editar Maquinário</DialogTitle>
          </DialogHeader>

          <form onSubmit={atualizarMaquina} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome do Item *</Label>
                <Input value={maquinaForm.item} onChange={(e) => setMaquinaForm({ ...maquinaForm, item: e.target.value })} required className="input-dark" />
              </div>
              <div className="col-span-2">
                <Label>Nome Completo *</Label>
                <Input value={maquinaForm.nome} onChange={(e) => setMaquinaForm({ ...maquinaForm, nome: e.target.value })} required className="input-dark" />
              </div>
              <div>
                <Label>Categoria *</Label>
                <Input value={maquinaForm.categoria} onChange={(e) => setMaquinaForm({ ...maquinaForm, categoria: e.target.value })} required className="input-dark" />
              </div>
              <div>
                <Label>Quantidade Total *</Label>
                <Input type="number" value={maquinaForm.quantidade} onChange={(e) => setMaquinaForm({ ...maquinaForm, quantidade: parseInt(e.target.value) || 1 })} min="1" required className="input-dark" />
                <p className="text-xs text-muted mt-1">Aumentar/diminuir quantidade total</p>
              </div>
              <div>
                <Label>Valor Unitário (R$) *</Label>
                <Input type="number" step="0.01" value={maquinaForm.valor_unitario} onChange={(e) => setMaquinaForm({ ...maquinaForm, valor_unitario: parseFloat(e.target.value) || 0 })} min="0" required className="input-dark" />
              </div>
              <div>
                <Label>Valor da Diária (R$) *</Label>
                <Input type="number" step="0.01" value={maquinaForm.valor_diaria} onChange={(e) => setMaquinaForm({ ...maquinaForm, valor_diaria: parseFloat(e.target.value) || 0 })} min="0" required className="input-dark" />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Input value={maquinaForm.observacao} onChange={(e) => setMaquinaForm({ ...maquinaForm, observacao: e.target.value })} className="input-dark" />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  if (selectedMaquina) {
                    excluirMaquina(selectedMaquina.id, selectedMaquina.item);
                  }
                }}
                className="bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
              <Button type="submit" className="btn-primary flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
              <Button type="button" onClick={() => setEditOpen(false)} className="btn-secondary">Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
