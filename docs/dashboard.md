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

`dashboard_summary` consulta `recipe_product_costs` com os preços e quantidades de referência atuais dos insumos. No modo por unidades, divide pelo rendimento de venda da receita. No modo por peso, calcula a proporção entre peso líquido do produto e rendimento da preparação, somando as embalagens de um pacote. Receitas base contribuem com o custo da preparação, sem suas embalagens de venda. A soma usa `numeric` no PostgreSQL e só é arredondada para centavos depois de ponderar pelas quantidades vendidas, evitando arredondar prematuramente cada unidade.

Um item vendido é calculável quando seu produto está vinculado a **exatamente uma receita**, com insumos. Produtos removidos/sem receita ou receitas sem insumos entram em cobertura ausente. Produtos com múltiplas receitas entram em cobertura ambígua: nenhuma receita é escolhida arbitrariamente. O painel mostra quantidades cobertas, ausentes e ambíguas.

O custo mostrado é subtotal das unidades calculáveis, identificado como parcial quando necessário. O **lucro bruto estimado**, em reais, é o valor vendido menos o custo estimado dos produtos. A **margem bruta estimada**, em percentual, é esse lucro dividido pelo valor vendido. Ambos exigem cobertura completa; nos demais casos fica indisponível, sem tratar custos desconhecidos como zero. Insumos de preço realmente zero continuam calculáveis.

O **lucro líquido estimado** desconta do lucro bruto as despesas cadastradas em **Custos e despesas → Despesas**, usando o mesmo período. A **margem líquida estimada** divide esse resultado pelo valor vendido. Os percentuais usam as vendas como denominador, nunca o custo de produção ou o dinheiro recebido. Resultados negativos representam prejuízo. Quando o valor vendido é zero, as margens percentuais ficam indisponíveis; um período com despesas e sem vendas apresenta o prejuízo dessas despesas. Um período sem vendas nem despesas não inventa lucro.

Com cobertura incompleta, os lucros bruto e líquido e suas margens ficam indisponíveis. O custo conhecido continua visível como parcial, junto do valor vendido sem custo. Não se subtrai esse subtotal de todas as vendas para sugerir um lucro inflado.

A seção **Pendências de custo** identifica produto, apresentação, unidades, valor vendido e motivo: sem receita, várias receitas para o mesmo produto, receita sem ingredientes ou produto removido do catálogo. A consulta e o filtro por motivo são paginados no backend, com ordenação conhecida e desempate único. Uma receita pode atender a vários tamanhos; cada produto deve ter um único vínculo de custo. Produtos removidos precisam ser revisados na venda; o sistema não tenta reconhecê-los pelo nome e não altera o histórico automaticamente.

Essas estimativas mudam ao editar receitas/preços atuais e não representam o custo histórico da venda. Energia, taxas, impostos, frete e mão de obra só são descontados quando cadastrados como despesa. A tela avisa quando não há despesas registradas e pede conferir os gastos do período. Recebimentos e contas a receber não alteram o lucro por competência nem representam saldo em caixa.

## Cadastro de despesas

Em **Custos e despesas → Despesas**, cadastre descrição, categoria opcional de texto, data da despesa, valor em reais e observações opcionais. A data representa o período ao qual o gasto pertence, independentemente do pagamento; o cadastro não é uma movimentação de caixa. Valores devem ser positivos, até R$ 1.000.000,00, com duas casas decimais. Não há geração automática de despesas recorrentes.

Registre despesas do negócio como energia, aluguel, taxas, impostos e mão de obra. **Não lance novamente ingredientes e embalagens que já entram nas receitas**, para evitar descontá-los duas vezes. Compras de insumos continuam sendo referências atuais de custo; este cadastro não substitui estoque ou histórico de compras.

A listagem filtra período (até 366 dias), descrição e categoria sem acentos, ordena e calcula contagem e soma no backend com RLS. Usa páginas de 10/25/50, volta à primeira página ao aplicar filtros/ordenação/tamanho e corrige páginas vazias após exclusões. A soma corresponde a todo o filtro, não apenas à página atual.

Criar e editar usa a RPC `save_expense`, com autorização de administrador confirmado, controle de versão e idempotência. Se a confirmação se perder, repetir a mesma solicitação não duplica o lançamento. A escrita direta dos campos é bloqueada. Exclusões exigem confirmação e a revisão atual do registro. Alterações passam a valer na próxima consulta dos indicadores.

As fórmulas seguem a separação entre lucro bruto, despesas e lucro líquido descrita no [guia do Sebrae](https://sebrae.com.br/sites/PortalSebrae/artigos/como-calcular-a-margem-de-lucro-no-varejo-de-roupas%2C8aab338f65017810VgnVCM1000001b00320aRCRD), usando as informações disponíveis neste sistema.

## Tabelas e integridade

- Vendas do período: consulta paginada a `sales`, datas aplicadas no servidor, ordenação por data, cliente ou total, contagem exata.
- Produtos vendidos: agrupamento no servidor de `sale_items` com `sales`, por produto e descrição/categoria/apresentação históricas. Preços atuais do catálogo não alteram os valores vendidos. Mudanças de descrição podem gerar linhas históricas separadas para o mesmo produto.
- Ambas usam páginas de 10/25/50, ordem com desempate por ID, retorno à primeira página ao mudar ordem/tamanho/período e correção de páginas vazias. O ranking aceita apenas colunas conhecidas. Totais não dependem de carregar páginas nem sofrem o limite de registros do REST.

O resumo é calculado em uma única instrução SQL com snapshot consistente. As tabelas são consultas separadas e podem refletir alterações feitas após a hora do resumo; Atualizar dados recarrega o conjunto. Estados ficam apenas em memória e são desmontados ao trocar de sessão.

Validação: `dashboard.test.ts` cobre calendário/fuso e períodos; `dashboard_security.sql` cobre totais, período, ticket, recebimentos, cobertura incompleta, múltiplas receitas, recálculo, nomes históricos, paginação e acesso indevido. O navegador foi validado com backend simulado para filtro, ranking, estados vazio/erro e celular. A função também foi consultada no Supabase conectado, em modo somente leitura sob o papel authenticated de administrador, sem criar registros de teste.

## Migração e verificação

Requer `20261012000400_expenses_profit_dashboard.sql` antes do frontend atualizado. Acrescenta `expenses`, `save_expense`, `expenses_page`, a view `dashboard_cost_items` com `security_invoker` e a RPC `dashboard_cost_issues`. Atualiza `dashboard_summary` com lucro bruto, margens percentuais, despesas e lucro líquido. O campo antigo `estimated_gross_margin_cents` é preservado como alias do lucro bruto para clientes anteriores. Cada item recebe um único motivo de cobertura; ausência de custo e ambiguidade não contam duas vezes.

`supabase/tests/expenses_profit_dashboard.sql` verifica custos por peso com embalagens, lucros e percentuais, recebimentos independentes, despesas por competência, ausência de custos, ambiguidade, exclusões de produtos, prejuízo, vendas gratuitas, despesas sem vendas, período vazio, filtros sem acentos, paginação, totais, versão, idempotência e acesso. Os dados de teste são usados apenas no banco isolado local.

Migração aplicada no projeto conectado em 12/10/2026, versão remota `20261012201900`, com dados e custos existentes preservados por contagens e hashes. Na consulta de 01/10 a 12/10/2026, 109 de 114 unidades têm custo calculável (R$ 580,57); faltam os vínculos de Cravejado 50/100/150 g e Pipoca de infância 150 g, somando cinco unidades e R$ 68,00 em vendas sem custo. Não há despesas cadastradas. Os lucros e margens permanecem indisponíveis até completar esses vínculos. Estes valores descrevem o momento da validação, não são dados fixos do painel.

`npm run check` passou, incluindo 44 testes, lint, formatação, TypeScript e build. A navegação foi validada com backend simulado para resultados completos/incompletos, prejuízo, despesas sem vendas, erro de consulta, paginação/filtros/ordenação, correção de página após exclusão, criar/editar/remover despesas, conflito de revisão, repetição idempotente após perda da confirmação e layouts de 360 a 1536 px. O frontend ainda precisa ser publicado para disponibilizar essas telas.
