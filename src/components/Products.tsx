import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { requireSupabase } from '../services/supabase';
import { money } from '../domain/format';
import { parseProductDraft } from '../domain/catalog';
import type { CatalogProduct } from '../domain/catalog';
const columns = 'id,name,category,presentation,price_cents';
export function Products() {
  const { session, loading: authLoading, identity } = useAuth();
  const userId = session?.user.id;
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const [catalog, setCatalog] = useState<{ owner: string; rows: CatalogProduct[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const canCreate = Boolean(userId && identity?.owner === userId && identity.isAdmin);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setCatalog(null); setOpen(false); setError(''); setMessage(''); setLoading(true);
    if (!userId) { window.clearTimeout(timeout); setLoading(false); return; }
    void (async () => {
      try {
        const client = requireSupabase();
        const items = await client.from('products').select(columns).order('name').order('presentation').limit(1000).abortSignal(controller.signal);
        if (items.error) {
          if (active) setError(items.error.code === '42501' ? 'Sua conta não tem permissão para consultar o catálogo.' : 'Não foi possível carregar o catálogo. Tente novamente.');
          return;
        }
        if (active) setCatalog({ owner: userId, rows: items.data as CatalogProduct[] });
      } catch { if (active) setError('Não foi possível carregar o catálogo. Confira a conexão e tente novamente.'); }
      finally { window.clearTimeout(timeout); if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [userId, retry]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !canCreate || !userId) return;
    const owner = userId;
    const fields = new FormData(event.currentTarget);
    let values;
    try {
      values = parseProductDraft({ name: String(fields.get('name') ?? ''), category: String(fields.get('category') ?? ''), presentation: String(fields.get('presentation') ?? ''), price: String(fields.get('price') ?? '') });
    } catch (issue) { setMessage(issue instanceof Error ? issue.message : 'Confira os campos.'); return; }
    saving.current = true; setBusy(true); setMessage('');
    try {
      const client = requireSupabase();
      const verified = await client.auth.getUser();
      if (verified.error || verified.data.user?.id !== owner || currentUser.current !== owner) throw new Error('AUTH');
      const { data, error } = await client.from('products').insert(values).select(columns).single();
      if (currentUser.current !== owner) return;
      if (error) {
        setMessage(error.code === '23505' ? 'Já existe um produto com esse nome, categoria e apresentação.' : 'Não foi possível cadastrar. Verifique sua permissão e conexão antes de tentar novamente.');
        return;
      }
      setCatalog(previous => previous?.owner === owner ? { owner, rows: [...previous.rows, data as CatalogProduct].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) } : previous);
      setOpen(false); setMessage('Produto cadastrado com sucesso.');
    } catch { if (currentUser.current === owner) setMessage('Não foi possível cadastrar. Confira a conexão e tente novamente.'); }
    finally { saving.current = false; setBusy(false); }
  }
  if (authLoading) return <p role="status">Verificando sessão…</p>;
  if (!session) return <section className="panel"><h2>Catálogo de produtos</h2><p>Entre na sua conta para consultar os produtos.</p><Link to="/entrar">Entrar ↗</Link></section>;
  return <section className="panel products-panel"><div className="panel-heading"><div><h2>Catálogo de produtos</h2><p>Produtos, apresentações e preços de venda.</p></div>{canCreate && !open && <button className="g-button" type="button" onClick={() => { setMessage(''); setOpen(true); }}>Cadastrar produto +</button>}</div>
    {loading ? <p role="status">Carregando produtos…</p> : error ? <><p role="alert">{error}</p><button type="button" className="g-button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></> : <>
      {open && canCreate && <form className="login-form product-form" onSubmit={submit}><h3>Novo produto</h3><fieldset disabled={busy}><label htmlFor="product-name">Nome do produto</label><input id="product-name" name="name" required minLength={2} maxLength={120} placeholder="Ex.: Brownie de chocolate" autoFocus /><label htmlFor="product-category">Categoria</label><input id="product-category" name="category" required minLength={2} maxLength={80} placeholder="Ex.: Doces" /><label htmlFor="product-presentation">Apresentação / unidade de venda</label><input id="product-presentation" name="presentation" required maxLength={80} placeholder="Ex.: Unidade, caixa com 6 ou 100 g" /><label htmlFor="product-price">Preço de venda (R$)</label><input id="product-price" name="price" required inputMode="decimal" maxLength={10} placeholder="16,00" aria-describedby="product-price-help" /><p id="product-price-help">Use vírgula para centavos, sem separador de milhares.</p><div className="product-actions"><button className="g-button" type="submit">{busy ? 'Salvando…' : 'Salvar produto'}</button><button type="button" className="text-link" onClick={() => { setOpen(false); setMessage(''); }}>Cancelar</button></div></fieldset></form>}
      {catalog && catalog.owner === userId && (catalog.rows.length ? <><p>{catalog.rows.length} apresentações cadastradas{catalog.rows.length >= 1000 ? ' · exibindo até 1.000 itens' : ''}</p><div className="product-table-scroll"><table className="product-table"><caption className="sr-only">Produtos cadastrados</caption><thead><tr><th scope="col">Produto</th><th scope="col">Categoria</th><th scope="col">Apresentação</th><th scope="col">Preço</th></tr></thead><tbody>{catalog.rows.map(product => <tr key={product.id}><th scope="row">{product.name}</th><td>{product.category}</td><td>{product.presentation}</td><td>{money(product.price_cents)}</td></tr>)}</tbody></table></div></> : <p>Nenhum produto cadastrado.</p>)}
      {!canCreate && <p>O cadastro de produtos é reservado aos administradores.</p>}
    </>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
