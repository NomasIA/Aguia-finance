'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CustoFixo {
  id: string;
  nome: string;
  categoria: string;
  valor: number;
  dia_vencimento: number;
  ativo: boolean;
}

export default function CustosFixosPage() {
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'aluguel',
    valor: 0,
    dia_vencimento: 10,
    ativo: true,
  });

  useEffect(() => {
    loadCustos();
  }, []);

  const loadCustos = async () => {
    try {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('*')
        .order('categoria', { ascending: true });

      if (error) throw error;
      setCustos(data || []);
    } catch (error) {
      console.error('Erro ao carregar custos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('custos_fixos')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Custo fixo atualizado com sucesso' });
      } else {
        const { error } = await supabase.from('custos_fixos').insert([formData]);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Custo fixo cadastrado com sucesso' });
      }

      setDialogOpen(false);
      resetForm();
      loadCustos();
    } catch (error) {
      console.error('Erro ao salvar custo:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar o custo fixo', variant: 'destructive' });
    }
  };

  const handleEdit = (custo: CustoFixo) => {
    setEditingId(custo.id);
    setFormData({
      nome: custo.nome,
      categoria: custo.categoria,
      valor: custo.valor,
      dia_vencimento: custo.dia_vencimento,
      ativo: custo.ativo,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este custo fixo?')) return;

    try {
      const { error } = await supabase.from('custos_fixos').delete().eq('id', id);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Custo fixo excluído com sucesso' });
      loadCustos();
    } catch (error) {
      console.error('Erro ao excluir custo:', error);
      toast({ title: 'Erro', description: 'Não foi possível excluir o custo fixo', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nome: '',
      categoria: 'aluguel',
      valor: 0,
      dia_vencimento: 10,
      ativo: true,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getTotalMensal = () => {
    return custos.filter(c => c.ativo).reduce((sum, c) => sum + c.valor, 0);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gold text-lg">Carregando custos fixos...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Custos Fixos</h1>
            <p className="text-muted">Gerenciamento de custos fixos mensais recorrentes</p>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Novo Custo Fixo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-surface border-border">
              <DialogHeader>
                <DialogTitle className="text-gold">
                  {editingId ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome</label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    className="input-dark"
                    placeholder="Ex: Aluguel Escritório"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Categoria</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="select-dark w-full"
                  >
                    <option value="aluguel">Aluguel</option>
                    <option value="luz">Luz</option>
                    <option value="agua">Água</option>
                    <option value="internet">Internet</option>
                    <option value="telefone">Telefone</option>
                    <option value="impostos">Impostos</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Valor Mensal</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                      required
                      className="input-dark"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Dia do Vencimento</label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dia_vencimento}
                      onChange={(e) =>
                        setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 10 })
                      }
                      required
                      className="input-dark"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm">Ativo</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="btn-primary flex-1">
                    {editingId ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                  <Button type="button" onClick={() => setDialogOpen(false)} className="btn-secondary">
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="kpi-label">Total Mensal (Ativos)</CardTitle>
            <DollarSign className="w-5 h-5 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="kpi-value">{formatCurrency(getTotalMensal())}</div>
            <p className="text-xs text-muted mt-2">{custos.filter(c => c.ativo).length} custos ativos</p>
          </CardContent>
        </Card>

        <Card className="card">
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Valor Mensal</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {custos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-8">
                      Nenhum custo fixo cadastrado
                    </td>
                  </tr>
                ) : (
                  custos.map((custo) => (
                    <tr key={custo.id}>
                      <td className="font-medium">{custo.nome}</td>
                      <td className="capitalize">{custo.categoria}</td>
                      <td className="font-semibold">{formatCurrency(custo.valor)}</td>
                      <td>Dia {custo.dia_vencimento}</td>
                      <td>
                        {custo.ativo ? (
                          <span className="text-xs px-2 py-1 bg-success/10 text-success rounded-full">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => handleEdit(custo)}
                            className="btn-icon"
                            size="sm"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(custo.id)}
                            className="btn-icon-danger"
                            size="sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
