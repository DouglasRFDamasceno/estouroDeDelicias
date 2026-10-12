import { searchPattern } from '../domain/search';
import { requireSupabase } from './supabase';
import { pageRange } from '../domain/pagination';
import type { MeasureUnit } from '../domain/costs';
import { money } from '../domain/format';
import type { SearchOption } from '../components/SearchSelect';
export interface Material {
  id: string;
  name: string;
  purchase_quantity: number;
  purchase_unit: MeasureUnit;
  price_cents: number;
  revision: number;
}
export interface Recipe {
  id: string;
  name: string;
  product_id: string | null;
  product_label: string;
  yield_quantity: number;
  notes: string;
  revision: number;
  total_cents: number;
  unit_cost_cents: number;
}
export interface RecipeLine {
  material: Material;
  quantity: string;
  unit: MeasureUnit;
}
export type CostSection = 'materials' | 'recipes';
export async function loadCostRows(
  section: CostSection,
  page: number,
  pageSize: number,
  name: string,
  sort: string,
  ascending: boolean,
  signal: AbortSignal,
) {
  const { from, to } = pageRange(page, pageSize);
  const allowed =
    section === 'materials' ? ['name', 'price_cents'] : ['name', 'total_cents', 'unit_cost_cents'];
  if (!allowed.includes(sort) || name.length > 120) throw Error('Consulta inválida');
  const columns =
    section === 'materials'
      ? 'id,name,purchase_quantity,purchase_unit,price_cents,revision'
      : 'id,name,product_id,product_label,yield_quantity,notes,revision,total_cents,unit_cost_cents';
  let query = requireSupabase()
    .from(section === 'materials' ? 'materials' : 'recipe_costs')
    .select(columns, { count: 'exact' });
  if (name.trim()) query = query.ilike('name_search', searchPattern(name));
  const result = await query
    .order(sort, { ascending })
    .order('id')
    .range(from, to)
    .abortSignal(signal);
  if (result.error || result.count === null) throw result.error ?? Error('Contagem indisponível');
  return { rows: result.data as unknown as (Material | Recipe)[], total: result.count };
}
export interface MaterialOption extends SearchOption {
  material: Material;
}
export async function searchMaterials(search: string, page: number, signal: AbortSignal) {
  const result = await loadCostRows('materials', page, 10, search, 'name', true, signal);
  return {
    rows: (result.rows as Material[]).map((m) => ({
      id: m.id,
      label: m.name,
      description: `${m.purchase_quantity} ${m.purchase_unit} por ${money(m.price_cents)}`,
      material: m,
    })),
    total: result.total,
  };
}
export async function loadRecipeLines(id: string, signal: AbortSignal): Promise<RecipeLine[]> {
  const result = await requireSupabase()
    .from('recipe_items')
    .select(
      'quantity,unit,material:materials(id,name,purchase_quantity,purchase_unit,price_cents,revision)',
    )
    .eq('recipe_id', id)
    .order('id')
    .range(0, 49)
    .abortSignal(signal);
  if (result.error) throw result.error;
  const rows = result.data as unknown as {
    quantity: number;
    unit: MeasureUnit;
    material: Material | null;
  }[];
  if (rows.some((r) => !r.material)) throw Error('Insumo indisponível');
  return rows.map((r) => ({
    material: r.material!,
    quantity: String(r.quantity).replace('.', ','),
    unit: r.unit,
  }));
}
