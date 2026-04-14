import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useFinanceSummary, useUpdateOpeningBalance, usePayInstallment, usePayExpenseLog } from './hooks';
import { formatCurrency } from '@/lib/format';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--color-warning, #f59e0b)',
  PAID: 'var(--color-success, #16a34a)',
  OVERDUE: 'var(--color-danger)',
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

  const { data, isLoading, error } = useFinanceSummary(month, year);
  const updateBalanceMutation = useUpdateOpeningBalance();
  const payInstallmentMutation = usePayInstallment();
  const payExpenseLogMutation = usePayExpenseLog();

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  async function handleSaveBalance() {
    const value = Math.round(parseFloat(balanceInput) * 100);
    if (isNaN(value) || value < 0) return;
    await updateBalanceMutation.mutateAsync(value);
    setEditingBalance(false);
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

  const netProfit = data.realized.netProfit;

  return (
    <div>
      {/* Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Financeiro</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button
            onClick={prevMonth}
            style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}
          >
            {'<'}
          </button>
          <span style={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}
          >
            {'>'}
          </button>
        </div>
      </div>

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
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>Entradas pagas − saídas pagas</p>
        </div>
      </div>

      {/* Installments table */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Parcelas do Mês</h2>
      {data.installments.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-600)', marginBottom: 'var(--space-4)' }}>Nenhuma parcela neste mês.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-4)' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-200)', textAlign: 'left' }}>
              {['Cliente', 'Vencimento', 'Valor', 'Status', 'Ação'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.installments.map((inst) => (
              <tr key={inst.id} style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
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
                      onClick={() => void payInstallmentMutation.mutateAsync(inst.id)}
                      disabled={payInstallmentMutation.isPending}
                      style={{ ...btnStyle, background: 'var(--color-primary)', color: '#fff' }}
                    >
                      Marcar como pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Expense logs table */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Despesas Fixas do Mês</h2>
      {data.expenseLogs.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-600)' }}>Nenhuma despesa fixa ativa.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-200)', textAlign: 'left' }}>
              {['Despesa', 'Categoria', 'Dia', 'Valor', 'Status', 'Ação'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.expenseLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
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
                      onClick={() => void payExpenseLogMutation.mutateAsync(log.id)}
                      disabled={payExpenseLogMutation.isPending}
                      style={{ ...btnStyle, background: 'var(--color-danger)', color: '#fff' }}
                    >
                      Marcar como pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
