export interface InstallmentSummaryItem {
  id: string;
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  clientName: string;
  quoteId: string;
}

export interface ExpenseLogSummaryItem {
  id: string;
  fixedExpenseName: string;
  category: string | null;
  dueDay: number;
  amount: number;
  status: 'PENDING' | 'PAID';
}

export interface FinanceSummary {
  balance: number;
  openingBalance: number;
  month: number;
  year: number;
  projected: {
    incoming: number;
    outgoing: number;
  };
  realized: {
    netProfit: number;
  };
  installments: InstallmentSummaryItem[];
  expenseLogs: ExpenseLogSummaryItem[];
}
