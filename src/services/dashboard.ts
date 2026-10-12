import { requireSupabase } from './supabase';
import { validateDashboardPeriod } from '../domain/dashboard';
import { pageRange } from '../domain/pagination';
export interface DashboardSummary {
  sale_count: number;
  revenue_cents: number;
  received_cents: number;
  receivable_cents: number;
  average_ticket_cents: number;
  settled_count: number;
  partial_count: number;
  unpaid_count: number;
  units: number;
  costed_units: number;
  missing_units: number;
  ambiguous_units: number;
  estimated_cost_cents: number;
  estimated_gross_margin_cents: number | null;
  estimated_gross_profit_cents: number | null;
  estimated_gross_margin_percent: number | null;
  expense_count: number;
  expense_cents: number;
  estimated_net_profit_cents: number | null;
  estimated_net_margin_percent: number | null;
  costed_revenue_cents: number;
  uncovered_revenue_cents: number;
  all_receivable_cents: number;
  all_pending_count: number;
  product_count: number;
  customer_count: number;
  material_count: number;
  recipe_count: number;
  calculated_at: string;
}
export type DashboardProductSort = 'name' | 'quantity' | 'revenue_cents';
export interface DashboardProduct {
  id: string;
  name: string;
  category: string;
  presentation: string;
  quantity: number;
  revenue_cents: number;
}
export async function loadDashboard(
  from: string,
  until: string,
  signal: AbortSignal,
): Promise<DashboardSummary> {
  validateDashboardPeriod(from, until);
  const result = await requireSupabase()
    .rpc('dashboard_summary', { p_from: from, p_until: until })
    .abortSignal(signal);
  if (result.error || !result.data) throw result.error ?? Error('Resumo indisponível');
  return result.data as DashboardSummary;
}
export async function loadDashboardProducts(
  from: string,
  until: string,
  page: number,
  size: number,
  sort: DashboardProductSort,
  ascending: boolean,
  signal: AbortSignal,
): Promise<{ rows: DashboardProduct[]; total: number }> {
  validateDashboardPeriod(from, until);
  pageRange(page, size);
  if (!['name', 'quantity', 'revenue_cents'].includes(sort)) throw Error('Ordenação inválida');
  const result = await requireSupabase()
    .rpc('dashboard_products', {
      p_from: from,
      p_until: until,
      p_page: page,
      p_size: size,
      p_sort: sort,
      p_ascending: ascending,
    })
    .abortSignal(signal);
  if (result.error || !result.data) throw result.error ?? Error('Produtos indisponíveis');
  return result.data;
}

export interface DashboardDay {
  date: string;
  revenue_cents: number;
}
export async function loadDashboardDays(
  from: string,
  until: string,
  signal: AbortSignal,
): Promise<DashboardDay[]> {
  validateDashboardPeriod(from, until);
  const result = await requireSupabase()
    .rpc('dashboard_daily_sales', { p_from: from, p_until: until })
    .abortSignal(signal);
  if (result.error || !result.data) throw result.error ?? Error('Série indisponível');
  return result.data as DashboardDay[];
}

export const costIssueLabels = {
  no_recipe: 'Sem receita vinculada',
  multiple_recipes: 'Mais de uma receita vinculada',
  removed_product: 'Produto removido do catálogo',
  empty_recipe: 'Receita sem ingredientes',
} as const;
export type CostIssueReason = keyof typeof costIssueLabels;
export interface DashboardCostIssue extends DashboardProduct {
  product_id: string | null;
  reason: CostIssueReason;
}
export async function loadDashboardCostIssues(
  from: string,
  until: string,
  page: number,
  size: number,
  sort: DashboardProductSort,
  ascending: boolean,
  reason: CostIssueReason | 'all',
  signal: AbortSignal,
): Promise<{ rows: DashboardCostIssue[]; total: number }> {
  validateDashboardPeriod(from, until);
  pageRange(page, size);
  if (
    !['name', 'quantity', 'revenue_cents'].includes(sort) ||
    (reason !== 'all' && !(reason in costIssueLabels))
  )
    throw Error('Consulta inválida.');
  const result = await requireSupabase()
    .rpc('dashboard_cost_issues', {
      p_from: from,
      p_until: until,
      p_page: page,
      p_size: size,
      p_sort: sort,
      p_ascending: ascending,
      p_reason: reason,
    })
    .abortSignal(signal);
  if (result.error || !result.data) throw result.error ?? Error('Pendências indisponíveis');
  return result.data;
}
