import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardPeriod, validateDashboardPeriod } from './dashboard.ts';
test('período inicial usa o mês e a data de São Paulo', () => {
  assert.deepEqual(dashboardPeriod(new Date('2026-11-01T01:00:00Z')), {
    from: '2026-10-01',
    until: '2026-10-31',
  });
  validateDashboardPeriod('2024-01-01', '2024-12-31');
  validateDashboardPeriod('2026-10-10', '2026-10-10');
});
test('rejeita datas inexistentes, períodos invertidos e extensos', () => {
  for (const [from, until] of [
    ['2026-02-30', '2026-03-01'],
    ['2026-10-11', '2026-10-10'],
    ['2026-01-01', '2027-01-02'],
    ['', '2026-10-10'],
  ])
    assert.throws(() => validateDashboardPeriod(from, until));
});
