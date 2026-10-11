import { requireSupabase } from './supabase';
import { pageRange } from '../domain/pagination';
import type { CatalogProduct } from '../domain/catalog';
export const productSortColumns = ['name', 'category', 'presentation', 'price_cents'] as const;
export type ProductSort = typeof productSortColumns[number];
export interface ProductFilters { name: string; category: string; presentation: string; }
export const emptyProductFilters: ProductFilters = { name: '', category: '', presentation: '' };
export async function loadProducts(options: { page: number; pageSize: number; sort: ProductSort; ascending: boolean; filters: ProductFilters; signal: AbortSignal }) {
  const { from, to } = pageRange(options.page, options.pageSize);
  if (!productSortColumns.includes(options.sort)) throw new Error('Ordenação inválida.');
  let query = requireSupabase().from('products').select('id,name,category,presentation,price_cents', { count: 'exact' });
  for (const column of ['name', 'category', 'presentation'] as const) {
    const value = options.filters[column].trim();
    if (value.length > 120) throw new Error('Filtro muito longo.');
    if (value) query = query.ilike(column, `%${value.replace(/[\\%_]/g, '\\$&')}%`);
  }
  const result = await query.order(options.sort, { ascending: options.ascending }).order('id', { ascending: true }).range(from, to).abortSignal(options.signal);
  if (result.error) throw result.error;
  if (result.count === null) throw new Error('Contagem indisponível.');
  return { rows: result.data as CatalogProduct[], total: result.count };
}
