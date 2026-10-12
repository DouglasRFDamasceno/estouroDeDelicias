export const measureUnits = ['g', 'kg', 'ml', 'l', 'un'] as const;
export type MeasureUnit = (typeof measureUnits)[number];
export function measureFamily(unit: string) {
  if (unit === 'g' || unit === 'kg') return 'mass';
  if (unit === 'ml' || unit === 'l') return 'volume';
  if (unit === 'un') return 'count';
  throw Error('Unidade inválida.');
}
export function parseQuantity(value: string) {
  if (!/^\d{1,8}([,.]\d{1,3})?$/.test(value.trim()))
    throw Error(
      'Informe uma quantidade positiva, com até três casas decimais, sem separador de milhares.',
    );
  const number = Number(value.trim().replace(',', '.'));
  if (number <= 0 || number > 10000000)
    throw Error('A quantidade deve ser maior que zero e até 10.000.000.');
  return number;
}
export function ingredientCost(
  priceCents: number,
  bought: number,
  boughtUnit: string,
  used: number,
  usedUnit: string,
) {
  if (!Number.isSafeInteger(priceCents)) throw Error('Valores inválidos.');
  return recipeComponentCost(priceCents, bought, boughtUnit, used, usedUnit);
}
// Receitas base usam o custo sem arredondamento, inclusive em vários níveis.
export function recipeComponentCost(
  totalCents: number,
  produced: number,
  producedUnit: string,
  used: number,
  usedUnit: string,
) {
  if (measureFamily(producedUnit) !== measureFamily(usedUnit))
    throw Error('Use unidades compatíveis: g/kg, ml/l ou unidades.');
  if (
    !Number.isFinite(produced) ||
    produced <= 0 ||
    !Number.isFinite(used) ||
    used <= 0 ||
    !Number.isFinite(totalCents) ||
    totalCents < 0
  )
    throw Error('Valores inválidos.');
  const factor = (unit: string) => (unit === 'kg' || unit === 'l' ? 1000 : 1);
  return (totalCents * used * factor(usedUnit)) / (produced * factor(producedUnit));
}
export function parseCostPrice(value: string) {
  if (!/^\d{1,7}([,.]\d{1,2})?$/.test(value.trim()))
    throw Error('Informe o preço em reais, sem separador de milhares.');
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > 100000000) throw Error('O preço máximo é R$ 1.000.000,00.');
  return cents;
}
