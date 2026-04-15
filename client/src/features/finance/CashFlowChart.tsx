import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useFinanceCashflow } from './hooks';

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                     'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatYAxis(value: number): string {
  if (value === 0) return 'R$ 0';
  if (value >= 100000) return `R$ ${(value / 100000).toFixed(0)}k`;
  return `R$ ${(value / 100).toFixed(0)}`;
}

function formatTooltipValue(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

export function CashFlowChart() {
  const { data, isLoading } = useFinanceCashflow(6);

  if (isLoading || !data) {
    return (
      <div style={{ padding: 'var(--space-3)', color: 'var(--color-neutral-600)', fontSize: '0.875rem' }}>
        Carregando fluxo de caixa...
      </div>
    );
  }

  const chartData = data.map((d) => ({
    label: `${MONTH_SHORT[d.month - 1]}/${String(d.year).slice(2)}`,
    Entradas: d.income,
    Saídas: d.expense,
  }));

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-neutral-300)',
        borderRadius: 8,
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>Fluxo de Caixa</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} barGap={4} barCategoryGap="30%">
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            formatter={(value, name) => [
              typeof value === 'number' ? formatTooltipValue(value) : String(value),
              name,
            ]}
          />
          <Legend />
          <Bar dataKey="Entradas" fill="var(--color-success, #16a34a)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Saídas" fill="var(--color-danger, #dc2626)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
