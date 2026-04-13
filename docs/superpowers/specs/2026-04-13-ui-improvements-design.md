# UI Improvements — Design Spec

**Date:** 2026-04-13
**Scope:** Four targeted UX improvements to the quotes and clients flows.

---

## 1. CPF/CNPJ Mask (`ClientFormPage`)

**What:** The `taxId` field in `ClientFormPage` applies a mask in real time as the user types.

**Logic:**
- Strip all non-digits from the raw input.
- ≤ 11 digits → format as CPF: `000.000.000-00`
- 12–14 digits → format as CNPJ: `00.000.000/0000-00`
- The field label changes from the static "CPF / CNPJ" to "CPF" or "CNPJ" once the type is unambiguous (≥ 12 digits for CNPJ, exactly 11 digits typed for CPF).

**Implementation:** Inline helper functions `formatTaxId(digits: string): string` and `detectTaxIdType(digits: string): 'CPF' | 'CNPJ' | 'CPF / CNPJ'` added at the bottom of `ClientFormPage.tsx`. No external library.

**Stored value:** The raw masked string (with punctuation) is what gets sent in the payload — consistent with current behaviour of the `taxId` field.

---

## 2. Quick-action Buttons in the Quotes Grid (`QuotesListPage`)

**What:** The "Ações" column in `QuotesListPage` gains inline Aceitar / Recusar / Sem Retorno buttons when the user is ADMIN and the quote is in an actionable status.

**Visibility rules (ADMIN only):**

| Quote status      | Buttons shown                           |
|-------------------|-----------------------------------------|
| `PENDING_REVIEW`  | Aceitar · Recusar · Sem Retorno         |
| `NO_RESPONSE`     | Aceitar · Recusar                       |
| `REJECTED`        | Aceitar · Sem Retorno                   |
| `DRAFT`           | _(no action buttons)_                   |
| `ACCEPTED`        | _(no action buttons)_                   |

- **Aceitar** opens the `AcceptQuoteModal` inline (state held in `QuotesListPage`).
- **Recusar** and **Sem Retorno** call `updateStatus` directly, no confirmation dialog.
- `QuotesListPage` holds state: `{ type: 'accept' | null, quoteId: string | null }` to control the modal.
- The `AcceptQuoteModal` receives both `quoteId` and `total` (from `activeVersion.total`) as props.

**No navigation change** — "Ver" button remains for accessing the detail page.

---

## 3. Number Input Zero Reset

**What:** Number inputs that start at `0` clear/select their content on focus so the user can type without producing values like `0500`.

**Implementation:** A single helper:
```ts
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()
```
Added as `onFocus={selectOnFocus}` to:
- `AcceptQuoteModal` — down payment field
- `QuoteFormPage` — laborCost and discount fields
- `QuoteVersionFormPage` — laborCost and discount fields

Using `select()` rather than clearing: preserves the value if the user wants to keep it (e.g., tab through without editing), but any keystroke replaces it naturally.

---

## 4. Accept Quote Modal Redesign (`AcceptQuoteModal`)

**What:** Replace the manual row-by-row installment entry with an auto-calculated installment preview.

### Props change
```ts
interface Props {
  quoteId: string
  total: number   // added — integer cents, from activeVersion.total
  onClose: () => void
}
```

### New form layout

1. **Order summary** (read-only, top of form):
   > Valor do pedido: **R$ X.XXX,XX**

2. **Forma de pagamento** — `À vista` / `Parcelado` (unchanged)

3. **Entrada (R$)** — numeric input with `selectOnFocus`

4. *(only when Parcelado)*
   - **Nº de parcelas** — `<select>` with options 1–36
   - **Data da 1ª parcela** — `<input type="date">`

5. *(only when Parcelado and both nº + date are filled)*  
   **Preview table** — auto-calculated, read-only:

   | # | Vencimento | Valor |
   |---|-----------|-------|
   | 1 | 01/06/2026 | R$ 350,00 |
   | … | … | … |

### Calculation
```
remaining = total - downPaymentCents
baseInstallment = Math.floor(remaining / count)
remainder = remaining - baseInstallment * count
// last installment = baseInstallment + remainder
// dates: first date + (i * 1 month) for i = 0..count-1
```

### Payload sent to backend
Generated from the preview rows — same `InstallmentPayload[]` structure as before (no backend changes needed).

### Edge cases
- `downPayment >= total`: preview shows 0 remaining, nº de parcelas input is hidden (or forced to 1 with R$ 0,00).
- `À vista` selected: only shows order summary + entry field. No table.

---

## Files changed

| File | Change |
|------|--------|
| `client/src/features/clients/ClientFormPage.tsx` | Add CPF/CNPJ mask + dynamic label |
| `client/src/features/quotes/QuotesListPage.tsx` | Add inline action buttons + modal state |
| `client/src/features/quotes/AcceptQuoteModal.tsx` | Full redesign with auto-calculated installments |
| `client/src/features/quotes/QuoteDetailPage.tsx` | Pass `total` prop to `AcceptQuoteModal` |
| `client/src/features/quotes/QuoteFormPage.tsx` | Add `selectOnFocus` to laborCost/discount |
| `client/src/features/quotes/QuoteVersionFormPage.tsx` | Add `selectOnFocus` to laborCost/discount |

No backend changes. No new files.
