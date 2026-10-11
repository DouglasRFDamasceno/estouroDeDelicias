/** Dinheiro em centavos inteiros; quantidades inteiras nesta primeira versão. */
export interface Sale {
  id: string;
  customer: string;
  date: string;
  totalCents: number;
  receivedCents: number;
  costCents: number;
}
export interface Product {
  id: string;
  name: string;
  priceCents: number;
  costCents: number;
}
