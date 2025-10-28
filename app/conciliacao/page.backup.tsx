'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileCheck, Upload, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Transaction {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  conciliado: boolean;
  categoria?: string;
}

export default function ConciliacaoPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankStatements, setBankStatements] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [conciliationRate, setConciliationRate] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_ledger')
        .select('*')
        .eq('forma', 'banco')
        .order('data', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        data: new Date(item.data).toLocaleDateString('pt-BR'),
        descricao: item.descricao || item.categoria,
        valor: parseFloat(item.valor),
        tipo: item.tipo,
        conciliado: item.conciliado || false,
        categoria: item.categoria
      }));

      setTransactions(formatted);

      const conciliados = formatted.filter((t: Transaction) => t.conciliado).length;
      const taxa = formatted.length > 0 ? (conciliados / formatted.length) * 100 : 0;
      setConciliationRate(taxa);

      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setLoading(false);
    }
  };

  const handleImportStatement = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const imported: Transaction[] = [];

        lines.slice(1).forEach((line, index) => {
          const parts = line.split(';');
          if (parts.length >= 3) {
            imported.push({
              id: `import-${index}`,
              data: parts[0],
              descricao: parts[1],
              valor: parseFloat(parts[2].replace(',', '.')),
              tipo: parseFloat(parts[2].replace(',', '.')) > 0 ? 'entrada' : 'saida',
              conciliado: false
            });
          }
        });

        setBankStatements(imported);
      } catch (error) {
        console.error('Erro ao importar arquivo:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleAutoMatch = () => {
    const updated = transactions.map(t => {
      const match = bankStatements.find(s =>
        Math.abs(s.valor) === Math.abs(t.valor) &&
        s.data === t.data
      );
      return match ? { ...t, conciliado: true } : t;
    });

    setTransactions(updated);
    const conciliados = updated.filter(t => t.conciliado).length;
    const taxa = updated.length > 0 ? (conciliados / updated.length) * 100 : 0;
    setConciliationRate(taxa);
  };

  const handleExport = () => {
    if (conciliationRate < 100) {
      alert('Não é possível exportar. A conciliação deve estar 100% completa.');
      return;
    }

    const csv = [
      'Data;Descrição;Valor;Tipo;Status',
      ...transactions.map(t =>
        `${t.data};${t.descricao};${t.valor};${t.tipo};Conciliado`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `conciliacao_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
          <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Conciliação Bancária</h1>
          <p className="text-muted">Concilie extratos do Itaú com lançamentos do sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="card">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Taxa de Conciliação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold">{conciliationRate.toFixed(1)}%</div>
              <p className="text-xs text-muted mt-2">
                {transactions.filter(t => t.conciliado).length} de {transactions.length} transações
              </p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Importar Extrato</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex items-center justify-center p-4 border-2 border-dashed border-gold/30 rounded-lg hover:border-gold/50 transition-colors">
                  <Upload className="h-6 w-6 text-gold mr-2" />
                  <span className="text-sm">Selecionar arquivo CSV</span>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportStatement}
                />
              </Label>
              <p className="text-xs text-muted mt-2">Formato: Data;Descrição;Valor</p>
            </CardContent>
          </Card>

          <Card className="card">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={handleAutoMatch}
                disabled={bankStatements.length === 0}
                className="w-full bg-info hover:bg-info/90"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Matching Automático
              </Button>
              <Button
                onClick={handleExport}
                disabled={conciliationRate < 100}
                className="w-full bg-success hover:bg-success/90"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardContent>
          </Card>
        </div>

        {conciliationRate < 100 && conciliationRate > 0 && (
          <Alert className="bg-warning/10 border-warning/20">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              A exportação só é permitida quando a conciliação estiver 100% completa.
              Atual: {conciliationRate.toFixed(1)}%
            </AlertDescription>
          </Alert>
        )}

        <Card className="card">
          <CardHeader>
            <CardTitle>Transações Bancárias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Descrição</th>
                    <th className="text-left p-3">Categoria</th>
                    <th className="text-right p-3">Valor</th>
                    <th className="text-center p-3">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border/50 hover:bg-accent/5">
                      <td className="p-3">
                        {transaction.conciliado ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted" />
                        )}
                      </td>
                      <td className="p-3 text-sm">{transaction.data}</td>
                      <td className="p-3 text-sm">{transaction.descricao}</td>
                      <td className="p-3 text-sm text-muted">{transaction.categoria || '-'}</td>
                      <td className="p-3 text-sm text-right font-medium">
                        <span className={transaction.tipo === 'entrada' ? 'text-success' : 'text-danger'}>
                          {formatCurrency(transaction.valor)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          transaction.tipo === 'entrada'
                            ? 'bg-success/10 text-success border border-success/20'
                            : 'bg-danger/10 text-danger border border-danger/20'
                        }`}>
                          {transaction.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
