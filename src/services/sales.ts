import { searchPattern } from '../domain/search';
import { requireSupabase } from './supabase';
import { pageRange } from '../domain/pagination';
export interface Sale {
  id: string;
  revision: number;
  customer_id: string | null;
  customer: string;
  sale_date: string;
  total_cents: number;
  received_cents: number;
  payment_method: string;
  notes: string;
}
export type SaleSort = 'sale_date' | 'customer' | 'total_cents';
export async function loadSales(
  page: number,
  pageSize: number,
  search: string,
  sort: SaleSort,
  ascending: boolean,
  signal: AbortSignal,
  period?: { from: string; until: string },
) {
  const { from, to } = pageRange(page, pageSize);
  if (!['sale_date', 'customer', 'total_cents'].includes(sort)) throw Error('Ordenação inválida.');
  let query = requireSupabase()
    .from('sales')
    .select(
      'id,revision,customer_id,customer,sale_date,total_cents,received_cents,payment_method,notes',
      { count: 'exact' },
    );
  if (period) query = query.gte('sale_date', period.from).lte('sale_date', period.until);
  if (search.trim())
    query = query.ilike('customer_search', searchPattern(search.trim().slice(0, 120)));
  const result = await query
    .order(sort, { ascending })
    .order('id')
    .range(from, to)
    .abortSignal(signal);
  if (result.error || result.count === null) throw result.error ?? Error('Contagem indisponível');
  return { rows: result.data as Sale[], total: result.count };
}

export interface SavedSaleItem {
  id: string;
  product_id: string | null;
  product_name: string;
  category: string;
  presentation: string;
  unit_price_cents: number;
  quantity: number;
}
export async function loadSaleItems(id: string, signal: AbortSignal) {
  const result = await requireSupabase()
    .from('sale_items')
    .select('id,product_id,product_name,category,presentation,unit_price_cents,quantity')
    .eq('sale_id', id)
    .order('id')
    .range(0, 49)
    .abortSignal(signal);
  if (result.error) throw result.error;
  return result.data as SavedSaleItem[];
}
