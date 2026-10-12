# Arquitetura e plano

## Decisões da etapa 1

Uma única aplicação React + TypeScript, construída pelo Vite. Ionic oferece componentes e navegação adaptados ao dispositivo; Capacitor empacotará o mesmo build em Android/iOS. Sem backend próprio nesta fase. Supabase fornece Auth e PostgreSQL; a aplicação web é hospedada na Vercel. Internet obrigatória; sem service worker, cache de dados ou sincronização offline.

- `src/pages`: telas públicas e área de gestão.
- `src/components`: elementos reutilizáveis.
- `src/services`: adaptadores Supabase; dados antigos de demonstração não são usados pela gestão.
- `src/types`: contratos de domínio.
- `src/domain`: cálculos e formatação compartilhados por web e aplicativos.
- `supabase/migrations`: SQL versionado das tabelas, políticas e funções implementadas.

A etapa de Auth foi implementada no código: cadastro, login, recuperação, callbacks web e perfil privado em `/conta`. Veja [ativação e segurança](supabase.md). `/demo/*` mantém o endereço original, mas suas seções consultam dados reais. Produtos são consultáveis por contas confirmadas; clientes, vendas, custos e indicadores exigem administrador confirmado. O catálogo da Estouros é compartilhado, sem multiempresa implementada. Perfis continuam privados ao titular.

## Etapas pequenas e critérios de validação

1. **Base implementada:** estrutura, landing e layout Ionic. Validar navegação, telas pequenas, tipos e build.
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

## Indicadores e período implementados

A Visão geral usa exclusivamente os registros reais do Supabase. Agregações e ranking ocorrem no servidor, com RLS, filtro por `sale_date` e paginação nas tabelas. A data inicial padrão é o começo do mês atual em America/Sao_Paulo.

As regras e limites estão em [docs/dashboard.md](dashboard.md). Recebimentos são os valores informados nas vendas selecionadas, sem histórico de pagamentos por data. Custos e margem bruta usam receitas e preços atuais dos insumos; não são custos históricos nem lucro líquido. Produtos sem receita ou com múltiplas receitas deixam a margem total indisponível. Não existe tabela de despesas operacionais nesta etapa, por isso esses valores não são presumidos.

A modelagem multiempresa, pagamentos e descontos descritos acima é uma proposta futura; não corresponde ao esquema atual. A vitrine pública ainda possui catálogo estático, independente do cadastro da gestão.
