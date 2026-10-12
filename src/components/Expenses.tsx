import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { dashboardPeriod, validateDashboardPeriod } from '../domain/dashboard';
import { parseExpenseDraft } from '../domain/expenses';
import { dateBR, money } from '../domain/format';
import { totalPages } from '../domain/pagination';
import { loadExpenses, removeExpense } from '../services/expenses';
import type { Expense, ExpenseFilters, ExpenseSort } from '../services/expenses';
import { requireSupabase } from '../services/supabase';
import { ActionIconButton } from './ActionIconButton';
import { ClearableInput } from './ClearableInput';
import { ConfirmRemove } from './ConfirmRemove';
import { useManagementRefresh } from './ManagementRefresh';
import { Pagination } from './Pagination';
import { TableScrollArea } from './TableScrollArea';
const initialFilters = (): ExpenseFilters => ({ ...dashboardPeriod(), search: '', category: '' });
const columns = [
  ['expense_date', 'Data'],
  ['description', 'Descrição'],
  ['category', 'Categoria'],
  ['amount_cents', 'Valor'],
] as const;
export function Expenses() {
  const { refreshVersion, trackRefresh } = useManagementRefresh();
  const [filters, setFilters] = useState(initialFilters),
    [draft, setDraft] = useState(initialFilters);
  const [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [sort, setSort] = useState<ExpenseSort>('expense_date'),
    [ascending, setAscending] = useState(false);
  const [result, setResult] = useState<{
      rows: Expense[];
      total: number;
      amount_cents: number;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [filterError, setFilterError] = useState(''),
    [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<Expense | null>(null),
    [open, setOpen] = useState(false),
    [removing, setRemoving] = useState<Expense | null>(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 20000);
    setLoading(true);
    setError('');
    setResult(null);
    trackRefresh(
      loadExpenses(filters, page, size, sort, ascending, c.signal)
        .then((data) => {
          if (!active) return;
          if (page > totalPages(data.total, size)) {
            setPage(totalPages(data.total, size));
            return;
          }
          setResult(data);
        })
        .catch(() => {
          if (active)
            setError(
              'Não foi possível consultar as despesas. Confira seu acesso e tente novamente.',
            );
        })
        .finally(() => {
          clearTimeout(timer);
          if (active) setLoading(false);
        }),
    );
    return () => {
      active = false;
      c.abort();
      clearTimeout(timer);
    };
  }, [filters, page, size, sort, ascending, retry, refreshVersion, trackRefresh]);
  return (
    <section className="panel products-panel sales-panel expenses-panel">
      <div className="panel-heading">
        <div>
          <h2>Despesas do negócio</h2>
          <p>Valores que serão descontados do lucro bruto na Visão geral.</p>
        </div>
        <button
          type="button"
          className="sale-primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
            setMessage('');
          }}
        >
          + Nova despesa
        </button>
      </div>
      <p className="fine">
        Registre despesas como energia, aluguel, frete, taxas, impostos e mão de obra na data à qual
        pertencem. Ingredientes e embalagens já incluídos nas receitas não devem ser lançados
        novamente aqui.
      </p>
      <form
        className="sale-filter"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            validateDashboardPeriod(draft.from, draft.until);
            setFilters({ ...draft });
            setPage(1);
            setFilterError('');
          } catch (issue) {
            setFilterError(issue instanceof Error ? issue.message : 'Confira os filtros.');
          }
        }}
      >
        <label>
          De
          <input
            type="date"
            required
            value={draft.from}
            onChange={(e) => setDraft((v) => ({ ...v, from: e.target.value }))}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            required
            value={draft.until}
            onChange={(e) => setDraft((v) => ({ ...v, until: e.target.value }))}
          />
        </label>
        <label>
          Buscar despesa
          <ClearableInput
            label="Buscar despesa"
            value={draft.search}
            maxLength={120}
            onChange={(e) => setDraft((v) => ({ ...v, search: e.target.value }))}
            onClear={() => setDraft((v) => ({ ...v, search: '' }))}
          />
        </label>
        <label>
          Filtrar categoria da despesa
          <ClearableInput
            label="Filtrar categoria da despesa"
            value={draft.category}
            maxLength={80}
            onChange={(e) => setDraft((v) => ({ ...v, category: e.target.value }))}
            onClear={() => setDraft((v) => ({ ...v, category: '' }))}
          />
        </label>
        <button type="submit">Filtrar</button>
        <button
          type="button"
          onClick={() => {
            const next = initialFilters();
            setDraft(next);
            setFilters(next);
            setPage(1);
            setFilterError('');
          }}
        >
          Limpar
        </button>
      </form>
      {filterError && <p role="alert">{filterError}</p>}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Consultando despesas…</p>
      ) : error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Tentar novamente
          </button>
        </p>
      ) : (
        result && (
          <>
            <p className="sale-sum">
              Total das despesas filtradas <strong>{money(result.amount_cents)}</strong>
            </p>
            <TableScrollArea
              label="Despesas cadastradas"
              hint="Deslize a tabela para ver todas as colunas e ações."
            >
              <table className="product-table">
                <caption className="sr-only">Despesas cadastradas</caption>
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
                          {label}{' '}
                          <span aria-hidden="true">
                            {sort === key ? (ascending ? '↑' : '↓') : '↕'}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((expense) => (
                    <tr key={expense.id}>
                      <td>{dateBR(expense.expense_date)}</td>
                      <th scope="row">{expense.description}</th>
                      <td>{expense.category || 'Sem categoria'}</td>
                      <td>{money(expense.amount_cents)}</td>
                      <td className="table-actions">
                        <ActionIconButton
                          action="edit"
                          label={`Editar despesa ${expense.description}`}
                          onClick={() => {
                            setEditing(expense);
                            setOpen(true);
                            setMessage('');
                          }}
                        />
                        <ActionIconButton
                          action="remove"
                          label={`Remover despesa ${expense.description}`}
                          onClick={() => setRemoving(expense)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollArea>
            {!result.rows.length && <p>Nenhuma despesa neste filtro.</p>}
            <Pagination
              page={page}
              pageSize={size}
              total={result.total}
              onPage={setPage}
              onPageSize={(value) => {
                setSize(value);
                setPage(1);
              }}
            />
          </>
        )
      )}
      {open && (
        <ExpenseModal
          expense={editing}
          defaultDate={
            dashboardPeriod().until < filters.from
              ? filters.from
              : dashboardPeriod().until > filters.until
                ? filters.until
                : dashboardPeriod().until
          }
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setRetry((v) => v + 1);
            setMessage('Despesa salva. A Visão geral será recalculada com os valores do período.');
          }}
        />
      )}
      {removing && (
        <ConfirmRemove
          description={`Remover a despesa “${removing.description}”? O resultado estimado do período será recalculado.`}
          remove={() => removeExpense(removing)}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            setRetry((v) => v + 1);
            setMessage('Despesa removida.');
          }}
        />
      )}
    </section>
  );
}
function ExpenseModal({
  expense,
  defaultDate,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    active = useRef(true),
    saving = useRef(false),
    id = useRef(expense?.id ?? crypto.randomUUID()),
    request = useRef(crypto.randomUUID()),
    payload = useRef<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    return () => {
      active.current = false;
    };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError('');
    if (!payload.current) {
      const data = new FormData(event.currentTarget);
      try {
        const value = parseExpenseDraft({
          description: String(data.get('description') ?? ''),
          category: String(data.get('category') ?? ''),
          date: String(data.get('date') ?? ''),
          amount: String(data.get('amount') ?? ''),
          notes: String(data.get('notes') ?? ''),
        });
        payload.current = {
          p_id: id.current,
          p_revision: expense?.revision ?? 0,
          p_request_id: request.current,
          p_description: value.description,
          p_category: value.category,
          p_date: value.expense_date,
          p_amount_cents: value.amount_cents,
          p_notes: value.notes,
        };
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : 'Confira os campos.');
        return;
      }
    }
    saving.current = true;
    setBusy(true);
    let definitive = false;
    try {
      const result = await requireSupabase()
        .rpc('save_expense', payload.current)
        .abortSignal(AbortSignal.timeout(20000));
      if (result.error) {
        if (result.error.code && /^[0-9A-Z]{5}$/.test(result.error.code)) {
          definitive = true;
          payload.current = null;
          setUncertain(false);
          throw Error(
            result.error.code === 'P0001'
              ? result.error.message
              : 'Não foi possível salvar. Confira seu acesso e atualize a lista.',
          );
        }
        throw Error('Confirmação indisponível');
      }
      if (!result.data) throw Error('Confirmação indisponível');
      if (active.current) onSaved();
    } catch (issue) {
      if (active.current) {
        if (!definitive) setUncertain(true);
        setError(
          definitive && issue instanceof Error
            ? issue.message
            : 'A confirmação não chegou. Repita a mesma solicitação para verificar sem duplicar a despesa.',
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
      className="sale-dialog customer-dialog form-dialog"
      aria-labelledby="expense-title"
      onCancel={(event) => {
        if (saving.current) event.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={save}>
        <div className="form-heading">
          <h2 id="expense-title">{expense ? 'Editar despesa' : 'Nova despesa'}</h2>
          <button
            type="button"
            className="form-close"
            disabled={busy}
            onClick={onClose}
            aria-label="Fechar formulário de despesa"
            title="Fechar"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <fieldset disabled={busy || uncertain}>
          <label>
            Descrição da despesa
            <input
              name="description"
              required
              minLength={2}
              maxLength={120}
              defaultValue={expense?.description}
              placeholder="Ex.: Energia de outubro"
              autoFocus
            />
          </label>
          <label>
            Categoria da despesa (opcional)
            <input
              name="category"
              maxLength={80}
              defaultValue={expense?.category}
              placeholder="Ex.: Energia, Taxas, Impostos"
            />
          </label>
          <label>
            Data da despesa
            <input
              name="date"
              type="date"
              required
              min="1900-01-01"
              max="9999-12-31"
              defaultValue={expense?.expense_date ?? defaultDate}
              aria-describedby="expense-date-help"
            />
          </label>
          <p id="expense-date-help" className="fine">
            Use a data à qual a despesa pertence, mesmo que o pagamento ocorra depois. Essa data
            define o período do lucro líquido.
          </p>
          <label>
            Valor da despesa (R$)
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={
                expense ? (expense.amount_cents / 100).toFixed(2).replace('.', ',') : ''
              }
              placeholder="125,50"
            />
          </label>
          <label>
            Observações
            <textarea name="notes" maxLength={1000} defaultValue={expense?.notes} />
          </label>
          <p className="fine">
            O valor será descontado uma vez do lucro bruto. Evite repetir ingredientes e embalagens
            que já compõem o custo das receitas.
          </p>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="sale-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="sale-primary" disabled={busy}>
            {busy ? 'Salvando…' : uncertain ? 'Confirmar novamente' : 'Salvar despesa'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
