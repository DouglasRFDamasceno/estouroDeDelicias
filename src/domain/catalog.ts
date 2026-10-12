export interface CatalogProduct {
  revision: number;
  id: string;
  name: string;
  category: string;
  presentation: string;
  price_cents: number;
  weight_grams?: number | null;
}
export interface ProductDraft {
  name: string;
  category: string;
  presentation: string;
  price: string;
  weight?: string;
}
export function parseProductDraft(draft: ProductDraft): Omit<CatalogProduct, 'id' | 'revision'> {
  const name = draft.name.trim();
  const category = draft.category.trim();
  const presentation = draft.presentation.trim();
  if (name.length < 2 || name.length > 120)
    throw new Error('Informe um nome de 2 a 120 caracteres.');
  if (category.length < 2 || category.length > 80)
    throw new Error('Informe uma categoria de 2 a 80 caracteres.');
  if (!presentation || presentation.length > 80)
    throw new Error('Informe a apresentação (até 80 caracteres).');
  const value = draft.price.trim();
  if (!/^\d{1,7}([,.]\d{1,2})?$/.test(value))
    throw new Error('Informe o preço em reais, por exemplo 16,00, sem separador de milhares.');
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const price_cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (price_cents > 100000000) throw new Error('O preço máximo é R$ 1.000.000,00.');
  let weight_grams: number | null = null;
  if (draft.weight?.trim()) {
    if (!/^\d{1,8}([,.]\d{1,3})?$/.test(draft.weight.trim()))
      throw Error('Informe o peso líquido em gramas, com até três casas decimais.');
    weight_grams = Number(draft.weight.trim().replace(',', '.'));
    if (weight_grams <= 0 || weight_grams > 10000000)
      throw Error('O peso líquido deve ser maior que zero e até 10.000.000 g.');
  }
  return {
    name,
    category,
    presentation,
    price_cents,
    ...(draft.weight !== undefined ? { weight_grams } : {}),
  };
}
