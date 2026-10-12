import { Link } from 'react-router-dom';
import { money } from '../domain/format';
import type { DashboardSummary } from '../services/dashboard';
const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const percent = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(
        value,
      ) + '%';
export function DashboardProfit({ summary }: { summary: DashboardSummary }) {
  const incomplete = summary.costed_units !== summary.units;
  return (
    <section className="panel dashboard-margin-card" aria-label="Lucro e margens estimados">
      <p className="eyebrow">RESULTADO DO PERÍODO</p>
      <h2>
        {(summary.estimated_gross_profit_cents ?? 0) < 0
          ? 'Prejuízo bruto estimado'
          : 'Lucro bruto estimado'}
      </h2>
      <strong className="dashboard-margin">
        {summary.estimated_gross_profit_cents === null
          ? 'Cálculo indisponível'
          : money(summary.estimated_gross_profit_cents)}
      </strong>
      <p>
        {summary.estimated_gross_profit_cents === null
          ? incomplete
            ? 'Complete os custos das apresentações vendidas para calcular o resultado de todas as vendas.'
            : 'Registre vendas ou despesas para acompanhar o resultado.'
          : 'Valor vendido menos o custo estimado dos produtos vendidos, incluindo as embalagens cadastradas.'}
      </p>
      <dl className="dashboard-numbers">
        <div>
          <dt>Margem bruta sobre as vendas</dt>
          <dd>{percent(summary.estimated_gross_margin_percent)}</dd>
        </div>
        <div>
          <dt>Custo estimado {incomplete ? '(parcial)' : 'dos produtos vendidos'}</dt>
          <dd>
            {summary.costed_units || summary.units === 0
              ? money(summary.estimated_cost_cents)
              : 'Indisponível'}
          </dd>
        </div>
        <div>
          <dt>Unidades com custo calculável</dt>
          <dd>
            {number(summary.costed_units)} de {number(summary.units)}
          </dd>
        </div>
        {incomplete && (
          <div>
            <dt>Valor vendido sem custo calculável</dt>
            <dd>{money(summary.uncovered_revenue_cents)}</dd>
          </div>
        )}
      </dl>
      {summary.missing_units > 0 && (
        <p className="dashboard-attention">
          {number(summary.missing_units)} unidades sem uma receita válida. Consulte as apresentações
          pendentes abaixo.
        </p>
      )}
      {summary.ambiguous_units > 0 && (
        <p className="dashboard-attention">
          {number(summary.ambiguous_units)} unidades com mais de uma receita vinculada ao mesmo
          produto. Uma receita pode atender a vários tamanhos; cada produto precisa ter uma única
          receita de custo.
        </p>
      )}
      {incomplete && <a href="#dashboard-cost-issues">Ver pendências de custo ↓</a>}
      <div className="dashboard-net-profit">
        <h3>
          {(summary.estimated_net_profit_cents ?? 0) < 0
            ? 'Prejuízo líquido estimado'
            : 'Lucro líquido estimado'}
        </h3>
        <strong className="dashboard-margin">
          {summary.estimated_net_profit_cents === null
            ? 'Cálculo indisponível'
            : money(summary.estimated_net_profit_cents)}
        </strong>
        <dl className="dashboard-numbers">
          <div>
            <dt>Despesas registradas no período</dt>
            <dd>{money(summary.expense_cents)}</dd>
          </div>
          <div>
            <dt>Margem líquida sobre as vendas</dt>
            <dd>{percent(summary.estimated_net_margin_percent)}</dd>
          </div>
        </dl>
        <p className="fine">
          Lucro bruto menos as despesas registradas pela data à qual pertencem.{' '}
          {summary.expense_count === 0
            ? 'Nenhuma despesa cadastrada neste período. Registre seus gastos para incluí-los no resultado.'
            : `${number(summary.expense_count)} ${summary.expense_count === 1 ? 'despesa considerada' : 'despesas consideradas'}. Confira se todos os gastos e impostos do período foram registrados.`}
        </p>
        <Link to="/demo/custos?aba=expenses">Gerenciar despesas ↗</Link>
      </div>
      <p className="fine">
        Estimativa com receitas e preços atuais dos insumos: muda ao editar os custos. Gastos não
        cadastrados não são descontados. Valores a receber não são dinheiro em caixa; os
        recebimentos não alteram este cálculo.
      </p>
      <Link to="/demo/custos">Revisar receitas e insumos ↗</Link>
    </section>
  );
}
