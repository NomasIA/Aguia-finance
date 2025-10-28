'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, Building2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface Vault {
  id: string;
  nome: string;
  saldo_atual: number;
  tipo: 'banco' | 'dinheiro';
}

interface Transaction {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valor: number;
  forma: string;
}

export default function CaixaPage() {
  const [bankVault, setBankVault] = useState<Vault | null>(null);
  const [cashVault, setCashVault] = useState<Vault | null>(null);
  const [bankTransactions, setBankTransactions] = useState<Transaction[]>([]);
  const [cashTransactions, setCashTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bankData, cashData, ledgerData] = await Promise.all([
        supabase
          .from('bank_accounts')
          .select('id, nome, saldo_atual')
          .eq('nome', 'Itaú – Conta Principal')
          .maybeSingle(),
        supabase
          .from('cash_books')
          .select('id, nome, saldo_atual')
          .eq('nome', 'Caixa Dinheiro (Físico)')
          .maybeSingle(),
        supabase
          .from('cash_ledger')
          .select('*')
          .order('data', { ascending: false })
          .limit(50),
      ]);

      if (bankData.data) {
        setBankVault({ ...bankData.data, tipo: 'banco' });
      }

      if (cashData.data) {
        setCashVault({ ...cashData.data, tipo: 'dinheiro' });
      }

      const allTransactions = ledgerData.data || [];
      setBankTransactions(allTransactions.filter(t => t.forma === 'banco'));
      setCashTransactions(allTransactions.filter(t => t.forma === 'dinheiro'));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const calculateStats = (transactions: Transaction[]) => {
    const entradas = transactions
      .filter(t => t.tipo === 'entrada')
      .reduce((sum, t) => sum + t.valor, 0);

    const saidas = transactions
      .filter(t => t.tipo === 'saida')
      .reduce((sum, t) => sum + t.valor, 0);

    return { entradas, saidas, saldo: entradas - saidas };
  };

  const bankStats = calculateStats(bankTransactions);
  const cashStats = calculateStats(cashTransactions);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gold text-lg">Carregando cofres...</div>
        </div>
      </DashboardLayout>
    );
  }

  const renderVaultCard = (vault: Vault | null, stats: any, transactions: Transaction[], icon: React.ReactNode) => {
    if (!vault) return null;

    return (
      <div className="space-y-4">
        <Card className="kpi-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{vault.nome}</CardTitle>
              {icon}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted mb-1">Saldo Atual</p>
                <p className="text-3xl font-bold text-gold">{formatCurrency(vault.saldo_atual)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted mb-1">Entradas</p>
                  <p className="text-lg font-semibold text-success">{formatCurrency(stats.entradas)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Saídas</p>
                  <p className="text-lg font-semibold text-danger">{formatCurrency(stats.saidas)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card">
          <CardHeader>
            <CardTitle className="text-lg">Últimas Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-center text-muted py-8">Nenhuma movimentação</p>
              ) : (
                transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-panel/30 hover:bg-panel/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {transaction.tipo === 'entrada' ? (
                        <TrendingUp className="w-5 h-5 text-success" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-danger" />
                      )}
                      <div>
                        <p className="font-medium">{transaction.descricao}</p>
                        <p className="text-xs text-muted">
                          {format(new Date(transaction.data), 'dd/MM/yyyy')} • {transaction.categoria}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-semibold ${
                        transaction.tipo === 'entrada' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {transaction.tipo === 'entrada' ? '+' : '-'} {formatCurrency(transaction.valor)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Caixa & Banco</h1>
          <p className="text-muted">Movimentações separadas de Banco (Itaú) e Caixa Dinheiro (Físico)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="kpi-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="kpi-label">Saldo Total</CardTitle>
              <DollarSign className="w-5 h-5 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value">
                {formatCurrency((bankVault?.saldo_atual || 0) + (cashVault?.saldo_atual || 0))}
              </div>
              <p className="text-xs text-muted mt-2">Banco + Dinheiro</p>
            </CardContent>
          </Card>

          <Card className="kpi-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="kpi-label">Entradas Totais</CardTitle>
              <TrendingUp className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-xl text-success">
                {formatCurrency(bankStats.entradas + cashStats.entradas)}
              </div>
              <p className="text-xs text-muted mt-2">Últimas 50 transações</p>
            </CardContent>
          </Card>

          <Card className="kpi-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="kpi-label">Saídas Totais</CardTitle>
              <TrendingDown className="w-5 h-5 text-danger" />
            </CardHeader>
            <CardContent>
              <div className="kpi-value text-xl text-danger">
                {formatCurrency(bankStats.saidas + cashStats.saidas)}
              </div>
              <p className="text-xs text-muted mt-2">Últimas 50 transações</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderVaultCard(
            bankVault,
            bankStats,
            bankTransactions,
            <Building2 className="w-6 h-6 text-blue-400" />
          )}
          {renderVaultCard(
            cashVault,
            cashStats,
            cashTransactions,
            <Wallet className="w-6 h-6 text-success" />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
