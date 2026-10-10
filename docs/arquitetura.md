# Arquitetura e plano

## Decisões da etapa 1

Uma única aplicação React + TypeScript, construída pelo Vite. Ionic oferece componentes e navegação adaptados ao dispositivo; Capacitor empacotará o mesmo build em Android/iOS. Sem backend próprio nesta fase. Supabase fornecerá Auth e PostgreSQL; Cloudflare Pages receberá os arquivos estáticos futuramente. Internet obrigatória; sem service worker, cache de dados ou sincronização offline.

- `src/pages`: telas públicas e área demonstrativa.
- `src/components`: elementos reutilizáveis.
- `src/services`: dados fictícios agora; adaptadores Supabase depois.
- `src/types`: contratos de domínio.
- `src/domain`: cálculos e formatação compartilhados por web e aplicativos.
- `supabase/migrations`: SQL versionado quando a modelagem for implementada.

A etapa de Auth foi implementada no código: cadastro, login, recuperação, callbacks web e perfil privado em `/conta`. Veja [ativação e segurança](supabase.md). `/demo/*` permanece público e fictício. A migração de perfil não cria papéis nem acesso a empresas.

## Etapas pequenas e critérios de validação

1. **Atual:** estrutura, landing e layout Ionic. Validar navegação, telas pequenas, tipos e build.
2. **Auth:** cliente Supabase, cadastro/login/logout/recuperação, sessão persistente, estados de carregamento e erro, validação de formulários, rotas privadas e callbacks web/mobile. Testar sessão expirada, confirmação, recuperação e acesso direto sem sessão.
3. **Banco:** revisar a proposta abaixo; criar migrações SQL reais, RLS e provisionamento transacional da empresa. Testar com duas empresas e acesso direto à API, incluindo alteração fraudulenta de company_id.
4. **Cadastros:** produtos, clientes, despesas. Validar valores, carregamento, lista vazia, erros e isolamento.
5. **Vendas:** itens, desconto, pagamentos, histórico por período e indicadores; transações e testes de dinheiro. Testar alterações de preço/custo no produto sem alterar vendas antigas.
6. **Aplicativos e hospedagem:** deep links, teclado, áreas seguras, testes reais Android/iOS; depois configurar Cloudflare Pages. Publicação será uma tarefa própria.

## Modelagem proposta — ainda não implementada

| Tabela | Campos principais e regras |
| --- | --- |
| companies | id UUID, name, timezone (America/Sao_Paulo), created_at |
| company_members | company_id, user_id → auth.users, role (owner/member); PK composta |
| products | id, company_id, name, price_cents, cost_cents, active |
| customers | id, company_id, name, contatos opcionais, active |
| expenses | id, company_id, description, category, amount_cents, incurred_on DATE |
| sales | id, company_id, customer_id opcional, sold_on DATE, status (draft/confirmed/cancelled), discount_cents, created_by |
| sale_items | id, company_id, sale_id, product_id opcional, product_name_snapshot, quantity inteira > 0, unit_price_cents, unit_cost_cents |
| sale_payments | id, company_id, sale_id, amount_cents, paid_on DATE, method (pix/cash/card/other) |

Valores monetários: BIGINT em centavos com CHECK >= 0, limites de negócio e verificação de inteiro seguro no JavaScript. Não usar ponto flutuante para cálculos; conversão para reais apenas na apresentação. A entrada decimal será convertida de texto para centavos, sem multiplicar parseFloat por 100. Quantidades inteiras no MVP; venda por peso exigirá uma regra de escala e arredondamento revisada.

Cada registro de negócio tem company_id obrigatório. FKs compostas (company_id, parent_id) referenciam UNIQUE(company_id, id), impedindo itens, pagamentos ou clientes vinculados a outra empresa. Produtos e clientes usados serão arquivados, preservando histórico. Itens mantêm nome, custo e preço praticados como snapshots, independentemente do catálogo futuro.

Confirmação de venda via função transacional: validar vínculo e papel do usuário, gravar itens, validar desconto <= subtotal e recebimentos <= total, congelar snapshots e total. Proibir alterações diretas em vendas confirmadas; cancelamento explícito exclui a venda dos indicadores e precisa tratar estornos. Situação do pagamento derivada da soma de pagamentos (pendente/parcial/pago), evitando divergência de campo duplicado. Desconto único da venda no MVP; se desconto por item for necessário, revisar regras antes da migração.

### RLS e autorização planejadas

Habilitar RLS em todas as tabelas expostas. Sem políticas de negócio para anon. SELECT/INSERT/UPDATE/DELETE exigirão vínculo ativo entre auth.uid() e company_id, usando USING e WITH CHECK. Empresas visíveis apenas aos membros. Usuários não podem se promover, criar vínculos arbitrários nem trocar company_id. Gerência de membros reservada ao owner por fluxo seguro. Provisionamento cria empresa e primeiro owner atomicamente no servidor; nunca confiar no company_id informado pela interface.

Evitar recursão da policy de membros com helper privado cuidadosamente restrito (SECURITY DEFINER, search_path fixo, permissões mínimas); revisar antes de implementar. Grants também limitam ações. Testes com anon e dois usuários em empresas diferentes devem demonstrar isolamento da API, inclusive inserts/updates cruzados. Proteção de rotas é experiência de uso; RLS é a fronteira de segurança. Não usar service_role no navegador, logs, .env.example ou bundle.

## Indicadores e período

A demonstração contém três vendas confirmadas e duas despesas de outubro de 2026. Os recebimentos fictícios pertencem às mesmas vendas do período; não é relatório de fluxo de caixa.

- Faturamento: soma de quantidade × preço histórico, menos desconto de cada venda confirmada no período de sold_on.
- Recebidos: soma de pagamentos dessas vendas, até a data de corte do relatório.
- A receber: faturamento menos recebidos; não aceitar pagamento acima do total.
- Custo dos itens vendidos: soma de quantidade × custo histórico das vendas confirmadas do período.
- Despesas: soma de despesas por incurred_on no período; excluir insumos já incorporados ao custo dos produtos para não contar duas vezes.
- Resultado estimado: faturamento − custo dos itens vendidos − despesas. Regime de competência; não é caixa nem lucro contábil, e não inclui tributos/taxas não cadastrados.

Resultado do exemplo: faturamento R$ 606,00, recebidos R$ 276,00, a receber R$ 330,00, custo R$ 262,00, despesas R$ 131,00 e resultado R$ 213,00. A vitrine pública apresenta o cardápio fornecido pela marca; seus preços não se vinculam aos dados fictícios da gestão.

Datas de negócio são DATE e apresentadas em pt-BR; timestamps de auditoria serão TIMESTAMPTZ em UTC. Filtros futuros usam datas inclusivas na zona da empresa. Relatório de caixa por paid_on será separado para não confundir recebimentos de vendas antigas com faturamento do período.
