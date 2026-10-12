import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingredientCost, parseQuantity, parseCostPrice, recipeComponentCost } from './costs.ts';
test('calcula chocolate, líquidos e embalagens com conversão de unidades', () => {
  assert.equal(ingredientCost(3000, 1, 'kg', 200, 'g'), 600);
  assert.equal(ingredientCost(1200, 2, 'l', 250, 'ml'), 150);
  assert.equal(ingredientCost(1000, 100, 'un', 10, 'un'), 100);
  assert.equal(ingredientCost(3000, 1000, 'g', 0.2, 'kg'), 600);
  assert.equal(ingredientCost(3000, 1, 'kg', 200, 'g') / 10, 60);
  assert.equal(parseQuantity('0,125'), 0.125);
  assert.equal(parseCostPrice('30,29'), 3029);
});
test('rejeita unidades incompatíveis e entradas inválidas', () => {
  assert.throws(() => ingredientCost(3000, 1, 'kg', 200, 'ml'));
  assert.throws(() => ingredientCost(3000, 0, 'kg', 200, 'g'));
  for (const value of ['0', '-1', 'NaN', 'Infinity', '1e3', '1.000,00', '0,0001', '10000001'])
    assert.throws(() => parseQuantity(value));
  for (const value of ['-1', '30,009', '1.000,00', 'Infinity', '1000000,01'])
    assert.throws(() => parseCostPrice(value));
});
test('receita base contribui proporcionalmente ao rendimento, sem arredondamento intermediário', () => {
  assert.equal(recipeComponentCost(2000, 1, 'kg', 300, 'g'), 600);
  assert.equal(recipeComponentCost(2000, 1000, 'g', 0.3, 'kg'), 600);
  assert.equal(recipeComponentCost(2000, 10, 'un', 2, 'un'), 400);
  const base = recipeComponentCost(1, 3, 'un', 1, 'un');
  assert.equal(recipeComponentCost(base, 1, 'un', 3, 'un'), 1);
  assert.equal(recipeComponentCost(0, 1, 'kg', 300, 'g'), 0);
  assert.throws(() => recipeComponentCost(2000, 1, 'kg', 300, 'ml'));
  assert.throws(() => recipeComponentCost(NaN, 1, 'kg', 300, 'g'));
  assert.throws(() => recipeComponentCost(2000, 0, 'kg', 300, 'g'));
  assert.throws(() => ingredientCost(base, 1, 'un', 1, 'un'));
});
