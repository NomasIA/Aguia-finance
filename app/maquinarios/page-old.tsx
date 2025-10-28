'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Calculator, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Maquina {
  id: string;
  nome: string;
  categoria: string;
  custo_aquisicao: number;
  vida_util_meses: number;
  manutencao_pct_mensal: number;
  preco_mercado_diaria: number;
  preco_mercado_mensal: number;
  status: string;
  quantidade: number;
}

export default function MaquinariosPage() {
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [config, setConfig] = useState({
    margem_default: 0.30,
    desconto_semanal: 0.10,
    desconto_mensal: 0.15,
    impostos_pct: 0.08,
    caucao_pct: 0.20,
  });
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'Equipamento',
    custo_aquisicao: 0,
    vida_util_meses: 36,
    manutencao_pct_mensal: 0.015,
    preco_mercado_diaria: 0,
    preco_mercado_mensal: 0,
    status: 'disponivel',
    quantidade: 1,
  });

  const [simulador, setSimulador] = useState({
    maquina_id: '',
    dias: 1,
    margem: 0.30,
    frete: 0,
    usar_caucao: true,
  });

  const [resultadoSimulacao, setResultadoSimulacao] = useState({
    base_diaria: 0,
    depreciacao_dia: 0,
    manutencao_dia: 0,
    subtotal: 0,
    com_desconto: 0,
    com_margem: 0,
    impostos: 0,
    total_sem_frete: 0,
    total_com_frete: 0,
    caucao: 0,
    desconto_aplicado: 0,
  });

  useEffect(() => {
    loadMaquinas();
    loadConfig();
  }, []);

  const loadMaquinas = async () => {
    try {
      const { data, error } = await supabase
        .from('maquinas')
        .select('*')
        .order('nome');

      if (error) throw error;
      setMaquinas(data || []);
    } catch (error) {
      console.error('Erro ao carregar máquinas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig({
          margem_default: data.margem_default || 0.30,
          desconto_semanal: data.desconto_semanal || 0.10,
          desconto_mensal: data.desconto_mensal || 0.15,
          impostos_pct: data.impostos_pct || 0.08,
          caucao_pct: data.caucao_pct || 0.20,
        });
        setSimulador(prev => ({ ...prev, margem: data.margem_default || 0.30 }));
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const simularLocacao = () => {
    const maquina = maquinas.find(m => m.id === simulador.maquina_id);
    if (!maquina) return;

    const baseDiaria = Math.max(
      maquina.preco_mercado_diaria || 0,
      (maquina.preco_mercado_mensal || 0) / 30
    );

    const depreciacaoDia = (maquina.custo_aquisicao / maquina.vida_util_meses) / 30;
    const manutencaoDia = (maquina.custo_aquisicao * maquina.manutencao_pct_mensal) / 30;

    let subtotal = baseDiaria * simulador.dias;

    let descontoAplicado = 0;
    if (simulador.dias >= 28) {
      descontoAplicado = config.desconto_mensal;
      subtotal *= (1 - config.desconto_mensal);
    } else if (simulador.dias > 7) {
      descontoAplicado = config.desconto_semanal;
      subtotal *= (1 - config.desconto_semanal);
    }

    const comMargem = subtotal * (1 + simulador.margem);
    const impostos = comMargem * config.impostos_pct;
    const totalSemFrete = comMargem + impostos;
    const totalComFrete = totalSemFrete + simulador.frete;
    const caucao = simulador.usar_caucao ? totalComFrete * config.caucao_pct : 0;

    setResultadoSimulacao({
      base_diaria: baseDiaria,
      depreciacao_dia: depreciacaoDia,
      manutencao_dia: manutencaoDia,
      subtotal: baseDiaria * simulador.dias,
      com_desconto: subtotal,
      com_margem: comMargem,
      impostos,
      total_sem_frete: totalSemFrete,
      total_com_frete: totalComFrete,
      caucao,
      desconto_aplicado: descontoAplicado,
    });
  };

  useEffect(() => {
    if (simulador.maquina_id) {
      simularLocacao();
    }
  }, [simulador, maquinas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('maquinas')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Máquina atualizada com sucesso',
        });
      } else {
        const { error } = await supabase
          .from('maquinas')
          .insert([formData]);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Máquina cadastrada com sucesso',
        });
      }

      setDialogOpen(false);
      resetForm();
      loadMaquinas();
    } catch (error) {
      console.error('Erro ao salvar máquina:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a máquina',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (maquina: Maquina) => {
    setEditingId(maquina.id);
    setFormData({
      nome: maquina.nome,
      categoria: maquina.categoria,
      custo_aquisicao: maquina.custo_aquisicao,
      vida_util_meses: maquina.vida_util_meses,
      manutencao_pct_mensal: maquina.manutencao_pct_mensal,
      preco_mercado_diaria: maquina.preco_mercado_diaria,
      preco_mercado_mensal: maquina.preco_mercado_mensal,
      status: maquina.status,
      quantidade: maquina.quantidade,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta máquina?')) return;

    try {
      const { error } = await supabase
        .from('maquinas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Máquina excluída com sucesso',
      });
      loadMaquinas();
    } catch (error) {
      console.error('Erro ao excluir máquina:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a máquina',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nome: '',
      categoria: 'Equipamento',
      custo_aquisicao: 0,
      vida_util_meses: 36,
      manutencao_pct_mensal: 0.015,
      preco_mercado_diaria: 0,
      preco_mercado_mensal: 0,
      status: 'disponivel',
      quantidade: 1,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gold text-lg">Carregando maquinário...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Maquinário</h1>
            <p className="text-muted">Equipamentos e Simulador de Locação</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Nova Máquina
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border-border">
              <DialogHeader>
                <DialogTitle className="text-gold">
                  {editingId ? 'Editar Máquina' : 'Nova Máquina'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nome</label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                      className="input-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Categoria</label>
                    <Input
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      required
                      className="input-dark"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Custo Aquisição</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.custo_aquisicao}
                      onChange={(e) => setFormData({ ...formData, custo_aquisicao: parseFloat(e.target.value) || 0 })}
                      className="input-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Vida Útil (meses)</label>
                    <Input
                      type="number"
                      value={formData.vida_util_meses}
                      onChange={(e) => setFormData({ ...formData, vida_util_meses: parseInt(e.target.value) || 36 })}
                      className="input-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantidade</label>
                    <Input
                      type="number"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })}
                      className="input-dark"
                      min="1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Preço Mercado (Diária)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.preco_mercado_diaria}
                      onChange={(e) => setFormData({ ...formData, preco_mercado_diaria: parseFloat(e.target.value) || 0 })}
                      className="input-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Preço Mercado (Mensal)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.preco_mercado_mensal}
                      onChange={(e) => setFormData({ ...formData, preco_mercado_mensal: parseFloat(e.target.value) || 0 })}
                      className="input-dark"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="select-dark w-full"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="locado">Locado</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="btn-primary flex-1">
                    {editingId ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="cadastro" className="space-y-6">
          <TabsList className="bg-surface border border-border">
            <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
            <TabsTrigger value="simulador">Simulador de Locação</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro" className="space-y-6">
            <Card className="card">
              <div className="overflow-x-auto">
                <table className="table-dark">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Categoria</th>
                      <th>Qtd</th>
                      <th>Custo Aquisição</th>
                      <th>Preço Diária</th>
                      <th>Preço Mensal</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maquinas.map((maquina) => (
                      <tr key={maquina.id}>
                        <td className="font-medium">{maquina.nome}</td>
                        <td>{maquina.categoria}</td>
                        <td className="text-center">{maquina.quantidade}</td>
                        <td>{formatCurrency(maquina.custo_aquisicao)}</td>
                        <td className="text-gold">
                          {maquina.preco_mercado_diaria > 0
                            ? formatCurrency(maquina.preco_mercado_diaria)
                            : '-'}
                        </td>
                        <td className="text-gold">
                          {maquina.preco_mercado_mensal > 0
                            ? formatCurrency(maquina.preco_mercado_mensal)
                            : '-'}
                        </td>
                        <td>
                          {maquina.status === 'disponivel' && (
                            <span className="text-xs px-2 py-1 bg-success/10 text-success rounded-full">
                              Disponível
                            </span>
                          )}
                          {maquina.status === 'locado' && (
                            <span className="text-xs px-2 py-1 bg-warning/10 text-warning rounded-full">
                              Locado
                            </span>
                          )}
                          {maquina.status === 'manutencao' && (
                            <span className="text-xs px-2 py-1 bg-danger/10 text-danger rounded-full">
                              Manutenção
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(maquina)}
                              className="hover:bg-gold/10"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(maquina.id)}
                              className="hover:bg-danger/10 hover:text-danger"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="card p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gold/10 rounded-lg">
                  <Wrench className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{maquinas.length}</p>
                  <p className="text-sm text-muted">Equipamentos Cadastrados</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-success">
                    {maquinas.filter(m => m.status === 'disponivel').length}
                  </p>
                  <p className="text-sm text-muted">Disponíveis</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="simulador" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="card p-6">
                <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Parâmetros da Locação
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Equipamento</label>
                    <select
                      value={simulador.maquina_id}
                      onChange={(e) => setSimulador({ ...simulador, maquina_id: e.target.value })}
                      className="select-dark w-full"
                    >
                      <option value="">Selecione...</option>
                      {maquinas.map((maquina) => (
                        <option key={maquina.id} value={maquina.id}>
                          {maquina.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Dias de Locação</label>
                    <Input
                      type="number"
                      value={simulador.dias}
                      onChange={(e) => setSimulador({ ...simulador, dias: parseInt(e.target.value) || 1 })}
                      className="input-dark"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Margem de Lucro (%)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={simulador.margem * 100}
                      onChange={(e) => setSimulador({ ...simulador, margem: (parseFloat(e.target.value) || 0) / 100 })}
                      className="input-dark"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Frete</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={simulador.frete}
                      onChange={(e) => setSimulador({ ...simulador, frete: parseFloat(e.target.value) || 0 })}
                      className="input-dark"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={simulador.usar_caucao}
                        onChange={(e) => setSimulador({ ...simulador, usar_caucao: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Aplicar Caução ({(config.caucao_pct * 100).toFixed(0)}%)</span>
                    </label>
                  </div>
                </div>
              </Card>

              <Card className="card p-6">
                <h3 className="text-lg font-semibold text-gold mb-4">Resultado da Simulação</h3>
                {simulador.maquina_id ? (
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted">Base Diária:</span>
                      <span className="font-semibold">{formatCurrency(resultadoSimulacao.base_diaria)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted">Subtotal ({simulador.dias} dias):</span>
                      <span className="font-semibold">{formatCurrency(resultadoSimulacao.subtotal)}</span>
                    </div>
                    {resultadoSimulacao.desconto_aplicado > 0 && (
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-success">
                          Desconto ({(resultadoSimulacao.desconto_aplicado * 100).toFixed(0)}%):
                        </span>
                        <span className="font-semibold text-success">
                          -{formatCurrency(resultadoSimulacao.subtotal - resultadoSimulacao.com_desconto)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted">Com Margem:</span>
                      <span className="font-semibold">{formatCurrency(resultadoSimulacao.com_margem)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted">Impostos ({(config.impostos_pct * 100).toFixed(0)}%):</span>
                      <span className="font-semibold">{formatCurrency(resultadoSimulacao.impostos)}</span>
                    </div>
                    {simulador.frete > 0 && (
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted">Frete:</span>
                        <span className="font-semibold">{formatCurrency(simulador.frete)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-t-2 border-gold/30 mt-2">
                      <span className="text-lg font-semibold text-gold">TOTAL:</span>
                      <span className="text-2xl font-bold text-gold">
                        {formatCurrency(resultadoSimulacao.total_com_frete)}
                      </span>
                    </div>
                    {simulador.usar_caucao && (
                      <div className="flex justify-between py-2 bg-warning/10 px-3 rounded">
                        <span className="text-warning font-medium">Caução:</span>
                        <span className="font-bold text-warning">
                          {formatCurrency(resultadoSimulacao.caucao)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted">
                    Selecione um equipamento para simular
                  </div>
                )}
              </Card>
            </div>

            <Card className="card p-6 bg-panel/30">
              <h4 className="font-semibold mb-3 text-gold">Regras de Desconto</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-surface/50 rounded-lg">
                  <p className="text-muted mb-1">Diária</p>
                  <p className="font-semibold">Sem desconto</p>
                </div>
                <div className="p-3 bg-surface/50 rounded-lg">
                  <p className="text-muted mb-1">Semanal (8-27 dias)</p>
                  <p className="font-semibold text-success">{(config.desconto_semanal * 100).toFixed(0)}% desconto</p>
                </div>
                <div className="p-3 bg-surface/50 rounded-lg">
                  <p className="text-muted mb-1">Mensal (28+ dias)</p>
                  <p className="font-semibold text-success">{(config.desconto_mensal * 100).toFixed(0)}% desconto</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
