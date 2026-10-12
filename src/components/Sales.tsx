import { useManagementRefresh } from './ManagementRefresh';
import { ActionIconButton } from './ActionIconButton';
import { ClearableInput } from './ClearableInput';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { PendingOrders } from './PendingOrders';
import type { PendingOrder } from '../services/pendingOrders';
import { useAuth } from '../auth/AuthProvider';
import { requireSupabase } from '../services/supabase';
import { SearchSelect } from './SearchSelect';
import type { SearchOption } from './SearchSelect';
import {
  searchSaleProducts,
  searchSaleCustomers,
  createSaleCustomer,
} from '../services/saleOptions';
import type { ProductOption } from '../services/saleOptions';
import { loadSales, loadSaleItems } from '../services/sales';
import type { Sale, SaleSort } from '../services/sales';
import type { CatalogProduct } from '../domain/catalog';
import { money, dateBR } from '../domain/format';
import { ConfirmRemove } from './ConfirmRemove';
import { removeRecord } from '../services/management';
import { totalPages } from '../domain/pagination';
import { Pagination } from './Pagination';
const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const methods: Record<string, string> = {
  pending: 'A receber',
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
  other: 'Outro',
};
export function Sales() {
  const { refreshVersion, trackRefresh } = useManagementRefresh();
  const { identity, identityLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const onSalesPage = useLocation().pathname === '/demo/vendas';
  const tab = searchParams.get('aba') === 'pedidos' ? 'orders' : 'sales';
  function setTab(value: 'orders' | 'sales') {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('aba', value === 'sales' ? 'vendas' : 'pedidos');
      return next;
    });
  }
  const [editing, setEditing] = useState<Sale | null>(null),
    [removing, setRemoving] = useState<Sale | null>(null);
  const [pending, setPending] = useState<{ order: PendingOrder; items: DraftSaleItem[] } | null>(
    null,
  );
  const [open, setOpen] = useState(false),
    [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SaleSort>('sale_date'),
    [ascending, setAscending] = useState(false);
  const [rows, setRows] = useState<Sale[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!onSalesPage || !identity?.isAdmin || searchParams.get('acao') !== 'nova') return;
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.set('aba', 'vendas');
    next.delete('acao');
    setSearchParams(next, { replace: true });
  }, [identity?.isAdmin, searchParams, setSearchParams, onSalesPage]);
  useEffect(() => {
    if (!identity?.isAdmin || !onSalesPage) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    setLoading(true);
    setError('');
    setRows([]);
    trackRefresh(
      loadSales(page, size, filter, sort, ascending, controller.signal)
        .then((result) => {
          if (active) {
            if (page > totalPages(result.total, size)) {
              setPage(totalPages(result.total, size));
              return;
            }
            setRows(result.rows);
            setTotal(result.total);
          }
        })
        .catch((issue) => {
          if (active) {
            if (issue?.code === 'PGRST103' && page > 1) {
              setPage(1);
              return;
            }
            setError('Não foi possível carregar as vendas. Tente novamente.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        }),
    );
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [
    identity?.isAdmin,
    page,
    size,
    filter,
    sort,
    ascending,
    revision,
    onSalesPage,
    refreshVersion,
    trackRefresh,
  ]);
  if (identityLoading) return <p role="status">Carregando acesso…</p>;
  if (!identity?.isAdmin)
    return (
      <section className="panel">
        <p>O registro de vendas é exclusivo para administradores.</p>
      </section>
    );
  return (
    <section className="panel sales-panel">
      <div className="sales-tabs" role="tablist" aria-label="Acompanhamento de vendas">
        {(
          [
            ['sales', 'Vendas registradas'],
            ['orders', 'Pedidos recebidos'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            id={`sales-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`sales-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => {
              let next: 'orders' | 'sales';
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                next = key === 'orders' ? 'sales' : 'orders';
              } else if (event.key === 'Home') {
                next = 'sales';
              } else if (event.key === 'End') {
                next = 'orders';
              } else {
                return;
              }
              event.preventDefault();
              setTab(next);
              document.getElementById(`sales-tab-${next}`)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id="sales-panel-orders"
        role="tabpanel"
        aria-labelledby="sales-tab-orders"
        hidden={tab !== 'orders'}
        tabIndex={0}
      >
        <PendingOrders
          revision={revision}
          onReview={(order, items) => setPending({ order, items })}
        />
      </div>
      {pending && (
        <SaleModal
          pendingOrder={pending.order}
          initialItems={pending.items}
          onClose={() => setPending(null)}
          onSaved={() => {
            setPending(null);
            setTab('sales');
            setRevision((value) => value + 1);
            setPage(1);
          }}
        />
      )}

      <div
        id="sales-panel-sales"
        role="tabpanel"
        aria-labelledby="sales-tab-sales"
        hidden={tab !== 'sales'}
        tabIndex={0}
      >
        <div className="panel-heading">
          <div>
            <h2>Vendas registradas</h2>
            <p>Acompanhe suas vendas e os valores a receber.</p>
          </div>
          <button className="sale-primary" onClick={() => setOpen(true)}>
            + Nova venda
          </button>
        </div>
        <form
          className="sale-filter"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(search);
            setPage(1);
          }}
        >
          <label>
            Cliente
            <ClearableInput
              label="Cliente"
              value={search}
              maxLength={120}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome"
              onClear={() => {
                setSearch('');
              }}
            />
          </label>
          <button>Filtrar</button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilter('');
              setPage(1);
            }}
          >
            Limpar
          </button>
        </form>
        {error && (
          <p role="alert">
            {error} <button onClick={() => setRevision((v) => v + 1)}>Recarregar</button>
          </p>
        )}
        {loading ? (
          <p role="status">Carregando vendas…</p>
        ) : (
          !error && (
            <>
              <div className="product-table-scroll">
                <table className="product-table">
                  <thead>
                    <tr>
                      {(
                        [
                          ['sale_date', 'Data'],
                          ['customer', 'Cliente'],
                          ['total_cents', 'Total'],
                        ] as const
                      ).map(([key, label]) => (
                        <th
                          scope="col"
                          key={key}
                          aria-sort={
                            sort === key ? (ascending ? 'ascending' : 'descending') : 'none'
                          }
                        >
                          <button
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
                      <th scope="col">Recebido</th>
                      <th scope="col">A receber</th>
                      <th scope="col">Pagamento</th>
                      <th scope="col" className="table-actions">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <td>{dateBR(s.sale_date)}</td>
                        <td>{s.customer}</td>
                        <td>{money(s.total_cents)}</td>
                        <td>{money(s.received_cents)}</td>
                        <td>{money(s.total_cents - s.received_cents)}</td>
                        <td>{methods[s.payment_method]}</td>
                        <td className="table-actions">
                          <ActionIconButton
                            action="edit"
                            label={`Editar ${s.customer}, ${dateBR(s.sale_date)}`}
                            onClick={() => setEditing(s)}
                          />{' '}
                          <ActionIconButton
                            action="remove"
                            label={`Remover ${s.customer}, ${dateBR(s.sale_date)}`}
                            onClick={() => setRemoving(s)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && <p>Nenhuma venda encontrada.</p>}
            </>
          )
        )}
        <Pagination
          page={page}
          pageSize={size}
          total={total}
          disabled={loading}
          onPage={setPage}
          onPageSize={(v) => {
            setSize(v);
            setPage(1);
          }}
        />
      </div>
      {removing && (
        <ConfirmRemove
          description={`Remover a venda de ${removing.customer}, em ${dateBR(removing.sale_date)}, no valor de ${money(removing.total_cents)}? Todos os itens desta venda também serão removidos.`}
          remove={() => removeRecord('sales', removing.id, removing.revision)}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            setRevision((v) => v + 1);
          }}
        />
      )}
      {editing && (
        <EditSale
          sale={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((v) => v + 1);
          }}
        />
      )}
      {open && (
        <SaleModal
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setPage(1);
            setRevision((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}
type DraftSaleItem = CatalogProduct & { quantity: number; sale_item_id?: string };
function SaleModal({
  sale,
  initialItems = [],
  pendingOrder,
  onClose,
  onSaved,
}: {
  sale?: Sale;
  initialItems?: DraftSaleItem[];
  pendingOrder?: PendingOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState('');
  const [customer, setCustomer] = useState<SearchOption | null>(
      sale?.customer_id ? { id: sale.customer_id, label: sale.customer } : null,
    ),
    [date, setDate] = useState(sale?.sale_date ?? today()),
    [received, setReceived] = useState(
      ((sale?.received_cents ?? 0) / 100).toFixed(2).replace('.', ','),
    ),
    [method, setMethod] = useState(sale?.payment_method ?? 'pending'),
    [notes, setNotes] = useState(
      sale?.notes ?? (pendingOrder ? `Pedido #${pendingOrder.reference}` : ''),
    );
  const [orderCustomer, setOrderCustomer] = useState(pendingOrder?.customer ?? '');
  const [items, setItems] = useState<DraftSaleItem[]>(initialItems);
  const payload = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const amount = items.reduce((sum, p) => sum + p.price_cents * p.quantity, 0);
  const previousAmount = useRef(amount);
  useEffect(() => {
    if (previousAmount.current !== amount) {
      setReceived(method === 'pending' ? '0,00' : (amount / 100).toFixed(2).replace('.', ','));
      previousAmount.current = amount;
    }
  }, [amount, method]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!payload.current) {
      if (pendingOrder && !customer && orderCustomer.trim().length < 2) {
        setError('Confira o nome do cliente.');
        return;
      }
      if (
        !items.length ||
        items.some((p) => !Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 999)
      ) {
        setError('Adicione produtos com quantidades de 1 a 999.');
        return;
      }
      if (!/^\d{1,9}([,.]\d{1,2})?$/.test(received)) {
        setError('Informe o valor recebido em reais, por exemplo 16,00.');
        return;
      }
      const [whole, fraction = ''] = received.replace(',', '.').split('.');
      const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      if (cents > amount || (cents > 0 && method === 'pending')) {
        setError('Confira o valor recebido e a forma de pagamento.');
        return;
      }
      payload.current = {
        p_request_id: requestId.current,
        p_customer:
          customer?.label ??
          (orderCustomer.trim() ||
            (sale?.customer_id === null ? sale.customer : 'Consumidor final')),
        p_customer_id: customer?.id ?? null,
        p_sale_date: date,
        p_received_cents: cents,
        p_payment_method: method,
        p_notes: notes.trim(),
        p_items: items.map((p) => ({
          sale_item_id: p.sale_item_id,
          product_id: p.id,
          quantity: p.quantity,
          unit_price_cents: p.price_cents,
        })),
      };
    }
    setBusy(true);
    try {
      const result = await requireSupabase()
        .rpc(
          sale ? 'update_sale' : pendingOrder ? 'confirm_pending_order' : 'create_sale',
          sale
            ? { ...payload.current, p_sale_id: sale.id, p_revision: sale.revision }
            : pendingOrder
              ? { ...payload.current, p_order_id: pendingOrder.id }
              : payload.current,
        )
        .abortSignal(AbortSignal.timeout(20000));
      if (result.error) {
        if (result.error.code && /^[0-9A-Z]{5}$/.test(result.error.code)) {
          payload.current = null;
          setUncertain(false);
          setError(
            result.error.code === 'P0001'
              ? result.error.message
              : 'Não foi possível salvar. Verifique os dados e seu acesso.',
          );
        } else {
          setUncertain(true);
          setError(
            'A confirmação não chegou. Tente novamente para consultar ou salvar esta mesma venda sem duplicar.',
          );
        }
        return;
      }
      if (!result.data) throw Error('Sem confirmação');
      onSaved();
    } catch {
      setUncertain(true);
      setError(
        'A confirmação não chegou. Tente novamente sem alterar a venda para evitar duplicação.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="sale-dialog"
      aria-labelledby="sale-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={save}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">GESTÃO DE VENDAS</p>
            <h2 id="sale-title">
              {sale
                ? 'Editar venda'
                : pendingOrder
                  ? `Registrar pedido #${pendingOrder.reference}`
                  : 'Nova venda'}
            </h2>
          </div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <fieldset disabled={busy || uncertain}>
          {pendingOrder && (
            <>
              <p>Confira o combinado pelo WhatsApp. Os preços abaixo são os atuais do catálogo.</p>
              <label>
                Nome no pedido
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={orderCustomer}
                  onChange={(event) => setOrderCustomer(event.target.value)}
                />
              </label>
              <p>Se selecionar um cliente cadastrado, o nome desse cadastro será usado na venda.</p>
            </>
          )}
          <div className="sale-fields">
            <SearchSelect
              label="Cliente (opcional)"
              value={customer}
              placeholder="Consumidor final — buscar cliente"
              disabled={busy || uncertain}
              load={searchSaleCustomers}
              onSelect={setCustomer}
              onCreate={createSaleCustomer}
            />
            <label>
              Data da venda
              <input
                type="date"
                required
                min="2000-01-01"
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <h3>Adicionar produtos</h3>
          <SearchSelect
            label="Produto"
            value={null}
            placeholder="Digite o nome do produto"
            disabled={busy || uncertain || items.length >= 50}
            load={searchSaleProducts}
            onSelect={(option) => {
              if (!option) return;
              const product = (option as ProductOption).product;
              if (items.some((i) => i.id === product.id)) {
                setError('Este produto já está na venda. Ajuste a quantidade abaixo.');
                return;
              }
              setError('');
              setItems((v) => [...v, { ...product, quantity: 1 }]);
            }}
          />
          <h3>Itens da venda</h3>
          {!items.length && <p>Selecione pelo menos um produto.</p>}
          <ul className="sale-cart">
            {items.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name} · {p.presentation}
                  <small>{money(p.price_cents)} por unidade</small>
                </span>
                <label>
                  Quantidade
                  <input
                    type="number"
                    min="1"
                    max="999"
                    required
                    value={p.quantity || ''}
                    onChange={(e) =>
                      setItems((v) =>
                        v.map((i) =>
                          i.id === p.id ? { ...i, quantity: Number(e.target.value) } : i,
                        ),
                      )
                    }
                  />
                </label>
                <strong>{money(p.price_cents * p.quantity)}</strong>
                <ActionIconButton
                  action="remove"
                  label={`Remover ${p.name} da venda`}
                  onClick={() => setItems((v) => v.filter((i) => i.id !== p.id))}
                />
              </li>
            ))}
          </ul>
          <p className="sale-sum">
            Total da venda <strong>{money(amount)}</strong>
          </p>
          <div className="sale-fields">
            <label>
              Valor recebido (R$)
              <input
                inputMode="decimal"
                required
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </label>
            <label>
              Forma de pagamento
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(methods).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Observações (opcional)
            <textarea maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {uncertain && <p>Os dados estão preservados para repetir a mesma solicitação.</p>}
        <div className="sale-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="sale-primary" disabled={busy || !items.length}>
            {busy
              ? 'Salvando…'
              : uncertain
                ? 'Confirmar novamente'
                : sale
                  ? 'Salvar alterações'
                  : 'Salvar venda'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function EditSale({
  sale,
  onClose,
  onSaved,
}: {
  sale: Sale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<DraftSaleItem[] | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setError(false);
    loadSaleItems(sale.id, controller.signal)
      .then((rows) => {
        if (active)
          setItems(
            rows.map((i) => ({
              id: i.product_id ?? i.id,
              revision: 0,
              sale_item_id: i.id,
              name: i.product_name,
              category: i.category,
              presentation: i.presentation,
              price_cents: i.unit_price_cents,
              quantity: i.quantity,
            })),
          );
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [sale.id, retry]);
  if (!items)
    return (
      <div role="status">
        {error ? (
          <>
            Não foi possível carregar os itens.{' '}
            <button type="button" onClick={() => setRetry((v) => v + 1)}>
              Tentar novamente
            </button>
          </>
        ) : (
          'Carregando itens…'
        )}{' '}
        <button type="button" onClick={onClose}>
          Cancelar edição
        </button>
      </div>
    );
  return <SaleModal sale={sale} initialItems={items} onClose={onClose} onSaved={onSaved} />;
}
