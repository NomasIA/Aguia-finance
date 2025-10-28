'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReceitasWithInstallments from './receitas-with-installments';

interface Obra {
  id: string;
  cliente: string;
  nome_obra: string;
  endereco: string;
  responsavel: string;
  condicoes_pagamento: string;
  status: string;
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    cliente: '',
    nome_obra: '',
    endereco: '',
    responsavel: '',
    condicoes_pagamento: '',
    status: 'ativa',
  });

  useEffect(() => {
    loadObras();
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
            <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Obras e Receitas</h1>
            <p className="text-muted">Gestão completa de obras e sistema de parcelas</p>
          </div>
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

        <Tabs defaultValue="obras" className="space-y-6">
          <TabsList className="bg-surface border border-border">
            <TabsTrigger value="obras" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Obras
            </TabsTrigger>
            <TabsTrigger value="receitas" className="flex items-center gap-2">
              Receitas e Parcelas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="obras" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {obras.map((obra) => {
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
                      {obra.endereco && (
                        <div>
                          <span className="text-muted">Endereço: </span>
                          <span>{obra.endereco}</span>
                        </div>
                      )}
                      {obra.responsavel && (
                        <div>
                          <span className="text-muted">Responsável: </span>
                          <span>{obra.responsavel}</span>
                        </div>
                      )}
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

            {obras.length === 0 && (
              <Card className="card p-8 text-center text-muted">
                Nenhuma obra cadastrada
              </Card>
            )}
          </TabsContent>

          <TabsContent value="receitas">
            <ReceitasWithInstallments obras={obras} onReceitasChange={loadObras} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
