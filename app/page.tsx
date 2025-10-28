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
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Building2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KPIData {
  saldo_banco: number;
  saldo_dinheiro: number;
  total_entradas: number;
  total_saidas: number;
  lucro_operacional: number;
  count_entradas: number;
  count_saidas: number;
  count_conciliados: number;
  count_pendentes: number;
  ultima_atualizacao: string;
}

interface Movimentacao {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  forma: 'banco' | 'dinheiro';
  categoria: string;
  origem: string;
  descricao: string;
  valor: number;
  conciliado: boolean;
  created_at: string;
}

export default function HomePage() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [ultimas, setUltimas] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const handleRefresh = () => loadData();
    window.addEventListener('kpi-refresh', handleRefresh);
    window.addEventListener('revalidate-all', handleRefresh);
    window.addEventListener('revalidate-overview', handleRefresh);

    return () => {
      window.removeEventListener('kpi-refresh', handleRefresh);
      window.removeEventListener('revalidate-all', handleRefresh);
      window.removeEventListener('revalidate-overview', handleRefresh);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [kpisResult, ultimasResult] = await Promise.all([
        supabase.from('kpis_realtime').select('*').single(),
        supabase.from('ultimas_movimentacoes').select('*').limit(5)
      ]);

      if (kpisResult.data) {
        setKpis(kpisResult.data);
      }

      if (ultimasResult.data) {
        setUltimas(ultimasResult.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const chartData = kpis ? [
    {
      name: 'Entradas',
      valor: parseFloat(kpis.total_entradas.toString()),
      quantidade: kpis.count_entradas
    },
    {
      name: 'Saídas',
      valor: parseFloat(kpis.total_saidas.toString()),
      quantidade: kpis.count_saidas
    }
  ] : [];

  const saldoTotal = kpis ? parseFloat(kpis.saldo_banco.toString()) + parseFloat(kpis.saldo_dinheiro.toString()) : 0;
  const margemOperacional = kpis && kpis.total_entradas > 0
    ? (parseFloat(kpis.lucro_operacional.toString()) / parseFloat(kpis.total_entradas.toString())) * 100
    : 0;

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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gold mb-2">Visão Geral</h1>
          <p className="text-muted">Dashboard financeiro em tempo real</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted">Saldo Banco (Itaú)</CardTitle>
              <Building2 className="h-4 w-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">
                {kpis ? formatCurrency(parseFloat(kpis.saldo_banco.toString())) : 'R$ 0,00'}
              </div>
              <p className="text-xs text-muted mt-1">Conta principal</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted">Saldo Dinheiro</CardTitle>
              <Wallet className="h-4 w-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">
                {kpis ? formatCurrency(parseFloat(kpis.saldo_dinheiro.toString())) : 'R$ 0,00'}
              </div>
              <p className="text-xs text-muted mt-1">Caixa físico</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted">Saldo Total</CardTitle>
              <DollarSign className="h-4 w-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">
                {formatCurrency(saldoTotal)}
              </div>
              <p className="text-xs text-muted mt-1">Banco + Dinheiro</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted">Lucro Operacional</CardTitle>
              {kpis && parseFloat(kpis.lucro_operacional.toString()) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpis && parseFloat(kpis.lucro_operacional.toString()) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {kpis ? formatCurrency(parseFloat(kpis.lucro_operacional.toString())) : 'R$ 0,00'}
              </div>
              <p className="text-xs text-muted mt-1">
                Margem: {margemOperacional.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card">
            <CardHeader>
              <CardTitle className="text-gold">Entradas vs Saídas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #d4af37' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="valor" fill="#d4af37" name="Valor Total" />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted">Entradas</p>
                    <p className="text-lg font-semibold text-white">
                      {kpis ? formatCurrency(parseFloat(kpis.total_entradas.toString())) : 'R$ 0,00'}
                    </p>
                    <p className="text-xs text-muted">{kpis?.count_entradas || 0} movimentações</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-sm text-muted">Saídas</p>
                    <p className="text-lg font-semibold text-white">
                      {kpis ? formatCurrency(parseFloat(kpis.total_saidas.toString())) : 'R$ 0,00'}
                    </p>
                    <p className="text-xs text-muted">{kpis?.count_saidas || 0} movimentações</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader>
              <CardTitle className="text-gold flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Últimas Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ultimas.length === 0 ? (
                  <p className="text-muted text-center py-8">Nenhuma movimentação registrada</p>
                ) : (
                  ultimas.map((mov) => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between p-3 bg-surface/50 rounded-lg border border-border hover:border-gold/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${mov.tipo === 'entrada' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          {mov.tipo === 'entrada' ? (
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {mov.descricao || mov.categoria || mov.origem || 'Sem descrição'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <span>{format(new Date(mov.data), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            <span>•</span>
                            <span className="capitalize">{mov.forma}</span>
                            {mov.conciliado && (
                              <>
                                <span>•</span>
                                <span className="text-green-500">✓ Conciliado</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`text-right ${mov.tipo === 'entrada' ? 'text-green-500' : 'text-red-500'} font-semibold`}>
                        {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrency(parseFloat(mov.valor.toString()))}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {ultimas.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted mb-1">Conciliadas</p>
                      <p className="text-lg font-semibold text-green-500">{kpis?.count_conciliados || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">Pendentes</p>
                      <p className="text-lg font-semibold text-orange-500">{kpis?.count_pendentes || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {kpis?.ultima_atualizacao && (
          <div className="text-center text-xs text-muted">
            Última atualização: {format(new Date(kpis.ultima_atualizacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
