import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  format?: 'currency' | 'date' | 'text' | 'number';
}

export interface ExcelOptions {
  title?: string;
  period?: string;
  columns: ExcelColumn[];
  data: any[];
  filename: string;
  sheetName?: string;
  totals?: { [key: string]: number | string };
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (value: string | Date): string => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
};

export function generateFormattedExcel(options: ExcelOptions) {
  const {
    title,
    period,
    columns,
    data,
    filename,
    sheetName = 'Relatório',
    totals,
  } = options;

  const rows: any[][] = [];

  if (title) {
    rows.push([title]);
    rows.push([]);
  }

  if (period) {
    rows.push([`Período: ${period}`]);
    rows.push([]);
  }

  const headers = columns.map((col) => col.header);
  rows.push(headers);

  data.forEach((item) => {
    const row = columns.map((col) => {
      const value = item[col.key];

      if (value === null || value === undefined) return '';

      switch (col.format) {
        case 'currency':
          return typeof value === 'number' ? formatCurrency(value) : value;
        case 'date':
          return formatDate(value);
        case 'number':
          return typeof value === 'number' ? value : parseFloat(value) || 0;
        default:
          return value;
      }
    });
    rows.push(row);
  });

  if (totals) {
    rows.push([]);
    const totalRow = columns.map((col) => {
      if (totals[col.key] !== undefined) {
        const value = totals[col.key];
        if (col.format === 'currency' && typeof value === 'number') {
          return formatCurrency(value);
        }
        return value;
      }
      return '';
    });
    rows.push(totalRow);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  const columnWidths = columns.map((col) => ({
    wch: col.width || 15,
  }));
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, filename);
}

export function exportRelatorioGeral(ledger: any[], periodo: string) {
  const columns: ExcelColumn[] = [
    { header: 'Data', key: 'data', format: 'date', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Forma', key: 'forma', width: 10 },
    { header: 'Categoria', key: 'categoria', width: 20 },
    { header: 'Descrição', key: 'descricao', width: 40 },
    { header: 'Valor', key: 'valor', format: 'currency', width: 15 },
    { header: 'Conciliado', key: 'conciliado_text', width: 12 },
  ];

  const data = ledger.map((item) => ({
    ...item,
    conciliado_text: item.conciliado ? 'Sim' : 'Não',
  }));

  const totalEntradas = ledger
    .filter((i) => i.tipo === 'entrada')
    .reduce((sum, i) => sum + (i.valor || 0), 0);

  const totalSaidas = ledger
    .filter((i) => i.tipo === 'saida')
    .reduce((sum, i) => sum + (i.valor || 0), 0);

  const saldo = totalEntradas - totalSaidas;

  const totals = {
    descricao: 'TOTAIS',
    valor: saldo,
  };

  generateFormattedExcel({
    title: 'Relatório Geral - Dashboard Águia',
    period: periodo,
    columns,
    data,
    filename: `relatorio_geral_${new Date().getTime()}.xlsx`,
    sheetName: 'Relatório Geral',
    totals,
  });
}

export function exportMensalistas(mensalistas: any[], periodo: string) {
  const columns: ExcelColumn[] = [
    { header: 'Nome', key: 'nome', width: 25 },
    { header: 'Função', key: 'funcao', width: 20 },
    { header: 'Salário', key: 'salario', format: 'currency', width: 15 },
    { header: 'VT', key: 'vale_transporte', format: 'currency', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
  ];

  const totalSalarios = mensalistas.reduce((sum, m) => sum + (m.salario || 0), 0);
  const totalVT = mensalistas.reduce((sum, m) => sum + (m.vale_transporte || 0), 0);

  const totals = {
    nome: 'TOTAIS',
    salario: totalSalarios,
    vale_transporte: totalVT,
  };

  generateFormattedExcel({
    title: 'Relatório de Mensalistas',
    period: periodo,
    columns,
    data: mensalistas,
    filename: `mensalistas_${new Date().getTime()}.xlsx`,
    sheetName: 'Mensalistas',
    totals,
  });
}

export function exportDiaristas(lancamentos: any[], periodo: string) {
  const columns: ExcelColumn[] = [
    { header: 'Nome', key: 'diarista_nome', width: 25 },
    { header: 'Data', key: 'data', format: 'date', width: 12 },
    { header: 'Horas', key: 'horas_trabalhadas', format: 'number', width: 10 },
    { header: 'Valor/Hora', key: 'valor_hora', format: 'currency', width: 12 },
    { header: 'Total', key: 'total', format: 'currency', width: 15 },
    { header: 'Obra', key: 'obra', width: 20 },
  ];

  const totalGeral = lancamentos.reduce((sum, l) => sum + (l.total || 0), 0);

  const totals = {
    obra: 'TOTAL GERAL',
    total: totalGeral,
  };

  generateFormattedExcel({
    title: 'Relatório de Diaristas',
    period: periodo,
    columns,
    data: lancamentos,
    filename: `diaristas_${new Date().getTime()}.xlsx`,
    sheetName: 'Diaristas',
    totals,
  });
}

export function exportMaquinas(maquinas: any[], periodo: string) {
  const columns: ExcelColumn[] = [
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Categoria', key: 'categoria', width: 20 },
    { header: 'Quantidade', key: 'quantidade', format: 'number', width: 12 },
    { header: 'Disponível', key: 'quantidade_disponivel', format: 'number', width: 12 },
    { header: 'Valor Unit.', key: 'valor_unitario', format: 'currency', width: 15 },
    { header: 'Valor Total', key: 'valor_total', format: 'currency', width: 15 },
    { header: 'Diária', key: 'valor_diaria', format: 'currency', width: 12 },
    { header: 'Status', key: 'status', width: 15 },
  ];

  const totalInvestido = maquinas.reduce((sum, m) => sum + (m.valor_total || 0), 0);

  const totals = {
    item: 'TOTAL INVESTIDO',
    valor_total: totalInvestido,
  };

  generateFormattedExcel({
    title: 'Relatório de Maquinário',
    period: periodo,
    columns,
    data: maquinas,
    filename: `maquinas_${new Date().getTime()}.xlsx`,
    sheetName: 'Maquinário',
    totals,
  });
}

export function exportContratos(contratos: any[], periodo: string) {
  const columns: ExcelColumn[] = [
    { header: 'Máquina', key: 'maquina_item', width: 30 },
    { header: 'Cliente', key: 'cliente', width: 25 },
    { header: 'Obra', key: 'obra', width: 20 },
    { header: 'Data Início', key: 'data_inicio', format: 'date', width: 12 },
    { header: 'Data Fim', key: 'data_fim', format: 'date', width: 12 },
    { header: 'Diárias', key: 'dias_locacao', format: 'number', width: 10 },
    { header: 'Valor Total', key: 'valor_total', format: 'currency', width: 15 },
    { header: 'Recebido', key: 'recebido_text', width: 10 },
  ];

  const data = contratos.map((c) => ({
    ...c,
    recebido_text: c.recebido ? 'Sim' : 'Não',
  }));

  const totalRecebido = contratos
    .filter((c) => c.recebido)
    .reduce((sum, c) => sum + (c.valor_total || 0), 0);

  const totalPendente = contratos
    .filter((c) => !c.recebido)
    .reduce((sum, c) => sum + (c.valor_total || 0), 0);

  const totals = {
    obra: 'TOTAIS',
    valor_total: totalRecebido + totalPendente,
  };

  generateFormattedExcel({
    title: 'Relatório de Contratos de Locação',
    period: periodo,
    columns,
    data,
    filename: `contratos_${new Date().getTime()}.xlsx`,
    sheetName: 'Contratos',
    totals,
  });
}

export function exportObras(receitas: any[], periodo: string) {
  const columns: ExcelColumn[] = [
    { header: 'Obra', key: 'obra_nome', width: 30 },
    { header: 'Cliente', key: 'cliente', width: 25 },
    { header: 'Descrição', key: 'descricao', width: 30 },
    { header: 'Vencimento', key: 'vencimento', format: 'date', width: 12 },
    { header: 'Valor Total', key: 'valor_total', format: 'currency', width: 15 },
    { header: 'Recebido', key: 'recebido_text', width: 10 },
  ];

  const data = receitas.map((r) => ({
    ...r,
    recebido_text: r.recebido ? 'Sim' : 'Não',
  }));

  const totalGeral = receitas.reduce((sum, r) => sum + (r.valor_total || 0), 0);

  const totals = {
    descricao: 'TOTAL GERAL',
    valor_total: totalGeral,
  };

  generateFormattedExcel({
    title: 'Relatório de Obras e Receitas',
    period: periodo,
    columns,
    data,
    filename: `obras_${new Date().getTime()}.xlsx`,
    sheetName: 'Obras',
    totals,
  });
}

export function exportEntradasSaidas(
  movimentacoes: any[],
  tipo: 'entradas' | 'saidas',
  forma: 'banco' | 'dinheiro',
  periodo: string
) {
  const columns: ExcelColumn[] = [
    { header: 'Data', key: 'data', format: 'date', width: 12 },
    { header: 'Categoria', key: 'categoria', width: 20 },
    { header: 'Descrição', key: 'descricao', width: 40 },
    { header: 'Valor', key: 'valor', format: 'currency', width: 15 },
    { header: 'Conciliado', key: 'conciliado_text', width: 12 },
  ];

  const data = movimentacoes.map((m) => ({
    ...m,
    conciliado_text: m.conciliado ? 'Sim' : 'Não',
  }));

  const total = movimentacoes.reduce((sum, m) => sum + (m.valor || 0), 0);

  const totals = {
    descricao: 'TOTAL',
    valor: total,
  };

  const tituloTipo = tipo === 'entradas' ? 'Entradas' : 'Saídas';
  const tituloForma = forma === 'banco' ? 'Banco' : 'Dinheiro';

  generateFormattedExcel({
    title: `${tituloTipo} - ${tituloForma}`,
    period: periodo,
    columns,
    data,
    filename: `${tipo}_${forma}_${new Date().getTime()}.xlsx`,
    sheetName: `${tituloTipo} ${tituloForma}`,
    totals,
  });
}
