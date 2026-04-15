import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useFinanceSummary, useUpdateOpeningBalance, usePayInstallment, usePayExpenseLog, useOverdueInstallments } from './hooks';
import { formatCurrency } from '@/lib/format';
import { CashFlowChart } from './CashFlowChart';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--color-warning, #f59e0b)',
  PAID: 'var(--color-success, #16a34a)',
  OVERDUE: 'var(--color-danger, #dc2626)',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
};

export function FinanceDashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(null);
  const [payingExpenseLogId, setPayingExpenseLogId] = useState<string | null>(null);

  const { data, isLoading, error } = useFinanceSummary(month, year);
  const updateBalanceMutation = useUpdateOpeningBalance();
  const payInstallmentMutation = usePayInstallment();
  const payExpenseLogMutation = usePayExpenseLog();
  const { data: overdueData } = useOverdueInstallments();

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  async function handleSaveBalance() {
    // balanceInput is in BRL (e.g. "5000.00"); server stores cents so multiply by 100
    const value = Math.round(parseFloat(balanceInput) * 100);
    if (isNaN(value) || value < 0) return;
    try {
      await updateBalanceMutation.mutateAsync(value);
      setEditingBalance(false);
    } catch {
      // mutation error is surfaced via updateBalanceMutation.error if needed
    }
  }

  async function handlePayInstallment(id: string) {
    setPayingInstallmentId(id);
    try {
      await payInstallmentMutation.mutateAsync(id);
    } finally {
      setPayingInstallmentId(null);
    }
  }

  async function handlePayExpenseLog(id: string) {
    setPayingExpenseLogId(id);
    try {
      await payExpenseLogMutation.mutateAsync(id);
    } finally {
      setPayingExpenseLogId(null);
    }
  }

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>;
  if (error || !data) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar dados financeiros.</p>;

  const cardBase: CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 8,
    padding: 'var(--space-3)',
  };

  const btnStyle: CSSProperties = {
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    padding: '4px 10px',
    fontSize: '0.8rem',
    fontWeight: 600,
  };

  const netProfit = data.projected.incoming - data.projected.outgoing;

  return (
    <div>
      {/* Header + Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Financeiro</h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-neutral-300)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={prevMonth}
            style={{
              background: 'transparent',
              border: 'none',
              borderRight: '1px solid var(--color-neutral-300)',
              cursor: 'pointer',
              padding: '10px 18px',
              fontSize: '1rem',
              color: 'var(--color-primary)',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ‹
          </button>
          <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: 160, textAlign: 'center', padding: '10px 8px', color: 'var(--color-neutral-900)' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            style={{
              background: 'transparent',
              border: 'none',
              borderLeft: '1px solid var(--color-neutral-300)',
              cursor: 'pointer',
              padding: '10px 18px',
              fontSize: '1rem',
              color: 'var(--color-primary)',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Overdue installments */}
      {overdueData && overdueData.length > 0 && (
        <div
          style={{
            background: 'var(--color-danger-bg, #fef2f2)',
            border: '1px solid var(--color-danger, #dc2626)',
            borderRadius: 8,
            padding: 'var(--space-2) var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
            ⚠ Inadimplência — {overdueData.length} parcela{overdueData.length > 1 ? 's' : ''} vencida{overdueData.length > 1 ? 's' : ''}
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(220,38,38,0.08)', textAlign: 'left' }}>
                {['Cliente', 'Vencimento', 'Dias em atraso', 'Valor', 'Ação'].map((h) => (
                  <th key={h} style={{ padding: '6px 10px', color: 'var(--color-danger)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overdueData.map((inst, i) => (
                <tr
                  key={inst.id}
                  style={{
                    borderTop: '1px solid rgba(220,38,38,0.15)',
                    background: i % 2 === 1 ? 'rgba(220,38,38,0.04)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '6px 10px' }}>{inst.clientName}</td>
                  <td style={{ padding: '6px 10px' }}>{new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--color-danger)', fontWeight: 600 }}>
                    {inst.daysOverdue} dia{inst.daysOverdue !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '6px 10px', fontWeight: 600 }}>{formatCurrency(inst.amount)}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <button
                      onClick={() => void handlePayInstallment(inst.id)}
                      disabled={payingInstallmentId === inst.id}
                      style={{
                        ...btnStyle,
                        background: 'var(--color-danger)',
                        color: '#fff',
                        opacity: payingInstallmentId === inst.id ? 0.6 : 1,
                      }}
                    >
                      {payingInstallmentId === inst.id ? 'Salvando...' : 'Marcar como pago'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Balance card */}
      <div
        style={{
          ...cardBase,
          marginBottom: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginBottom: 4 }}>Saldo em Caixa</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatCurrency(data.balance)}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>
            Saldo inicial: {formatCurrency(data.openingBalance)}
          </p>
        </div>
        {editingBalance ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              onFocus={(e) => e.target.select()}
              style={{
                padding: '6px 8px',
                border: '1px solid var(--color-neutral-300)',
                borderRadius: 4,
                width: 140,
              }}
              placeholder="Ex: 5000.00"
            />
            <button
              onClick={() => void handleSaveBalance()}
              disabled={updateBalanceMutation.isPending}
              style={{ ...btnStyle, background: 'var(--color-primary)', color: '#fff' }}
            >
              {updateBalanceMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => setEditingBalance(false)}
              style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setBalanceInput((data.openingBalance / 100).toFixed(2));
              setEditingBalance(true);
            }}
            style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}
          >
            Editar saldo inicial
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={cardBase}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginBottom: 4 }}>Previsto Entrar</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success, #16a34a)' }}>
            {formatCurrency(data.projected.incoming)}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>Parcelas pendentes no mês</p>
        </div>
        <div style={cardBase}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginBottom: 4 }}>Previsto Sair</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>
            {formatCurrency(data.projected.outgoing)}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>Despesas fixas pendentes</p>
        </div>
        <div style={cardBase}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginBottom: 4 }}>Lucro Líquido</p>
          <p
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: netProfit >= 0 ? 'var(--color-success, #16a34a)' : 'var(--color-danger)',
            }}
          >
            {formatCurrency(netProfit)}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>Previsto entrar − previsto sair</p>
        </div>
      </div>

      <CashFlowChart />

      {/* Installments table */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Parcelas do Mês</h2>
      {data.installments.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-600)', marginBottom: 'var(--space-4)' }}>Nenhuma parcela neste mês.</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-neutral-300)', borderRadius: 8, overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-bg)', textAlign: 'left' }}>
              {['Cliente', 'Vencimento', 'Valor', 'Status', 'Ação'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.installments.map((inst, i) => (
              <tr key={inst.id} style={{ borderTop: '1px solid var(--color-neutral-300)', background: i % 2 === 1 ? 'var(--color-neutral-100)' : 'transparent' }}>
                <td style={{ padding: '8px 12px' }}>{inst.clientName}</td>
                <td style={{ padding: '8px 12px' }}>{inst.dueDate}</td>
                <td style={{ padding: '8px 12px' }}>{formatCurrency(inst.amount)}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ color: STATUS_COLOR[inst.status], fontWeight: 600, fontSize: '0.85rem' }}>
                    {STATUS_LABEL[inst.status]}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {inst.status !== 'PAID' && (
                    <button
                      onClick={() => void handlePayInstallment(inst.id)}
                      disabled={payingInstallmentId === inst.id}
                      style={{
                        ...btnStyle,
                        background: 'var(--color-primary)',
                        color: '#fff',
                        opacity: payingInstallmentId === inst.id ? 0.6 : 1,
                      }}
                    >
                      Marcar como pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* Expense logs table */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Despesas Fixas do Mês</h2>
      {data.expenseLogs.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-600)' }}>Nenhuma despesa fixa ativa.</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-neutral-300)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-bg)', textAlign: 'left' }}>
              {['Despesa', 'Categoria', 'Dia', 'Valor', 'Status', 'Ação'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.expenseLogs.map((log, i) => (
              <tr key={log.id} style={{ borderTop: '1px solid var(--color-neutral-300)', background: i % 2 === 1 ? 'var(--color-neutral-100)' : 'transparent' }}>
                <td style={{ padding: '8px 12px' }}>{log.fixedExpenseName}</td>
                <td style={{ padding: '8px 12px', color: 'var(--color-neutral-600)' }}>{log.category ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>Dia {log.dueDay}</td>
                <td style={{ padding: '8px 12px' }}>{formatCurrency(log.amount)}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ color: STATUS_COLOR[log.status], fontWeight: 600, fontSize: '0.85rem' }}>
                    {STATUS_LABEL[log.status]}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {log.status === 'PENDING' && (
                    <button
                      onClick={() => void handlePayExpenseLog(log.id)}
                      disabled={payingExpenseLogId === log.id}
                      style={{
                        ...btnStyle,
                        background: 'var(--color-danger, #dc2626)',
                        color: '#fff',
                        opacity: payingExpenseLogId === log.id ? 0.6 : 1,
                      }}
                    >
                      Marcar como pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
