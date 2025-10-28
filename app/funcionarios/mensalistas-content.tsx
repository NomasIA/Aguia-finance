'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Banknote, Bus, Check, AlertCircle, Undo2, Plus, Edit, Trash2, Gift } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { format, startOfMonth, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createLedgerEntry, recalcAll, deleteLedgerEntry } from '@/lib/ledger-sync';
import { revalidateAfterFolha, revalidateAll } from '@/lib/revalidation-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { getPaymentDate, formatPaymentDateInfo } from '@/lib/business-days';
import { DecimoTerceiroModal } from './decimo-terceiro-modal';

interface Mensalista {
  id: string;
  nome: string;
  funcao: string;
  salario_base: number;
  ajuda_custo: number;
  vale_salario: number;
  recebe_vt: boolean;
  vt_valor_unitario_dia: number;
  vt_dias_uteis_override: number;
  ativo: boolean;
}

interface PayrollRun {
  id: string;
  tipo: 'SALARIO_5' | 'VALE_20' | 'VT_ULTIMO_DIA';
  total_funcionarios: number;
  total_pago: number;
  status: 'processado' | 'desfeito';
  created_at: string;
  ledger_id: string;
}

type TipoPagamento = 'SALARIO_5' | 'VALE_20' | 'VT_ULTIMO_DIA';

interface ModalData {
  tipo: TipoPagamento;
  totalFuncionarios: number;
  totalPagar: number;
  detalhes: Array<{ nome: string; valor: number }>;
  dataPagamento?: Date;
  dataOriginal?: Date;
}

export default function MensalistasContent() {
  const [mensalistas, setMensalistas] = useState<Mensalista[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [cadastroDialogOpen, setCadastroDialogOpen] = useState(false);
  const [editingMensalista, setEditingMensalista] = useState<Mensalista | null>(null);
  const [decimoModalOpen, setDecimoModalOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    funcao: '',
    salario_base: '',
    ajuda_custo: '0',
    vale_salario: '0',
    recebe_vt: false,
    vt_valor_unitario_dia: '0',
    vt_dias_uteis_override: '22'
  });

  const [competencia, setCompetencia] = useState(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });

  const competenciaAno = parseInt(competencia.split('-')[0]);
  const competenciaMes = parseInt(competencia.split('-')[1]);
  const isDezembro = competenciaMes === 12;

  useEffect(() => {
    loadData();
  }, [competencia]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: mensalistasData, error: mensalistasError } = await supabase
        .from('funcionarios_mensalistas')
        .select('*')
        .is('deleted_at', null)
        .eq('ativo', true)
        .order('nome');

      if (mensalistasError) throw mensalistasError;

      const competenciaDate = startOfMonth(new Date(competencia + '-01'));
      const { data: runsData, error: runsError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('competencia', format(competenciaDate, 'yyyy-MM-dd'))
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (runsError) throw runsError;

      setMensalistas(mensalistasData || []);
      setPayrollRuns(runsData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularVTMensal = (mensalista: Mensalista) => {
    if (!mensalista.recebe_vt) return 0;
    const diasUteis = mensalista.vt_dias_uteis_override || 22;
    return mensalista.vt_valor_unitario_dia * diasUteis;
  };

  const calcularCustoTotal = (mensalista: Mensalista) => {
    const salario = parseFloat(mensalista.salario_base?.toString() || '0');
    const ajuda = parseFloat(mensalista.ajuda_custo?.toString() || '0');
    const vale = parseFloat(mensalista.vale_salario?.toString() || '0');
    const vt = calcularVTMensal(mensalista);
    return salario + ajuda + vale + vt;
  };

  const getDataPagamento = async (tipo: TipoPagamento): Promise<Date> => {
    const [ano, mes] = competencia.split('-');

    let day = 5;
    if (tipo === 'VALE_20') {
      day = 20;
    }

    const adjustedDate = await getPaymentDate(
      parseInt(ano),
      parseInt(mes),
      day,
      tipo
    );

    return adjustedDate;
  };

  const getTipoLabel = (tipo: TipoPagamento) => {
    switch (tipo) {
      case 'SALARIO_5': return 'Salário (dia 5)';
      case 'VALE_20': return 'Vale-Salário (dia 20)';
      case 'VT_ULTIMO_DIA': return 'Vale-Transporte (último dia útil)';
    }
  };

  const calcularTotaisPorTipo = (tipo: TipoPagamento) => {
    const detalhes: Array<{ nome: string; valor: number }> = [];
    let total = 0;
    let count = 0;

    mensalistas.forEach((m) => {
      let valor = 0;

      if (tipo === 'SALARIO_5') {
        valor = parseFloat(m.salario_base?.toString() || '0') +
                parseFloat(m.ajuda_custo?.toString() || '0');
      } else if (tipo === 'VALE_20') {
        valor = parseFloat(m.vale_salario?.toString() || '0');
      } else if (tipo === 'VT_ULTIMO_DIA') {
        if (m.recebe_vt) {
          valor = calcularVTMensal(m);
        }
      }

      if (valor > 0) {
        detalhes.push({ nome: m.nome, valor });
        total += valor;
        count++;
      }
    });

    return { detalhes, total, count };
  };

  const abrirModalConfirmacao = async (tipo: TipoPagamento) => {
    const jaProcessado = payrollRuns.find(r => r.tipo === tipo && r.status === 'processado');

    if (jaProcessado) {
      toast({
        title: 'Aviso',
        description: 'Este pagamento já foi processado para esta competência',
        variant: 'destructive'
      });
      return;
    }

    const { detalhes, total, count } = calcularTotaisPorTipo(tipo);

    if (count === 0) {
      toast({
        title: 'Aviso',
        description: 'Nenhum funcionário elegível para este tipo de pagamento',
        variant: 'destructive'
      });
      return;
    }

    const [ano, mes] = competencia.split('-');
    const diaOriginal = tipo === 'SALARIO_5' ? 5 : tipo === 'VALE_20' ? 20 : new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const dataOriginal = new Date(parseInt(ano), parseInt(mes) - 1, diaOriginal);
    const dataPagamento = await getDataPagamento(tipo);

    setModalData({
      tipo,
      totalFuncionarios: count,
      totalPagar: total,
      detalhes,
      dataPagamento,
      dataOriginal
    });
    setModalOpen(true);
  };

  const processarPagamento = async () => {
    if (!modalData) return;

    setProcessing(true);

    try {
      const competenciaDate = startOfMonth(new Date(competencia + '-01'));
      const dataPagamento = await getDataPagamento(modalData.tipo);

      const descricao = `Folha Mensalistas • ${getTipoLabel(modalData.tipo)} • ${competencia}`;
      const categoria = modalData.tipo === 'SALARIO_5' ? 'salario' :
                       modalData.tipo === 'VALE_20' ? 'vale_salario' : 'vt';

      const ledger = await createLedgerEntry({
        data: format(dataPagamento, 'yyyy-MM-dd'),
        tipo: 'saida',
        forma: 'banco',
        categoria,
        descricao,
        valor: modalData.totalPagar,
        origem: 'folha_mensalista',
        origem_id: null
      });

      const { error: runError } = await supabase
        .from('payroll_runs')
        .insert([{
          competencia: format(competenciaDate, 'yyyy-MM-dd'),
          tipo: modalData.tipo,
          total_funcionarios: modalData.totalFuncionarios,
          total_pago: modalData.totalPagar,
          conta_banco: 'Itaú',
          status: 'processado',
          ledger_id: ledger.id,
          detalhes: modalData.detalhes
        }]);

      if (runError) throw runError;

      await recalcAll();
      revalidateAfterFolha();
      revalidateAll();

      toast({
        title: 'Sucesso',
        description: `Pagamentos processados via Banco Itaú. Total: ${formatCurrency(modalData.totalPagar)}`
      });

      setModalOpen(false);
      setModalData(null);
      loadData();
    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível processar o pagamento',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const desfazerPagamento = async () => {
    if (!selectedRun) return;

    setProcessing(true);

    try {
      await deleteLedgerEntry(selectedRun.ledger_id);

      const { error } = await supabase
        .from('payroll_runs')
        .update({
          status: 'desfeito',
          deleted_at: new Date().toISOString()
        })
        .eq('id', selectedRun.id);

      if (error) throw error;

      await recalcAll();
      revalidateAfterFolha();
      revalidateAll();

      toast({
        title: 'Sucesso',
        description: 'Pagamento desfeito e saldos recalculados'
      });

      setUndoDialogOpen(false);
      setSelectedRun(null);
      loadData();
    } catch (error: any) {
      console.error('Erro ao desfazer pagamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível desfazer o pagamento',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const isProcessado = (tipo: TipoPagamento) => {
    return payrollRuns.some(r => r.tipo === tipo && r.status === 'processado');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const abrirCadastro = () => {
    setFormData({
      nome: '',
      funcao: '',
      salario_base: '',
      ajuda_custo: '0',
      vale_salario: '0',
      recebe_vt: false,
      vt_valor_unitario_dia: '0',
      vt_dias_uteis_override: '22'
    });
    setEditingMensalista(null);
    setCadastroDialogOpen(true);
  };

  const abrirEdicao = (mensalista: Mensalista) => {
    setFormData({
      nome: mensalista.nome,
      funcao: mensalista.funcao,
      salario_base: mensalista.salario_base.toString(),
      ajuda_custo: mensalista.ajuda_custo.toString(),
      vale_salario: mensalista.vale_salario.toString(),
      recebe_vt: mensalista.recebe_vt,
      vt_valor_unitario_dia: mensalista.vt_valor_unitario_dia.toString(),
      vt_dias_uteis_override: mensalista.vt_dias_uteis_override.toString()
    });
    setEditingMensalista(mensalista);
    setCadastroDialogOpen(true);
  };

  const salvarMensalista = async () => {
    if (!formData.nome || !formData.funcao || !formData.salario_base) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios (Nome, Função e Salário)',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);

    try {
      const dados = {
        nome: formData.nome,
        funcao: formData.funcao,
        salario_base: parseFloat(formData.salario_base),
        ajuda_custo: parseFloat(formData.ajuda_custo || '0'),
        vale_salario: parseFloat(formData.vale_salario || '0'),
        recebe_vt: formData.recebe_vt,
        vt_valor_unitario_dia: parseFloat(formData.vt_valor_unitario_dia || '0'),
        vt_dias_uteis_override: parseInt(formData.vt_dias_uteis_override || '22'),
        tipo_vinculo: 'CLT',
        ativo: true,
        aplica_encargos: false,
        usa_adiantamento: formData.vale_salario !== '0'
      };

      if (editingMensalista) {
        const { error } = await supabase
          .from('funcionarios_mensalistas')
          .update(dados)
          .eq('id', editingMensalista.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Mensalista atualizado com sucesso'
        });
      } else {
        const { error } = await supabase
          .from('funcionarios_mensalistas')
          .insert([dados]);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Mensalista cadastrado com sucesso'
        });
      }

      setCadastroDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar mensalista:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar o mensalista',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const excluirMensalista = async (mensalista: Mensalista) => {
    if (!confirm(`Deseja realmente excluir ${mensalista.nome}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('funcionarios_mensalistas')
        .update({ deleted_at: new Date().toISOString(), ativo: false })
        .eq('id', mensalista.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Mensalista excluído com sucesso'
      });

      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir mensalista:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível excluir o mensalista',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gold text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gold">Folha de Pagamento - Mensalistas</h2>
          <div className="flex items-center gap-4">
            {isDezembro && (
              <Button
                onClick={() => setDecimoModalOpen(true)}
                className="bg-gradient-to-r from-gold to-yellow-600 hover:from-gold/90 hover:to-yellow-600/90 text-black font-semibold"
              >
                <Gift className="w-4 h-4 mr-2" />
                13º Salário
              </Button>
            )}
            <Button
              onClick={abrirCadastro}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Funcionário
            </Button>
            <label className="text-sm text-muted">Competência:</label>
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="input-dark px-3 py-2 rounded-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Button
            size="lg"
            className={isProcessado('SALARIO_5') ? 'btn-success' : 'btn-primary'}
            onClick={() => abrirModalConfirmacao('SALARIO_5')}
            disabled={isProcessado('SALARIO_5')}
          >
            {isProcessado('SALARIO_5') ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Salário Pago ✅
              </>
            ) : (
              <>
                <DollarSign className="w-5 h-5 mr-2" />
                💸 Pagar Salário (dia 5)
              </>
            )}
          </Button>

          <Button
            size="lg"
            className={isProcessado('VALE_20') ? 'btn-success' : 'btn-primary'}
            onClick={() => abrirModalConfirmacao('VALE_20')}
            disabled={isProcessado('VALE_20')}
          >
            {isProcessado('VALE_20') ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Vale Pago ✅
              </>
            ) : (
              <>
                <Banknote className="w-5 h-5 mr-2" />
                💵 Pagar Vale-Salário (dia 20)
              </>
            )}
          </Button>

          <Button
            size="lg"
            className={isProcessado('VT_ULTIMO_DIA') ? 'btn-success' : 'btn-primary'}
            onClick={() => abrirModalConfirmacao('VT_ULTIMO_DIA')}
            disabled={isProcessado('VT_ULTIMO_DIA')}
          >
            {isProcessado('VT_ULTIMO_DIA') ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                VT Pago ✅
              </>
            ) : (
              <>
                <Bus className="w-5 h-5 mr-2" />
                🚎 Pagar VT (último dia útil)
              </>
            )}
          </Button>
        </div>

        {payrollRuns.filter(r => r.status === 'processado').length > 0 && (
          <Card className="bg-surface/50 p-4 mb-6 border border-gold/20">
            <h3 className="text-sm font-semibold text-gold mb-3">Pagamentos Processados</h3>
            <div className="space-y-2">
              {payrollRuns.filter(r => r.status === 'processado').map((run) => (
                <div key={run.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-muted">{getTipoLabel(run.tipo)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white">{run.total_funcionarios} funcionários</span>
                    <span className="font-semibold text-gold">{formatCurrency(parseFloat(run.total_pago.toString()))}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        setSelectedRun(run);
                        setUndoDialogOpen(true);
                      }}
                    >
                      <Undo2 className="w-3 h-3 mr-1" />
                      Desfazer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                <th className="text-left">Nome</th>
                <th className="text-left">Cargo</th>
                <th className="text-right">Salário</th>
                <th className="text-right">Ajuda Custo</th>
                <th className="text-right">Vale</th>
                <th className="text-right">VT Mensal</th>
                <th className="text-right">Total</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {mensalistas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-8">
                    Nenhum funcionário cadastrado
                  </td>
                </tr>
              ) : (
                mensalistas.map((mensalista) => {
                  const vtMensal = calcularVTMensal(mensalista);
                  const custoTotal = calcularCustoTotal(mensalista);

                  return (
                    <tr key={mensalista.id}>
                      <td className="font-medium">{mensalista.nome}</td>
                      <td className="text-muted">{mensalista.funcao}</td>
                      <td className="text-right">{formatCurrency(parseFloat(mensalista.salario_base?.toString() || '0'))}</td>
                      <td className="text-right">{formatCurrency(parseFloat(mensalista.ajuda_custo?.toString() || '0'))}</td>
                      <td className="text-right">{formatCurrency(parseFloat(mensalista.vale_salario?.toString() || '0'))}</td>
                      <td className="text-right">{formatCurrency(vtMensal)}</td>
                      <td className="text-right font-semibold text-gold">{formatCurrency(custoTotal)}</td>
                      <td>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirEdicao(mensalista)}
                            className="h-8"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => excluirMensalista(mensalista)}
                            className="h-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gold/30">
                <td colSpan={2} className="font-semibold text-gold">TOTAL</td>
                <td className="text-right font-semibold">
                  {formatCurrency(mensalistas.reduce((sum, m) => sum + parseFloat(m.salario_base?.toString() || '0'), 0))}
                </td>
                <td className="text-right font-semibold">
                  {formatCurrency(mensalistas.reduce((sum, m) => sum + parseFloat(m.ajuda_custo?.toString() || '0'), 0))}
                </td>
                <td className="text-right font-semibold">
                  {formatCurrency(mensalistas.reduce((sum, m) => sum + parseFloat(m.vale_salario?.toString() || '0'), 0))}
                </td>
                <td className="text-right font-semibold">
                  {formatCurrency(mensalistas.reduce((sum, m) => sum + calcularVTMensal(m), 0))}
                </td>
                <td className="text-right font-bold text-gold text-lg">
                  {formatCurrency(mensalistas.reduce((sum, m) => sum + calcularCustoTotal(m), 0))}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card className="card p-6 bg-surface/50">
        <div className="flex items-start gap-3 p-3 bg-gold/10 border border-gold/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-gold mt-0.5" />
          <div className="text-sm text-muted">
            <p className="font-semibold text-gold mb-2">Como funciona o processamento global:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Cada botão processa TODOS os funcionários elegíveis de uma vez</li>
              <li>Cria UM lançamento consolidado no Banco Itaú</li>
              <li>Atualiza automaticamente: Entradas & Saídas, Caixa & Banco, Conciliação, Relatórios e KPIs</li>
              <li>Permite desfazer o pagamento por competência (undo)</li>
              <li>Cada tipo só pode ser processado uma vez por mês</li>
            </ul>
          </div>
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-gold">Confirmar Processamento</DialogTitle>
            <DialogDescription>
              Revise os detalhes antes de processar o pagamento
            </DialogDescription>
          </DialogHeader>

          {modalData && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted">Competência</p>
                  <p className="font-medium text-white">{competencia}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Tipo</p>
                  <p className="font-medium text-white">{getTipoLabel(modalData.tipo)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Total de Funcionários</p>
                  <p className="font-medium text-white">{modalData.totalFuncionarios}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Conta Bancária</p>
                  <p className="font-medium text-white">Itaú</p>
                </div>
              </div>

              {modalData.dataPagamento && modalData.dataOriginal && (
                <div className="bg-gold/10 border border-gold/20 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gold mb-2">Data de Pagamento</p>
                  <div className="space-y-1 text-sm">
                    {modalData.dataPagamento.getTime() === modalData.dataOriginal.getTime() ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-white font-medium">
                          {format(modalData.dataPagamento, 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          <span className="text-muted">
                            Data original: {format(modalData.dataOriginal, 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-white font-medium">
                            Data ajustada: {format(modalData.dataPagamento, 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-muted italic ml-6">
                          {getDay(modalData.dataOriginal) === 6 && 'Ajustado: Sábado → Sexta-feira anterior'}
                          {getDay(modalData.dataOriginal) === 0 && 'Ajustado: Domingo → Próximo dia útil'}
                          {getDay(modalData.dataOriginal) !== 0 && getDay(modalData.dataOriginal) !== 6 && 'Ajustado: Feriado → Dia útil anterior'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted mb-2">Detalhamento:</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {modalData.detalhes.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted">{d.nome}</span>
                      <span className="text-white">{formatCurrency(d.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gold">Total a Pagar:</span>
                  <span className="text-2xl font-bold text-gold">{formatCurrency(modalData.totalPagar)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={processarPagamento}
              disabled={processing}
              className="btn-primary"
            >
              {processing ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-gold">Desfazer Pagamento</DialogTitle>
            <DialogDescription>
              Esta ação irá reverter o pagamento e recalcular todos os saldos
            </DialogDescription>
          </DialogHeader>

          {selectedRun && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted">Tipo</p>
                  <p className="font-medium text-white">{getTipoLabel(selectedRun.tipo)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Valor</p>
                  <p className="font-medium text-white">{formatCurrency(parseFloat(selectedRun.total_pago.toString()))}</p>
                </div>
              </div>
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-sm text-muted">
                  <strong className="text-destructive">Atenção:</strong> O lançamento será marcado como excluído e os saldos serão recalculados.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUndoDialogOpen(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={desfazerPagamento}
              disabled={processing}
              className="bg-destructive hover:bg-destructive/80"
            >
              {processing ? 'Desfazendo...' : 'Confirmar Desfazer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cadastroDialogOpen} onOpenChange={setCadastroDialogOpen}>
        <DialogContent className="bg-background border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gold">
              {editingMensalista ? 'Editar Funcionário' : 'Novo Funcionário'}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do funcionário mensalista
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-gold">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                  className="input-dark"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="funcao" className="text-gold">Cargo/Função *</Label>
                <Input
                  id="funcao"
                  value={formData.funcao}
                  onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                  placeholder="Ex: Engenheiro, Operacional"
                  className="input-dark"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salario_base" className="text-gold">Salário Base *</Label>
                <Input
                  id="salario_base"
                  type="number"
                  step="0.01"
                  value={formData.salario_base}
                  onChange={(e) => setFormData({ ...formData, salario_base: e.target.value })}
                  placeholder="0.00"
                  className="input-dark"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ajuda_custo" className="text-gold">Ajuda de Custo</Label>
                <Input
                  id="ajuda_custo"
                  type="number"
                  step="0.01"
                  value={formData.ajuda_custo}
                  onChange={(e) => setFormData({ ...formData, ajuda_custo: e.target.value })}
                  placeholder="0.00"
                  className="input-dark"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vale_salario" className="text-gold">Vale-Salário</Label>
                <Input
                  id="vale_salario"
                  type="number"
                  step="0.01"
                  value={formData.vale_salario}
                  onChange={(e) => setFormData({ ...formData, vale_salario: e.target.value })}
                  placeholder="0.00"
                  className="input-dark"
                />
                <p className="text-xs text-muted">Adiantamento quinzenal (dia 20)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vt_dias_uteis" className="text-gold">Dias Úteis/Mês</Label>
                <Input
                  id="vt_dias_uteis"
                  type="number"
                  value={formData.vt_dias_uteis_override}
                  onChange={(e) => setFormData({ ...formData, vt_dias_uteis_override: e.target.value })}
                  placeholder="22"
                  className="input-dark"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <Label className="text-gold">Recebe Vale-Transporte</Label>
                  <p className="text-xs text-muted">Funcionário utiliza transporte público</p>
                </div>
                <Switch
                  checked={formData.recebe_vt}
                  onCheckedChange={(checked) => setFormData({ ...formData, recebe_vt: checked })}
                />
              </div>

              {formData.recebe_vt && (
                <div className="space-y-2 pl-4 border-l-2 border-gold/20">
                  <Label htmlFor="vt_valor_unitario" className="text-gold">Valor Unitário do VT</Label>
                  <Input
                    id="vt_valor_unitario"
                    type="number"
                    step="0.01"
                    value={formData.vt_valor_unitario_dia}
                    onChange={(e) => setFormData({ ...formData, vt_valor_unitario_dia: e.target.value })}
                    placeholder="0.00"
                    className="input-dark"
                  />
                  <p className="text-xs text-muted">
                    VT Mensal calculado: {formatCurrency(
                      parseFloat(formData.vt_valor_unitario_dia || '0') *
                      parseInt(formData.vt_dias_uteis_override || '22')
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gold/10 border border-gold/20 rounded-lg p-3">
              <p className="text-sm font-semibold text-gold mb-2">Resumo do Custo Mensal</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Salário Base:</span>
                  <span className="text-white">{formatCurrency(parseFloat(formData.salario_base || '0'))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Ajuda de Custo:</span>
                  <span className="text-white">{formatCurrency(parseFloat(formData.ajuda_custo || '0'))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Vale-Salário:</span>
                  <span className="text-white">{formatCurrency(parseFloat(formData.vale_salario || '0'))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">VT Mensal:</span>
                  <span className="text-white">
                    {formatCurrency(
                      formData.recebe_vt
                        ? parseFloat(formData.vt_valor_unitario_dia || '0') * parseInt(formData.vt_dias_uteis_override || '22')
                        : 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gold/20 pt-1 mt-1">
                  <span className="font-semibold text-gold">Total:</span>
                  <span className="font-bold text-gold">
                    {formatCurrency(
                      parseFloat(formData.salario_base || '0') +
                      parseFloat(formData.ajuda_custo || '0') +
                      parseFloat(formData.vale_salario || '0') +
                      (formData.recebe_vt
                        ? parseFloat(formData.vt_valor_unitario_dia || '0') * parseInt(formData.vt_dias_uteis_override || '22')
                        : 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCadastroDialogOpen(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarMensalista}
              disabled={processing}
              className="btn-primary"
            >
              {processing ? 'Salvando...' : editingMensalista ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DecimoTerceiroModal
        open={decimoModalOpen}
        onOpenChange={setDecimoModalOpen}
        mensalistas={mensalistas}
        competenciaAno={competenciaAno}
        onSuccess={loadData}
      />
    </div>
  );
}
