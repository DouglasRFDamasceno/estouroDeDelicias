# Pedidos públicos com confirmação pelo WhatsApp

O cliente informa seu nome, escolhe os itens, prepara o pedido (com verificação antirrobô apenas quando ativada). A API retorna somente o número e o subtotal calculado no servidor. O botão seguinte abre o WhatsApp com nome, número e itens, sem código de importação. A preparação não comprova que a mensagem foi enviada: confirmar disponibilidade, frete e pagamento na conversa.

Na gestão, administradores veem **Vendas → Pedidos recebidos**, buscam por nome ou número e escolhem **Revisar e registrar venda**. A revisão usa os preços atuais dos produtos cadastrados. Só salvar cria a venda. É possível selecionar um cliente existente; não há criação automática de clientes. Pedidos indesejados podem ser cancelados.

## Ativação

1. Aplicar as migrações anteriores e `supabase/migrations/20261011000200_pending_orders.sql` no projeto correto, primeiro em desenvolvimento. Esta entrega não aplica SQL remoto automaticamente.
2. **Modo atual, autorizado em 11/10/2026:** Turnstile desativado. Configurar `ORDER_REQUIRE_TURNSTILE=false` no servidor e `VITE_ORDER_REQUIRE_TURNSTILE=false` no frontend. Os limites por IP e globais continuam ativos. As chaves Turnstile são dispensáveis nesse modo.

   Para ativar futuramente, configurar ambas as flags como `true` e criar um widget **Turnstile Managed** no painel Cloudflare → Turnstile → Add widget. Autorizar o hostname exato do site. A chave pública (site key) e a chave secreta são diferentes. Não usar chaves de teste em produção.

3. Configurar na Vercel as variáveis abaixo, separadamente para cada ambiente. Não colocar segredos no Git nem no chat.

| Variável                                                   | Uso                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| `ORDER_REQUIRE_TURNSTILE` / `VITE_ORDER_REQUIRE_TURNSTILE` | `false` no modo atual; `true` em ambos para exigir Turnstile |
| `VITE_TURNSTILE_SITE_KEY`                                  | Chave pública do widget; exige rebuild                       |
| `APP_ORIGIN`                                               | Origem HTTPS exata do site, sem barra final                  |
| `SUPABASE_URL`                                             | URL do projeto Supabase                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                                | Chave legada `service_role`, somente no servidor             |
| `TURNSTILE_SECRET_KEY`                                     | Chave secreta do mesmo widget                                |
| `ORDER_IP_HASH_SECRET`                                     | Segredo aleatório estável, ao menos 32 caracteres            |
| `CRON_SECRET`                                              | Segredo aleatório para a limpeza diária da Vercel            |

Manter também `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` existentes. Nenhum segredo recebe prefixo `VITE_`. Gerar os dois segredos aleatórios separadamente usando, por exemplo, `openssl rand -hex 32`. Rotacionar o segredo de IP no meio do mês reinicia, na prática, as cotas por endereço; evitar sem necessidade.

4. Publicar a aplicação na Vercel. `api/create-order.ts` roda como função Node, não como arquivo estático. A CSP permite apenas o domínio específico do Turnstile para script e iframe. `api/cleanup-orders.ts` recebe o cron diário às 06h UTC (03h de São Paulo).
5. Verificar em ambiente de desenvolvimento o checklist abaixo. Sem configuração obrigatória de banco, origem ou segredo IP, o fluxo de gravação falha fechado. Com Turnstile ativado, sua chave secreta e um token válido também são obrigatórios. O cliente ainda pode combinar diretamente pelo WhatsApp, sem criar um registro.

### Desenvolvimento local

O `npm run dev` atende `/api/create-order` pelo middleware local do Vite, reutilizando as validações e o handler de produção. Configurar `SUPABASE_SERVICE_ROLE_KEY` e `ORDER_IP_HASH_SECRET` (ao menos 32 caracteres) no `.env.local`, além das variáveis públicas existentes. `SUPABASE_URL` pode ser omitida localmente para usar `VITE_SUPABASE_URL`. Reiniciar o Vite após alterar as variáveis. Usar um projeto Supabase de desenvolvimento com as migrações aplicadas: o middleware grava no banco configurado, sem simular pedidos.

Os segredos ficam somente no processo Node. O middleware aceita apenas conexões e hosts de loopback, usa o IP real do socket e ignora os cabeçalhos de IP enviados pelo cliente. A origem é o endereço local e a porta efetiva do Vite. Não é necessário configurar `VERCEL=1` localmente. Sem os segredos, a rota retorna uma mensagem de configuração com status 503.

Em produção, o backend continua exigindo `VERCEL=1` e o cabeçalho `x-vercel-forwarded-for` fornecido pela plataforma; não publicar esse handler diretamente em outro servidor que aceite esse cabeçalho do cliente. Não extrair IP de campos do JSON nem usar fallback para cabeçalhos arbitrários. Um proxy adicional pode fazer vários clientes compartilharem o mesmo IP visto pela Vercel; validar a infraestrutura antes de adicionar proxy.

## Limites e retenção

- Máximo de **30 pedidos novos por IP por mês-calendário**, no fuso `America/Sao_Paulo`.
- Até **5 tentativas por minuto por IP** e **100 tentativas por minuto no total**. São janelas fixas de minuto, com possibilidade de rajada na virada da janela.
- Até **10.000 tentativas admitidas por mês no total**, limitando também as linhas de contadores e as chamadas ao CAPTCHA. Tentativas negadas não criam registros individuais. Ao esgotar, gravações online ficam indisponíveis até o próximo mês; o WhatsApp continua disponível.
- Até **1.000 pedidos novos por mês no total** e **300 pedidos pendentes ativos**, mesmo com rotação de IP. Cancelar/expirar um pedido não restitui a cota mensal.
- Pendentes expiram em **7 dias**. Confirmados e cancelados ficam até **30 dias da criação**; a venda confirmada permanece no histórico normal.
- A limpeza roda a cada tentativa admitida pelo backend e pelo cron diário, inclusive sem novas compras. Contadores de meses anteriores são removidos. Não há uma linha por requisição rejeitada.
- O banco recebe somente HMAC do IP, não o endereço bruto. O IP é enviado ao Turnstile para a verificação; provedores de hospedagem podem manter seus próprios logs. Não registrar corpos de pedidos ou segredos nos logs da aplicação.
- Repetir a mesma requisição, com mesmo IP e conteúdo, retorna o mesmo número e não consome outra cota de pedidos. Ao perder a confirmação, manter os dados e tentar novamente. Não há identificação automática de duplicatas criadas deliberadamente como novos pedidos.
- Confirmar o mesmo pedido duas vezes, inclusive por administradores diferentes, retorna a venda já criada. Cancelar e confirmar simultaneamente também são serializados pelo bloqueio da linha.

Os tetos acima protegem a gravação e o volume de dados. Requisições bloqueadas ainda podem consumir invocações da API e consultas de controle. Antes de expor em produção, configurar também regra de rate limit no **Vercel Firewall para `/api/create-order`**, monitoramento de uso e orçamento da hospedagem/Supabase. Não há garantia de custo zero ou disponibilidade contra DDoS. Um ataque pode esgotar o teto global e forçar atendimento por WhatsApp. IP não identifica uma pessoa; redes móveis e Wi-Fi compartilhado podem atingir a cota em conjunto.

## Verificação

- `npm run check`: lint, formatação, testes do domínio e da API com serviços simulados, TypeScript e build.
- `supabase/tests/pending_orders_security.sql`: executar em banco de teste com todas as migrações; usa transação e rollback. Confere grants/RLS, 30 pedidos/mês, 5 tentativas/minuto, cotas globais, idempotência, preços calculados pelo banco, limpeza, autorização e confirmação repetida.
- No navegador móvel: preparar pedido, enviar mensagem com número curto, localizar pela gestão e revisar/salvar. Conferir comportamento do widget, teclados, rolagem e fechamento do modal durante envio.
- Em staging, conferir que cabeçalhos de IP enviados manualmente pelo cliente são substituídos pela Vercel. Testar CAPTCHA inválido/expirado e hostnames incorretos. Não realizar testes de carga em produção.
- Verificar que cron com autenticação incorreta falha e que a limpeza diária aparece nos logs de execução, sem dados pessoais.

Referências oficiais: [cabeçalhos Vercel](https://vercel.com/docs/headers/request-headers), [funções Node](https://vercel.com/docs/functions/runtimes/node-js), [validação Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [renderização Turnstile](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/), [segurança de cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).

## Verificações desta implementação

A migração completa e o teste SQL foram executados em PostgreSQL embarcado (PGlite), com `auth.users`, `auth.sessions`, roles e helpers Auth simulados. Os testes da API usam respostas simuladas de Supabase/Turnstile. O navegador foi exercitado em 320, 390, 768 e 1280 px com resposta de gravação e widget simulados: nome, itens, referência, subtotal retornado pelo servidor, ausência de código na mensagem, alinhamento de 44 px e ausência de overflow nos cartões/seleção.

A lista administrativa também foi exercitada isoladamente em 320, 390 e 1280 px, com busca por número, revisão usando o preço atual retornado pelo catálogo e ausência de overflow.

Os testes locais acima não validam o serviço Turnstile real ou o cron hospedado. Essas verificações continuam pendentes. Nenhuma mensagem de WhatsApp foi enviada pelos testes.

Em 11/10/2026, a migração foi aplicada no Supabase e o site foi publicado em produção sem Turnstile. A credencial de servidor está configurada como variável compartilhada da Vercel, vinculada ao projeto em Production. O teste real em navegador de 390 px confirmou a gravação, o link do WhatsApp com referência curta e a repetição idempotente (mesma referência nas duas respostas). O pedido temporário foi removido após a verificação. A compilação reescreve extensões de imports TypeScript para JavaScript nas funções Node.
