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
  category: string | null;
  base_category: string | null;
  yield_quantity: number;
  output_quantity: number;
  output_unit: MeasureUnit;
  notes: string;
  revision: number;
  total_cents: number;
  unit_cost_cents: number;
  raw_total_cents: number;
}
export type RecipeLine = (
  { kind: 'material'; material: Material } | { kind: 'recipe'; recipe: Recipe }
) & {
  quantity: string;
  unit: MeasureUnit;
};
export type CostSection = 'materials' | 'recipes';
const recipeColumns =
  'id,name,product_id,product_label,category,base_category,yield_quantity,output_quantity,output_unit,notes,revision,total_cents,unit_cost_cents,raw_total_cents';
export async function loadCostRows(
  section: CostSection,
  page: number,
  pageSize: number,
  name: string,
  sort: string,
  ascending: boolean,
  signal: AbortSignal,
  category: string | null = null,
) {
  const { from, to } = pageRange(page, pageSize);
  const allowed =
    section === 'materials'
      ? ['name', 'price_cents']
      : ['name', 'category', 'total_cents', 'unit_cost_cents'];
  if (!allowed.includes(sort) || name.length > 120 || (category?.length ?? 0) > 80)
    throw Error('Consulta inválida');
  const columns =
    section === 'materials'
      ? 'id,name,purchase_quantity,purchase_unit,price_cents,revision'
      : recipeColumns;
  let query = requireSupabase()
    .from(section === 'materials' ? 'materials' : 'recipe_costs')
    .select(columns, { count: 'exact' });
  if (name.trim()) query = query.ilike('name_search', searchPattern(name));
  if (section === 'recipes' && category !== null) query = query.eq('category', category);
  const result = await query
    .order(sort, { ascending })
    .order('id')
    .range(from, to)
    .abortSignal(signal);
  if (result.error || result.count === null) throw result.error ?? Error('Contagem indisponível');
  return { rows: result.data as unknown as (Material | Recipe)[], total: result.count };
}
export async function searchRecipeCategories(search: string, page: number, signal: AbortSignal) {
  const { from, to } = pageRange(page, 10);
  if (search.length > 120) throw Error('Consulta inválida');
  let query = requireSupabase().from('recipe_categories').select('category', { count: 'exact' });
  if (search.trim()) query = query.ilike('category_search', searchPattern(search));
  const result = await query.order('category').range(from, to).abortSignal(signal);
  if (result.error || result.count === null) throw result.error ?? Error('Contagem indisponível');
  return {
    rows: result.data.map(({ category }: { category: string }) => ({
      id: category,
      label: category,
    })),
    total: result.count,
  };
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
      'quantity,unit,component_recipe_id,material:materials(id,name,purchase_quantity,purchase_unit,price_cents,revision)',
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
    component_recipe_id: string | null;
  }[];
  const recipeIds = rows.flatMap((r) => (r.component_recipe_id ? [r.component_recipe_id] : []));
  const bases = new Map<string, Recipe>();
  if (recipeIds.length) {
    const result = await requireSupabase()
      .from('recipe_costs')
      .select(recipeColumns)
      .in('id', recipeIds)
      .order('id')
      .range(0, 49)
      .abortSignal(signal);
    if (result.error) throw result.error;
    for (const base of result.data as Recipe[]) bases.set(base.id, base);
  }
  return rows.map((r): RecipeLine => {
    const values = { quantity: String(r.quantity).replace('.', ','), unit: r.unit };
    if (r.material) return { ...values, kind: 'material', material: r.material };
    const base = r.component_recipe_id ? bases.get(r.component_recipe_id) : null;
    if (!base) throw Error('Componente da receita indisponível');
    return { ...values, kind: 'recipe', recipe: base };
  });
}
export async function loadRecipeForCopy(id: string, signal: AbortSignal) {
  const [result, lines] = await Promise.all([
    requireSupabase()
      .from('recipe_costs')
      .select(recipeColumns)
      .eq('id', id)
      .abortSignal(signal)
      .single(),
    loadRecipeLines(id, signal),
  ]);
  if (result.error || !result.data) throw result.error ?? Error('Receita indisponível');
  if (!lines.length) throw Error('Esta receita não possui componentes para copiar.');
  return { recipe: result.data as Recipe, lines };
}
export interface RecipeOption extends SearchOption {
  recipe: Recipe;
}
export async function searchRecipes(
  search: string,
  page: number,
  signal: AbortSignal,
  excludeId: string,
) {
  const { from, to } = pageRange(page, 10);
  if (search.length > 120) throw Error('Consulta inválida');
  let query = requireSupabase()
    .from('recipe_costs')
    .select(recipeColumns, { count: 'exact' })
    .neq('id', excludeId);
  if (search.trim()) query = query.ilike('name_search', searchPattern(search));
  const result = await query.order('name').order('id').range(from, to).abortSignal(signal);
  if (result.error || result.count === null) throw result.error ?? Error('Contagem indisponível');
  return {
    rows: (result.data as Recipe[]).map((r) => ({
      id: r.id,
      label: r.name,
      description: `Rende ${r.output_quantity} ${r.output_unit} por ${money(r.total_cents)}`,
      recipe: r,
    })),
    total: result.count,
  };
}
