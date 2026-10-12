import { useManagementRefresh } from './ManagementRefresh';
import { useEffect, useId, useState } from 'react';
import { dateBR, money } from '../domain/format';
import { loadDashboardDays, loadDashboardProducts } from '../services/dashboard';
import type { DashboardDay, DashboardProduct, DashboardSummary } from '../services/dashboard';

export function DashboardCharts({
  period,
  summary,
}: {
  period: { from: string; until: string };
  summary: DashboardSummary;
}) {
  const { refreshVersion, trackRefresh } = useManagementRefresh();
  const gradientId = useId();
  const [selectedDate, setSelectedDate] = useState('');
  const [days, setDays] = useState<DashboardDay[] | null>(null);
  const [products, setProducts] = useState<DashboardProduct[] | null>(null);
  const [dayError, setDayError] = useState(false);
  const [productError, setProductError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let active = true;
    setDays(null);
    setProducts(null);
    setDayError(false);
    setProductError(false);
    trackRefresh(
      Promise.allSettled([
        loadDashboardDays(period.from, period.until, controller.signal)
          .then((rows) => {
            if (active) setDays(rows);
          })
          .catch(() => {
            if (active) setDayError(true);
          }),
        loadDashboardProducts(
          period.from,
          period.until,
          1,
          10,
          'quantity',
          false,
          controller.signal,
        )
          .then(({ rows }) => {
            if (active) setProducts(rows.slice(0, 5));
          })
          .catch(() => {
            if (active) setProductError(true);
          }),
      ]).finally(() => clearTimeout(timeout)),
    );
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [period.from, period.until, summary.calculated_at, retry, refreshVersion, trackRefresh]);
  const receivedPercent = summary.revenue_cents
    ? (summary.received_cents / summary.revenue_cents) * 100
    : 0;
  const peak = Math.max(1, ...(days ?? []).map((day) => day.revenue_cents));
  const x = (index: number) => 64 + (index / Math.max(1, (days?.length ?? 1) - 1)) * 616;
  const y = (value: number) => 190 - (value / peak) * 156;
  const points = (days ?? []).map((day, index) => `${x(index)},${y(day.revenue_cents)}`).join(' ');
  const selectedDay = days?.find((day) => day.date === selectedDate) ?? days?.at(-1);
  const maxQuantity = Math.max(1, ...(products ?? []).map((product) => product.quantity));
  const retryButton = (
    <button type="button" onClick={() => setRetry((v) => v + 1)}>
      Tentar novamente
    </button>
  );
  return (
    <div className="dashboard-charts">
      <section className="panel dashboard-line-card" aria-labelledby="sales-chart-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-overline">RITMO DO NEGÓCIO</p>
            <h2 id="sales-chart-title">Evolução das vendas</h2>
          </div>
          <span className="dashboard-chart-badge">
            <span /> Vendas diárias
          </span>
        </div>
        <p>Valor vendido por dia no período selecionado. Dias sem vendas aparecem como zero.</p>
        {dayError ? (
          <p role="alert">Não foi possível carregar a evolução. {retryButton}</p>
        ) : !days ? (
          <p role="status">Carregando evolução…</p>
        ) : !summary.sale_count ? (
          <p>Nenhuma venda no período para exibir.</p>
        ) : (
          <>
            <div className="dashboard-chart-summary">
              <div>
                <span>Total no período</span>
                <strong>{money(summary.revenue_cents)}</strong>
              </div>
              {selectedDay && (
                <label className="dashboard-day-picker">
                  <span>{money(selectedDay.revenue_cents)} neste dia</span>
                  <select
                    aria-label="Consultar vendas de um dia"
                    value={selectedDay.date}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  >
                    {days.map((day) => (
                      <option key={day.date} value={day.date}>
                        {dateBR(day.date)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="dashboard-chart-viewport">
              <svg
                className="dashboard-line-chart"
                viewBox="0 0 720 230"
                role="img"
                aria-label={`Vendas diárias de ${dateBR(period.from)} a ${dateBR(period.until)}. Total de ${money(summary.revenue_cents)}.`}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eb0956" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#eb0956" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                <polygon
                  points={`64,190 ${points} ${x(days.length - 1)},190`}
                  fill={`url(#${gradientId})`}
                />
                {[0, 0.5, 1].map((ratio) => (
                  <g key={ratio}>
                    <line
                      x1="64"
                      x2="680"
                      y1={y(peak * ratio)}
                      y2={y(peak * ratio)}
                      className="chart-grid-line"
                    />
                    <text x="57" y={y(peak * ratio) + 4} textAnchor="end">
                      {new Intl.NumberFormat('pt-BR', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format((peak * ratio) / 100)}
                    </text>
                  </g>
                ))}
                <text x="64" y="18">
                  Valor (R$)
                </text>
                <polyline points={points} fill="none" className="chart-line" />
                {days.map((day, index) => (
                  <circle
                    key={day.date}
                    cx={x(index)}
                    cy={y(day.revenue_cents)}
                    r={days.length > 60 ? 2 : 4}
                    className={`chart-point${day.date === selectedDay?.date ? ' selected' : ''}`}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <title>
                      {dateBR(day.date)}: {money(day.revenue_cents)}
                    </title>
                  </circle>
                ))}
                <text x="64" y="218">
                  {dateBR(period.from)}
                </text>
                <text x="680" y="218" textAnchor="end">
                  {dateBR(period.until)}
                </text>
              </svg>
            </div>
            <details className="chart-data">
              <summary>Consultar valores diários</summary>
              <dl>
                {days.map((day) => (
                  <div key={day.date}>
                    <dt>{dateBR(day.date)}</dt>
                    <dd>{money(day.revenue_cents)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </>
        )}
      </section>
      <section className="panel" aria-labelledby="receipts-chart-title">
        <p className="dashboard-overline">CADA VALOR, SEU LUGAR</p>
        <h2 id="receipts-chart-title">Recebido e a receber</h2>
        <p>Distribuição do valor das vendas do período.</p>
        {!summary.revenue_cents ? (
          <p>Nenhum valor vendido no período.</p>
        ) : (
          <div className="dashboard-pie-layout">
            <div
              className="dashboard-pie"
              role="img"
              aria-label={`${receivedPercent.toFixed(1).replace('.', ',')}% recebido; ${(100 - receivedPercent).toFixed(1).replace('.', ',')}% a receber.`}
              style={{
                background: `conic-gradient(#eb0956 0% ${receivedPercent}%, #452365 ${receivedPercent}% 100%)`,
              }}
            >
              <div className="dashboard-donut-center" aria-hidden="true">
                <strong>
                  {Math.round(receivedPercent)}
                  <small>%</small>
                </strong>
                <span>recebido</span>
              </div>
            </div>
            <dl className="chart-legend">
              <div>
                <dt>
                  <span className="chart-dot received" />
                  Recebido
                </dt>
                <dd>{money(summary.received_cents)}</dd>
              </div>
              <div>
                <dt>
                  <span className="chart-dot receivable" />A receber
                </dt>
                <dd>{money(summary.receivable_cents)}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
      <section className="panel" aria-labelledby="products-chart-title">
        <p className="dashboard-overline">OS QUERIDINHOS</p>
        <h2 id="products-chart-title">Produtos mais vendidos</h2>
        <p>Até 5 produtos por quantidade de unidades no período.</p>
        {productError ? (
          <p role="alert">Não foi possível carregar os produtos. {retryButton}</p>
        ) : !products ? (
          <p role="status">Carregando produtos…</p>
        ) : !products.length ? (
          <p>Nenhum produto vendido no período.</p>
        ) : (
          <ol className="dashboard-bars">
            {products.map((product, index) => (
              <li key={product.id}>
                <div>
                  <span>
                    <b className="dashboard-rank">{String(index + 1).padStart(2, '0')}</b>
                    {product.name} <small>{product.presentation}</small>
                  </span>
                  <strong>{product.quantity.toLocaleString('pt-BR')} un.</strong>
                </div>
                <div className="chart-bar-track" aria-hidden="true">
                  <span style={{ width: `${(product.quantity / maxQuantity) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
