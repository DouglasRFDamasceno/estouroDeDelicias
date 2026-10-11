import { loadProducts, emptyProductFilters } from './products';
import { createCustomer, emptyCustomerFilters, loadCustomers } from './customers';
import { money } from '../domain/format';
import type { SearchOption } from '../components/SearchSelect';
import type { CatalogProduct } from '../domain/catalog';
export interface ProductOption extends SearchOption {
  product: CatalogProduct;
}
export async function searchSaleProducts(search: string, page: number, signal: AbortSignal) {
  const result = await loadProducts({
    page,
    pageSize: 10,
    sort: 'name',
    ascending: true,
    filters: { ...emptyProductFilters, name: search },
    signal,
  });
  return {
    rows: result.rows.map((p) => ({
      id: p.id,
      label: `${p.name} · ${p.presentation}`,
      description: `${p.category} · ${money(p.price_cents)}`,
      product: p,
    })),
    total: result.total,
  };
}
export async function searchSaleCustomers(search: string, page: number, signal: AbortSignal) {
  const result = await loadCustomers({
    page,
    pageSize: 10,
    sort: 'name',
    ascending: true,
    filters: { ...emptyCustomerFilters, name: search },
    signal,
  });
  return {
    rows: result.rows.map((c) => ({
      id: c.id,
      label: c.name,
      description: `Cliente · ${c.id.slice(0, 8)}`,
    })),
    total: result.total,
  };
}
export async function createSaleCustomer(name: string): Promise<SearchOption> {
  const customer = await createCustomer(name, AbortSignal.timeout(15000));
  return { id: customer.id, label: customer.name };
}
