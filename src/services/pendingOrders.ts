import { requireSupabase } from './supabase';
import { pageRange } from '../domain/pagination';
import type { CatalogProduct } from '../domain/catalog';
export type PendingItem = {
  product_id: string;
  name: string;
  presentation: string;
  quantity: number;
  unit_price_cents: number;
};
export type PendingOrder = {
  id: string;
  reference: number;
  customer: string;
  items: PendingItem[];
  total_cents: number;
  created_at: string;
  expires_at: string;
};
export async function loadPendingOrders(
  page: number,
  size: number,
  filter: string,
  signal: AbortSignal,
) {
  const { from, to } = pageRange(page, size);
  if (filter.length > 120) throw new Error('Filtro muito longo.');
  let query = requireSupabase()
    .from('pending_orders')
    .select('id,reference,customer,items,total_cents,created_at,expires_at', { count: 'exact' })
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());
  if (filter.trim()) {
    if (/^#?\d+$/.test(filter.trim()))
      query = query.eq('reference', filter.trim().replace('#', ''));
    else query = query.ilike('customer', `%${filter.trim().replace(/[\\%_]/g, '\\$&')}%`);
  }
  const result = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to)
    .abortSignal(signal);
  if (result.error) throw result.error;
  if (result.count === null) throw new Error('Não foi possível carregar os pedidos.');
  return { rows: result.data as PendingOrder[], total: result.count };
}
export async function reviewPendingOrder(order: PendingOrder, signal: AbortSignal) {
  const result = await requireSupabase()
    .from('products')
    .select('id,name,category,presentation,price_cents,revision')
    .in(
      'id',
      order.items.map((item) => item.product_id),
    )
    .order('id')
    .range(0, 38)
    .abortSignal(signal);
  if (result.error) throw new Error('Não foi possível consultar os produtos. Tente novamente.');
  return order.items.map((item) => {
    const product = (result.data as CatalogProduct[]).find(
      (product) => product.id === item.product_id,
    );
    if (!product)
      throw new Error(
        `O produto ${item.name} · ${item.presentation} foi removido. Cancele o pedido e combine uma nova seleção com o cliente.`,
      );
    return { ...product, quantity: item.quantity };
  });
}
export async function cancelPendingOrder(id: string) {
  const result = await requireSupabase()
    .rpc('cancel_pending_order', { p_order_id: id })
    .abortSignal(AbortSignal.timeout(15000));
  if (result.error) throw new Error('Não foi possível cancelar o pedido.');
}
