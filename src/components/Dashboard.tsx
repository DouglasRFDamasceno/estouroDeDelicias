import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { dashboardPeriod, validateDashboardPeriod } from '../domain/dashboard';
import { dateBR, money } from '../domain/format';
import { totalPages } from '../domain/pagination';
import { loadDashboard, loadDashboardProducts } from '../services/dashboard';
import type { DashboardSummary, DashboardProduct, DashboardProductSort } from '../services/dashboard';
import { loadSales } from '../services/sales';
import type { Sale, SaleSort } from '../services/sales';
import { Pagination } from './Pagination';
const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
export function Dashboard() {
 const { identity, identityLoading } = useAuth();
 const [period, setPeriod] = useState(dashboardPeriod), [draft, setDraft] = useState(dashboardPeriod), [periodError, setPeriodError] = useState('');
 const [summary, setSummary] = useState<DashboardSummary | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
 useEffect(() => {
  if (!identity?.isAdmin) return;
  let active = true; const c = new AbortController(); const timer = setTimeout(() => c.abort(),20000);
  setSummary(null); setError('');
  loadDashboard(period.from,period.until,c.signal).then(data => { if (active) setSummary(data); }).catch(() => { if (active) setError('Não foi possível consultar os indicadores. Confira sua conexão e permissão e tente novamente.'); }).finally(() => clearTimeout(timer));
  return () => { active = false; c.abort(); clearTimeout(timer); };
 }, [identity?.isAdmin,period,revision]);
 useEffect(() => { const refresh = () => setRevision(v => v+1); window.addEventListener('focus',refresh); return () => window.removeEventListener('focus',refresh); }, []);
 if (identityLoading) return <p role="status">Carregando acesso…</p>;
 if (!identity?.isAdmin) return <section className="panel"><h2>Visão geral</h2><p>Os indicadores de gestão são exclusivos para administradores.</p></section>;
 return <div className="real-dashboard"><form className="panel dashboard-period" onSubmit={e => { e.preventDefault(); try { validateDashboardPeriod(draft.from,draft.until); setPeriod({...draft}); setPeriodError(''); } catch(issue) { setPeriodError(issue instanceof Error ? issue.message : 'Confira as datas.'); } }}><div><label>De<input type="date" required value={draft.from} onChange={e => setDraft(v => ({...v,from:e.target.value}))} /></label><label>Até<input type="date" required value={draft.until} onChange={e => setDraft(v => ({...v,until:e.target.value}))} /></label><button type="submit">Aplicar período</button><button type="button" onClick={() => { const current = dashboardPeriod(); setDraft(current); setPeriod(current); setPeriodError(''); }}>Este mês</button><button type="button" onClick={() => setRevision(v => v+1)}>Atualizar dados</button></div>{periodError && <p role="alert">{periodError}</p>}<p className="fine">Indicadores por data da venda: {dateBR(period.from)} a {dateBR(period.until)}. Os recebimentos correspondem ao valor registrado nessas vendas, sem histórico de datas de pagamento.</p></form>
 {error ? <section className="panel"><p role="alert">{error}</p><button type="button" onClick={() => setRevision(v => v+1)}>Tentar novamente</button></section> : !summary ? <p role="status">Consultando indicadores do sistema…</p> : <>
 <p className="dashboard-updated">Consultado em {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(summary.calculated_at))} · horário de Brasília</p>
 {summary.sale_count === 0 && <section className="panel"><h2>Nenhuma venda neste período.</h2><p>Cadastre uma venda ou selecione outro intervalo para acompanhar os resultados.</p><Link to="/demo/vendas">Registrar vendas ↗</Link></section>}
 <div className="stats">{[
 ['Vendas no período',money(summary.revenue_cents),'Soma dos valores das vendas registradas'],
 ['Recebido dessas vendas',money(summary.received_cents),'Recebimentos informados nos cadastros'],
 ['A receber no período',money(summary.receivable_cents),'Total vendido menos valor recebido'],
 ['Ticket médio',summary.sale_count ? money(summary.average_ticket_cents) : '—',`${number(summary.sale_count)} vendas no período`]
 ].map(([label,value,hint]) => <article className="stat" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</div>
 <div className="dashboard-grid"><section className="panel"><h2>Recebimentos e pendências</h2><dl className="dashboard-numbers"><div><dt>Vendas quitadas no período</dt><dd>{number(summary.settled_count)}</dd></div><div><dt>Recebidas parcialmente</dt><dd>{number(summary.partial_count)}</dd></div><div><dt>Sem recebimento</dt><dd>{number(summary.unpaid_count)}</dd></div><div><dt>Unidades vendidas</dt><dd>{number(summary.units)}</dd></div></dl>
 {summary.revenue_cents > 0 && <><label className="dashboard-progress-label" htmlFor="dashboard-received">Recebimento do valor vendido: {new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1}).format(summary.received_cents/summary.revenue_cents)}</label><progress id="dashboard-received" value={summary.received_cents} max={summary.revenue_cents} /></>}
 <div className="dashboard-receivable"><span>A receber em todo o histórico</span><strong>{money(summary.all_receivable_cents)}</strong><small>{number(summary.all_pending_count)} vendas com saldo pendente · inclui outros períodos</small></div><Link to="/demo/vendas">Consultar vendas ↗</Link></section>
 <section className="panel"><p className="eyebrow">CUSTOS E COBERTURA</p><h2>Margem bruta estimada</h2><strong className="dashboard-margin">{summary.estimated_gross_margin_cents === null ? 'Cálculo indisponível' : money(summary.estimated_gross_margin_cents)}</strong><p>{summary.estimated_gross_margin_cents === null ? summary.sale_count ? 'Faltam custos completos para estimar a margem de todas as vendas.' : 'Registre vendas para acompanhar a margem.' : 'Valor vendido menos os custos estimados das unidades vendidas.'}</p>
 <dl className="dashboard-numbers"><div><dt>Custo estimado {summary.costed_units !== summary.units ? '(somente unidades com receita)' : 'dos itens vendidos'}</dt><dd>{summary.costed_units ? money(summary.estimated_cost_cents) : 'Sem custo disponível'}</dd></div><div><dt>Unidades com custo calculável</dt><dd>{number(summary.costed_units)} de {number(summary.units)}</dd></div></dl>
 {summary.missing_units > 0 && <p className="dashboard-attention">{number(summary.missing_units)} unidades sem receita vinculada válida, incluindo produtos removidos do catálogo.</p>}{summary.ambiguous_units > 0 && <p className="dashboard-attention">{number(summary.ambiguous_units)} unidades pertencem a produtos com várias receitas. Mantenha uma receita por apresentação para calcular a margem sem ambiguidade.</p>}
 <p className="fine">Estimativa com receitas e preços atuais dos insumos; pode mudar ao editar os custos. Não representa lucro líquido nem saldo em caixa. Despesas operacionais, perdas e mão de obra não possuem valores registrados para este cálculo.</p><Link to="/demo/custos">Revisar receitas e insumos ↗</Link></section></div>
 <section className="panel"><h2>Cadastros atuais</h2><div className="dashboard-counts">{[['Produtos',summary.product_count,'produtos'],['Clientes',summary.customer_count,'clientes'],['Insumos',summary.material_count,'custos'],['Receitas',summary.recipe_count,'custos']].map(([label,count,path]) => <Link key={label} to={`/demo/${path}`}><span>{label}</span><strong>{number(Number(count))}</strong></Link>)}</div><p className="fine">Totais atuais de cadastros; não são limitados pelo período das vendas.</p></section>
 <DashboardTable key={`sales-${period.from}-${period.until}-${revision}`} kind="sales" period={period} /><DashboardTable key={`products-${period.from}-${period.until}-${revision}`} kind="products" period={period} />
 </>}</div>;
}
function DashboardTable({kind,period}:{kind:'sales'|'products';period:{from:string;until:string}}) {
 const sales = kind === 'sales';
 const [page,setPage] = useState(1), [size,setSize] = useState(10), [sort,setSort] = useState(sales ? 'sale_date' : 'revenue_cents'), [ascending,setAscending] = useState(false), [revision,setRevision] = useState(0);
 const [rows,setRows] = useState<(Sale | DashboardProduct)[]>([]), [total,setTotal] = useState(0), [loading,setLoading] = useState(true), [error,setError] = useState('');
 useEffect(() => { let active = true; const c = new AbortController(); const timer=setTimeout(() => c.abort(),20000);setLoading(true);setRows([]);setError('');
  const request=sales ? loadSales(page,size,'',sort as SaleSort,ascending,c.signal,period) : loadDashboardProducts(period.from,period.until,page,size,sort as DashboardProductSort,ascending,c.signal);
  request.then(r => { if (!active) return; if (page>totalPages(r.total,size)) {setPage(totalPages(r.total,size));return;}setRows(r.rows);setTotal(r.total); }).catch(issue => { if(active) { if (issue?.code==='PGRST103' && page>1) {setPage(1);return;}setError('Não foi possível carregar esta tabela.'); } }).finally(() => { clearTimeout(timer);if(active)setLoading(false); });
  return () => {active=false;c.abort();clearTimeout(timer);};
 },[sales,period,page,size,sort,ascending,revision]);
 const columns=sales ? [['sale_date','Data'],['customer','Cliente'],['total_cents','Total']] : [['name','Produto'],['quantity','Quantidade'],['revenue_cents','Valor vendido']];
 return <section className="panel"><div className="panel-heading"><div><h2>{sales ? 'Vendas do período' : 'Produtos vendidos no período'}</h2><p>{sales ? 'Registros reais, começando pelas vendas mais recentes.' : 'Ranking pelos itens registrados nas vendas; descrições e preços preservados no histórico.'}</p></div><Link to={sales ? '/demo/vendas' : '/demo/produtos'}>{sales ? 'Gerenciar vendas ↗' : 'Ver catálogo ↗'}</Link></div>
 {loading ? <p role="status">Carregando tabela…</p> : error ? <p role="alert">{error} <button type="button" onClick={() => setRevision(v=>v+1)}>Tentar novamente</button></p> : <><div className="product-table-scroll"><table className="product-table"><caption className="sr-only">{sales ? 'Vendas do período' : 'Produtos vendidos no período'}</caption><thead><tr>{columns.map(([key,label])=><th key={key} aria-sort={sort===key ? ascending ? 'ascending':'descending':'none'}><button type="button" onClick={()=>{setSort(key);setAscending(sort===key ? !ascending:true);setPage(1);}}>{label} {sort===key ? ascending?'↑':'↓':'↕'}</button></th>)}{sales && <><th>Recebido</th><th>A receber</th></>}</tr></thead><tbody>{rows.map(row=>'sale_date' in row ? <tr key={row.id}><td>{dateBR(row.sale_date)}</td><th scope="row">{row.customer}</th><td>{money(row.total_cents)}</td><td>{money(row.received_cents)}</td><td>{money(row.total_cents-row.received_cents)}</td></tr> : <tr key={row.id}><th scope="row">{row.name}<small className="cost-detail">{row.category} · {row.presentation}</small></th><td>{number(row.quantity)}</td><td>{money(row.revenue_cents)}</td></tr>)}</tbody></table></div>{!rows.length && <p>Nenhum registro neste período.</p>}<Pagination page={page} pageSize={size} total={total} onPage={setPage} onPageSize={v=>{setSize(v);setPage(1);}} /></>}</section>;
}
