import type { Sale } from '../types/business.ts';
export function metrics(sales: readonly Sale[], expenseCents: number) {
  const revenue = sales.reduce((sum, s) => sum + s.totalCents, 0);
  const received = sales.reduce((sum, s) => sum + s.receivedCents, 0);
  const cost = sales.reduce((sum, s) => sum + s.costCents, 0);
  return { revenue, received, receivable: revenue - received, cost, expenses: expenseCents, result: revenue - cost - expenseCents };
}
