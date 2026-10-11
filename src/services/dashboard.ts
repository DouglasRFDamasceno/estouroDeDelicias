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
