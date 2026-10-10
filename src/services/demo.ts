import type { Product, Sale } from '../types/business';
export const products: Product[] = [
{ id: '1', name: 'Pipoca caramelizada · 100 g', priceCents: 1500, costCents: 600 },
{ id: '2', name: 'Pipoca de chocolate · 100 g', priceCents: 1800, costCents: 800 },
{ id: '3', name: 'Kit presente · 3 sabores', priceCents: 4800, costCents: 2100 }];
export const sales: Sale[] = [
{ id: '001', customer: 'Mariana Costa', date: '2026-10-09', totalCents: 9600, receivedCents: 9600, costCents: 4200 },
{ id: '002', customer: 'Café da Praça', date: '2026-10-08', totalCents: 36000, receivedCents: 18000, costCents: 16000 },
{ id: '003', customer: 'Ana Oliveira', date: '2026-10-06', totalCents: 15000, receivedCents: 0, costCents: 6000 }];
export const expenses = [{ name: 'Embalagens administrativas', cents: 3200 }, { name: 'Internet · outubro', cents: 9900 }];
export const customers = ['Mariana Costa', 'Café da Praça', 'Ana Oliveira'];
