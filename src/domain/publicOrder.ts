import { orderItemPrice, landingFlavors, packageSizes } from './landingCatalog.ts';
import type { LandingOrderItem } from './landingCatalog.ts';

export type PublicOrder = { customer: string; items: LandingOrderItem[] };
export function cleanOrderCustomer(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('');
}
const invalid = () => new Error('Confira seu nome, os sabores e as quantidades do pedido.');
export function validateOrder(value: unknown): PublicOrder {
  if (!value || typeof value !== 'object') throw invalid();
  const { customer, items } = value as PublicOrder;
  if (
    typeof customer !== 'string' ||
    customer.trim().length < 2 ||
    customer.length > 120 ||
    cleanOrderCustomer(customer) !== customer
  )
    throw invalid();
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.length > landingFlavors.length * packageSizes.length
  )
    throw invalid();
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') throw invalid();
    try {
      orderItemPrice(item);
    } catch {
      throw invalid();
    }
    const key = `${item.flavor}:${item.size}`;
    if (seen.has(key)) throw invalid();
    seen.add(key);
  }
  return {
    customer: customer.trim(),
    items: items.map(({ flavor, size, quantity }) => ({ flavor, size, quantity })),
  };
}
