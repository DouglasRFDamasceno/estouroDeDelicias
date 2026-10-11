import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { requireSupabase } from '../services/supabase';
import { EditProduct } from './EditProduct';
import { Pagination } from './Pagination';
import { totalPages } from '../domain/pagination';
import { emptyProductFilters, loadProducts, productSortColumns } from '../services/products';
import type { ProductFilters, ProductSort } from '../services/products';
import { money } from '../domain/format';
import { parseProductDraft } from '../domain/catalog';
import type { CatalogProduct } from '../domain/catalog';
const columns = 'id,name,category,presentation,price_cents';
const columnLabels = {
  name: 'Produto',
  category: 'Categoria',
  presentation: 'Apresentação',
  price_cents: 'Preço',
};
export function Products() {
  const { session, loading: authLoading, identity } = useAuth();
  const userId = session?.user.id;
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const [catalog, setCatalog] = useState<{
    owner: string;
    rows: CatalogProduct[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ column: ProductSort; ascending: boolean }>({
    column: 'name',
    ascending: true,
  });
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(emptyProductFilters);
  const [filters, setFilters] = useState<ProductFilters>(emptyProductFilters);
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draftFilters });
  }
  function orderBy(column: ProductSort) {
    setPage(1);
    setSort((previous) => ({
      column,
      ascending: previous.column === column ? !previous.ascending : true,
    }));
  }
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [removing, setRemoving] = useState<CatalogProduct | null>(null);
  const [removeError, setRemoveError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const canManage = Boolean(userId && identity?.owner === userId && identity.isAdmin);
  useEffect(() => {
    if (removing && canManage && dialog.current && !dialog.current.open) dialog.current.showModal();
    else if (!removing || !canManage) dialog.current?.close();
  }, [removing, canManage]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setCatalog(null);
    setError('');
    setLoading(true);
    if (!userId) {
      window.clearTimeout(timeout);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const result = await loadProducts({
          page,
          pageSize,
          sort: sort.column,
          ascending: sort.ascending,
          filters,
          signal: controller.signal,
        });
        if (active) {
          const lastPage = totalPages(result.total, pageSize);
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }
          setCatalog({ owner: userId, ...result });
        }
      } catch (issue) {
        if (active) {
          const code = issue && typeof issue === 'object' && 'code' in issue ? issue.code : '';
          if (code === 'PGRST103' && page > 1) {
            setPage(1);
            return;
          }
          setError(
            code === '42501'
              ? 'Sua conta não tem permissão para consultar o catálogo.'
              : 'Não foi possível carregar o catálogo. Confira a conexão e tente novamente.',
          );
        }
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [userId, retry, page, pageSize, sort, filters]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !canManage || !userId) return;
    const owner = userId;
    const fields = new FormData(event.currentTarget);
    let values;
    try {
      values = parseProductDraft({
        name: String(fields.get('name') ?? ''),
        category: String(fields.get('category') ?? ''),
        presentation: String(fields.get('presentation') ?? ''),
        price: String(fields.get('price') ?? ''),
      });
    } catch (issue) {
      setMessage(issue instanceof Error ? issue.message : 'Confira os campos.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setMessage('');
    try {
      const client = requireSupabase();
      const verified = await client.auth.getUser();
      if (verified.error || verified.data.user?.id !== owner || currentUser.current !== owner)
        throw new Error('AUTH');
      const { error } = await client.from('products').insert(values).select(columns).single();
      if (currentUser.current !== owner) return;
      if (error) {
        setMessage(
          error.code === '23505'
            ? 'Já existe um produto com esse nome, categoria e apresentação.'
            : 'Não foi possível cadastrar. Verifique sua permissão e conexão antes de tentar novamente.',
        );
        return;
      }
      setPage(1);
      setRetry((value) => value + 1);
      setOpen(false);
      setMessage('Produto cadastrado com sucesso.');
    } catch {
      if (currentUser.current === owner)
        setMessage('Não foi possível cadastrar. Confira a conexão e tente novamente.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function removeProduct() {
    if (saving.current || !canManage || !removing || !userId) return;
    const owner = userId;
    const productId = removing.id;
    saving.current = true;
    setBusy(true);
    setRemoveError('');
    setMessage('');
    try {
      const client = requireSupabase();
      const verified = await client.auth.getUser();
      if (verified.error || verified.data.user?.id !== owner || currentUser.current !== owner)
        throw new Error('AUTH');
      const { data, error } = await client
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('revision', removing.revision)
        .select('id')
        .single();
      if (currentUser.current !== owner) return;
      if (error || !data || data.id !== productId) {
        setRemoveError(
          error?.code === '23503'
            ? 'Este produto está vinculado a outros registros e não pode ser removido.'
            : 'Não foi possível confirmar a remoção. Confira sua permissão e conexão. O produto pode já ter sido removido; atualize o catálogo para verificar.',
        );
        return;
      }
      if (catalog?.rows.length === 1 && page > 1) setPage(page - 1);
      setRetry((value) => value + 1);
      setRemoving(null);
      setMessage('Produto removido com sucesso.');
    } catch {
      if (currentUser.current === owner)
        setRemoveError('Não foi possível remover. Confira a conexão e tente novamente.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  if (authLoading) return <p role="status">Verificando sessão…</p>;
  if (!session)
    return (
      <section className="panel">
        <h2>Catálogo de produtos</h2>
        <p>Entre na sua conta para consultar os produtos.</p>
        <Link to="/entrar">Entrar ↗</Link>
      </section>
    );
  return (
    <section className="panel products-panel">
      <div className="panel-heading">
        <div>
          <h2>Catálogo de produtos</h2>
          <p>Produtos, apresentações e preços de venda.</p>
        </div>
        {canManage && !open && (
          <button
            className="g-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setMessage('');
              setOpen(true);
            }}
          >
            Cadastrar produto +
          </button>
        )}
      </div>
      <form className="product-filters" onSubmit={applyFilters}>
        <fieldset disabled={busy}>
          <legend>Filtrar produtos</legend>
          <div>
            {(['name', 'category', 'presentation'] as const).map((key) => (
              <label key={key}>
                {columnLabels[key]}
                <input
                  value={draftFilters[key]}
                  maxLength={120}
                  onChange={(event) =>
                    setDraftFilters((previous) => ({ ...previous, [key]: event.target.value }))
                  }
                  placeholder={`Buscar ${columnLabels[key].toLowerCase()}`}
                />
              </label>
            ))}
            <button type="submit">Aplicar filtros</button>
            <button
              type="button"
              onClick={() => {
                setDraftFilters(emptyProductFilters);
                setFilters(emptyProductFilters);
                setPage(1);
              }}
            >
              Limpar
            </button>
          </div>
        </fieldset>
      </form>
      {loading ? (
        <p role="status">Carregando produtos…</p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button type="button" className="g-button" onClick={() => setRetry((value) => value + 1)}>
            Tentar novamente
          </button>
        </>
      ) : (
        <>
          {open && canManage && (
            <form className="login-form product-form" onSubmit={submit}>
              <h3>Novo produto</h3>
              <fieldset disabled={busy}>
                <label htmlFor="product-name">Nome do produto</label>
                <input
                  id="product-name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Ex.: Brownie de chocolate"
                  autoFocus
                />
                <label htmlFor="product-category">Categoria</label>
                <input
                  id="product-category"
                  name="category"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ex.: Doces"
                />
                <label htmlFor="product-presentation">Apresentação / unidade de venda</label>
                <input
                  id="product-presentation"
                  name="presentation"
                  required
                  maxLength={80}
                  placeholder="Ex.: Unidade, caixa com 6 ou 100 g"
                />
                <label htmlFor="product-price">Preço de venda (R$)</label>
                <input
                  id="product-price"
                  name="price"
                  required
                  inputMode="decimal"
                  maxLength={10}
                  placeholder="16,00"
                  aria-describedby="product-price-help"
                />
                <p id="product-price-help">Use vírgula para centavos, sem separador de milhares.</p>
                <div className="product-actions">
                  <button className="g-button" type="submit">
                    {busy ? 'Salvando…' : 'Salvar produto'}
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setOpen(false);
                      setMessage('');
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {catalog && catalog.owner === userId && (
            <>
              {catalog.rows.length ? (
                <div className="product-table-scroll">
                  <table className="product-table">
                    <caption className="sr-only">Produtos cadastrados</caption>
                    <thead>
                      <tr>
                        {productSortColumns.map((column) => (
                          <th
                            key={column}
                            scope="col"
                            aria-sort={
                              sort.column === column
                                ? sort.ascending
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button type="button" disabled={busy} onClick={() => orderBy(column)}>
                              {columnLabels[column]}{' '}
                              <span aria-hidden="true">
                                {sort.column === column ? (sort.ascending ? '↑' : '↓') : '↕'}
                              </span>
                            </button>
                          </th>
                        ))}
                        {canManage && <th scope="col">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {catalog.rows.map((product) => (
                        <tr key={product.id}>
                          <th scope="row">{product.name}</th>
                          <td>{product.category}</td>
                          <td>{product.presentation}</td>
                          <td className="product-price-cell">{money(product.price_cents)}</td>
                          {canManage && (
                            <td>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setEditing(product)}
                              >
                                Editar
                              </button>{' '}
                              <button
                                type="button"
                                className="product-remove-button"
                                disabled={busy}
                                aria-label={`Remover ${product.name}, ${product.presentation}`}
                                onClick={() => {
                                  setRemoving(product);
                                  setRemoveError('');
                                }}
                              >
                                Remover
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Nenhum produto encontrado com esses filtros.</p>
              )}
              <Pagination
                page={page}
                pageSize={pageSize}
                total={catalog.total}
                disabled={busy || loading}
                onPage={setPage}
                onPageSize={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
          {!canManage && (
            <p>O cadastro e a remoção de produtos são reservados aos administradores.</p>
          )}
        </>
      )}
      {editing && canManage && (
        <EditProduct
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRetry((v) => v + 1);
            setMessage('Produto atualizado com sucesso.');
          }}
        />
      )}
      <dialog
        ref={dialog}
        className="product-remove-dialog"
        aria-labelledby="remove-product-title"
        aria-describedby="remove-product-description"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setRemoving(null);
        }}
        onClose={() => {
          if (!busy) setRemoving(null);
        }}
      >
        <h2 id="remove-product-title">Remover produto?</h2>
        <p id="remove-product-description">
          Você vai remover <strong>{removing?.name}</strong>, apresentação{' '}
          <strong>{removing?.presentation}</strong>, do catálogo compartilhado. Essa ação não pode
          ser desfeita.
        </p>
        {removeError && (
          <p role="alert" className="product-remove-error">
            {removeError}
          </p>
        )}
        <div className="product-remove-actions">
          <button
            type="button"
            className="product-cancel-button"
            autoFocus
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="product-confirm-remove"
            disabled={busy || !canManage}
            onClick={removeProduct}
          >
            {busy ? 'Removendo…' : 'Sim, remover produto'}
          </button>
        </div>
      </dialog>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
