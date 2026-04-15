# Spec: Financeiro + Orçamentos — Novas Features

**Data:** 2026-04-15  
**Status:** Aprovado

---

## Escopo

4 features em 2 áreas do sistema:

| # | Área | Feature |
|---|------|---------|
| 1 | Financeiro | Fluxo de Caixa (gráfico últimos 6 meses) |
| 2 | Financeiro | Inadimplência (parcelas vencidas) |
| 3 | Orçamentos | PDF do Orçamento |
| 4 | Orçamentos | Duplicar Orçamento |

---

## Decisões Técnicas

- **Charting:** `recharts` — maturidade, API React-friendly, integração direta com dados do backend
- **PDF:** `@react-pdf/renderer` — geração client-side, output profissional, sem servidor necessário
- Valores continuam em centavos no backend; formatação em pt-BR no frontend

---

## Feature 1 — Fluxo de Caixa

### Backend

**Endpoint:** `GET /finance/cashflow?months=N` (default N=6, max N=24)

Agrupa `CashTransaction` por `(month, year)` e retorna:
```json
[
  { "month": 11, "year": 2025, "income": 0, "expense": 0 },
  ...
  { "month": 4, "year": 2026, "income": 150000, "expense": 59800 }
]
```

- Retorna exatamente N meses, incluindo meses sem transações (zeros)
- Ordenado do mais antigo para o mais recente
- Acessível para roles ADMIN e FINANCE

### Frontend

- Componente `CashFlowChart` em `client/src/features/finance/CashFlowChart.tsx`
- `recharts` `BarChart` com:
  - Barras verdes (`--color-success`) para entradas
  - Barras vermelhas (`--color-danger`) para saídas
  - Eixo X: "Mês/Ano" (abreviado: "Abr/26")
  - Eixo Y: valores em R$ formatados
  - Tooltip com valores completos
- Aparece abaixo dos 3 cards de resumo no `FinanceDashboardPage`
- Exibido dentro de um card branco com título "Fluxo de Caixa"
- Usa `useFinanceCashflow` hook com `useQuery`

---

## Feature 2 — Inadimplência

### Backend

**Endpoint:** `GET /finance/overdue`

Busca installments onde `dueDate < now` e `status = PENDING` (não PAID). Inclui clientName via join.

Retorna:
```json
[
  {
    "id": "...",
    "clientName": "João Silva",
    "amount": 40000,
    "dueDate": "2026-03-06",
    "daysOverdue": 39
  }
]
```

- `daysOverdue` = diferença em dias entre hoje e `dueDate`
- Ordenado por `dueDate` ASC (mais antigo primeiro)
- Acessível para roles ADMIN e FINANCE

### Frontend

- Seção "Inadimplência" no topo do `FinanceDashboardPage`, logo abaixo do seletor de mês
- Só renderiza se houver parcelas vencidas
- Card com fundo `var(--color-danger-bg)` e borda `var(--color-danger)`
- Tabela com colunas: Cliente | Vencimento | Dias em atraso | Valor | Ação
- Botão "Marcar como pago" reutiliza `usePayInstallment` e invalida também `useOverdue`
- Hook `useOverdueInstallments` separado do summary mensal

---

## Feature 3 — PDF do Orçamento

### Frontend (client-side)

- Componente `QuotePDF` em `client/src/features/quotes/QuotePDF.tsx` usando `@react-pdf/renderer`
- Estrutura do documento:
  1. Cabeçalho: "Constru Manager" + data de geração
  2. Dados do cliente: nome, CPF/CNPJ, e-mail, telefone
  3. Número do orçamento e versão ativa
  4. Tabela de itens: Item | Qtd | Un. | Preço Unit. | Total
  5. Rodapé com subtotal, M.O. (se > 0), desconto (se > 0), **Total**
- Botão "Baixar PDF" no `QuoteDetailPage`, visível quando há versão ativa
- Usa `pdf(…).toBlob()` + `URL.createObjectURL` para download sem abrir nova aba
- Nome do arquivo: `orcamento-{clientName}-v{version}.pdf`

### Sem mudanças de backend

PDF gerado 100% no cliente com os dados já carregados pelo `useQuote`.

---

## Feature 4 — Duplicar Orçamento

### Backend

**Endpoint:** `POST /quotes/:id/duplicate`

1. Busca o quote pelo id com versão ativa e seus itens
2. Cria novo `Quote` para o mesmo `clientId` com status `PENDING_REVIEW`
3. Cria `QuoteVersion` v1 copiando todos os `QuoteItem` da versão ativa (productId, kitId, quantity, unitPrice, lineTotal), subtotal, laborCost, discount, total
4. Define o novo quote com `activeVersionId` apontando para a nova versão
5. Retorna `{ id: novoQuoteId }`
- Requer role ADMIN ou SALES

### Frontend

- Hook `useDuplicateQuote` em `quotes/hooks.ts`
- Botão "Duplicar" no `QuoteDetailPage` (ao lado dos demais botões de ação, visível para ADMIN e SALES)
- Botão "Duplicar" na `QuotesListPage` na coluna Ações
- Após sucesso: navega para `/quotes/{novoId}` via `useNavigate`
- Durante a mutação: botão desabilitado com texto "Duplicando..."

---

## Rotas novas (backend)

| Método | Path | Role |
|--------|------|------|
| GET | `/finance/cashflow` | ADMIN, FINANCE |
| GET | `/finance/overdue` | ADMIN, FINANCE |
| POST | `/quotes/:id/duplicate` | ADMIN, SALES |

---

## Dependências a instalar (client)

```
recharts
@react-pdf/renderer
```

---

## Arquivos a criar/modificar

### Backend
- `server/src/features/finance/finance.service.ts` — adicionar `getCashflow`, `getOverdue`
- `server/src/features/finance/finance.controller.ts` — adicionar handlers
- `server/src/features/finance/finance.routes.ts` — registrar rotas
- `server/src/features/finance/finance.types.ts` — tipos de resposta
- `server/src/features/quotes/quotes.service.ts` — adicionar `duplicateQuote`
- `server/src/features/quotes/quotes.controller.ts` — adicionar handler
- `server/src/features/quotes/quotes.routes.ts` — registrar rota

### Frontend
- `client/src/features/finance/CashFlowChart.tsx` — novo componente
- `client/src/features/finance/hooks.ts` — adicionar `useFinanceCashflow`, `useOverdueInstallments`
- `client/src/features/finance/api.ts` — adicionar chamadas de API
- `client/src/features/finance/FinanceDashboardPage.tsx` — integrar fluxo de caixa e inadimplência
- `client/src/features/quotes/QuotePDF.tsx` — novo componente
- `client/src/features/quotes/hooks.ts` — adicionar `useDuplicateQuote`
- `client/src/features/quotes/api.ts` — adicionar chamadas de API
- `client/src/features/quotes/QuoteDetailPage.tsx` — botões PDF e Duplicar
- `client/src/features/quotes/QuotesListPage.tsx` — botão Duplicar
