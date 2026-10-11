import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { money } from '../domain/format';
import { ingredientCost, measureFamily, measureUnits, parseCostPrice, parseQuantity } from '../domain/costs';
import type { MeasureUnit } from '../domain/costs';
import { totalPages } from '../domain/pagination';
import { requireSupabase } from '../services/supabase';
import { loadCostRows, loadRecipeLines, searchMaterials } from '../services/costs';
import type { CostSection, Material, MaterialOption, Recipe, RecipeLine } from '../services/costs';
import { searchSaleProducts } from '../services/saleOptions';
import { removeRecord } from '../services/management';
import { SearchSelect } from './SearchSelect';
import type { SearchOption } from './SearchSelect';
import { Pagination } from './Pagination';
import { ConfirmRemove } from './ConfirmRemove';
export function Costs() {
 const { identity, identityLoading } = useAuth();
 const [section, setSection] = useState<CostSection>('materials');
 if (identityLoading) return <p role="status">Carregando acesso…</p>;
 if (!identity?.isAdmin) return <section className="panel"><p>O cadastro de custos é exclusivo para administradores.</p></section>;
 return <><div className="cost-tabs" aria-label="Cadastros de custos"><button type="button" aria-pressed={section === 'materials'} onClick={() => setSection('materials')}>Insumos</button><button type="button" aria-pressed={section === 'recipes'} onClick={() => setSection('recipes')}>Receitas e custos</button></div><p className="fine">Cadastre a compra de referência do insumo e depois a quantidade usada na receita. Exemplo: 1 kg de chocolate por R$ 30,00 → 200 g custam R$ 6,00.</p><CostList key={section} section={section} /></>;
}
function CostList({ section }: { section: CostSection }) {
 const [page, setPage] = useState(1), [size, setSize] = useState(10), [sort, setSort] = useState('name'), [ascending, setAscending] = useState(true);
 const [search, setSearch] = useState(''), [filter, setFilter] = useState(''), [retry, setRetry] = useState(0), [rows, setRows] = useState<(Material | Recipe)[]>([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
 const [open, setOpen] = useState(false), [editing, setEditing] = useState<Material | Recipe | null>(null), [removing, setRemoving] = useState<Material | Recipe | null>(null), [message, setMessage] = useState('');
 const materials = section === 'materials';
 useEffect(() => {
  let active = true; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(),15000);
  setLoading(true); setRows([]); setError('');
  loadCostRows(section,page,size,filter,sort,ascending,controller.signal).then(r => { if (!active) return; if (page > totalPages(r.total,size)) { setPage(totalPages(r.total,size)); return; } setRows(r.rows); setTotal(r.total); }).catch(e => { if (active) { if (e?.code === 'PGRST103' && page > 1) { setPage(1); return; } setError('Não foi possível carregar os cadastros. Confira a conexão.'); } }).finally(() => { clearTimeout(timer); if (active) setLoading(false); });
  return () => { active = false; clearTimeout(timer); controller.abort(); };
 }, [section,page,size,filter,sort,ascending,retry]);
 function saved() { setOpen(false); setEditing(null); setRetry(v => v+1); setMessage('Cadastro salvo com sucesso.'); }
 const columns = materials ? [['name','Insumo'],['price_cents','Preço de compra']] : [['name','Receita'],['total_cents','Custo da receita'],['unit_cost_cents','Custo por unidade']];
 return <section className="panel products-panel sales-panel"><div className="panel-heading"><div><h2>{materials ? 'Insumos e compras de referência' : 'Receitas dos produtos'}</h2><p>{materials ? 'Ingredientes, embalagens e outros materiais de produção.' : 'Custos calculados com os preços atuais dos insumos.'}</p></div><button type="button" className="sale-primary" onClick={() => { setMessage(''); setOpen(true); }}>{materials ? '+ Novo insumo' : '+ Nova receita'}</button></div>
 <form className="sale-filter" onSubmit={e => { e.preventDefault(); setFilter(search); setPage(1); }}><label>Buscar por nome<input value={search} maxLength={120} onChange={e => setSearch(e.target.value)} /></label><button>Filtrar</button><button type="button" onClick={() => { setSearch(''); setFilter(''); setPage(1); }}>Limpar</button></form>
 {loading ? <p role="status">Carregando…</p> : error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(v => v+1)}>Tentar novamente</button></p> : <><div className="product-table-scroll"><table className="product-table"><caption className="sr-only">{materials ? 'Insumos cadastrados' : 'Receitas cadastradas'}</caption><thead><tr>{columns.map(([key,label]) => <th key={key} aria-sort={sort === key ? ascending ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => { setSort(key); setAscending(sort === key ? !ascending : true); setPage(1); }}>{label} {sort === key ? ascending ? '↑' : '↓' : '↕'}</button></th>)}<th>{materials ? 'Quantidade comprada' : 'Produto e rendimento'}</th><th>Ações</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th>{'price_cents' in row ? <><td>{money(row.price_cents)}</td><td>{row.purchase_quantity} {row.purchase_unit}</td></> : <><td>{money(row.total_cents)}</td><td>{money(row.unit_cost_cents)}</td><td>{row.product_label}<small className="cost-detail">{row.yield_quantity} unidades de venda</small></td></>}<td><button type="button" onClick={() => setEditing(row)}>Editar</button> <button type="button" onClick={() => setRemoving(row)}>Remover</button></td></tr>)}</tbody></table></div>{!rows.length && <p>Nenhum cadastro encontrado.</p>}<Pagination page={page} pageSize={size} total={total} onPage={setPage} onPageSize={v => { setSize(v); setPage(1); }} /></>}
 <p role="status">{message}</p>{(open || editing) && (materials ? <MaterialModal material={editing as Material | null} onClose={() => { setOpen(false); setEditing(null); }} onSaved={saved} /> : <RecipeModal recipe={editing as Recipe | null} onClose={() => { setOpen(false); setEditing(null); }} onSaved={saved} />)}
 {removing && <ConfirmRemove description={`Remover ${removing.name}? ${materials ? 'Insumos usados em receitas precisam ser retirados das receitas antes da exclusão.' : 'Os itens desta receita também serão removidos.'}`} remove={() => removeRecord(section,removing.id,removing.revision)} onClose={() => setRemoving(null)} onRemoved={() => { setRemoving(null); setRetry(v => v+1); setMessage('Cadastro removido.'); }} />}</section>;
}
function MaterialModal({ material, onClose, onSaved }: { material: Material | null; onClose: () => void; onSaved: () => void }) {
 const dialog = useRef<HTMLDialogElement>(null), saving = useRef(false), active = useRef(true);
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 useEffect(() => { active.current = true; dialog.current?.showModal(); return () => { active.current = false; }; }, []);
 async function save(e: FormEvent<HTMLFormElement>) {
  e.preventDefault(); if (saving.current) return; const form = new FormData(e.currentTarget); let values;
  try { const name = String(form.get('name')).trim(); if (name.length < 2 || name.length > 120) throw Error('Informe um nome de 2 a 120 caracteres.'); values = { name, purchase_quantity: parseQuantity(String(form.get('quantity'))), purchase_unit: String(form.get('unit')), price_cents: parseCostPrice(String(form.get('price'))) }; }
  catch (issue) { setError(issue instanceof Error ? issue.message : 'Confira os campos'); return; }
  saving.current = true; setBusy(true); setError('');
  try {
   const client = requireSupabase();
   const query = material ? client.from('materials').update(values).eq('id',material.id).eq('revision',material.revision) : client.from('materials').insert(values);
   const result = await query.select('id').abortSignal(AbortSignal.timeout(15000)).single();
   if (result.error || !result.data) throw result.error;
   if (active.current) onSaved();
  } catch (issue) { if (active.current) setError(issue && typeof issue === 'object' && 'code' in issue && issue.code === 'P0001' && 'message' in issue ? String(issue.message) : 'Não foi possível confirmar. Feche e consulte a lista antes de repetir; o cadastro pode ter sido salvo ou alterado por outra sessão.'); }
  finally { saving.current = false; if (active.current) setBusy(false); }
 }
 return <dialog ref={dialog} className="sale-dialog customer-dialog" aria-labelledby="material-title" onCancel={e => { if (saving.current) e.preventDefault(); else onClose(); }}><form onSubmit={save}><h2 id="material-title">{material ? 'Editar insumo' : 'Novo insumo'}</h2><fieldset disabled={busy}><label>Nome do insumo<input name="name" required minLength={2} maxLength={120} autoFocus defaultValue={material?.name} placeholder="Chocolate, leite, embalagem…" /></label><div className="sale-fields"><label>Quantidade comprada<input name="quantity" required inputMode="decimal" defaultValue={material ? String(material.purchase_quantity).replace('.',',') : ''} placeholder="1" /></label><label>Unidade de compra<select name="unit" defaultValue={material?.purchase_unit ?? 'kg'}>{measureUnits.map(u => <option key={u} value={u}>{u}</option>)}</select></label></div><label>Preço total da compra (R$)<input name="price" required inputMode="decimal" defaultValue={material ? (material.price_cents/100).toFixed(2).replace('.',',') : ''} placeholder="30,00" /></label><p className="fine">O preço corresponde à quantidade inteira informada. Atualizar essa referência recalcula os custos das receitas que usam este insumo.</p></fieldset>{error && <p role="alert">{error}</p>}<div className="sale-actions"><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="sale-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar insumo'}</button></div></form></dialog>;
}
function RecipeModal({ recipe, onClose, onSaved }: { recipe: Recipe | null; onClose: () => void; onSaved: () => void }) {
 const dialog = useRef<HTMLDialogElement>(null), saving = useRef(false), active = useRef(true), id = useRef(recipe?.id ?? crypto.randomUUID()), request = useRef(crypto.randomUUID()), payload = useRef<Record<string,unknown> | null>(null);
 const [name, setName] = useState(recipe?.name ?? ''), [product, setProduct] = useState<SearchOption | null>(recipe?.product_id ? {id:recipe.product_id,label:recipe.product_label} : null), [yieldQuantity, setYield] = useState(String(recipe?.yield_quantity ?? 1)), [notes, setNotes] = useState(recipe?.notes ?? '');
 const [lines, setLines] = useState<RecipeLine[]>([]), [loading, setLoading] = useState(Boolean(recipe)), [loadError, setLoadError] = useState(false), [retry, setRetry] = useState(0), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState('');
 useEffect(() => { active.current = true; dialog.current?.showModal(); return () => { active.current = false; }; }, []);
 useEffect(() => { if (!recipe) return; let current = true; const c = new AbortController(); const timer = setTimeout(() => c.abort(),15000); setLoadError(false); setLoading(true); loadRecipeLines(recipe.id,c.signal).then(r => { if (current) setLines(r); }).catch(() => { if (current) setLoadError(true); }).finally(() => { clearTimeout(timer); if (current) setLoading(false); }); return () => { current = false; c.abort(); clearTimeout(timer); }; }, [recipe,retry]);
 function cost(line: RecipeLine) { try { return ingredientCost(line.material.price_cents,Number(line.material.purchase_quantity),line.material.purchase_unit,parseQuantity(line.quantity),line.unit); } catch { return null; } }
 const costs = lines.map(cost); const total = costs.reduce<number>((sum,c) => sum+(c ?? 0),0); const valid = lines.length > 0 && costs.every(c => c !== null);
 async function save(e: FormEvent) {
  e.preventDefault(); if (saving.current) return; setError('');
  if (!payload.current) {
   try { if (!valid) throw Error('Adicione insumos e confira as quantidades.'); if (!product && (!recipe || recipe.product_id)) throw Error('Selecione o produto da receita.'); if (name.trim().length < 2) throw Error('Informe o nome da receita.'); if (!/^\d{1,7}$/.test(yieldQuantity) || Number(yieldQuantity)<1 || Number(yieldQuantity)>1000000) throw Error('Informe o rendimento de 1 a 1.000.000 unidades.');
    payload.current = { p_id:id.current,p_revision:recipe?.revision ?? 0,p_request_id:request.current,p_name:name.trim(),p_product_id:product?.id ?? null,p_yield_quantity:Number(yieldQuantity),p_notes:notes.trim(),p_items:lines.map(l => ({material_id:l.material.id,quantity:parseQuantity(l.quantity),unit:l.unit})) };
   } catch(issue) { setError(issue instanceof Error ? issue.message : 'Confira os campos'); return; }
  }
  saving.current = true; setBusy(true); let definitive = false;
  try { const result = await requireSupabase().rpc('save_recipe',payload.current).abortSignal(AbortSignal.timeout(20000)); if (result.error) {
    if (result.error.code && /^[0-9A-Z]{5}$/.test(result.error.code)) { definitive = true; payload.current=null; setUncertain(false); throw Error(result.error.code === 'P0001' ? result.error.message : 'Não foi possível salvar. Confira seu acesso e atualize os dados.'); }
    setUncertain(true); throw Error('A confirmação não chegou. Repita a mesma solicitação para verificar sem duplicar a receita.');
   } if (!result.data) { setUncertain(true); throw Error('Não foi possível confirmar. Tente novamente.'); } if (active.current) onSaved();
  } catch(issue) { if (active.current) { if (!definitive) setUncertain(true); setError(definitive && issue instanceof Error ? issue.message : 'A confirmação não chegou. Repita a mesma solicitação para verificar sem duplicar a receita.'); } }
  finally { saving.current=false; if (active.current) setBusy(false); }
 }
 return <dialog ref={dialog} className="sale-dialog" aria-labelledby="recipe-title" onCancel={e => { if (saving.current) e.preventDefault(); else onClose(); }}><form onSubmit={save}><h2 id="recipe-title">{recipe ? 'Editar receita' : 'Nova receita'}</h2>{loading ? <p role="status">Carregando receita…</p> : loadError ? <p role="alert">Não foi possível carregar. <button type="button" onClick={() => setRetry(v => v+1)}>Tentar novamente</button></p> : <fieldset disabled={busy || uncertain}><label>Nome da receita<input required minLength={2} maxLength={120} autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Pipoca de chocolate" /></label><SearchSelect label="Produto da receita" value={product} load={searchSaleProducts} onSelect={setProduct} disabled={busy || uncertain} placeholder="Buscar produto" />{recipe && !recipe.product_id && !product && <p>Produto removido do catálogo: {recipe.product_label}. Você pode manter a receita ou selecionar outro produto.</p>}<label>Rendimento (unidades de venda)<input type="number" required min="1" max="1000000" value={yieldQuantity} onChange={e => setYield(e.target.value)} /></label><p className="fine">Quantas unidades da apresentação selecionada esta receita produz? Exemplo: 10 pacotes de 100 g → rendimento 10.</p>
 <SearchSelect label="Adicionar insumo" value={null} load={searchMaterials} placeholder="Buscar ingrediente ou embalagem" disabled={busy || uncertain || lines.length >= 50} onSelect={option => { if (!option) return; const m = (option as MaterialOption).material; if (lines.some(l => l.material.id === m.id)) { setError('Insumo já adicionado. Ajuste sua quantidade abaixo.'); return; } setError(''); setLines(v => [...v,{material:m,quantity:'',unit:m.purchase_unit === 'kg' ? 'g' : m.purchase_unit === 'l' ? 'ml' : m.purchase_unit}]); }} />
 <ul className="recipe-lines">{lines.map((l,index) => <li key={l.material.id}><strong>{l.material.name}<small>{l.material.purchase_quantity} {l.material.purchase_unit} por {money(l.material.price_cents)}</small></strong><div className="sale-fields"><label>Quantidade usada de {l.material.name}<input required inputMode="decimal" value={l.quantity} placeholder="200" onChange={e => setLines(v => v.map((r,i) => i === index ? {...r,quantity:e.target.value} : r))} /></label><label>Unidade de {l.material.name}<select value={l.unit} onChange={e => setLines(v => v.map((r,i) => i === index ? {...r,unit:e.target.value as MeasureUnit} : r))}>{measureUnits.filter(u => measureFamily(u) === measureFamily(l.material.purchase_unit)).map(u => <option key={u} value={u}>{u}</option>)}</select></label></div><div className="recipe-line-total"><span>{cost(l) === null ? 'Informe uma quantidade válida' : `Custo: ${money(cost(l)!)}`}</span><button type="button" onClick={() => setLines(v => v.filter((_,i) => i !== index))}>Remover insumo</button></div></li>)}</ul>
 <p className="sale-sum">Custo da receita <strong>{valid ? money(total) : '—'}</strong></p><p className="sale-sum">Custo por unidade <strong>{valid && Number(yieldQuantity)>0 ? money(total/Number(yieldQuantity)) : '—'}</strong></p><p className="fine">Prévia com os preços consultados. Ao salvar, o banco calcula com os preços atuais. Custos de mão de obra, energia e perdas não estão incluídos automaticamente.</p><label>Observações<textarea value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} /></label></fieldset>}{error && <p role="alert">{error}</p>}<div className="sale-actions"><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="sale-primary" disabled={busy || loading || loadError || !lines.length}>{busy ? 'Salvando…' : uncertain ? 'Confirmar novamente' : 'Salvar receita'}</button></div></form></dialog>;
}
