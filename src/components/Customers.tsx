import { useManagementRefresh } from './ManagementRefresh';
import { ActionIconButton } from './ActionIconButton';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ConfirmRemove } from './ConfirmRemove';
import { removeRecord } from '../services/management';
import { Pagination } from './Pagination';
import { totalPages } from '../domain/pagination';
import {
  createCustomer,
  updateCustomer,
  customerSortColumns,
  emptyCustomerFilters,
  loadCustomers,
} from '../services/customers';
import type { Customer, CustomerSort } from '../services/customers';
const labels = { name: 'Nome', created_at: 'Cadastrado em' };
const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value));
export function Customers() {
  const { refreshVersion, trackRefresh } = useManagementRefresh();
  const { identity, identityLoading } = useAuth();
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [revision, setRevision] = useState(0);
  const [sort, setSort] = useState<CustomerSort>('name'),
    [ascending, setAscending] = useState(true);
  const [draft, setDraft] = useState(emptyCustomerFilters),
    [filters, setFilters] = useState(emptyCustomerFilters);
  const [rows, setRows] = useState<Customer[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [filterError, setFilterError] = useState(''),
    [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null),
    [removing, setRemoving] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!identity?.isAdmin) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setError('');
    setRows([]);
    trackRefresh(
      loadCustomers({ page, pageSize, sort, ascending, filters, signal: controller.signal })
        .then((result) => {
          if (!active) return;
          if (page > totalPages(result.total, pageSize)) {
            setPage(totalPages(result.total, pageSize));
            return;
          }
          setRows(result.rows);
          setTotal(result.total);
        })
        .catch((issue) => {
          if (active) {
            if (issue?.code === 'PGRST103' && page > 1) {
              setPage(1);
              return;
            }
            setError('Não foi possível carregar os clientes. Confira a conexão e tente novamente.');
          }
        })
        .finally(() => {
          clearTimeout(timer);
          if (active) setLoading(false);
        }),
    );
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    identity?.isAdmin,
    page,
    pageSize,
    sort,
    ascending,
    filters,
    revision,
    refreshVersion,
    trackRefresh,
  ]);
  function apply(event: FormEvent) {
    event.preventDefault();
    setFilterError('');
    if (draft.from && draft.until && draft.from > draft.until) {
      setFilterError('A data inicial deve ser anterior à final.');
      return;
    }
    setFilters({ ...draft });
    setPage(1);
  }
  if (identityLoading) return <p role="status">Carregando acesso…</p>;
  if (!identity?.isAdmin)
    return (
      <section className="panel">
        <p>O cadastro e a consulta de clientes são exclusivos para administradores.</p>
      </section>
    );
  return (
    <section className="panel products-panel customers-panel">
      <div className="panel-heading">
        <div>
          <h2>Clientes cadastrados</h2>
          <p>Organize seus clientes e selecione-os ao registrar uma venda.</p>
        </div>
        <button
          type="button"
          className="g-button"
          onClick={() => {
            setMessage('');
            setOpen(true);
          }}
        >
          Cadastrar cliente +
        </button>
      </div>
      <form className="product-filters" onSubmit={apply}>
        <fieldset>
          <legend>Filtrar clientes</legend>
          <div>
            <label>
              Nome
              <input
                maxLength={120}
                value={draft.name}
                placeholder="Buscar por nome"
                onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
              />
            </label>
            <label>
              Cadastrado de
              <input
                type="date"
                value={draft.from}
                onChange={(e) => setDraft((v) => ({ ...v, from: e.target.value }))}
              />
            </label>
            <label>
              Cadastrado até
              <input
                type="date"
                value={draft.until}
                onChange={(e) => setDraft((v) => ({ ...v, until: e.target.value }))}
              />
            </label>
            <button type="submit">Aplicar filtros</button>
            <button
              type="button"
              onClick={() => {
                setDraft(emptyCustomerFilters);
                setFilters(emptyCustomerFilters);
                setPage(1);
                setFilterError('');
              }}
            >
              Limpar
            </button>
          </div>
        </fieldset>
        <p className="fine">Datas de cadastro em UTC.</p>
        {filterError && <p role="alert">{filterError}</p>}
      </form>
      {loading ? (
        <p role="status">Carregando clientes…</p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button type="button" className="g-button" onClick={() => setRevision((v) => v + 1)}>
            Tentar novamente
          </button>
        </>
      ) : (
        <>
          <div className="product-table-scroll">
            <table className="product-table">
              <caption className="sr-only">Clientes cadastrados</caption>
              <thead>
                <tr>
                  {customerSortColumns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      aria-sort={
                        sort === column ? (ascending ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSort(column);
                          setAscending(sort === column ? !ascending : true);
                          setPage(1);
                        }}
                      >
                        {labels[column]}{' '}
                        <span aria-hidden="true">
                          {sort === column ? (ascending ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th scope="col">Identificador</th>
                  <th scope="col" className="table-actions">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.name}</th>
                    <td>{date(c.created_at)}</td>
                    <td title={c.id}>{c.id.slice(0, 8)}</td>
                    <td className="table-actions">
                      <ActionIconButton
                        action="edit"
                        label={`Editar ${c.name}`}
                        onClick={() => setEditing(c)}
                      />{' '}
                      <ActionIconButton
                        action="remove"
                        label={`Remover ${c.name}`}
                        onClick={() => setRemoving(c)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <p>Nenhum cliente encontrado com esses filtros.</p>}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      {removing && (
        <ConfirmRemove
          description={`Remover ${removing.name} do cadastro? Os nomes nas vendas anteriores serão preservados.`}
          remove={() => removeRecord('customers', removing.id, removing.revision)}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            setRevision((v) => v + 1);
            setMessage('Cliente removido.');
          }}
        />
      )}
      {editing && (
        <CustomerModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((v) => v + 1);
            setMessage('Cliente atualizado.');
          }}
        />
      )}
      {open && (
        <CustomerModal
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setFilters(emptyCustomerFilters);
            setDraft(emptyCustomerFilters);
            setPage(1);
            setRevision((v) => v + 1);
            setMessage('Cliente cadastrado. Já está disponível na seleção de novas vendas.');
          }}
        />
      )}
    </section>
  );
}
function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    saving = useRef(false),
    active = useRef(true);
  const [name, setName] = useState(customer?.name ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const opener = useRef(document.activeElement);
  const [discardRequested, setDiscardRequested] = useState(false);
  function requestClose() {
    if (saving.current) return;
    if (name !== (customer?.name ?? '')) setDiscardRequested(true);
    else onClose();
  }
  useEffect(() => {
    active.current = true;
    const returnFocus = opener.current;
    const modal = dialog.current;
    modal?.showModal();
    return () => {
      active.current = false;
      modal?.close();
      requestAnimationFrame(() => {
        if (!modal?.open && returnFocus instanceof HTMLElement && returnFocus.isConnected)
          returnFocus.focus();
      });
    };
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    if (name.trim().length < 2) {
      setError('Informe um nome de 2 a 120 caracteres.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      if (customer) await updateCustomer(customer, name, AbortSignal.timeout(15000));
      else await createCustomer(name, AbortSignal.timeout(15000));
      if (active.current) onSaved();
    } catch {
      if (active.current)
        setError(
          'Não foi possível confirmar a alteração. O registro pode ter sido alterado por outra sessão. Confira sua conexão e acesso. Antes de repetir, consulte a lista para verificar se o cliente já foi cadastrado.',
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
      aria-labelledby={discardRequested ? 'discard-customer-title' : 'new-customer-title'}
      onCancel={(e) => {
        e.preventDefault();
        if (discardRequested) setDiscardRequested(false);
        else requestClose();
      }}
    >
      {discardRequested ? (
        <section aria-labelledby="discard-customer-title">
          <h2 id="discard-customer-title">Descartar alterações?</h2>
          <p>O que você preencheu ainda não foi salvo.</p>
          <div className="sale-actions">
            <button type="button" autoFocus onClick={() => setDiscardRequested(false)}>
              Continuar editando
            </button>
            <button type="button" className="sale-primary" onClick={onClose}>
              Descartar alterações
            </button>
          </div>
        </section>
      ) : (
        <form onSubmit={save}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">GESTÃO DE CLIENTES</p>
              <h2 id="new-customer-title">{customer ? 'Editar cliente' : 'Novo cliente'}</h2>
            </div>
            <button type="button" disabled={busy} onClick={requestClose} aria-label="Fechar">
              ✕
            </button>
          </div>
          <fieldset disabled={busy}>
            <label>
              Nome do cliente
              <input
                autoFocus
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da pessoa ou empresa"
              />
            </label>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <div className="sale-actions">
            <button type="button" disabled={busy} onClick={requestClose}>
              Cancelar
            </button>
            <button type="submit" className="sale-primary" disabled={busy}>
              {busy ? 'Salvando…' : customer ? 'Salvar alterações' : 'Salvar cliente'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
