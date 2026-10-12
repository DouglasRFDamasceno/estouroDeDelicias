import { useManagementRefresh } from './ManagementRefresh';
import { ActionIconButton } from './ActionIconButton';
import { ClearableInput } from './ClearableInput';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { money } from '../domain/format';
import { measureUnits, parseCostPrice, parseQuantity } from '../domain/costs';
import type { MeasureUnit } from '../domain/costs';
import { totalPages } from '../domain/pagination';
import { requireSupabase } from '../services/supabase';
import {
  loadCostRows,
  loadRecipeForCopy,
  loadRecipeLines,
  loadRecipePresentations,
  recipeLineCost,
  searchRecipeCategories,
  searchRecipes,
} from '../services/costs';
import type {
  CostSection,
  Material,
  Recipe,
  RecipeLine,
  RecipeOption,
  RecipePresentation,
} from '../services/costs';
import { searchSaleProducts } from '../services/saleOptions';
import type { ProductOption } from '../services/saleOptions';
import { removeRecord } from '../services/management';
import { SearchSelect } from './SearchSelect';
import type { SearchOption } from './SearchSelect';
import { Pagination } from './Pagination';
import { ConfirmRemove } from './ConfirmRemove';
import { RecipeLinesEditor } from './RecipeLinesEditor';
import { RecipePresentations } from './RecipePresentations';
export function Costs() {
  const { identity, identityLoading } = useAuth();
  const [section, setSection] = useState<CostSection>('recipes');
  if (identityLoading) return <p role="status">Carregando acesso…</p>;
  if (!identity?.isAdmin)
    return (
      <section className="panel">
        <p>O cadastro de custos é exclusivo para administradores.</p>
      </section>
    );
  return (
    <>
      <div className="cost-tabs" role="tablist" aria-label="Cadastros de custos">
        {(
          [
            ['recipes', 'Receitas e custos'],
            ['materials', 'Insumos'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            id={`cost-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={section === key}
            aria-controls={`cost-panel-${key}`}
            tabIndex={section === key ? 0 : -1}
            onClick={() => setSection(key)}
            onKeyDown={(event) => {
              let next: CostSection;
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                next = key === 'materials' ? 'recipes' : 'materials';
              } else if (event.key === 'Home') {
                next = 'recipes';
              } else if (event.key === 'End') {
                next = 'materials';
              } else {
                return;
              }
              event.preventDefault();
              setSection(next);
              document.getElementById(`cost-tab-${next}`)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="fine">
        Cadastre a compra de referência do insumo e depois a quantidade usada na receita. Exemplo: 1
        kg de chocolate por R$ 30,00 → 200 g custam R$ 6,00.
      </p>
      {(['recipes', 'materials'] as const).map((key) => (
        <div
          key={key}
          id={`cost-panel-${key}`}
          role="tabpanel"
          aria-labelledby={`cost-tab-${key}`}
          hidden={section !== key}
          tabIndex={0}
        >
          {section === key && <CostList section={key} />}
        </div>
      ))}
    </>
  );
}
function CostList({ section }: { section: CostSection }) {
  const { refreshVersion, trackRefresh } = useManagementRefresh();
  const [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [sort, setSort] = useState('name'),
    [ascending, setAscending] = useState(true);
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [category, setCategory] = useState<SearchOption | null>(null),
    [categoryFilter, setCategoryFilter] = useState<string | null>(null),
    [materialCategory, setMaterialCategory] = useState(''),
    [retry, setRetry] = useState(0),
    [rows, setRows] = useState<(Material | Recipe)[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Material | Recipe | null>(null),
    [removing, setRemoving] = useState<Material | Recipe | null>(null),
    [message, setMessage] = useState('');
  const materials = section === 'materials';
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setRows([]);
    setError('');
    trackRefresh(
      loadCostRows(section, page, size, filter, sort, ascending, controller.signal, categoryFilter)
        .then((r) => {
          if (!active) return;
          if (page > totalPages(r.total, size)) {
            setPage(totalPages(r.total, size));
            return;
          }
          setRows(r.rows);
          setTotal(r.total);
        })
        .catch((e) => {
          if (active) {
            if (e?.code === 'PGRST103' && page > 1) {
              setPage(1);
              return;
            }
            setError('Não foi possível carregar os cadastros. Confira a conexão.');
          }
        })
        .finally(() => {
          clearTimeout(timer);
          if (active) setLoading(false);
        }),
    );
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    section,
    page,
    size,
    filter,
    categoryFilter,
    sort,
    ascending,
    retry,
    refreshVersion,
    trackRefresh,
  ]);
  function saved() {
    setOpen(false);
    setEditing(null);
    setRetry((v) => v + 1);
    setMessage('Cadastro salvo com sucesso.');
  }
  const columns = materials
    ? [
        ['name', 'Insumo'],
        ['category', 'Categoria'],
        ['price_cents', 'Preço de compra'],
      ]
    : [
        ['name', 'Receita'],
        ['category', 'Categoria'],
        ['total_cents', 'Custo da receita'],
        ['unit_cost_cents', 'Custo por unidade'],
      ];
  return (
    <section className="panel products-panel sales-panel">
      <div className="panel-heading">
        <div>
          <h2>{materials ? 'Insumos e compras de referência' : 'Receitas dos produtos'}</h2>
          <p>
            {materials
              ? 'Ingredientes, embalagens e outros materiais de produção.'
              : 'Custos calculados com os preços atuais dos insumos.'}
          </p>
        </div>
        <button
          type="button"
          className="sale-primary"
          onClick={() => {
            setMessage('');
            setOpen(true);
          }}
        >
          {materials ? '+ Novo insumo' : '+ Nova receita'}
        </button>
      </div>
      <form
        className="sale-filter"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter(search);
          setCategoryFilter(materials ? materialCategory : (category?.id ?? null));
          setPage(1);
        }}
      >
        <label>
          Buscar por nome
          <ClearableInput
            label="Buscar por nome"
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => {
              setSearch('');
            }}
          />
        </label>
        {materials && (
          <label>
            Filtrar por categoria
            <ClearableInput
              label="Filtrar por categoria"
              value={materialCategory}
              maxLength={80}
              placeholder="Ex.: Chocolates, Embalagens"
              onChange={(e) => setMaterialCategory(e.target.value)}
              onClear={() => setMaterialCategory('')}
            />
          </label>
        )}
        {!materials && (
          <SearchSelect
            label="Filtrar por categoria"
            showHint={false}
            value={category}
            load={searchRecipeCategories}
            onSelect={(option) => {
              setCategory(option);
              setCategoryFilter(option?.id ?? null);
              setPage(1);
            }}
            placeholder="Todas as categorias"
          />
        )}
        <button>Filtrar</button>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setFilter('');
            setCategory(null);
            setMaterialCategory('');
            setCategoryFilter(null);
            setPage(1);
          }}
        >
          Limpar
        </button>
      </form>
      {loading ? (
        <p role="status">Carregando…</p>
      ) : error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Tentar novamente
          </button>
        </p>
      ) : (
        <>
          <div className="product-table-scroll">
            <table className="product-table">
              <caption className="sr-only">
                {materials ? 'Insumos cadastrados' : 'Receitas cadastradas'}
              </caption>
              <thead>
                <tr>
                  {columns.map(([key, label]) => (
                    <th
                      scope="col"
                      key={key}
                      aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSort(key);
                          setAscending(sort === key ? !ascending : true);
                          setPage(1);
                        }}
                      >
                        {label}
                        <span aria-hidden="true">
                          {sort === key ? (ascending ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th scope="col">{materials ? 'Quantidade comprada' : 'Produto e rendimento'}</th>
                  <th scope="col" className="table-actions">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.name}</th>
                    {'price_cents' in row ? (
                      <>
                        <td>{row.category || 'Sem categoria'}</td>
                        <td>{money(row.price_cents)}</td>
                        <td>
                          {row.purchase_quantity} {row.purchase_unit}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{row.category ?? 'Sem categoria'}</td>
                        <td>{money(row.total_cents)}</td>
                        <td>
                          {row.cost_mode === 'weight' && row.presentation_count > 0
                            ? 'Por apresentação'
                            : row.product_id && row.unit_cost_cents !== null
                              ? money(row.unit_cost_cents)
                              : '—'}
                        </td>
                        <td>
                          {row.cost_mode === 'weight' && row.presentation_count > 0
                            ? `${row.presentation_count} apresentações`
                            : row.product_label}
                          <small className="cost-detail">
                            Rende {row.output_quantity} {row.output_unit}
                            {row.cost_mode === 'units' &&
                              row.product_id &&
                              ` · ${row.yield_quantity} unidades de venda`}
                          </small>
                        </td>
                      </>
                    )}
                    <td className="table-actions">
                      <ActionIconButton
                        action="edit"
                        label={`Editar ${row.name}`}
                        onClick={() => setEditing(row)}
                      />{' '}
                      <ActionIconButton
                        action="remove"
                        label={`Remover ${row.name}`}
                        onClick={() => setRemoving(row)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <p>Nenhum cadastro encontrado.</p>}
          <Pagination
            page={page}
            pageSize={size}
            total={total}
            onPage={setPage}
            onPageSize={(v) => {
              setSize(v);
              setPage(1);
            }}
          />
        </>
      )}
      <p role="status">{message}</p>
      {(open || editing) &&
        (materials ? (
          <MaterialModal
            material={editing as Material | null}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
            onSaved={saved}
          />
        ) : (
          <RecipeModal
            recipe={editing as Recipe | null}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
            onSaved={saved}
          />
        ))}
      {removing && (
        <ConfirmRemove
          description={`Remover ${removing.name}? ${materials ? 'Insumos usados na preparação ou nas embalagens precisam ser retirados das receitas antes da exclusão.' : 'Receitas usadas como base precisam ser retiradas das outras receitas antes da exclusão. Os itens e vínculos de apresentações desta receita também serão removidos.'}`}
          remove={() => removeRecord(section, removing.id, removing.revision)}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            setRetry((v) => v + 1);
            setMessage('Cadastro removido.');
          }}
        />
      )}
    </section>
  );
}
function MaterialModal({
  material,
  onClose,
  onSaved,
}: {
  material: Material | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    saving = useRef(false),
    active = useRef(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    return () => {
      active.current = false;
    };
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving.current) return;
    const form = new FormData(e.currentTarget);
    let values;
    try {
      const name = String(form.get('name')).trim();
      if (name.length < 2 || name.length > 120)
        throw Error('Informe um nome de 2 a 120 caracteres.');
      const category = String(form.get('category') ?? '').trim();
      if (category && (category.length < 2 || category.length > 80))
        throw Error('Informe uma categoria de 2 a 80 caracteres ou deixe em branco.');
      values = {
        name,
        category,
        purchase_quantity: parseQuantity(String(form.get('quantity'))),
        purchase_unit: String(form.get('unit')),
        price_cents: parseCostPrice(String(form.get('price'))),
      };
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Confira os campos');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const client = requireSupabase();
      const query = material
        ? client
            .from('materials')
            .update(values)
            .eq('id', material.id)
            .eq('revision', material.revision)
        : client.from('materials').insert(values);
      const result = await query.select('id').abortSignal(AbortSignal.timeout(15000)).single();
      if (result.error || !result.data) throw result.error;
      if (active.current) onSaved();
    } catch (issue) {
      if (active.current)
        setError(
          issue &&
            typeof issue === 'object' &&
            'code' in issue &&
            issue.code === 'P0001' &&
            'message' in issue
            ? String(issue.message)
            : 'Não foi possível confirmar. Feche e consulte a lista antes de repetir; o cadastro pode ter sido salvo ou alterado por outra sessão.',
        );
    } finally {
      saving.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="sale-dialog customer-dialog"
      aria-labelledby="material-title"
      onCancel={(e) => {
        if (saving.current) e.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={save}>
        <div className="form-heading">
          <h2 id="material-title">{material ? 'Editar insumo' : 'Novo insumo'}</h2>
          <button
            type="button"
            className="form-close"
            disabled={busy}
            onClick={onClose}
            aria-label="Fechar formulário de insumo"
            title="Fechar"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <fieldset disabled={busy}>
          <label>
            Nome do insumo
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              autoFocus
              defaultValue={material?.name}
              placeholder="Chocolate, leite, embalagem…"
            />
          </label>
          <label>
            Categoria do insumo (opcional)
            <input
              name="category"
              maxLength={80}
              defaultValue={material?.category ?? ''}
              placeholder="Ex.: Chocolates, Frutas, Embalagens"
            />
          </label>
          <p className="fine">
            Os insumos aparecem agrupados por esta categoria dentro da receita.
          </p>
          <div className="sale-fields">
            <label>
              Quantidade comprada
              <input
                name="quantity"
                required
                inputMode="decimal"
                defaultValue={material ? String(material.purchase_quantity).replace('.', ',') : ''}
                placeholder="1"
              />
            </label>
            <label>
              Unidade de compra
              <select name="unit" defaultValue={material?.purchase_unit ?? 'kg'}>
                {measureUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Preço total da compra (R$)
            <input
              name="price"
              required
              inputMode="decimal"
              defaultValue={
                material ? (material.price_cents / 100).toFixed(2).replace('.', ',') : ''
              }
              placeholder="30,00"
            />
          </label>
          <p className="fine">
            O preço corresponde à quantidade inteira informada. Atualizar essa referência recalcula
            os custos das receitas que usam este insumo.
          </p>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="sale-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="sale-primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar insumo'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function RecipeModal({
  recipe,
  onClose,
  onSaved,
}: {
  recipe: Recipe | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    nameInput = useRef<HTMLInputElement>(null),
    copyPanel = useRef<HTMLDetailsElement>(null),
    copyButton = useRef<HTMLButtonElement>(null),
    keepDraftButton = useRef<HTMLButtonElement>(null),
    restoreCopyFocus = useRef(false),
    copyController = useRef<AbortController | null>(null),
    saving = useRef(false),
    active = useRef(true),
    id = useRef(recipe?.id ?? crypto.randomUUID()),
    request = useRef(crypto.randomUUID()),
    payload = useRef<Record<string, unknown> | null>(null);
  const [name, setName] = useState(recipe?.name ?? ''),
    [legacyProduct, setLegacyProduct] = useState<
      (SearchOption & { category: string | null }) | null
    >(
      recipe?.product_id
        ? { id: recipe.product_id, label: recipe.product_label, category: recipe.category }
        : null,
    ),
    [baseCategory, setBaseCategory] = useState<SearchOption | null>(
      recipe?.category ? { id: recipe.category, label: recipe.category } : null,
    ),
    [yieldQuantity, setYield] = useState(String(recipe?.yield_quantity ?? 1)),
    [outputQuantity, setOutputQuantity] = useState(
      String(recipe?.output_quantity ?? 1).replace('.', ','),
    ),
    [outputUnit, setOutputUnit] = useState<MeasureUnit>(recipe?.output_unit ?? 'kg'),
    [notes, setNotes] = useState(recipe?.notes ?? '');
  const [costMode, setCostMode] = useState<'units' | 'weight'>(recipe?.cost_mode ?? 'weight');
  const [presentations, setPresentations] = useState<RecipePresentation[]>([]);
  const product =
    costMode === 'weight'
      ? presentations[0]
        ? {
            id: presentations[0].product.id,
            label: `${presentations[0].product.name} · ${presentations[0].product.presentation}`,
            category: presentations[0].product.category,
          }
        : null
      : legacyProduct;
  const [lines, setLines] = useState<RecipeLine[]>([]),
    [loading, setLoading] = useState(Boolean(recipe)),
    [loadError, setLoadError] = useState(false),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState('');
  const [copySource, setCopySource] = useState<Recipe | null>(null),
    [pendingCopy, setPendingCopy] = useState<Recipe | null>(null),
    [copying, setCopying] = useState(false),
    [copyError, setCopyError] = useState(''),
    [copyStatus, setCopyStatus] = useState('');
  const loadBases = useCallback(
    (search: string, page: number, signal: AbortSignal) =>
      searchRecipes(search, page, signal, id.current),
    [],
  );
  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    return () => {
      active.current = false;
      copyController.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (pendingCopy) keepDraftButton.current?.focus();
    else if (restoreCopyFocus.current) {
      restoreCopyFocus.current = false;
      copyButton.current?.focus();
    }
  }, [pendingCopy]);
  useEffect(() => {
    if (!copying && copyStatus) {
      nameInput.current?.focus();
      nameInput.current?.select();
    }
  }, [copying, copyStatus]);
  async function copyRecipe(source: Recipe) {
    if (saving.current || copyController.current || uncertain) return;
    const controller = new AbortController();
    copyController.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    setPendingCopy(null);
    setCopying(true);
    setCopyError('');
    setCopyStatus('');
    try {
      const copied = await loadRecipeForCopy(source.id, controller.signal);
      if (!active.current) return;
      if (controller.signal.aborted) throw Error('Cópia interrompida');
      setName(`Cópia de ${copied.recipe.name}`.slice(0, 120));
      setLegacyProduct(null);
      setPresentations([]);
      setCostMode(copied.recipe.cost_mode);
      setBaseCategory(
        copied.recipe.category
          ? { id: copied.recipe.category, label: copied.recipe.category }
          : null,
      );
      setYield(String(copied.recipe.yield_quantity));
      setOutputQuantity(String(copied.recipe.output_quantity).replace('.', ','));
      setOutputUnit(copied.recipe.output_unit);
      setNotes(copied.recipe.notes);
      setLines(copied.lines);
      setError('');
      setCopyStatus(
        `Receita “${copied.recipe.name}” copiada para o formulário. Revise o nome e escolha as apresentações e embalagens da nova receita. A original permanece igual.`,
      );
      if (copyPanel.current) copyPanel.current.open = false;
    } catch {
      if (active.current)
        setCopyError(
          'Não foi possível copiar a receita. Seu preenchimento foi mantido. Tente novamente ou escolha outra receita.',
        );
    } finally {
      clearTimeout(timer);
      copyController.current = null;
      if (active.current) setCopying(false);
    }
  }
  function requestCopy() {
    if (!copySource || copying || saving.current || uncertain) return;
    const hasDraft =
      name !== '' ||
      product !== null ||
      presentations.length > 0 ||
      costMode !== 'weight' ||
      baseCategory !== null ||
      lines.length > 0 ||
      notes !== '' ||
      yieldQuantity !== '1' ||
      outputQuantity !== '1' ||
      outputUnit !== 'kg';
    if (hasDraft) setPendingCopy(copySource);
    else void copyRecipe(copySource);
  }
  useEffect(() => {
    if (!recipe) return;
    let current = true;
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 15000);
    setLoadError(false);
    setLoading(true);
    Promise.all([loadRecipeLines(recipe.id, c.signal), loadRecipePresentations(recipe, c.signal)])
      .then(([r, p]) => {
        if (current) {
          setLines(r);
          setPresentations(p);
        }
      })
      .catch(() => {
        if (current) setLoadError(true);
      })
      .finally(() => {
        clearTimeout(timer);
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      c.abort();
      clearTimeout(timer);
    };
  }, [recipe, retry]);
  const cost = recipeLineCost;
  const costs = lines.map(cost);
  const total = costs.reduce<number>((sum, c) => sum + (c ?? 0), 0);
  const valid = lines.length > 0 && costs.every((c) => c !== null);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving.current || copyController.current || pendingCopy) return;
    setError('');
    if (!payload.current) {
      try {
        if (!valid) throw Error('Adicione insumos ou receitas base e confira as quantidades.');
        if (name.trim().length < 2) throw Error('Informe o nome da receita.');
        if (
          costMode === 'units' &&
          product &&
          (!/^\d{1,7}$/.test(yieldQuantity) ||
            Number(yieldQuantity) < 1 ||
            Number(yieldQuantity) > 1000000)
        )
          throw Error('Informe o rendimento de 1 a 1.000.000 unidades.');
        if (
          costMode === 'weight' &&
          presentations.length &&
          measureUnits.includes(outputUnit) &&
          !['g', 'kg'].includes(outputUnit)
        )
          throw Error('Informe o rendimento da preparação em g ou kg para calcular por peso.');
        if (
          costMode === 'weight' &&
          presentations.some(
            (p) =>
              !p.product.weight_grams ||
              p.packaging.some((l) => l.kind !== 'material' || recipeLineCost(l) === null),
          )
        )
          throw Error('Confira os pesos e as quantidades de embalagem.');
        payload.current = {
          p_cost_mode: costMode,
          p_presentations:
            costMode === 'weight'
              ? presentations.map((p) => ({
                  product_id: p.product.id,
                  packaging: p.packaging.map((l) => ({
                    material_id: l.kind === 'material' ? l.material.id : null,
                    quantity: parseQuantity(l.quantity),
                    unit: l.unit,
                  })),
                }))
              : [],
          p_id: id.current,
          p_revision: recipe?.revision ?? 0,
          p_request_id: request.current,
          p_name: name.trim(),
          p_product_id: product?.id ?? null,
          p_category: product ? null : (baseCategory?.id ?? null),
          p_yield_quantity:
            costMode === 'units' && product ? Number(yieldQuantity) : (recipe?.yield_quantity ?? 1),
          p_output_quantity: parseQuantity(outputQuantity),
          p_output_unit: outputUnit,
          p_notes: notes.trim(),
          p_items: lines.map((l) => ({
            ...(l.kind === 'material'
              ? { material_id: l.material.id }
              : { component_recipe_id: l.recipe.id }),
            quantity: parseQuantity(l.quantity),
            unit: l.unit,
          })),
        };
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : 'Confira os campos');
        return;
      }
    }
    saving.current = true;
    setBusy(true);
    let definitive = false;
    try {
      const result = await requireSupabase()
        .rpc('save_recipe', payload.current)
        .abortSignal(AbortSignal.timeout(20000));
      if (result.error) {
        if (result.error.code && /^[0-9A-Z]{5}$/.test(result.error.code)) {
          definitive = true;
          payload.current = null;
          setUncertain(false);
          throw Error(
            result.error.code === 'P0001'
              ? result.error.message
              : 'Não foi possível salvar. Confira seu acesso e atualize os dados.',
          );
        }
        setUncertain(true);
        throw Error(
          'A confirmação não chegou. Repita a mesma solicitação para verificar sem duplicar a receita.',
        );
      }
      if (!result.data) {
        setUncertain(true);
        throw Error('Não foi possível confirmar. Tente novamente.');
      }
      if (active.current) onSaved();
    } catch (issue) {
      if (active.current) {
        if (!definitive) setUncertain(true);
        setError(
          definitive && issue instanceof Error
            ? issue.message
            : 'A confirmação não chegou. Repita a mesma solicitação para verificar sem duplicar a receita.',
        );
      }
    } finally {
      saving.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="sale-dialog"
      aria-labelledby="recipe-title"
      onCancel={(e) => {
        if (saving.current) e.preventDefault();
        else if (pendingCopy) {
          e.preventDefault();
          restoreCopyFocus.current = true;
          setPendingCopy(null);
        } else onClose();
      }}
    >
      <form onSubmit={save}>
        <div className="form-heading">
          <h2 id="recipe-title">{recipe ? 'Editar receita' : 'Nova receita'}</h2>
          <button
            type="button"
            className="form-close"
            disabled={busy}
            onClick={onClose}
            aria-label="Fechar formulário de receita"
            title="Fechar"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {!recipe && (
          <>
            <details
              ref={copyPanel}
              className="recipe-copy"
              onToggle={(e) => {
                if (!e.currentTarget.open) setPendingCopy(null);
              }}
            >
              <summary
                aria-disabled={copying || undefined}
                onClick={(e) => {
                  if (copying) e.preventDefault();
                }}
              >
                Começar copiando outra receita
              </summary>
              <p className="fine">
                Copia insumos, receitas base, categoria, quantidades, rendimentos e observações. As
                apresentações e suas embalagens ficam em branco para configurar a nova receita.
              </p>
              <SearchSelect
                label="Receita para copiar"
                value={copySource ? { id: copySource.id, label: copySource.name } : null}
                load={loadBases}
                placeholder="Buscar receita pelo nome"
                disabled={busy || uncertain || copying || Boolean(pendingCopy)}
                onSelect={(option) => {
                  setCopySource(option ? (option as RecipeOption).recipe : null);
                  setCopyError('');
                }}
              />
              {pendingCopy ? (
                <div
                  role="group"
                  aria-labelledby="copy-replace-title"
                  className="recipe-copy-confirm"
                >
                  <p id="copy-replace-title">
                    Substituir o preenchimento atual pela receita “{pendingCopy.name}”? Os dados que
                    você digitou serão substituídos somente se a cópia for carregada.
                  </p>
                  <div className="recipe-copy-actions">
                    <button
                      ref={keepDraftButton}
                      type="button"
                      onClick={() => {
                        restoreCopyFocus.current = true;
                        setPendingCopy(null);
                      }}
                    >
                      Manter preenchimento
                    </button>
                    <button type="button" onClick={() => void copyRecipe(pendingCopy)}>
                      Substituir preenchimento
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  ref={copyButton}
                  type="button"
                  disabled={!copySource || busy || uncertain || copying}
                  onClick={requestCopy}
                >
                  {copying ? 'Copiando receita…' : 'Copiar para o formulário'}
                </button>
              )}
              {copying && (
                <p role="status">Carregando a receita. Aguarde para revisar os campos.</p>
              )}
              {copyError && <p role="alert">{copyError}</p>}
            </details>
            {copyStatus && (
              <p role="status" className="fine">
                {copyStatus}
              </p>
            )}
          </>
        )}
        {loading ? (
          <p role="status">Carregando receita…</p>
        ) : loadError ? (
          <p role="alert">
            Não foi possível carregar.{' '}
            <button type="button" onClick={() => setRetry((v) => v + 1)}>
              Tentar novamente
            </button>
          </p>
        ) : (
          <fieldset disabled={busy || uncertain || copying || Boolean(pendingCopy)}>
            <label>
              Nome da receita
              <input
                ref={nameInput}
                required
                minLength={2}
                maxLength={120}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pipoca de chocolate"
              />
            </label>
            <div className="sale-fields">
              <label>
                Rendimento da preparação
                <input
                  required
                  inputMode="decimal"
                  value={outputQuantity}
                  onChange={(e) => setOutputQuantity(e.target.value)}
                  placeholder="1"
                />
              </label>
              <label>
                Unidade do rendimento
                <select
                  value={outputUnit}
                  onChange={(e) => setOutputUnit(e.target.value as MeasureUnit)}
                >
                  {measureUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="fine">
              Quantidade pronta que esta receita produz. Exemplo: a caramelizada rende 1 kg; usar
              300 g dela na receita de morango inclui 30% do custo da caramelizada.
            </p>
            <label>
              Cálculo do custo
              <select
                value={costMode}
                onChange={(e) => setCostMode(e.target.value as 'units' | 'weight')}
              >
                <option value="weight">Por peso · várias apresentações</option>
                <option value="units">Por unidades de venda · uma apresentação</option>
              </select>
            </label>
            {costMode === 'units' && (
              <>
                <SearchSelect
                  label="Produto da receita (opcional)"
                  value={product}
                  load={searchSaleProducts}
                  onSelect={(option) => {
                    if (option) {
                      setPresentations([
                        { product: (option as ProductOption).product, packaging: [] },
                      ]);
                      setLegacyProduct({
                        ...option,
                        category: (option as ProductOption).product.category,
                      });
                    } else {
                      if (product?.category)
                        setBaseCategory({ id: product.category, label: product.category });
                      setLegacyProduct(null);
                      setPresentations([]);
                    }
                  }}
                  disabled={busy || uncertain}
                  placeholder="Buscar produto"
                />
                <p className="fine">
                  Para uma receita usada apenas como base, deixe o produto em branco.
                </p>
                {presentations.some((p) => p.packaging.length > 0) || presentations.length > 1 ? (
                  <p role="status" className="fine">
                    Ao salvar por unidades, as apresentações e embalagens do cálculo por peso serão
                    removidas. Neste modo, inclua as embalagens nos insumos da receita.
                  </p>
                ) : null}
              </>
            )}
            {product ? (
              <>
                <label>
                  Categoria
                  <input
                    value={product.category ?? 'Sem categoria'}
                    readOnly
                    aria-describedby="recipe-category-help"
                  />
                </label>
                <p id="recipe-category-help" className="fine">
                  A categoria acompanha o produto selecionado. Para alterá-la, edite o produto.
                </p>
              </>
            ) : (
              <>
                <SearchSelect
                  label="Categoria (opcional)"
                  value={baseCategory}
                  load={searchRecipeCategories}
                  onSelect={setBaseCategory}
                  disabled={busy || uncertain || copying || Boolean(pendingCopy)}
                  placeholder="Escolher categoria"
                />
                <p className="fine">
                  Use uma das categorias do catálogo ou deixe a receita sem categoria.
                </p>
              </>
            )}
            {recipe &&
              !recipe.product_id &&
              recipe.product_label !== 'Receita base' &&
              !product && (
                <p>
                  Produto removido do catálogo: {recipe.product_label}. Você pode manter a receita
                  ou selecionar outro produto.
                </p>
              )}
            {costMode === 'units' && product && (
              <>
                <label>
                  Rendimento (unidades de venda)
                  <input
                    type="number"
                    required
                    min="1"
                    max="1000000"
                    value={yieldQuantity}
                    onChange={(e) => setYield(e.target.value)}
                  />
                </label>
                <p className="fine">
                  Quantas unidades da apresentação selecionada esta receita produz? Exemplo: 10
                  pacotes de 100 g → rendimento 10.
                </p>
              </>
            )}
            <h3>Insumos da preparação</h3>
            {costMode === 'weight' && (
              <p className="fine">
                Aqui entram os ingredientes da receita pronta. Cadastre saco, etiqueta e laço em
                Embalagens por pacote, abaixo, na apresentação correspondente, para evitar contar
                duas vezes.
              </p>
            )}
            <RecipeLinesEditor
              lines={lines}
              onChange={setLines}
              disabled={busy || uncertain || copying || Boolean(pendingCopy)}
              loadBases={loadBases}
            />
            <p className="sale-sum">
              Custo da receita <strong>{valid ? money(total) : '—'}</strong>
            </p>
            {costMode === 'units' && product && (
              <p className="sale-sum">
                Custo por unidade{' '}
                <strong>
                  {valid && Number(yieldQuantity) > 0 ? money(total / Number(yieldQuantity)) : '—'}
                </strong>
              </p>
            )}
            {costMode === 'weight' && (
              <RecipePresentations
                value={presentations}
                onChange={(p) => {
                  if (!p.length && product?.category)
                    setBaseCategory({ id: product.category, label: product.category });
                  setPresentations(p);
                }}
                total={valid ? total : null}
                outputQuantity={outputQuantity}
                outputUnit={outputUnit}
                disabled={busy || uncertain || copying || Boolean(pendingCopy)}
              />
            )}
            <p className="fine">
              Prévia com os preços consultados. Ao salvar, o banco calcula com os preços atuais.
              Custos de mão de obra, energia e perdas não estão incluídos automaticamente.
            </p>
            <label>
              Observações
              <textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </fieldset>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="sale-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="sale-primary"
            disabled={
              busy || copying || Boolean(pendingCopy) || loading || loadError || !lines.length
            }
          >
            {busy
              ? 'Salvando…'
              : uncertain
                ? 'Confirmar novamente'
                : copyStatus
                  ? 'Salvar nova receita'
                  : 'Salvar receita'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
