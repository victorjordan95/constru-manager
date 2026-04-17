import { useState } from 'react'
import { useFinanceDRE } from './hooks'
import { formatCurrency } from '@/lib/format'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function DrePage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const { data, isLoading } = useFinanceDRE(month, year)

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  function resultColor(v: number): string {
    if (v > 0) return 'var(--color-success)'
    if (v < 0) return 'var(--color-danger)'
    return 'var(--color-neutral-600)'
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h1 style={{ fontSize: '1.5rem' }}>DRE</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={navBtnStyle}>◄</button>
          <span style={{ fontWeight: 600, minWidth: 130, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} style={navBtnStyle}>►</button>
        </div>
      </div>

      {isLoading || !data ? (
        <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
      ) : (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-neutral-300)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-primary-bg)' }}>
                <th style={{ ...thStyle, textAlign: 'left', width: '55%' }}></th>
                <th style={thStyle}>Previsto</th>
                <th style={thStyle}>Realizado</th>
              </tr>
            </thead>
            <tbody>
              {/* RECEITAS */}
              <tr style={{ background: 'var(--color-neutral-100)' }}>
                <td colSpan={3} style={sectionLabelStyle}>RECEITAS</td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                <td style={{ ...tdLabel, paddingLeft: 28 }}>Receita de Vendas</td>
                <td style={tdVal}>{formatCurrency(data.receitaPrevista)}</td>
                <td style={tdVal}>{formatCurrency(data.receitaRealizada)}</td>
              </tr>

              {/* DESPESAS */}
              <tr style={{ background: 'var(--color-neutral-100)', borderTop: '2px solid var(--color-neutral-200)' }}>
                <td colSpan={3} style={sectionLabelStyle}>DESPESAS</td>
              </tr>
              {data.expensesByCategory.length === 0 && (
                <tr style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                  <td colSpan={3} style={{ ...tdLabel, paddingLeft: 28, color: 'var(--color-neutral-600)', fontStyle: 'italic' }}>
                    Nenhuma despesa neste mês
                  </td>
                </tr>
              )}
              {data.expensesByCategory.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                  <td style={{ ...tdLabel, paddingLeft: 28 }}>{row.category ?? 'Outros'}</td>
                  <td style={tdVal}>{formatCurrency(row.previsto)}</td>
                  <td style={tdVal}>{formatCurrency(row.realizado)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid var(--color-neutral-300)', background: 'var(--color-neutral-100)' }}>
                <td style={{ ...tdLabel, fontWeight: 600 }}>Total Despesas</td>
                <td style={{ ...tdVal, fontWeight: 600 }}>{formatCurrency(data.despesaPrevista)}</td>
                <td style={{ ...tdVal, fontWeight: 600 }}>{formatCurrency(data.despesaRealizada)}</td>
              </tr>

              {/* RESULTADO */}
              <tr style={{ borderTop: '2px solid var(--color-neutral-300)' }}>
                <td style={{ ...tdLabel, fontWeight: 700 }}>RESULTADO DO MÊS</td>
                <td style={{ ...tdVal, fontWeight: 700, color: resultColor(data.resultadoPrevisto) }}>
                  {formatCurrency(data.resultadoPrevisto)}
                </td>
                <td style={{ ...tdVal, fontWeight: 700, color: resultColor(data.resultadoRealizado) }}>
                  {formatCurrency(data.resultadoRealizado)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'var(--color-primary-bg)',
  color: 'var(--color-primary)',
  border: 'none',
  borderRadius: 4,
  padding: '4px 10px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.875rem',
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'right',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--color-primary)',
}

const sectionLabelStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontWeight: 700,
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  color: 'var(--color-neutral-600)',
}

const tdLabel: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.875rem',
}

const tdVal: React.CSSProperties = {
  padding: '8px 16px',
  textAlign: 'right',
  fontSize: '0.875rem',
}
