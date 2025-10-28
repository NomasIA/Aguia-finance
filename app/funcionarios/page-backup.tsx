'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, DollarSign, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Funcionario {
  id: string;
  nome: string;
  funcao: string;
  tipo_vinculo: string;
  salario_base: number;
  ajuda_custo: number;
  vale_salario: number;
  aplica_encargos: boolean;
  encargos_pct: number;
  inss_pct: number;
  fgts_pct: number;
  outros_encargos_pct: number;
  usa_adiantamento: boolean;
  recebe_vt: boolean;
  vt_valor_unitario_dia: number;
  vt_dias_uteis_override: number | null;
  ativo: boolean;
}

interface Diarista {
  id: string;
  nome: string;
  funcao: string;
  valor_diaria: number;
  ativo: boolean;
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [diaristas, setDiaristas] = useState<Diarista[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    funcao: '',
    tipo_vinculo: 'CLT',
    salario_base: 0,
    ajuda_custo: 0,
    vale_salario: 0,
    aplica_encargos: true,
    encargos_pct: 0,
    inss_pct: 0,
    fgts_pct: 0,
    outros_encargos_pct: 0,
    usa_adiantamento: false,
    recebe_vt: false,
    vt_valor_unitario_dia: 0,
    vt_dias_uteis_override: null as number | null,
    ativo: true,
  });

  useEffect(() => {
    loadFuncionarios();
    loadDiaristas();
  }, []);

  const loadFuncionarios = async () => {
    try {
      const { data, error } = await supabase
        .from('funcionarios_mensalistas')
        .select('*')
        .order('nome');

      if (error) throw error;
      setFuncionarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os funcionários',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDiaristas = async () => {
    try {
      const { data, error } = await supabase
        .from('diaristas')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setDiaristas(data || []);
    } catch (error) {
      console.error('Erro ao carregar diaristas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('funcionarios_mensalistas')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Funcionário atualizado com sucesso',
        });
      } else {
        const { error } = await supabase
          .from('funcionarios_mensalistas')
          .insert([formData]);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Funcionário cadastrado com sucesso',
        });
      }

      setDialogOpen(false);
      resetForm();
      loadFuncionarios();
    } catch (error) {
      console.error('Erro ao salvar funcionário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o funcionário',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (func: Funcionario) => {
    setEditingId(func.id);
    setFormData({
      nome: func.nome,
      funcao: func.funcao,
      tipo_vinculo: func.tipo_vinculo,
      salario_base: func.salario_base,
      ajuda_custo: func.ajuda_custo,
      vale_salario: func.vale_salario,
      aplica_encargos: func.aplica_encargos,
      encargos_pct: func.encargos_pct,
      inss_pct: func.inss_pct,
      fgts_pct: func.fgts_pct,
      outros_encargos_pct: func.outros_encargos_pct,
      usa_adiantamento: func.usa_adiantamento,
      recebe_vt: func.recebe_vt,
      vt_valor_unitario_dia: func.vt_valor_unitario_dia,
      vt_dias_uteis_override: func.vt_dias_uteis_override,
      ativo: func.ativo,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este funcionário?')) return;

    try {
      const { error } = await supabase
        .from('funcionarios_mensalistas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Funcionário excluído com sucesso',
      });
      loadFuncionarios();
    } catch (error) {
      console.error('Erro ao excluir funcionário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o funcionário',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nome: '',
      funcao: '',
      tipo_vinculo: 'CLT',
      salario_base: 0,
      ajuda_custo: 0,
      vale_salario: 0,
      aplica_encargos: true,
      encargos_pct: 0,
      inss_pct: 0,
      fgts_pct: 0,
      outros_encargos_pct: 0,
      usa_adiantamento: false,
      recebe_vt: false,
      vt_valor_unitario_dia: 0,
      vt_dias_uteis_override: null,
      ativo: true,
    });
  };

  const calcularCustoTotal = (func: Funcionario) => {
    let total = func.salario_base + func.ajuda_custo + func.vale_salario;

    if (func.aplica_encargos) {
      const encargos = func.salario_base * (
        (func.encargos_pct / 100) +
        (func.inss_pct / 100) +
        (func.fgts_pct / 100) +
        (func.outros_encargos_pct / 100)
      );
      total += encargos;
    }

    if (func.recebe_vt) {
      const diasUteis = func.vt_dias_uteis_override || 22;
      const vt = diasUteis * func.vt_valor_unitario_dia;
      total += vt;
    }

    return total;
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
          <div className="text-gold text-lg">Carregando funcionários...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Funcionários Mensalistas</h1>
            <p className="text-muted">Gerenciamento de funcionários CLT e PJ</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Novo Funcionário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border-border">
              <DialogHeader>
                <DialogTitle className="text-gold">
                  {editingId ? 'Editar Funcionário' : 'Novo Funcionário'}
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
                    <label className="block text-sm font-medium mb-2">Função</label>
                    <Input
                      value={formData.funcao}
                      onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                      required
                      className="input-dark"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Salário Base</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.salario_base}
                      onChange={(e) => setFormData({ ...formData, salario_base: parseFloat(e.target.value) || 0 })}
                      className="input-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Ajuda de Custo</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.ajuda_custo}
                      onChange={(e) => setFormData({ ...formData, ajuda_custo: parseFloat(e.target.value) || 0 })}
                      className="input-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Vale Salário</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.vale_salario}
                      onChange={(e) => setFormData({ ...formData, vale_salario: parseFloat(e.target.value) || 0 })}
                      className="input-dark"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.recebe_vt}
                      onChange={(e) => setFormData({ ...formData, recebe_vt: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Recebe Vale Transporte (VT)</span>
                  </label>
                </div>

                {formData.recebe_vt && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-panel/50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium mb-2">VT Valor/Dia</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.vt_valor_unitario_dia}
                        onChange={(e) => setFormData({ ...formData, vt_valor_unitario_dia: parseFloat(e.target.value) || 0 })}
                        className="input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Dias Úteis (padrão: 22)</label>
                      <Input
                        type="number"
                        value={formData.vt_dias_uteis_override || ''}
                        onChange={(e) => setFormData({ ...formData, vt_dias_uteis_override: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="22"
                        className="input-dark"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Ativo</span>
                  </label>
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

        <Card className="card">
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Função</th>
                  <th>Salário Base</th>
                  <th>Ajuda Custo</th>
                  <th>Vale Salário</th>
                  <th>VT</th>
                  <th>Custo Total</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {funcionarios.map((func) => (
                  <tr key={func.id}>
                    <td className="font-medium">{func.nome}</td>
                    <td>{func.funcao}</td>
                    <td>{formatCurrency(func.salario_base)}</td>
                    <td>{formatCurrency(func.ajuda_custo)}</td>
                    <td>{formatCurrency(func.vale_salario)}</td>
                    <td>
                      {func.recebe_vt ? (
                        <span className="text-success text-xs">
                          {formatCurrency(func.vt_valor_unitario_dia)}/dia
                        </span>
                      ) : (
                        <span className="text-muted text-xs">Não</span>
                      )}
                    </td>
                    <td className="font-semibold text-gold">
                      {formatCurrency(calcularCustoTotal(func))}
                    </td>
                    <td>
                      {func.ativo ? (
                        <span className="text-xs px-2 py-1 bg-success/10 text-success rounded-full">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(func)}
                          className="hover:bg-gold/10"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(func.id)}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="card p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gold/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gold">
                  {formatCurrency(funcionarios.filter(f => f.ativo).reduce((sum, f) => sum + calcularCustoTotal(f), 0))}
                </p>
                <p className="text-sm text-muted">Custo Total Mensal (Mensalistas Ativos)</p>
              </div>
            </div>
          </Card>

          <Card className="card p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-info/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-info">
                  {formatCurrency(diaristas.reduce((sum, d) => sum + (d.valor_diaria * 5), 0))}
                </p>
                <p className="text-sm text-muted">Custo Semanal Estimado (Diaristas)</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="card">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-bold text-gold mb-2">Diaristas - Pagamento toda Sexta-feira</h2>
            <p className="text-sm text-muted">
              Diaristas ativos recebem o pagamento semanal sempre na sexta-feira, baseado nos dias trabalhados.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Função</th>
                  <th>Valor da Diária</th>
                  <th>Pagamento Semanal (5 dias)</th>
                  <th>Dia de Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {diaristas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-8">
                      Nenhum diarista ativo cadastrado
                    </td>
                  </tr>
                ) : (
                  diaristas.map((diarista) => (
                    <tr key={diarista.id}>
                      <td className="font-medium">{diarista.nome}</td>
                      <td>{diarista.funcao}</td>
                      <td className="text-gold font-semibold">
                        {formatCurrency(diarista.valor_diaria)}
                      </td>
                      <td className="text-success font-semibold">
                        {formatCurrency(diarista.valor_diaria * 5)}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2 text-xs px-3 py-1 bg-info/10 text-info rounded-full border border-info/20">
                          <Calendar className="w-3 h-3" />
                          Sexta-feira
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {diaristas.length > 0 && (
            <div className="p-4 bg-info/5 border-t border-border">
              <p className="text-sm text-muted">
                <strong>Total estimado para próxima sexta-feira:</strong>{' '}
                <span className="text-gold font-bold">
                  {formatCurrency(diaristas.reduce((sum, d) => sum + (d.valor_diaria * 5), 0))}
                </span>
                {' '}(considerando 5 dias trabalhados por diarista)
              </p>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
