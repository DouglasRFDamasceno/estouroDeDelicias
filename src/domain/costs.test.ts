import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingredientCost, parseQuantity, parseCostPrice } from './costs.ts';
test('calcula chocolate, líquidos e embalagens com conversão de unidades', () => {
 assert.equal(ingredientCost(3000,1,'kg',200,'g'),600);
 assert.equal(ingredientCost(1200,2,'l',250,'ml'),150);
 assert.equal(ingredientCost(1000,100,'un',10,'un'),100);
 assert.equal(ingredientCost(3000,1000,'g',0.2,'kg'),600);
 assert.equal(ingredientCost(3000,1,'kg',200,'g') / 10,60);
 assert.equal(parseQuantity('0,125'),0.125);
 assert.equal(parseCostPrice('30,29'),3029);
});
test('rejeita unidades incompatíveis e entradas inválidas', () => {
 assert.throws(() => ingredientCost(3000,1,'kg',200,'ml'));
 assert.throws(() => ingredientCost(3000,0,'kg',200,'g'));
 for (const value of ['0','-1','NaN','Infinity','1e3','1.000,00','0,0001','10000001']) assert.throws(() => parseQuantity(value));
 for (const value of ['-1','30,009','1.000,00','Infinity','1000000,01']) assert.throws(() => parseCostPrice(value));
});
