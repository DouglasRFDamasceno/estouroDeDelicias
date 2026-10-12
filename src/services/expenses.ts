import { requireSupabase } from './supabase';
import { validateDashboardPeriod } from '../domain/dashboard';
import { pageRange } from '../domain/pagination';
export interface Expense {
  id: string;
  description: string;
  category: string;
  expense_date: string;
  amount_cents: number;
  notes: string;
  revision: number;
}
export type ExpenseSort = 'expense_date' | 'description' | 'category' | 'amount_cents';
export interface ExpenseFilters {
  from: string;
  until: string;
  search: string;
  category: string;
}
export async function loadExpenses(
  filters: ExpenseFilters,
  page: number,
  size: number,
  sort: ExpenseSort,
  ascending: boolean,
  signal: AbortSignal,
): Promise<{ rows: Expense[]; total: number; amount_cents: number }> {
  validateDashboardPeriod(filters.from, filters.until);
  pageRange(page, size);
  if (
    !['expense_date', 'description', 'category', 'amount_cents'].includes(sort) ||
    filters.search.length > 120 ||
    filters.category.length > 80
  )
    throw Error('Consulta inválida.');
  const result = await requireSupabase()
    .rpc('expenses_page', {
      p_from: filters.from,
      p_until: filters.until,
      p_page: page,
      p_size: size,
      p_sort: sort,
      p_ascending: ascending,
      p_search: filters.search,
      p_category: filters.category,
    })
    .abortSignal(signal);
  if (result.error || !result.data) throw result.error ?? Error('Despesas indisponíveis');
  return result.data;
}
export async function removeExpense(expense: Expense) {
  const result = await requireSupabase()
    .from('expenses')
    .delete()
    .eq('id', expense.id)
    .eq('revision', expense.revision)
    .select('id')
    .abortSignal(AbortSignal.timeout(15000))
    .single();
  if (result.error || !result.data) throw result.error ?? Error('Despesa alterada ou removida.');
}
