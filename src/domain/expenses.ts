import { parseCostPrice } from './costs.ts';
import { validateDashboardPeriod } from './dashboard.ts';
export interface ExpenseDraft {
  description: string;
  category: string;
  date: string;
  amount: string;
  notes: string;
}
export function parseExpenseDraft(draft: ExpenseDraft) {
  const description = draft.description.trim();
  const category = draft.category.trim();
  const notes = draft.notes.trim();
  if (description.length < 2 || description.length > 120)
    throw Error('Informe uma descrição de 2 a 120 caracteres.');
  if (category && (category.length < 2 || category.length > 80))
    throw Error('Informe uma categoria de 2 a 80 caracteres ou deixe em branco.');
  validateDashboardPeriod(draft.date, draft.date);
  if (draft.date < '1900-01-01') throw Error('Informe uma data a partir de 1900.');
  const amount_cents = parseCostPrice(draft.amount);
  if (!amount_cents) throw Error('O valor da despesa deve ser maior que zero.');
  if (notes.length > 1000) throw Error('Use até 1.000 caracteres nas observações.');
  return { description, category, expense_date: draft.date, amount_cents, notes };
}
