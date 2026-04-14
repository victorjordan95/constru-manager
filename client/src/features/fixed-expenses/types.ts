export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string | null;
  isActive: boolean;
}

export interface CreateFixedExpensePayload {
  name: string;
  amount: number;
  dueDay: number;
  category?: string;
}

export type UpdateFixedExpensePayload = Partial<CreateFixedExpensePayload>;
