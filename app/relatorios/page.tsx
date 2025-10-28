'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Users, Calendar, TrendingUp, Wrench, Building2, DollarSign, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export default function RelatoriosPage() {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'dd/MM/yyyy');
  };

  const createStyledWorkbook = () => {
    const wb = XLSX.utils.book_new();
    return wb;
  };

  const addStyledSheet = (wb: any, data: any[], sheetName: string, headers: string[]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!ws[address]) continue;
      ws[address].s = {
        fill: { fgColor: { rgb: 'FFD700' } },
        font: { bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  const exportRelatorioMensalistas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('funcionarios_mensalistas')
        .select('*')
        .is('deleted_at', null)
        .order('nome');

      if (error) throw error;

      const wb = createStyledWorkbook();
      const rows = (data || []).map((f: any) => [
        f.nome,
        f.funcao || '',
        formatCurrency(f.salario_base || 0),
        formatCurrency(f.ajuda_custo || 0),
        formatCurrency(f.vale_salario || 0),
        f.recebe_vt ? 'Sim' : 'Não',
        formatCurrency(f.vt_valor_unitario_dia || 0),
        f.status || 'ativo'
      ]);

      addStyledSheet(wb, rows, 'Mensalistas', [
        'Nome', 'Função', 'Salário Base', 'Ajuda de Custo', 'Vale Salário',
        'Recebe VT', 'Valor VT/dia', 'Status'
      ]);

      XLSX.writeFile(wb, `Relatorio_Mensalistas_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

      toast({ title: 'Sucesso', description: 'Relatório de Mensalistas exportado com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: 'Erro', description: 'Não foi possível exportar o relatório', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportRelatorioDiaristas = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('diarista_lancamentos')
        .select('*, funcionarios_diaristas(nome)')
        .is('deleted_at', null)
        .order('data', { ascending: false });

      if (dataInicio) query = query.gte('data', dataInicio);
      if (dataFim) query = query.lte('data', dataFim);

      const { data, error } = await query;
      if (error) throw error;

      const wb = createStyledWorkbook();
      const rows = (data || []).map((l: any) => [
        formatDate(l.data),
        l.funcionarios_diaristas?.nome || 'N/A',
        l.horas_trabalhadas || 0,
        formatCurrency(l.valor_diaria || 0),
        formatCurrency(l.valor_total || 0),
        l.observacao || ''
      ]);

      addStyledSheet(wb, rows, 'Diaristas', [
        'Data', 'Nome', 'Horas Trabalhadas', 'Valor Diária', 'Valor Total', 'Observação'
      ]);

      const totalPago = (data || []).reduce((sum: number, l: any) => sum + (l.valor_total || 0), 0);
      rows.push(['', '', '', 'TOTAL:', formatCurrency(totalPago), '']);

      XLSX.writeFile(wb, `Relatorio_Diaristas_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

      toast({ title: 'Sucesso', description: 'Relatório de Diaristas exportado com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: 'Erro', description: 'Não foi possível exportar o relatório', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportRelatorioEntradasSaidas = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('cash_ledger')
        .select('*')
        .is('deleted_at', null)
        .order('data', { ascending: false });

      if (dataInicio) query = query.gte('data', dataInicio);
      if (dataFim) query = query.lte('data', dataFim);

      const { data, error } = await query;
      if (error) throw error;

      const wb = createStyledWorkbook();

      const bancoData = (data || []).filter((t: any) => t.forma === 'banco');
      const rowsBanco = bancoData.map((t: any) => [
        formatDate(t.data),
        t.tipo === 'entrada' ? 'Entrada' : 'Saída',
        t.categoria || '',
        t.descricao || '',
        formatCurrency(t.valor || 0)
      ]);

      const totalEntradasBanco = bancoData.filter((t: any) => t.tipo === 'entrada').reduce((s: number, t: any) => s + (t.valor || 0), 0);
      const totalSaidasBanco = bancoData.filter((t: any) => t.tipo === 'saida').reduce((s: number, t: any) => s + (t.valor || 0), 0);
      rowsBanco.push(['', '', '', 'TOTAL ENTRADAS:', formatCurrency(totalEntradasBanco)]);
      rowsBanco.push(['', '', '', 'TOTAL SAÍDAS:', formatCurrency(totalSaidasBanco)]);
      rowsBanco.push(['', '', '', 'SALDO:', formatCurrency(totalEntradasBanco - totalSaidasBanco)]);

      addStyledSheet(wb, rowsBanco, 'Banco', ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']);

      const dinheiroData = (data || []).filter((t: any) => t.forma === 'dinheiro');
      const rowsDinheiro = dinheiroData.map((t: any) => [
        formatDate(t.data),
        t.tipo === 'entrada' ? 'Entrada' : 'Saída',
        t.categoria || '',
        t.descricao || '',
        formatCurrency(t.valor || 0)
      ]);

      const totalEntradasDinheiro = dinheiroData.filter((t: any) => t.tipo === 'entrada').reduce((s: number, t: any) => s + (t.valor || 0), 0);
      const totalSaidasDinheiro = dinheiroData.filter((t: any) => t.tipo === 'saida').reduce((s: number, t: any) => s + (t.valor || 0), 0);
      rowsDinheiro.push(['', '', '', 'TOTAL ENTRADAS:', formatCurrency(totalEntradasDinheiro)]);
      rowsDinheiro.push(['', '', '', 'TOTAL SAÍDAS:', formatCurrency(totalSaidasDinheiro)]);
      rowsDinheiro.push(['', '', '', 'SALDO:', formatCurrency(totalEntradasDinheiro - totalSaidasDinheiro)]);

      addStyledSheet(wb, rowsDinheiro, 'Dinheiro', ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']);

      XLSX.writeFile(wb, `Relatorio_Entradas_Saidas_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

      toast({ title: 'Sucesso', description: 'Relatório de Entradas & Saídas exportado com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: 'Erro', description: 'Não foi possível exportar o relatório', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportRelatorioMaquinas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maquinas')
        .select('*')
        .is('deleted_at', null)
        .order('nome');

      if (error) throw error;

      const wb = createStyledWorkbook();
      const rows = (data || []).map((m: any) => [
        m.nome || '',
        m.categoria || '',
        formatCurrency(m.valor_aquisicao || 0),
        m.status || 'disponivel',
        m.observacao || ''
      ]);

      addStyledSheet(wb, rows, 'Máquinas', [
        'Nome', 'Categoria', 'Valor Aquisição', 'Status', 'Observação'
      ]);

      XLSX.writeFile(wb, `Relatorio_Maquinas_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

      toast({ title: 'Sucesso', description: 'Relatório de Máquinas exportado com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: 'Erro', description: 'Não foi possível exportar o relatório', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportRelatorioContratos = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('locacoes_contratos')
        .select('*, maquinas(nome), obras(nome_obra, cliente)')
        .is('deleted_at', null)
        .order('data_inicio', { ascending: false });

      if (dataInicio) query = query.gte('data_inicio', dataInicio);
      if (dataFim) query = query.lte('data_fim', dataFim);

      const { data, error } = await query;
      if (error) throw error;

      const wb = createStyledWorkbook();
      const rows = (data || []).map((c: any) => [
        c.numero_contrato || '',
        c.maquinas?.nome || 'N/A',
        c.obras?.nome_obra || 'N/A',
        c.obras?.cliente || 'N/A',
        formatDate(c.data_inicio),
        formatDate(c.data_fim),
        c.dias || 0,
        formatCurrency(c.valor_diaria || 0),
        formatCurrency(c.valor_total || 0),
        c.status || 'ativo'
      ]);

      addStyledSheet(wb, rows, 'Contratos', [
        'Número', 'Máquina', 'Obra', 'Cliente', 'Data Início', 'Data Fim',
        'Dias', 'Valor Diária', 'Valor Total', 'Status'
      ]);

      const totalContratos = (data || []).reduce((sum: number, c: any) => sum + (c.valor_total || 0), 0);
      rows.push(['', '', '', '', '', '', '', 'TOTAL:', formatCurrency(totalContratos), '']);

      XLSX.writeFile(wb, `Relatorio_Contratos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

      toast({ title: 'Sucesso', description: 'Relatório de Contratos exportado com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: 'Erro', description: 'Não foi possível exportar o relatório', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportRelatorioFinanceiroGeral = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('cash_ledger')
        .select('*')
        .is('deleted_at', null);

      if (dataInicio) query = query.gte('data', dataInicio);
      if (dataFim) query = query.lte('data', dataFim);

      const { data: ledgerData, error: ledgerError } = await query;
      if (ledgerError) throw ledgerError;

      const { data: custosFixos } = await supabase
        .from('custos_fixos')
        .select('*')
        .is('deleted_at', null);

      const wb = createStyledWorkbook();

      const entradas = (ledgerData || []).filter((t: any) => t.tipo === 'entrada');
      const saidas = (ledgerData || []).filter((t: any) => t.tipo === 'saida');

      const totalEntradas = entradas.reduce((sum: number, t: any) => sum + (t.valor || 0), 0);
      const totalSaidas = saidas.reduce((sum: number, t: any) => sum + (t.valor || 0), 0);
      const totalCustosFixos = (custosFixos || []).reduce((sum: number, c: any) => sum + (c.valor || 0), 0);
      const custoTotal = totalSaidas + totalCustosFixos;
      const lucroLiquido = totalEntradas - custoTotal;
      const margemOperacional = totalEntradas > 0 ? (lucroLiquido / totalEntradas) * 100 : 0;

      const resumoRows = [
        ['Indicador', 'Valor'],
        ['Faturamento Total (Entradas)', formatCurrency(totalEntradas)],
        ['Custos Variáveis (Saídas)', formatCurrency(totalSaidas)],
        ['Custos Fixos', formatCurrency(totalCustosFixos)],
        ['Custo Total', formatCurrency(custoTotal)],
        ['Lucro Líquido', formatCurrency(lucroLiquido)],
        ['Margem Operacional', `${margemOperacional.toFixed(2)}%`],
      ];

      const ws = XLSX.utils.aoa_to_sheet(resumoRows);
      ws['!cols'] = [{ wch: 35 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Resumo Financeiro');

      XLSX.writeFile(wb, `Relatorio_Financeiro_Geral_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

      toast({ title: 'Sucesso', description: 'Relatório Financeiro Geral exportado com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: 'Erro', description: 'Não foi possível exportar o relatório', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl text-[#FFD86F] mb-2" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            Relatórios
          </h1>
          <p className="text-muted" style={{ fontFamily: 'Inter, sans-serif' }}>
            Exportação de relatórios profissionais em Excel
          </p>
        </div>

        <Card className="card p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gold mb-4">📆 Filtro de Período</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dataInicio" className="text-sm font-medium mb-2 block">
                  Data Inicial
                </Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="input-dark"
                />
              </div>
              <div>
                <Label htmlFor="dataFim" className="text-sm font-medium mb-2 block">
                  Data Final
                </Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="input-dark"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gold mb-4">📂 Relatórios Disponíveis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button
                onClick={exportRelatorioMensalistas}
                disabled={loading}
                className="btn-primary h-auto py-6 flex flex-col gap-3"
              >
                <Users className="w-8 h-8" />
                <span className="text-base font-semibold">📘 Relatório Mensalistas</span>
              </Button>

              <Button
                onClick={exportRelatorioDiaristas}
                disabled={loading}
                className="btn-primary h-auto py-6 flex flex-col gap-3"
              >
                <Calendar className="w-8 h-8" />
                <span className="text-base font-semibold">🧾 Relatório Diaristas</span>
              </Button>

              <Button
                onClick={exportRelatorioEntradasSaidas}
                disabled={loading}
                className="btn-primary h-auto py-6 flex flex-col gap-3"
              >
                <TrendingUp className="w-8 h-8" />
                <span className="text-base font-semibold">💸 Relatório Entradas & Saídas</span>
                <span className="text-xs opacity-80">(Banco + Dinheiro separados)</span>
              </Button>

              <Button
                onClick={exportRelatorioMaquinas}
                disabled={loading}
                className="btn-primary h-auto py-6 flex flex-col gap-3"
              >
                <Wrench className="w-8 h-8" />
                <span className="text-base font-semibold">⚙️ Relatório Máquinas</span>
              </Button>

              <Button
                onClick={exportRelatorioContratos}
                disabled={loading}
                className="btn-primary h-auto py-6 flex flex-col gap-3"
              >
                <Building2 className="w-8 h-8" />
                <span className="text-base font-semibold">🏗️ Relatório Contratos</span>
              </Button>

              <Button
                onClick={exportRelatorioFinanceiroGeral}
                disabled={loading}
                className="btn-primary h-auto py-6 flex flex-col gap-3"
              >
                <DollarSign className="w-8 h-8" />
                <span className="text-base font-semibold">📊 Relatório Financeiro Geral</span>
                <span className="text-xs opacity-80">(KPIs e Indicadores)</span>
              </Button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-panel/30 rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted">
                <p className="mb-2">
                  <strong className="text-gold">Formato Profissional:</strong> Todos os relatórios são exportados em Excel com:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Cabeçalho dourado e formatação automática</li>
                  <li>Colunas ajustadas e bordas delimitadas</li>
                  <li>Totais e subtotais calculados</li>
                  <li>Datas e valores no formato BR (dd/mm/aaaa e R$)</li>
                  <li>Pronto para leitura imediata</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
