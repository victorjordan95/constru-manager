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

export interface CashflowMonth {
  month: number;
  year: number;
  income: number;
  expense: number;
}

export interface OverdueInstallment {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
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
