# Visão geral: indicadores reais

`/demo/dashboard` consulta exclusivamente tabelas reais do Supabase. Não importa `services/demo.ts` nem usa os antigos cálculos de exemplo. A migração `20261010001000_dashboard.sql` cria duas funções **SECURITY INVOKER** que executam as agregações respeitando RLS e verificam administrador com e-mail confirmado. Nenhum registro é criado para preencher o painel.

## Período e recebimentos

O período começa no primeiro dia do mês atual até hoje em **America/Sao_Paulo**, com datas inclusivas de `sales.sale_date`. É possível selecionar até 366 dias. O botão Atualizar dados refaz a consulta; retornar o foco à janela também atualiza. A interface mostra a hora de consulta e descarta a resposta anterior ao carregar outro período. Erros não são substituídos por valores de exemplo ou saldos zerados.

- Vendas: soma de `sales.total_cents` do período.
- Recebido dessas vendas: soma de `sales.received_cents` dos mesmos registros.
- A receber no período: total menos recebido.
- Ticket médio: média dos totais por venda; sem vendas, aparece “—”.
- Quitadas: recebido igual ao total (inclusive vendas de valor zero).
- Parciais: recebido maior que zero e menor que o total.
- Sem recebimento: total positivo e recebido zero.
- Unidades vendidas: soma das quantidades de `sale_items` das vendas selecionadas; refere-se a unidades de venda, não peso.
- A receber em todo o histórico: soma de todos os saldos pendentes, independente do período, acompanhada da quantidade de vendas pendentes.

O banco não tem datas de recebimentos individuais. Por isso, o painel não apresenta fluxo de caixa ou valores recebidos por data de pagamento. Produtos, clientes, insumos e receitas são contagens atuais de cadastros e não sofrem o filtro de data das vendas.

## Custo e margem estimados

`dashboard_summary` calcula o custo com as quantidades das receitas, conversões g/kg e ml/l, preço e quantidade de referência atuais dos insumos, dividindo pelo rendimento de cada receita. A soma usa `numeric` no PostgreSQL e só é arredondada para centavos depois de ponderar pelas quantidades vendidas, evitando arredondar prematuramente cada unidade.

Um item vendido é calculável quando seu produto está vinculado a **exatamente uma receita**, com insumos. Produtos removidos/sem receita ou receitas sem insumos entram em cobertura ausente. Produtos com múltiplas receitas entram em cobertura ambígua: nenhuma receita é escolhida arbitrariamente. O painel mostra quantidades cobertas, ausentes e ambíguas.

O custo mostrado é subtotal das unidades calculáveis, identificado como parcial quando necessário. A **margem bruta estimada** (valor vendido menos custo estimado) só aparece quando há vendas, itens e cobertura completa; nos demais casos fica indisponível, sem tratar custos desconhecidos como zero. Insumos de preço realmente zero continuam calculáveis.

Essa estimativa muda ao editar receitas/preços atuais e não representa o custo histórico da venda. Não há despesas operacionais, perdas, energia, tributos ou mão de obra registrados de forma própria; nenhum desses valores é inventado ou deduzido. Não é lucro líquido nem saldo em caixa.

## Tabelas e integridade

- Vendas do período: consulta paginada a `sales`, datas aplicadas no servidor, ordenação por data, cliente ou total, contagem exata.
- Produtos vendidos: agrupamento no servidor de `sale_items` com `sales`, por produto e descrição/categoria/apresentação históricas. Preços atuais do catálogo não alteram os valores vendidos. Mudanças de descrição podem gerar linhas históricas separadas para o mesmo produto.
- Ambas usam páginas de 10/25/50, ordem com desempate por ID, retorno à primeira página ao mudar ordem/tamanho/período e correção de páginas vazias. O ranking aceita apenas colunas conhecidas. Totais não dependem de carregar páginas nem sofrem o limite de registros do REST.

O resumo é calculado em uma única instrução SQL com snapshot consistente. As tabelas são consultas separadas e podem refletir alterações feitas após a hora do resumo; Atualizar dados recarrega o conjunto. Estados ficam apenas em memória e são desmontados ao trocar de sessão.

Validação: `dashboard.test.ts` cobre calendário/fuso e períodos; `dashboard_security.sql` cobre totais, período, ticket, recebimentos, cobertura incompleta, múltiplas receitas, recálculo, nomes históricos, paginação e acesso indevido. O navegador foi validado com backend simulado para filtro, ranking, estados vazio/erro e celular. A função também foi consultada no Supabase conectado, em modo somente leitura sob o papel authenticated de administrador, sem criar registros de teste.
