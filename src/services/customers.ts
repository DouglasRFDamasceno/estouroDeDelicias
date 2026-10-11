import { requireSupabase } from './supabase';
import { pageRange } from '../domain/pagination';
export interface Customer { id: string; name: string; created_at: string; revision: number; }
export const customerSortColumns = ['name', 'created_at'] as const;
export type CustomerSort = typeof customerSortColumns[number];
export interface CustomerFilters { name: string; from: string; until: string; }
export const emptyCustomerFilters: CustomerFilters = { name: '', from: '', until: '' };
export async function loadCustomers(options: { page: number; pageSize: number; sort: CustomerSort; ascending: boolean; filters: CustomerFilters; signal: AbortSignal }) {
 const { from, to } = pageRange(options.page, options.pageSize);
 if (!customerSortColumns.includes(options.sort)) throw Error('Ordenação inválida.');
 const filters = options.filters;
 if (filters.name.length > 120) throw Error('Nome muito longo.');
 for (const value of [filters.from, filters.until]) if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')))) throw Error('Data inválida.');
 if (filters.from && filters.until && filters.from > filters.until) throw Error('A data inicial deve ser anterior à final.');
 let query = requireSupabase().from('customers').select('id,name,created_at,revision', { count: 'exact' });
 if (filters.name.trim()) query = query.ilike('name', `%${filters.name.trim().replace(/[\\%_]/g, '\\$&')}%`);
 if (filters.from) query = query.gte('created_at', filters.from + 'T00:00:00Z');
 if (filters.until) {
  const nextDay = new Date(filters.until + 'T00:00:00Z'); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  query = query.lt('created_at', nextDay.toISOString());
 }
 const result = await query.order(options.sort, { ascending: options.ascending }).order('id').range(from, to).abortSignal(options.signal);
 if (result.error || result.count === null) throw result.error ?? Error('Contagem indisponível.');
 return { rows: result.data as Customer[], total: result.count };
}
export async function createCustomer(name: string, signal?: AbortSignal): Promise<Customer> {
 const trimmed = name.trim(); if (trimmed.length < 2 || trimmed.length > 120) throw Error('Informe um nome de 2 a 120 caracteres.');
 let query = requireSupabase().from('customers').insert({ name: trimmed }).select('id,name,created_at,revision');
 if (signal) query = query.abortSignal(signal);
 const result = await query.single();
 if (result.error) throw result.error;
 return result.data as Customer;
}

export async function updateCustomer(customer: Customer, name: string, signal: AbortSignal) {
 const trimmed = name.trim(); if (trimmed.length < 2 || trimmed.length > 120) throw Error('Nome inválido');
 const result = await requireSupabase().from('customers').update({ name: trimmed }).eq('id', customer.id).eq('revision', customer.revision).select('id').abortSignal(signal).single();
 if (result.error || !result.data) throw result.error ?? Error('Registro alterado');
}
