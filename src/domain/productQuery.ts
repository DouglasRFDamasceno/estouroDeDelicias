import { pageRange, pageSizes } from './pagination.ts';
import type { ProductFilters, ProductSort } from '../services/products';

export const productSortColumns = ['name', 'category', 'presentation', 'price_cents'] as const;
export function readProductQuery(params: URLSearchParams) {
  const requestedSize = Number(params.get('size') ?? 10);
  const pageSize = pageSizes.includes(requestedSize as (typeof pageSizes)[number])
    ? requestedSize
    : 10;
  let page = Number(params.get('page') ?? 1);
  try {
    pageRange(page, pageSize);
  } catch {
    page = 1;
  }
  const requestedSort = params.get('sort') as ProductSort;
  const sort = {
    column: productSortColumns.includes(requestedSort) ? requestedSort : ('name' as ProductSort),
    ascending: params.get('direction') !== 'desc',
  };
  const filters: ProductFilters = {
    name: (params.get('name') ?? '').trim().slice(0, 120),
    category: (params.get('category') ?? '').trim().slice(0, 120),
    presentation: (params.get('presentation') ?? '').trim().slice(0, 120),
  };
  return { page, pageSize, sort, filters };
}
