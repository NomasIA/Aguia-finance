import { addMonths, isWeekend, addDays, lastDayOfMonth, setDate, getDate, format } from 'date-fns';

export interface InstallmentConfig {
  valorTotal: number;
  numeroParcelas: number;
  vencimentoInicial: Date;
  periodicidade?: 'mensal' | 'quinzenal' | 'semanal';
  diaFixo?: number;
  ajustarFimDeSemana?: boolean;
  fimDoMes?: boolean;
}

export interface Installment {
  numero: number;
  valor: number;
  vencimento: Date;
}

export function generateInstallments(config: InstallmentConfig): Installment[] {
  const {
    valorTotal,
    numeroParcelas,
    vencimentoInicial,
    periodicidade = 'mensal',
    diaFixo,
    ajustarFimDeSemana = false,
    fimDoMes = false,
  } = config;

  const installments: Installment[] = [];
  const valorParcela = Math.floor((valorTotal / numeroParcelas) * 100) / 100;
  let somaAtual = 0;

  const diaVencimento = diaFixo || getDate(vencimentoInicial);

  for (let i = 0; i < numeroParcelas; i++) {
    let valor: number;

    if (i === numeroParcelas - 1) {
      valor = Math.round((valorTotal - somaAtual) * 100) / 100;
    } else {
      valor = valorParcela;
      somaAtual += valor;
    }

    let dataVencimento: Date;

    if (periodicidade === 'mensal') {
      if (i === 0) {
        dataVencimento = vencimentoInicial;
      } else {
        const mesBase = addMonths(vencimentoInicial, i);

        if (fimDoMes) {
          dataVencimento = lastDayOfMonth(mesBase);
        } else {
          const ultimoDiaMes = getDate(lastDayOfMonth(mesBase));

          if (diaVencimento > ultimoDiaMes) {
            dataVencimento = lastDayOfMonth(mesBase);
          } else {
            dataVencimento = setDate(mesBase, diaVencimento);
          }
        }
      }
    } else if (periodicidade === 'quinzenal') {
      dataVencimento = addDays(vencimentoInicial, i * 15);
    } else {
      dataVencimento = addDays(vencimentoInicial, i * 7);
    }

    if (ajustarFimDeSemana && isWeekend(dataVencimento)) {
      while (isWeekend(dataVencimento)) {
        dataVencimento = addDays(dataVencimento, 1);
      }
    }

    installments.push({
      numero: i + 1,
      valor,
      vencimento: dataVencimento,
    });
  }

  return installments;
}

export function formatInstallmentLabel(numero: number, total: number): string {
  return `Parcela ${numero}/${total}`;
}

export function calculateInstallmentStatus(
  vencimento: Date,
  recebido: boolean
): 'recebido' | 'pendente' | 'vencido' {
  if (recebido) return 'recebido';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataVencimento = new Date(vencimento);
  dataVencimento.setHours(0, 0, 0, 0);

  if (dataVencimento < hoje) return 'vencido';

  return 'pendente';
}

export function getStatusColor(status: 'recebido' | 'pendente' | 'vencido'): string {
  switch (status) {
    case 'recebido':
      return 'bg-success/10 text-success border-success/20';
    case 'vencido':
      return 'bg-danger/10 text-danger border-danger/20';
    case 'pendente':
      return 'bg-warning/10 text-warning border-warning/20';
  }
}

export function getStatusLabel(status: 'recebido' | 'pendente' | 'vencido'): string {
  switch (status) {
    case 'recebido':
      return 'Recebido';
    case 'vencido':
      return 'Vencido';
    case 'pendente':
      return 'Pendente';
  }
}
