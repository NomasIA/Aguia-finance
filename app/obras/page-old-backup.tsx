'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Building2, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Obra {
  id: string;
  cliente: string;
  nome_obra: string;
  endereco: string;
  responsavel: string;
  condicoes_pagamento: string;
  status: string;
}

interface Receita {
  id: string;
  obra_id: string;
  descricao: string;
  valor_total: number;
  parcela: number;
  parcelas: number;
  vencimento: string;
  recebido: boolean;
  data_recebimento: string | null;
  forma_recebimento: string | null;
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receitaDialogOpen, setReceitaDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedObra, setSelectedObra] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    cliente: '',
    nome_obra: '',
    endereco: '',
    responsavel: '',
    condicoes_pagamento: '',
    status: 'ativa',
  });

  const [receitaForm, setReceitaForm] = useState({
    obra_id: '',
    descricao: '',
    valor_total: 0,
    parcelas: 1,
    vencimento: '',
    forma_recebimento: 'banco' as 'banco' | 'dinheiro',
  });

  useEffect(() => {
    loadObras();
    loadReceitas();
  }, []);

  const loadObras = async () => {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('nome_obra');

      if (error) throw error;
      setObras(data || []);
    } catch (error) {
      console.error('Erro ao carregar obras:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReceitas = async () => {
    try {
      const { data, error } = await supabase
        .from('receitas')
        .select('*')
        .order('vencimento');

      if (error) throw error;
      setReceitas(data || []);
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('obras')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;

        toast({ title: 'Sucesso', description: 'Obra atualizada com sucesso' });
      } else {
        const { error } = await supabase.from('obras').insert([formData]);

        if (error) throw error;

        toast({ title: 'Sucesso', description: 'Obra cadastrada com sucesso' });
      }

      setDialogOpen(false);
      resetForm();
      loadObras();
    } catch (error) {
      console.error('Erro ao salvar obra:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar a obra', variant: 'destructive' });
    }
  };

  const handleReceitaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const parcelas = [];
      const valorParcela = receitaForm.valor_total / receitaForm.parcelas;

      for (let i = 1; i <= receitaForm.parcelas; i++) {
        parcelas.push({
          obra_id: receitaForm.obra_id,
          descricao: `${receitaForm.descricao} - Parcela ${i}/${receitaForm.parcelas}`,
          valor_total: valorParcela,
          parcela: i,
          parcelas: receitaForm.parcelas,
          vencimento: receitaForm.vencimento,
          forma_recebimento: receitaForm.forma_recebimento,
          recebido: false,
        });
      }

      const { error } = await supabase.from('receitas').insert(parcelas);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Receita(s) cadastrada(s) com sucesso' });
      setReceitaDialogOpen(false);
      resetReceitaForm();
      loadReceitas();
    } catch (error) {
      console.error('Erro ao salvar receita:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar a receita', variant: 'destructive' });
    }
  };

  const marcarRecebido = async (id: string) => {
    try {
      const { error } = await supabase
        .from('receitas')
        .update({
          recebido: true,
          data_recebimento: new Date().toISOString().split('T')[0],
        })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Receita marcada como recebida' });
      loadReceitas();
    } catch (error) {
      console.error('Erro ao marcar receita:', error);
      toast({ title: 'Erro', description: 'Não foi possível atualizar a receita', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      cliente: '',
      nome_obra: '',
      endereco: '',
      responsavel: '',
      condicoes_pagamento: '',
      status: 'ativa',
    });
  };

  const resetReceitaForm = () => {
    setReceitaForm({
      obra_id: '',
      descricao: '',
      valor_total: 0,
      parcelas: 1,
      vencimento: '',
      forma_recebimento: 'banco',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getTotalReceitas = (obraId: string) => {
    return receitas
      .filter(r => r.obra_id === obraId)
      .reduce((sum, r) => sum + r.valor_total, 0);
  };

  const getTotalRecebido = (obraId: string) => {
    return receitas
      .filter(r => r.obra_id === obraId && r.recebido)
      .reduce((sum, r) => sum + r.valor_total, 0);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gold text-lg">Carregando obras...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Obras</h1>
            <p className="text-muted">Gestão de obras e receitas</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={receitaDialogOpen} onOpenChange={(open) => {
              setReceitaDialogOpen(open);
              if (!open) resetReceitaForm();
            }}>
              <DialogTrigger asChild>
                <Button className="btn-secondary">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Nova Receita
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-surface border-border">
                <DialogHeader>
                  <DialogTitle className="text-gold">Nova Receita</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleReceitaSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Obra</label>
                    <select
                      value={receitaForm.obra_id}
                      onChange={(e) => setReceitaForm({ ...receitaForm, obra_id: e.target.value })}
                      className="select-dark w-full"
                      required
                    >
                      <option value="">Selecione...</option>
                      {obras.map((obra) => (
                        <option key={obra.id} value={obra.id}>{obra.nome_obra}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Descrição</label>
                    <Input
                      value={receitaForm.descricao}
                      onChange={(e) => setReceitaForm({ ...receitaForm, descricao: e.target.value })}
                      required
                      className="input-dark"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Valor Total</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={receitaForm.valor_total}
                        onChange={(e) => setReceitaForm({ ...receitaForm, valor_total: parseFloat(e.target.value) || 0 })}
                        required
                        className="input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Parcelas</label>
                      <Input
                        type="number"
                        value={receitaForm.parcelas}
                        onChange={(e) => setReceitaForm({ ...receitaForm, parcelas: parseInt(e.target.value) || 1 })}
                        required
                        min="1"
                        className="input-dark"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Vencimento</label>
                    <Input
                      type="date"
                      value={receitaForm.vencimento}
                      onChange={(e) => setReceitaForm({ ...receitaForm, vencimento: e.target.value })}
                      required
                      className="input-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Forma de Recebimento</label>
                    <select
                      value={receitaForm.forma_recebimento}
                      onChange={(e) => setReceitaForm({ ...receitaForm, forma_recebimento: e.target.value as any })}
                      className="select-dark w-full"
                    >
                      <option value="banco">Banco (Itaú)</option>
                      <option value="dinheiro">Dinheiro (Físico)</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="btn-primary flex-1">Cadastrar</Button>
                    <Button type="button" onClick={() => setReceitaDialogOpen(false)} className="btn-secondary">
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Obra
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-surface border-border">
                <DialogHeader>
                  <DialogTitle className="text-gold">
                    {editingId ? 'Editar Obra' : 'Nova Obra'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Cliente</label>
                      <Input
                        value={formData.cliente}
                        onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                        required
                        className="input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Nome da Obra</label>
                      <Input
                        value={formData.nome_obra}
                        onChange={(e) => setFormData({ ...formData, nome_obra: e.target.value })}
                        required
                        className="input-dark"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Endereço</label>
                    <Input
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      className="input-dark"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Responsável</label>
                      <Input
                        value={formData.responsavel}
                        onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                        className="input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="select-dark w-full"
                      >
                        <option value="ativa">Ativa</option>
                        <option value="concluida">Concluída</option>
                        <option value="pausada">Pausada</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Condições de Pagamento</label>
                    <Input
                      value={formData.condicoes_pagamento}
                      onChange={(e) => setFormData({ ...formData, condicoes_pagamento: e.target.value })}
                      className="input-dark"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="btn-primary flex-1">
                      {editingId ? 'Atualizar' : 'Cadastrar'}
                    </Button>
                    <Button type="button" onClick={() => { setDialogOpen(false); resetForm(); }} className="btn-secondary">
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {obras.map((obra) => {
            const totalReceitas = getTotalReceitas(obra.id);
            const totalRecebido = getTotalRecebido(obra.id);
            const percentualRecebido = totalReceitas > 0 ? (totalRecebido / totalReceitas) * 100 : 0;

            return (
              <Card key={obra.id} className="card card-hover p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gold mb-1">{obra.nome_obra}</h3>
                    <p className="text-sm text-muted">{obra.cliente}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditingId(obra.id);
                      setFormData({
                        cliente: obra.cliente,
                        nome_obra: obra.nome_obra,
                        endereco: obra.endereco,
                        responsavel: obra.responsavel,
                        condicoes_pagamento: obra.condicoes_pagamento,
                        status: obra.status,
                      });
                      setDialogOpen(true);
                    }} className="hover:bg-gold/10">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Total Receitas:</span>
                    <span className="font-semibold text-gold">{formatCurrency(totalReceitas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Recebido:</span>
                    <span className="font-semibold text-success">{formatCurrency(totalRecebido)}</span>
                  </div>
                  <div className="w-full bg-panel rounded-full h-2 mt-2">
                    <div className="bg-success h-2 rounded-full transition-all" style={{ width: `${percentualRecebido}%` }}></div>
                  </div>
                  <p className="text-xs text-muted text-center">{percentualRecebido.toFixed(1)}% recebido</p>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  {obra.status === 'ativa' && (
                    <span className="text-xs px-2 py-1 bg-success/10 text-success rounded-full">Ativa</span>
                  )}
                  {obra.status === 'concluida' && (
                    <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">Concluída</span>
                  )}
                  {obra.status === 'pausada' && (
                    <span className="text-xs px-2 py-1 bg-warning/10 text-warning rounded-full">Pausada</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="card p-6">
          <h3 className="text-lg font-semibold text-gold mb-4">Receitas Pendentes</h3>
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Forma</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {receitas.filter(r => !r.recebido).map((receita) => {
                  const obra = obras.find(o => o.id === receita.obra_id);
                  return (
                    <tr key={receita.id}>
                      <td className="font-medium">{obra?.nome_obra || '-'}</td>
                      <td>{receita.descricao}</td>
                      <td className="text-gold font-semibold">{formatCurrency(receita.valor_total)}</td>
                      <td>{new Date(receita.vencimento).toLocaleDateString('pt-BR')}</td>
                      <td>
                        {receita.forma_recebimento === 'banco' ? (
                          <span className="chip-banco">Banco (Itaú)</span>
                        ) : (
                          <span className="chip-dinheiro">Dinheiro (Físico)</span>
                        )}
                      </td>
                      <td>
                        <span className="text-xs px-2 py-1 bg-warning/10 text-warning rounded-full">
                          Pendente
                        </span>
                      </td>
                      <td>
                        <Button size="sm" onClick={() => marcarRecebido(receita.id)} className="btn-primary text-xs">
                          Marcar Recebido
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
