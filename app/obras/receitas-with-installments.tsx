'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateInstallments } from '@/lib/installment-utils';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Receita {
  id: string;
  obra_id: string;
  descricao: string;
  valor_total: number;
  parcelas: number;
  vencimento: string;
  forma_recebimento: string;
  deleted_at: string | null;
  created_at: string;
}

interface Parcela {
  id: string;
  receita_id: string;
  numero: number;
  valor: number;
  vencimento: string;
  recebido: boolean;
  data_recebimento: string | null;
  conciliado: boolean;
  forma_recebimento: string;
  deleted_at: string | null;
}

interface ReceitaWithParcelas extends Receita {
  parcelas_list: Parcela[];
}

interface Props {
  obras: any[];
  onReceitasChange: () => void;
}

export default function ReceitasWithInstallments({ obras, onReceitasChange }: Props) {
  const [receitas, setReceitas] = useState<ReceitaWithParcelas[]>([]);
  const [expandedReceitas, setExpandedReceitas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteParcelaDialogOpen, setDeleteParcelaDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'receita' | 'parcela'; id: string; data?: any } | null>(null);
  const { toast } = useToast();

  const [receitaForm, setReceitaForm] = useState({
    obra_id: '',
    descricao: '',
    valor_total: 0,
    parcelas: 1,
    vencimento: '',
    forma_recebimento: 'banco' as 'banco' | 'dinheiro',
  });

  useEffect(() => {
    loadReceitas();
  }, []);

  const loadReceitas = async () => {
    try {
      const { data: receitasData, error: receitasError } = await supabase
        .from('receitas')
        .select('*')
        .is('deleted_at', null)
        .order('vencimento', { ascending: false });

      if (receitasError) throw receitasError;

      const receitasWithParcelas: ReceitaWithParcelas[] = [];

      for (const receita of receitasData || []) {
        const { data: parcelasData, error: parcelasError } = await supabase
          .from('receitas_parcelas')
          .select('*')
          .eq('receita_id', receita.id)
          .is('deleted_at', null)
          .order('numero');

        if (parcelasError) {
          console.error('Error loading parcelas:', parcelasError);
          continue;
        }

        receitasWithParcelas.push({
          ...receita,
          parcelas_list: parcelasData || [],
        });
      }

      setReceitas(receitasWithParcelas);
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as receitas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const vencimentoDate = parse(receitaForm.vencimento, 'yyyy-MM-dd', new Date());

      const installments = generateInstallments({
        valorTotal: receitaForm.valor_total,
        numeroParcelas: receitaForm.parcelas,
        vencimentoInicial: vencimentoDate,
        periodicidade: 'mensal',
        ajustarFimDeSemana: true,
        fimDoMes: false,
      });

      const { data: receitaData, error: receitaError } = await supabase
        .from('receitas')
        .insert([{
          obra_id: receitaForm.obra_id,
          descricao: receitaForm.descricao,
          valor_total: receitaForm.valor_total,
          parcelas: receitaForm.parcelas,
          vencimento: receitaForm.vencimento,
          forma_recebimento: receitaForm.forma_recebimento,
        }])
        .select()
        .single();

      if (receitaError) throw receitaError;

      const parcelasToInsert = installments.map((inst) => ({
        receita_id: receitaData.id,
        numero: inst.numero,
        valor: inst.valor,
        vencimento: format(inst.vencimento, 'yyyy-MM-dd'),
        forma_recebimento: receitaForm.forma_recebimento,
        recebido: false,
        conciliado: false,
      }));

      const { error: parcelasError } = await supabase
        .from('receitas_parcelas')
        .insert(parcelasToInsert);

      if (parcelasError) throw parcelasError;

      toast({
        title: 'Sucesso',
        description: `Receita criada com ${receitaForm.parcelas} parcela(s)`,
      });

      setDialogOpen(false);
      resetForm();
      loadReceitas();
      onReceitasChange();
    } catch (error) {
      console.error('Erro ao criar receita:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a receita',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteReceita = async () => {
    if (!itemToDelete || itemToDelete.type !== 'receita') return;

    try {
      const { error } = await supabase
        .from('receitas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', itemToDelete.id);

      if (error) throw error;

      await supabase
        .from('receitas_parcelas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('receita_id', itemToDelete.id);

      toast({
        title: 'Sucesso',
        description: 'Receita excluída com sucesso',
      });

      loadReceitas();
      onReceitasChange();
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir receita:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a receita',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteParcela = async (undo: boolean = false) => {
    if (!itemToDelete || itemToDelete.type !== 'parcela') return;

    try {
      if (undo && itemToDelete.data) {
        await supabase
          .from('receitas_parcelas')
          .update({
            recebido: false,
            data_recebimento: null,
            conciliado: false,
          })
          .eq('id', itemToDelete.id);
      }

      const { error } = await supabase
        .from('receitas_parcelas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', itemToDelete.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Parcela excluída com sucesso',
      });

      loadReceitas();
      onReceitasChange();
      setDeleteParcelaDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir parcela:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a parcela',
        variant: 'destructive',
      });
    }
  };

  const marcarRecebido = async (parcelaId: string) => {
    try {
      const { error } = await supabase
        .from('receitas_parcelas')
        .update({
          recebido: true,
          data_recebimento: new Date().toISOString().split('T')[0],
        })
        .eq('id', parcelaId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Parcela marcada como recebida. Saldos atualizados automaticamente.',
      });

      window.dispatchEvent(new Event('kpi-refresh'));
      window.dispatchEvent(new Event('revalidate-all'));

      loadReceitas();
      onReceitasChange();
    } catch (error) {
      console.error('Erro ao marcar parcela:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a parcela',
        variant: 'destructive',
      });
    }
  };

  const desmarcarRecebido = async (parcelaId: string) => {
    try {
      const { error } = await supabase
        .from('receitas_parcelas')
        .update({
          recebido: false,
          data_recebimento: null,
        })
        .eq('id', parcelaId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Recebimento desfeito. Saldos recalculados automaticamente.',
      });

      window.dispatchEvent(new Event('kpi-refresh'));
      window.dispatchEvent(new Event('revalidate-all'));

      loadReceitas();
      onReceitasChange();
    } catch (error) {
      console.error('Erro ao desmarcar parcela:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível desfazer o recebimento',
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (type: 'receita' | 'parcela', id: string, data?: any) => {
    setItemToDelete({ type, id, data });
    if (type === 'receita') {
      setDeleteDialogOpen(true);
    } else {
      setDeleteParcelaDialogOpen(true);
    }
  };

  const toggleExpanded = (receitaId: string) => {
    setExpandedReceitas((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(receitaId)) {
        newSet.delete(receitaId);
      } else {
        newSet.add(receitaId);
      }
      return newSet;
    });
  };

  const resetForm = () => {
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

  const getStatusBadge = (parcela: Parcela) => {
    if (parcela.recebido) {
      return <span className="chip-success text-xs">Recebido</span>;
    }

    const hoje = new Date();
    const vencimento = new Date(parcela.vencimento);

    if (vencimento < hoje) {
      return <span className="chip-danger text-xs">Vencido</span>;
    }

    return <span className="chip-warning text-xs">Pendente</span>;
  };

  if (loading) {
    return <div className="text-gold">Carregando receitas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gold">Receitas e Parcelas</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Nova Receita
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-gold">Nova Receita</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label className="block text-sm font-medium mb-2">Vencimento Inicial</label>
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
                <Button type="button" onClick={() => setDialogOpen(false)} className="btn-secondary">
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="card">
        <div className="divide-y divide-border">
          {receitas.map((receita) => {
            const obra = obras.find(o => o.id === receita.obra_id);
            const isExpanded = expandedReceitas.has(receita.id);
            const totalRecebido = receita.parcelas_list.filter(p => p.recebido).reduce((sum, p) => sum + p.valor, 0);
            const percentualRecebido = receita.valor_total > 0 ? (totalRecebido / receita.valor_total) * 100 : 0;

            return (
              <div key={receita.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gold">{receita.descricao}</h3>
                      {receita.forma_recebimento === 'banco' ? (
                        <span className="chip-banco text-xs">Banco (Itaú)</span>
                      ) : (
                        <span className="chip-dinheiro text-xs">Dinheiro</span>
                      )}
                    </div>
                    <p className="text-sm text-muted">{obra?.nome_obra || 'Obra não encontrada'}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-gold font-semibold">{formatCurrency(receita.valor_total)}</span>
                      <span className="text-muted">•</span>
                      <span className="text-muted">{receita.parcelas_list.length} parcelas</span>
                      <span className="text-muted">•</span>
                      <span className="text-success">{formatCurrency(totalRecebido)} recebido</span>
                    </div>
                    <div className="w-full bg-panel rounded-full h-2 mt-2">
                      <div className="bg-success h-2 rounded-full transition-all" style={{ width: `${percentualRecebido}%` }}></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleExpanded(receita.id)}
                      className="hover:bg-gold/10"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDeleteDialog('receita', receita.id)}
                      className="hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && receita.parcelas_list.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2">Parcela</th>
                          <th className="text-left p-2">Vencimento</th>
                          <th className="text-right p-2">Valor</th>
                          <th className="text-center p-2">Status</th>
                          <th className="text-center p-2">Conciliado</th>
                          <th className="text-center p-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receita.parcelas_list.map((parcela) => (
                          <tr key={parcela.id} className="border-b border-border/50 hover:bg-accent/5">
                            <td className="p-2">{parcela.numero}/{receita.parcelas_list.length}</td>
                            <td className="p-2">
                              {format(new Date(parcela.vencimento), 'dd/MM/yyyy')}
                            </td>
                            <td className="p-2 text-right font-semibold text-gold">
                              {formatCurrency(parcela.valor)}
                            </td>
                            <td className="p-2 text-center">
                              {getStatusBadge(parcela)}
                            </td>
                            <td className="p-2 text-center">
                              {parcela.conciliado ? (
                                <span className="text-success text-xs">Sim</span>
                              ) : (
                                <span className="text-muted text-xs">Não</span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex gap-2 justify-center">
                                {!parcela.recebido ? (
                                  <Button
                                    size="sm"
                                    onClick={() => marcarRecebido(parcela.id)}
                                    className="btn-primary text-xs"
                                  >
                                    Marcar Recebido
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => desmarcarRecebido(parcela.id)}
                                    className="btn-secondary text-xs"
                                  >
                                    Desfazer
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openDeleteDialog('parcela', parcela.id, parcela)}
                                  className="hover:bg-danger/10 hover:text-danger"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {receitas.length === 0 && (
            <div className="p-8 text-center text-muted">
              Nenhuma receita cadastrada
            </div>
          )}
        </div>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirmar Exclusão de Receita
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              Esta ação excluirá a receita e todas as suas parcelas. Os dados serão preservados para auditoria, mas não aparecerão mais nos relatórios.
              <br /><br />
              <strong>Impacto:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Caixa e KPIs serão atualizados automaticamente</li>
                <li>Vínculos de conciliação serão removidos</li>
                <li>Esta ação não pode ser desfeita facilmente</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-secondary">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReceita} className="bg-danger hover:bg-danger/90">
              Excluir Receita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteParcelaDialogOpen} onOpenChange={setDeleteParcelaDialogOpen}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirmar Exclusão de Parcela
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {itemToDelete?.data?.recebido || itemToDelete?.data?.conciliado ? (
                <>
                  <strong className="text-warning">⚠️ Esta parcela está {itemToDelete?.data?.recebido ? 'recebida' : ''}{itemToDelete?.data?.recebido && itemToDelete?.data?.conciliado ? ' e ' : ''}{itemToDelete?.data?.conciliado ? 'conciliada' : ''}!</strong>
                  <br /><br />
                  Deseja desfazer o recebimento/conciliação e então excluir?
                  <br /><br />
                  <strong>Impacto:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Status será alterado para não recebido</li>
                    <li>Vínculo de conciliação será removido</li>
                    <li>Caixa e relatórios serão atualizados</li>
                  </ul>
                </>
              ) : (
                <>
                  Esta ação excluirá a parcela. O dado será preservado para auditoria.
                  <br /><br />
                  <strong>Impacto:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Caixa e KPIs serão atualizados</li>
                    <li>A parcela não aparecerá mais nos relatórios</li>
                  </ul>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-secondary">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteParcela(itemToDelete?.data?.recebido || itemToDelete?.data?.conciliado)}
              className="bg-danger hover:bg-danger/90"
            >
              {itemToDelete?.data?.recebido || itemToDelete?.data?.conciliado ? 'Desfazer & Excluir' : 'Excluir Parcela'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
