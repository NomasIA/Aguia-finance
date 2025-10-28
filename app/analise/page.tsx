'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wrench,
  DollarSign,
  AlertCircle,
  Activity
} from 'lucide-react';

interface AnalysisItem {
  id: string;
  type: 'warning' | 'danger' | 'success' | 'info';
  category: string;
  title: string;
  description: string;
  value?: string;
  icon: any;
}

export default function AnalisePage() {
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    warnings: 0,
    dangers: 0,
    successes: 0,
    infos: 0
  });

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    try {
      const results: AnalysisItem[] = [];

      const [ledgerData, bankData, cashData, maquinasData, locacoesData, custosData, obrasData] = await Promise.all([
        supabase.from('cash_ledger').select('*'),
        supabase.from('bank_accounts').select('saldo_atual').maybeSingle(),
        supabase.from('cash_books').select('saldo_atual').maybeSingle(),
        supabase.from('maquinas').select('id, nome').order('nome'),
        supabase.from('locacoes').select('maquina_id, data_fim').order('data_fim', { ascending: false }),
        supabase.from('custos_fixos').select('*'),
        supabase.from('obras').select('*'),
      ]);

      const ledger = ledgerData.data || [];
      const saldoBanco = bankData.data?.saldo_atual || 0;
      const saldoDinheiro = cashData.data?.saldo_atual || 0;
      const maquinas = maquinasData.data || [];
      const locacoes = locacoesData.data || [];
      const custos = custosData.data || [];
      const obras = obrasData.data || [];

      const entradas = ledger
        .filter((l: any) => l.tipo === 'entrada')
        .reduce((sum: number, l: any) => sum + parseFloat(l.valor), 0);

      const saidas = ledger
        .filter((l: any) => l.tipo === 'saida')
        .reduce((sum: number, l: any) => sum + parseFloat(l.valor), 0);

      const faturamento = entradas;
      const custoTotal = saidas;
      const lucro = faturamento - custoTotal;
      const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

      if (margem < 0) {
        results.push({
          id: 'margem-negativa',
          type: 'danger',
          category: 'Financeiro',
          title: 'Margem Operacional Negativa',
          description: 'Sua empresa está operando no prejuízo. Os custos excedem o faturamento.',
          value: `${margem.toFixed(1)}%`,
          icon: TrendingDown
        });
      } else if (margem < 15) {
        results.push({
          id: 'margem-baixa',
          type: 'warning',
          category: 'Financeiro',
          title: 'Margem Operacional Baixa',
          description: 'A margem está abaixo do ideal para o setor de construção (15-25%).',
          value: `${margem.toFixed(1)}%`,
          icon: AlertTriangle
        });
      } else {
        results.push({
          id: 'margem-saudavel',
          type: 'success',
          category: 'Financeiro',
          title: 'Margem Operacional Saudável',
          description: 'Sua margem está dentro do esperado para o setor.',
          value: `${margem.toFixed(1)}%`,
          icon: CheckCircle
        });
      }

      if (saldoBanco < 0) {
        results.push({
          id: 'banco-negativo',
          type: 'danger',
          category: 'Caixa',
          title: 'Saldo Bancário Negativo',
          description: 'Você está operando com saldo negativo no banco. Tome ação imediata.',
          value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoBanco),
          icon: XCircle
        });
      }

      if (saldoDinheiro < 0) {
        results.push({
          id: 'dinheiro-negativo',
          type: 'danger',
          category: 'Caixa',
          title: 'Saldo de Dinheiro Negativo',
          description: 'O saldo de caixa físico está negativo. Verifique lançamentos.',
          value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoDinheiro),
          icon: XCircle
        });
      }

      const hoje = new Date();
      const quinzeDiasAtras = new Date(hoje.getTime() - 15 * 24 * 60 * 60 * 1000);

      maquinas.forEach((maquina: any) => {
        const locacoesMaquina = locacoes.filter((loc: any) => loc.maquina_id === maquina.id);

        if (locacoesMaquina.length === 0) {
          results.push({
            id: `maquina-ociosa-${maquina.id}`,
            type: 'warning',
            category: 'Maquinários',
            title: `Máquina Ociosa: ${maquina.nome}`,
            description: 'Esta máquina nunca foi locada. Considere locar ou vender.',
            value: 'Nunca locada',
            icon: Wrench
          });
        } else {
          const ultimaLocacao = locacoesMaquina[0];

          if (ultimaLocacao && new Date(ultimaLocacao.data_fim) < quinzeDiasAtras) {
            const diasOciosa = Math.floor((hoje.getTime() - new Date(ultimaLocacao.data_fim).getTime()) / (24 * 60 * 60 * 1000));
            results.push({
              id: `maquina-ociosa-${maquina.id}`,
              type: 'warning',
              category: 'Maquinários',
              title: `Máquina Ociosa: ${maquina.nome}`,
              description: 'Esta máquina está parada há muito tempo. Busque oportunidades de locação.',
              value: `${diasOciosa} dias sem locação`,
              icon: Wrench
            });
          }
        }
      });

      const custoFixoTotal = custos.reduce((sum: number, c: any) => sum + parseFloat(c.valor), 0);
      const custoFixoPercentual = faturamento > 0 ? (custoFixoTotal / faturamento) * 100 : 0;

      if (custoFixoPercentual > 40) {
        results.push({
          id: 'custo-fixo-alto',
          type: 'warning',
          category: 'Custos Fixos',
          title: 'Custos Fixos Elevados',
          description: 'Seus custos fixos representam mais de 40% do faturamento. Considere otimizar.',
          value: `${custoFixoPercentual.toFixed(1)}% do faturamento`,
          icon: DollarSign
        });
      } else {
        results.push({
          id: 'custo-fixo-ok',
          type: 'success',
          category: 'Custos Fixos',
          title: 'Custos Fixos Controlados',
          description: 'Seus custos fixos estão em níveis saudáveis.',
          value: `${custoFixoPercentual.toFixed(1)}% do faturamento`,
          icon: CheckCircle
        });
      }

      const obrasAtivas = obras.filter((o: any) => o.status === 'ativa' || o.status === 'em_andamento').length;

      if (obrasAtivas === 0) {
        results.push({
          id: 'sem-obras',
          type: 'danger',
          category: 'Obras',
          title: 'Nenhuma Obra Ativa',
          description: 'Você não tem obras ativas no momento. Busque novos clientes.',
          value: '0 obras ativas',
          icon: AlertCircle
        });
      } else {
        results.push({
          id: 'obras-ativas',
          type: 'info',
          category: 'Obras',
          title: 'Obras em Andamento',
          description: 'Você tem obras ativas gerando receita.',
          value: `${obrasAtivas} obra${obrasAtivas > 1 ? 's' : ''} ativa${obrasAtivas > 1 ? 's' : ''}`,
          icon: Activity
        });
      }

      setAnalyses(results);

      setSummary({
        warnings: results.filter(r => r.type === 'warning').length,
        dangers: results.filter(r => r.type === 'danger').length,
        successes: results.filter(r => r.type === 'success').length,
        infos: results.filter(r => r.type === 'info').length
      });

      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
      setLoading(false);
    }
  };

  const getAlertClass = (type: string) => {
    switch (type) {
      case 'danger':
        return 'bg-danger/10 border-danger/20';
      case 'warning':
        return 'bg-warning/10 border-warning/20';
      case 'success':
        return 'bg-success/10 border-success/20';
      case 'info':
        return 'bg-info/10 border-info/20';
      default:
        return 'bg-accent/10 border-border';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'danger':
        return 'text-danger';
      case 'warning':
        return 'text-warning';
      case 'success':
        return 'text-success';
      case 'info':
        return 'text-info';
      default:
        return 'text-muted';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
            <p className="text-muted">Analisando dados...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Análise de Negócio</h1>
          <p className="text-muted">Insights e alertas automáticos baseados em seus dados</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Crítico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-danger">{summary.dangers}</div>
              <p className="text-xs text-muted mt-1">Requer ação imediata</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Atenção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{summary.warnings}</div>
              <p className="text-xs text-muted mt-1">Merece atenção</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Positivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{summary.successes}</div>
              <p className="text-xs text-muted mt-1">Indo bem</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Informativo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">{summary.infos}</div>
              <p className="text-xs text-muted mt-1">Para conhecimento</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {analyses.map((analysis) => {
            const Icon = analysis.icon;
            return (
              <Alert key={analysis.id} className={getAlertClass(analysis.type)}>
                <Icon className={`h-5 w-5 ${getIconColor(analysis.type)}`} />
                <AlertDescription>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          {analysis.category}
                        </span>
                      </div>
                      <h4 className="font-semibold text-base mb-1">{analysis.title}</h4>
                      <p className="text-sm opacity-90">{analysis.description}</p>
                    </div>
                    {analysis.value && (
                      <div className="ml-4 text-right">
                        <p className="text-lg font-bold whitespace-nowrap">{analysis.value}</p>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            );
          })}
        </div>

        {analyses.length === 0 && (
          <Card className="card p-12 text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Tudo em Ordem!</h3>
            <p className="text-muted">
              Nenhum alerta ou problema detectado no momento. Continue o bom trabalho!
            </p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
