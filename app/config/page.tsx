'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Settings, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [config, setConfig] = useState({
    margem_default: 0.30,
    desconto_semanal: 0.10,
    desconto_mensal: 0.15,
    impostos_pct: 0.08,
    caucao_pct: 0.20,
    impostos_empresa_modo: 'fixo' as 'fixo' | 'percentual',
    impostos_empresa_valor: 0,
    dias_uteis_padrao: 22,
    enable_conciliacao: true,
    nome_empresa: 'Águia Construções e Reforma',
  });

  useEffect(() => {
    loadConfig();
  }, []);

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
          impostos_empresa_modo: data.impostos_empresa_modo || 'fixo',
          impostos_empresa_valor: data.impostos_empresa_valor || 0,
          dias_uteis_padrao: data.dias_uteis_padrao || 22,
          enable_conciliacao: data.enable_conciliacao !== false,
          nome_empresa: data.nome_empresa || 'Águia Construções e Reforma',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: existing } = await supabase
        .from('config')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('config')
          .update(config)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config')
          .insert([config]);

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso',
      });
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gold text-lg">Carregando configurações...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Configurações</h1>
            <p className="text-muted">Parâmetros do sistema</p>
          </div>
          <Button onClick={handleSave} className="btn-primary">
            <Save className="w-4 h-4 mr-2" />
            Salvar Alterações
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card p-6">
            <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Simulador de Locação
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Margem de Lucro Padrão (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.margem_default * 100}
                  onChange={(e) => setConfig({ ...config, margem_default: (parseFloat(e.target.value) || 0) / 100 })}
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Desconto Semanal (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.desconto_semanal * 100}
                  onChange={(e) => setConfig({ ...config, desconto_semanal: (parseFloat(e.target.value) || 0) / 100 })}
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Desconto Mensal (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.desconto_mensal * 100}
                  onChange={(e) => setConfig({ ...config, desconto_mensal: (parseFloat(e.target.value) || 0) / 100 })}
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Impostos (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.impostos_pct * 100}
                  onChange={(e) => setConfig({ ...config, impostos_pct: (parseFloat(e.target.value) || 0) / 100 })}
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Caução (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.caucao_pct * 100}
                  onChange={(e) => setConfig({ ...config, caucao_pct: (parseFloat(e.target.value) || 0) / 100 })}
                  className="input-dark"
                />
              </div>
            </div>
          </Card>

          <Card className="card p-6">
            <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Geral
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nome da Empresa
                </label>
                <Input
                  value={config.nome_empresa}
                  onChange={(e) => setConfig({ ...config, nome_empresa: e.target.value })}
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Dias Úteis Padrão (VT)
                </label>
                <Input
                  type="number"
                  value={config.dias_uteis_padrao}
                  onChange={(e) => setConfig({ ...config, dias_uteis_padrao: parseInt(e.target.value) || 22 })}
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Modo Impostos Empresa
                </label>
                <select
                  value={config.impostos_empresa_modo}
                  onChange={(e) => setConfig({ ...config, impostos_empresa_modo: e.target.value as any })}
                  className="select-dark w-full"
                >
                  <option value="fixo">Valor Fixo (R$)</option>
                  <option value="percentual">Percentual do Faturamento (%)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {config.impostos_empresa_modo === 'fixo'
                    ? 'Valor Fixo Mensal (R$)'
                    : 'Percentual sobre Faturamento (%)'}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.impostos_empresa_valor}
                  onChange={(e) => setConfig({ ...config, impostos_empresa_valor: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.enable_conciliacao}
                    onChange={(e) => setConfig({ ...config, enable_conciliacao: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Habilitar Conciliação Bancária</span>
                </label>
              </div>
            </div>
          </Card>
        </div>

        <Card className="card p-6 bg-panel/30">
          <h4 className="font-semibold mb-2 text-gold">Sobre as Configurações</h4>
          <ul className="text-sm text-muted space-y-1 list-disc list-inside">
            <li>Margem de lucro padrão é aplicada automaticamente no simulador de locação</li>
            <li>Descontos são aplicados automaticamente para locações de 8+ dias (semanal) e 28+ dias (mensal)</li>
            <li>Dias úteis padrão é usado para cálculo de VT quando não há override específico por funcionário</li>
            <li>Impostos empresa podem ser configurados como valor fixo mensal ou percentual do faturamento</li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  );
}
