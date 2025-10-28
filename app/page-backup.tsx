'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Building2,
  Users,
  Wrench
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface KPI {
  saldoBanco: number;
  saldoDinheiro: number;
  saldoTotal: number;
  entradasBanco: number;
  entradasDinheiro: number;
  saidasBanco: number;
  saidasDinheiro: number;
  faturamento: number;
  lucroOperacional: number;
  margemOperacional: number;
  custoExecucaoInterna: number;
}

export default function HomePage() {
  const [kpis, setKpis] = useState<KPI>({
    saldoBanco: 0,
    saldoDinheiro: 0,
    saldoTotal: 0,
    entradasBanco: 0,
    entradasDinheiro: 0,
    saidasBanco: 0,
    saidasDinheiro: 0,
    faturamento: 0,
    lucroOperacional: 0,
    margemOperacional: 0,
    custoExecucaoInterna: 0,
  });
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      const [bankData, cashData, ledgerData, maquinasData, locacoesData] = await Promise.all([
        supabase.from('bank_accounts').select('saldo_atual').maybeSingle(),
        supabase.from('cash_books').select('saldo_atual').maybeSingle(),
        supabase.from('cash_ledger').select('tipo, forma, valor, categoria'),
        supabase.from('maquinas').select('id, nome').order('nome'),
        supabase.from('locacoes').select('maquina_id, data_fim').order('data_fim', { ascending: false }),
      ]);

      const saldoBanco = bankData.data?.saldo_atual || 0;
      const saldoDinheiro = cashData.data?.saldo_atual || 0;
      const saldoTotal = saldoBanco + saldoDinheiro;

      const ledger = ledgerData.data || [];

      const entradasBanco = ledger
        .filter((l: any) => l.tipo === 'entrada' && l.forma === 'banco')
        .reduce((sum: number, l: any) => sum + parseFloat(l.valor), 0);

      const entradasDinheiro = ledger
        .filter((l: any) => l.tipo === 'entrada' && l.forma === 'dinheiro')
        .reduce((sum: number, l: any) => sum + parseFloat(l.valor), 0);

      const saidasBanco = ledger
        .filter((l: any) => l.tipo === 'saida' && l.forma === 'banco')
        .reduce((sum: number, l: any) => sum + parseFloat(l.valor), 0);

      const saidasDinheiro = ledger
        .filter((l: any) => l.tipo === 'saida' && l.forma === 'dinheiro')
        .reduce((sum: number, l: any) => sum + parseFloat(l.valor), 0);

      const faturamento = entradasBanco + entradasDinheiro;
      const custoExecucao = saidasBanco + saidasDinheiro;
      const lucro = faturamento - custoExecucao;
      const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

      const newAlerts: string[] = [];
      if (margem < 0) newAlerts.push('Margem operacional negativa');
      if (saldoBanco < 0) newAlerts.push('Saldo bancário negativo');
      if (saldoDinheiro < 0) newAlerts.push('Saldo de caixa negativo');

      const maquinas = maquinasData.data || [];
      const locacoes = locacoesData.data || [];
      const hoje = new Date();
      const quinzeDiasAtras = new Date(hoje.getTime() - 15 * 24 * 60 * 60 * 1000);

      maquinas.forEach((maquina: any) => {
        const locacoesMaquina = locacoes.filter((loc: any) => loc.maquina_id === maquina.id);

        if (locacoesMaquina.length === 0) {
          newAlerts.push(`Máquina ociosa: ${maquina.nome} (nunca locada)`);
        } else {
          const ultimaLocacao = locacoesMaquina[0];

          if (ultimaLocacao && new Date(ultimaLocacao.data_fim) < quinzeDiasAtras) {
            const diasOciosa = Math.floor((hoje.getTime() - new Date(ultimaLocacao.data_fim).getTime()) / (24 * 60 * 60 * 1000));
            newAlerts.push(`Máquina ociosa: ${maquina.nome} (${diasOciosa} dias sem locação)`);
          }
        }
      });

      setKpis({
        saldoBanco,
        saldoDinheiro,
        saldoTotal,
        entradasBanco,
        entradasDinheiro,
        saidasBanco,
        saidasDinheiro,
        faturamento,
        lucroOperacional: lucro,
        margemOperacional: margem,
        custoExecucaoInterna: custoExecucao,
      });

      setAlerts(newAlerts);

      setChartData([
        { name: 'Banco', Entradas: entradasBanco, Saídas: saidasBanco },
        { name: 'Dinheiro', Entradas: entradasDinheiro, Saídas: saidasDinheiro },
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar KPIs:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
            <p className="text-muted">Carregando dados...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Dashboard Financeiro</h1>
          <p className="text-muted">Visão geral do seu negócio</p>
        </div>

        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <Alert key={idx} variant="destructive" className="bg-danger/10 border-danger/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Banco</CardTitle>
              <Building2 className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">{formatCurrency(kpis.saldoBanco)}</div>
              <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-info/10 text-info border border-info/20">
                Itaú
              </span>
            </CardContent>
          </Card>

          <Card className="card hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Dinheiro</CardTitle>
              <Wallet className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">{formatCurrency(kpis.saldoDinheiro)}</div>
              <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-success/10 text-success border border-success/20">
                Caixa Físico
              </span>
            </CardContent>
          </Card>

          <Card className="card hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <DollarSign className="h-5 w-5 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">{formatCurrency(kpis.saldoTotal)}</div>
              <p className="text-xs text-muted mt-2">Banco + Dinheiro</p>
            </CardContent>
          </Card>

          <Card className="card hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
              <TrendingUp className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">{formatCurrency(kpis.faturamento)}</div>
              <p className="text-xs text-muted mt-2">Receitas totais</p>
            </CardContent>
          </Card>

          <Card className="card hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Operacional</CardTitle>
              {kpis.lucroOperacional >= 0 ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : (
                <TrendingDown className="h-5 w-5 text-danger" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpis.lucroOperacional >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(kpis.lucroOperacional)}
              </div>
              <p className="text-xs text-muted mt-2">Receitas - Despesas</p>
            </CardContent>
          </Card>

          <Card className="card hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margem Operacional</CardTitle>
              {kpis.margemOperacional >= 0 ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : (
                <TrendingDown className="h-5 w-5 text-danger" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpis.margemOperacional >= 0 ? 'text-success' : 'text-danger'}`}>
                {kpis.margemOperacional.toFixed(1)}%
              </div>
              <p className="text-xs text-muted mt-2">Lucratividade</p>
            </CardContent>
          </Card>

          <Card className="card hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo Execução</CardTitle>
              <Wrench className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">{formatCurrency(kpis.custoExecucaoInterna)}</div>
              <p className="text-xs text-muted mt-2">Despesas totais</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card">
            <CardHeader>
              <CardTitle>Entradas vs Saídas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1f2e',
                      border: '1px solid rgba(245, 199, 66, 0.2)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Entradas" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Saídas" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader>
              <CardTitle>Evolução do Saldo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={[
                    { name: 'Início', Banco: kpis.entradasBanco - kpis.saidasBanco, Dinheiro: kpis.entradasDinheiro - kpis.saidasDinheiro },
                    { name: 'Atual', Banco: kpis.saldoBanco, Dinheiro: kpis.saldoDinheiro },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1f2e',
                      border: '1px solid rgba(245, 199, 66, 0.2)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Banco" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Dinheiro" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
