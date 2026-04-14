import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useFixedExpenses, useDeleteFixedExpense } from './hooks';
import { formatCurrency } from '@/lib/format';

export function FixedExpensesListPage() {
  const { data: expenses, isLoading, error } = useFixedExpenses();
  const deleteMutation = useDeleteFixedExpense();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>;
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar despesas fixas.</p>;

  async function handleDelete(id: string) {
    if (!confirm('Desativar esta despesa fixa?')) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  const btnStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    padding: '4px 10px',
    fontSize: '0.8rem',
    fontWeight: 600,
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>Despesas Fixas</h1>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link to={'/fixed-expenses/new' as any}>
          <button
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Nova Despesa
          </button>
        </Link>
      </div>
      {expenses?.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-600)' }}>Nenhuma despesa fixa cadastrada.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-200)', textAlign: 'left' }}>
              {['Nome', 'Categoria', 'Dia Venc.', 'Valor', 'Ações'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses?.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
                <td style={{ padding: '8px 12px' }}>{e.name}</td>
                <td style={{ padding: '8px 12px', color: 'var(--color-neutral-600)' }}>
                  {e.category ?? '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>Dia {e.dueDay}</td>
                <td style={{ padding: '8px 12px' }}>{formatCurrency(e.amount)}</td>
                <td style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Link to={'/fixed-expenses/$id/edit' as any} params={{ id: e.id }}>
                    <button
                      style={{
                        ...btnStyle,
                        background: 'var(--color-neutral-200)',
                        color: 'var(--color-neutral-900)',
                      }}
                    >
                      Editar
                    </button>
                  </Link>
                  <button
                    style={{
                      ...btnStyle,
                      background: 'var(--color-danger)',
                      color: '#fff',
                      opacity: deletingId === e.id ? 0.6 : 1,
                    }}
                    disabled={deletingId === e.id}
                    onClick={() => void handleDelete(e.id)}
                  >
                    Desativar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
