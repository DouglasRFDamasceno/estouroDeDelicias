import { useManagementRefresh } from './ManagementRefresh';
import { useEffect, useState } from 'react';
import {
  loadPendingOrders,
  reviewPendingOrder,
  cancelPendingOrder,
} from '../services/pendingOrders';
import type { PendingOrder } from '../services/pendingOrders';
import type { CatalogProduct } from '../domain/catalog';
import { totalPages } from '../domain/pagination';
import { money } from '../domain/format';
import { Pagination } from './Pagination';

export function PendingOrders({
  revision,
  onReview,
}: {
  revision: number;
  onReview: (order: PendingOrder, items: (CatalogProduct & { quantity: number })[]) => void;
}) {
  const [size, setSize] = useState(10);
  const { refreshVersion, trackRefresh } = useManagementRefresh();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('');
  const [rows, setRows] = useState<PendingOrder[]>([]),
    [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setError('');
    setRows([]);
    trackRefresh(
      loadPendingOrders(page, size, filter, controller.signal)
        .then((result) => {
          if (!active) return;
          if (page > totalPages(result.total, size)) {
            setPage(totalPages(result.total, size));
            return;
          }
          setRows(result.rows);
          setTotal(result.total);
        })
        .catch((issue) => {
          if (!active) return;
          if (issue?.code === 'PGRST103' && page > 1) {
            setPage(1);
            return;
          }
          setError('Não foi possível carregar os pedidos recebidos.');
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
  }, [page, size, filter, revision, refresh, refreshVersion, trackRefresh]);
  async function review(order: PendingOrder) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onReview(order, await reviewPendingOrder(order, AbortSignal.timeout(15000)));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Não foi possível abrir o pedido.');
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await cancelPendingOrder(id);
      setCancelTarget(null);
      setRefresh((value) => value + 1);
    } catch {
      setError('Não foi possível cancelar o pedido.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pending-orders">
      <div className="panel-heading">
        <div>
          <h2>Pedidos recebidos</h2>
          <p>
            Confira o número enviado no WhatsApp. Preparar o pedido no site não comprova o envio da
            mensagem.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          Atualizar pedidos
        </button>
      </div>
      <form
        className="sale-filter"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter(search);
          setPage(1);
        }}
      >
        <label>
          Cliente ou número do pedido
          <input
            maxLength={120}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome ou #1042"
          />
        </label>
        <button disabled={loading || busy}>Buscar pedido</button>
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => {
            setSearch('');
            setFilter('');
            setPage(1);
          }}
        >
          Limpar
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Carregando pedidos…</p>
      ) : (
        <>
          <ul className="pending-order-list">
            {rows.map((order) => (
              <li key={order.id}>
                <h3>
                  #{order.reference} · {order.customer}
                </h3>
                <p>
                  {order.items
                    .map((item) => `${item.quantity} × ${item.name} · ${item.presentation}`)
                    .join(' / ')}
                </p>
                <p>
                  Total no envio: <strong>{money(order.total_cents)}</strong>
                </p>
                <div className="pending-order-actions">
                  <button
                    type="button"
                    disabled={busy}
                    className="sale-primary"
                    onClick={() => review(order)}
                  >
                    Revisar e registrar venda
                  </button>
                  {cancelTarget === order.id ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => cancel(order.id)}>
                        Confirmar cancelamento
                      </button>
                      <button type="button" disabled={busy} onClick={() => setCancelTarget(null)}>
                        Manter pedido
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setCancelTarget(order.id)}>
                      Cancelar pedido
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!error && !rows.length && <p>Nenhum pedido pendente encontrado.</p>}
        </>
      )}
      <Pagination
        page={page}
        pageSize={size}
        total={total}
        disabled={loading || busy}
        onPage={setPage}
        onPageSize={(value) => {
          setSize(value);
          setPage(1);
        }}
      />
    </div>
  );
}
