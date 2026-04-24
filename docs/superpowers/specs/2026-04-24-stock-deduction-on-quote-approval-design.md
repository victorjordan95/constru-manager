# Stock Deduction on Quote Approval

**Date:** 2026-04-24  
**Status:** Approved

## Overview

When a quote is approved (`acceptQuote`), the stock of all products involved must be decremented. Products added via kits must also have their individual items decremented. If a product's stock drops below zero or below its minimum threshold, the API returns a list of warnings — the frontend shows these as a contextual banner after approval. Approval is never blocked by insufficient stock.

## Requirements

1. Stock is decremented **only when a quote is accepted** (not on creation, not on status changes to REJECTED/NO_RESPONSE).
2. Products used directly in a quote item are decremented by their `quantity`.
3. Products used via a kit are decremented by `kitItem.quantity × quoteItem.quantity`.
4. If the same product appears multiple times (directly and inside a kit), quantities are summed before deduction.
5. Each deduction creates a `StockMovement` record of type `OUTFLOW` with `reason: "Aprovação do orçamento <quoteId>"`.
6. Creating or updating a kit does **not** affect stock.
7. After deduction, products with `stockQty < 0` or `stockQty < minStock` are returned as `stockWarnings`.
8. The frontend shows a dismissible banner listing those products — it does not block navigation or further action.

## Backend Design

### `acceptQuote` changes (`quotes.service.ts`)

Within the existing `$transaction`:

1. Load `activeVersion.items` including `kitId`, `productId`, `quantity`, and kit's `items` (KitItem with `productId` and `quantity`).
2. Build a `Map<productId, totalQuantity>` by iterating items:
   - Direct product items: `productId → quantity`
   - Kit items: for each `KitItem`, `productId → kitItem.quantity × quoteItem.quantity`
   - Same product may appear in multiple items — accumulate.
3. For each entry in the map (inside the transaction):
   - `product.stockQty -= totalQuantity` via `prisma.product.update`
   - `prisma.stockMovement.create` with `type: OUTFLOW`, `quantity: totalQuantity`, `reason: "Aprovação do orçamento <id>"`
4. After the transaction, query updated products to find those with `stockQty < 0` or `stockQty < minStock`.

### Return type

```ts
type AcceptQuoteResult =
  | { error: 'NOT_FOUND' | 'ALREADY_ACCEPTED' | 'NO_ACTIVE_VERSION' }
  | { quote: Quote; stockWarnings: StockWarning[] }

type StockWarning = {
  productId: string
  productName: string
  stockQty: number   // may be negative
  minStock: number | null
}
```

## Frontend Design

### `AcceptQuoteModal` / `QuoteDetailPage`

- The `acceptQuote` mutation already exists. After it resolves successfully, check `result.stockWarnings.length > 0`.
- If warnings exist, store them in local state (`useState<StockWarning[]>`).
- Render a dismissible warning banner at the top of `QuoteDetailPage`:
  - Title: "Atenção: reposição de estoque necessária"
  - One row per product: name, current stock (may be negative), minimum stock
  - "OK, entendi" button clears the state
- The banner is ephemeral — disappears on navigate/reload. No persistence needed.

## Data Flow

```
User clicks "Aceitar" → fills AcceptQuoteModal → submits
→ POST /quotes/:id/accept
→ acceptQuote()
  → $transaction {
      create Sale
      update Quote status = ACCEPTED
      expand items → productQtyMap
      for each product: update stockQty, create StockMovement
    }
  → query updated products → build stockWarnings
→ return { quote, stockWarnings }
→ frontend: close modal, if stockWarnings → show banner
```

## What This Does NOT Change

- Kit creation/update — no stock impact.
- `updateStatus` endpoint — no stock impact (status ACCEPTED can only be reached via `acceptQuote`).
- Quote creation or new versions — no stock impact.
- No schema migrations needed — `StockMovement` and `stockQty` fields already exist.
