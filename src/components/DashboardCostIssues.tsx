import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../domain/format';
import { totalPages } from '../domain/pagination';
import { costIssueLabels, loadDashboardCostIssues } from '../services/dashboard';
import type {
  CostIssueReason,
  DashboardCostIssue,
  DashboardProductSort,
} from '../services/dashboard';
import { useManagementRefresh } from './ManagementRefresh';
import { Pagination } from './Pagination';
import { TableScrollArea } from './TableScrollArea';
export function DashboardCostIssues({
  period,
  refreshKey,
}: {
  period: { from: string; until: string };
  refreshKey: string;
}) {
  const { trackRefresh, refreshVersion } = useManagementRefresh();
  const [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [sort, setSort] = useState<DashboardProductSort>('quantity'),
    [ascending, setAscending] = useState(false),
    [reason, setReason] = useState<CostIssueReason | 'all'>('all');
  const [rows, setRows] = useState<DashboardCostIssue[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 20000);
    setLoading(true);
    setError('');
    setRows([]);
    trackRefresh(
      loadDashboardCostIssues(
        period.from,
        period.until,
        page,
        size,
        sort,
        ascending,
        reason,
        c.signal,
      )
        .then((result) => {
          if (!active) return;
          if (page > totalPages(result.total, size)) {
            setPage(totalPages(result.total, size));
            return;
          }
          setRows(result.rows);
          setTotal(result.total);
        })
        .catch(() => {
          if (active) setError('Não foi possível consultar as pendências de custo.');
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
  }, [
    period.from,
    period.until,
    page,
    size,
    sort,
    ascending,
    reason,
    retry,
    refreshKey,
    refreshVersion,
    trackRefresh,
  ]);
  const columns = [
    ['name', 'Produto'],
    ['quantity', 'Unidades'],
    ['revenue_cents', 'Valor vendido'],
  ] as const;
  return (
    <section
      id="dashboard-cost-issues"
      className="panel dashboard-cost-issues"
      aria-labelledby="cost-issues-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="cost-issues-title">Pendências de custo</h2>
          <p>Apresentações vendidas no período que impedem o cálculo completo do lucro.</p>
        </div>
        <Link to="/demo/custos">Revisar receitas ↗</Link>
      </div>
      <div className="sale-filter">
        <label>
          Motivo da pendência
          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as CostIssueReason | 'all');
              setPage(1);
            }}
          >
            <option value="all">Todos os motivos</option>
            {Object.entries(costIssueLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">Consultando pendências…</p>
      ) : error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Tentar novamente
          </button>
        </p>
      ) : (
        <>
          <TableScrollArea
            label="Apresentações com custo pendente"
            hint="Deslize a tabela para ver o motivo e como resolver cada pendência."
          >
            <table className="product-table">
              <caption className="sr-only">Apresentações com custo pendente</caption>
              <thead>
                <tr>
                  {columns.map(([key, label]) => (
                    <th
                      key={key}
                      scope="col"
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
                  <th scope="col">Como resolver</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {row.name}
                      <small className="cost-detail">
                        {row.category} · {row.presentation}
                      </small>
                    </th>
                    <td>{row.quantity}</td>
                    <td>{money(row.revenue_cents)}</td>
                    <td>
                      {costIssueLabels[row.reason]}
                      <small className="cost-detail">
                        {row.reason === 'removed_product'
                          ? 'Revise o item na venda e escolha o produto correto.'
                          : row.reason === 'multiple_recipes'
                            ? 'Mantenha um único vínculo de receita para este produto.'
                            : row.reason === 'empty_recipe'
                              ? 'Adicione ingredientes à receita vinculada.'
                              : 'Adicione este produto em Apresentações e embalagens de uma receita.'}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollArea>
          {!rows.length && <p>Nenhuma pendência neste filtro.</p>}
          <Pagination
            page={page}
            pageSize={size}
            total={total}
            onPage={setPage}
            onPageSize={(value) => {
              setSize(value);
              setPage(1);
            }}
          />
        </>
      )}
    </section>
  );
}
