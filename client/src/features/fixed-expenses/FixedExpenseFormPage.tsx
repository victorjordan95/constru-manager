import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useFixedExpense, useCreateFixedExpense, useUpdateFixedExpense } from './hooks';

type FormState = {
  name: string;
  amountBrl: string;
  dueDay: string;
  category: string;
};

const empty: FormState = { name: '', amountBrl: '', dueDay: '1', category: '' };

export function FixedExpenseFormPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { id?: string };
  const id = params.id;
  const isEdit = Boolean(id);

  const { data: existing } = useFixedExpense(id ?? '', { enabled: isEdit });
  const createMutation = useCreateFixedExpense();
  const updateMutation = useUpdateFixedExpense();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [form, setForm] = useState<FormState>(empty);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        amountBrl: (existing.amount / 100).toFixed(2),
        dueDay: String(existing.dueDay),
        category: existing.category ?? '',
      });
    } else if (!isEdit) {
      setForm(empty);
      setServerError(null);
    }
  }, [existing, isEdit, id]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const amount = Math.round(parseFloat(form.amountBrl) * 100);
    const dueDay = parseInt(form.dueDay, 10);
    if (isNaN(amount) || amount <= 0) {
      setServerError('Valor inválido.');
      return;
    }
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 28) {
      setServerError('Dia de vencimento deve ser entre 1 e 28.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      amount,
      dueDay,
      ...(form.category && { category: form.category }),
    };
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void navigate({ to: '/fixed-expenses' as any });
    } catch {
      setServerError('Erro ao salvar. Verifique os dados.');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-1) var(--space-2)',
    border: '1px solid var(--color-neutral-300)',
    borderRadius: 4,
    fontSize: '1rem',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 4,
    fontWeight: 600,
    fontSize: '0.875rem',
  };
  const fieldStyle: React.CSSProperties = { marginBottom: 'var(--space-3)' };

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>
        {isEdit ? 'Editar Despesa Fixa' : 'Nova Despesa Fixa'}
      </h1>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={fieldStyle}>
          <label htmlFor="fe-name" style={labelStyle}>Nome *</label>
          <input
            id="fe-name"
            style={inputStyle}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="fe-amount" style={labelStyle}>Valor (R$) *</label>
          <input
            id="fe-amount"
            style={inputStyle}
            type="number"
            step="0.01"
            min="0.01"
            value={form.amountBrl}
            onFocus={(e) => e.target.select()}
            onChange={(e) => set('amountBrl', e.target.value)}
            required
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="fe-dueDay" style={labelStyle}>Dia de Vencimento (1–28) *</label>
          <input
            id="fe-dueDay"
            style={inputStyle}
            type="number"
            min="1"
            max="28"
            value={form.dueDay}
            onChange={(e) => set('dueDay', e.target.value)}
            required
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="fe-category" style={labelStyle}>Categoria</label>
          <input
            id="fe-category"
            style={inputStyle}
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          />
        </div>
        {serverError && (
          <p style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
            {serverError}
          </p>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 4,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
          </button>
          <button
            type="button"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={() => void navigate({ to: '/fixed-expenses' as any })}
            style={{
              background: 'var(--color-neutral-200)',
              color: 'var(--color-neutral-900)',
              border: 'none',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
