export function dashboardPeriod(now = new Date()) {
 const until = new Intl.DateTimeFormat('sv-SE', { timeZone:'America/Sao_Paulo' }).format(now);
 return { from: until.slice(0,7)+'-01', until };
}
export function validateDashboardPeriod(from: string, until: string) {
 const parse = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Informe as duas datas.');
  const date = new Date(value+'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) throw Error('Data inválida.');
  return date.getTime();
 };
 const days = (parse(until)-parse(from))/86400000;
 if (days<0 || days>365) throw Error('Selecione um período de até 366 dias, com a data final após a inicial.');
}
