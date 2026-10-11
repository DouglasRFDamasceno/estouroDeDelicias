# Auditoria de segurança — Estouro de Delícias

Data: 11/10/2026. Modo: auditoria. Nenhuma correção aplicada.

## Resultado e escopo

Foi confirmado **1 achado de severidade média**, por execução local isolada. Não foram demonstradas vulnerabilidades críticas ou altas no escopo examinado. A lista não foi preenchida artificialmente até dez; não há achados confirmados adicionais omitidos. Ausência de outros achados não comprova segurança do projeto.

Arquitetura: SPA React/TypeScript, Ionic e Vite, npm com package-lock.json; Supabase Auth, PostgreSQL via PostgREST/RPC e Edge Function Deno para convites; hospedagem estática prevista na Vercel. Capacitor está presente, mas a integração nativa de autenticação não está concluída segundo a documentação. Não há backend HTTP próprio além da função de convite. A vitrine usa catálogo estático e encaminha pedidos ao WhatsApp. A consulta de CEP envia o CEP ao ViaCEP, sem cookies ou referrer.

Foram examinados AGENTS.md, rotas, serviços de acesso a dados, fluxos de perfil/login/recuperação/convite/logout, política de sessão, configurações de build e hospedagem, as dez migrações SQL, grants/policies/funções, arquivos de testes SQL e documentação de arquitetura/administração/sessões. A revisão de componentes e dependências foi direcionada às operações sensíveis, não uma prova exaustiva de todos os estados de interface ou de todo o grafo de pacotes.

Limites de confiança: o navegador é controlável pelo usuário; autorização deve acontecer no Auth, nas policies/grants do PostgreSQL e nas RPCs. A função de convite usa service_role exclusivamente no servidor e verifica identidade e papel atual. Metadados de usuário não podem conceder administração.

O modelo atual é **uma única operação com catálogo compartilhado**, conforme docs/arquitetura.md. Administradores globais podem gerenciar todos os registros de negócio; usuários comuns confirmados podem ler produtos e somente seu próprio perfil. Não existe contrato atual de isolamento por empresa ou propriedade individual de vendas/custos. Portanto, acesso de um administrador a vendas criadas por outro administrador não foi considerado IDOR. Isso precisará mudar se for introduzido multiempresa.

Não foram consultados banco, painel Auth, storage, Edge Function publicada ou site em produção. Não se comprovou que migrações, headers e configurações documentadas correspondem ao ambiente publicado. Não houve exploração remota, envio de e-mail, uso de credenciais reais, instalação de ferramentas ou alteração de dependências.

## Achados priorizados

| ID | Vulnerabilidade | Severidade | Confiança | Localização |
| --- | --- | --- | --- | --- |
| SEC-01 | Prazo de sessão de 72 horas contornável por depender do cliente | Média | Alta no desvio local; imposição remota não verificada | src/services/sessionPolicy.ts:28–37, 44–67; docs/sessions.md:23; supabase/migrations/20261010000100_user_profiles.sql:45–47 |

## SEC-01 — Prazo de sessão controlado pelo navegador

**Estado:** pendente; risco já documentado e aceito anteriormente, segundo docs/sessions.md:23. Este relatório não altera essa decisão nem aplica configuração externa. **Categoria:** CWE-602 (controle de segurança imposto no cliente), OWASP A07:2021.

### Evidência e causa raiz

src/services/sessionPolicy.ts:55 lê startedAt e lastActiveAt de localStorage. Ao restaurar a sessão, esses valores passam a definir a referência confiável; check(), nas linhas 28–37, usa o relógio local. src/domain/sessionPolicy.ts:8–30 valida formato e diferença de tempo, mas não consegue autenticar a origem dos horários.

Alterar startedAt durante uma instância ativa provoca expiração, pois check() compara com o valor em memória. Esse controle é contornado ao alterar os horários e **recriar o controlador/restaurar a sessão**: a nova instância aceita os valores adulterados como referência.

docs/sessions.md:23 registra explicitamente a decisão de não configurar os limites no Auth hospedado. supabase/config.toml:9–11 registra 72h somente para o ambiente local. A função private.confirmed_user(), na migração inicial, verifica existência do usuário e confirmação de e-mail, não a idade da sessão; as policies e RPCs de negócio não impõem esse prazo. O cliente pode também deixar de executar a SPA e usar a API diretamente com credenciais ainda válidas.

### Condições e impacto

É necessário possuir uma sessão válida e ainda renovável, por acesso ao dispositivo/navegador autenticado ou às credenciais da sessão. O achado não concede autenticação a um visitante, não forja JWT e não promove usuário comum a administrador. Se o Auth remoto já impuser duração máxima, essa proteção limita o abuso; ela não foi verificada nesta auditoria.

Sem limite no servidor, uma sessão pode ser mantida além das 72 horas esperadas. Em uma sessão administrativa comprometida, isso prolonga a possibilidade de consultar ou alterar vendas, clientes, produtos e custos. A classificação é média porque exige acesso prévio à sessão e contorna sua duração, sem elevar os privilégios existentes.

**Confiança alta no desvio local:** reproduzido usando a implementação real e sessão fictícia. A duração efetiva de uma sessão real no projeto hospedado permanece não comprovada; não houve tentativa de renovação remota.

### Reprodução segura executada

Executado na raiz com `node --experimental-strip-types --input-type=module`, usando o programa abaixo via stdin. Nenhuma chamada de rede, credencial real ou arquivo de aplicação foi necessário:

```js
import assert from 'node:assert/strict';
import { createSessionPolicy } from './src/services/sessionPolicy.ts';
const store = new Map();
globalThis.window = Object.assign(new EventTarget(), {
  setInterval: () => 1, clearInterval: () => {},
});
globalThis.document = Object.assign(new EventTarget(), {
  visibilityState: 'visible',
});
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
};
const session = {
  access_token: `h.${btoa(JSON.stringify({ session_id: 'audit-fictitious' }))}.s`,
};
const key = 'auth-activity:audit-fictitious';
store.set(key, JSON.stringify({
  startedAt: Date.now() - 4 * 86400000, lastActiveAt: Date.now(),
}));
let policy = createSessionPolicy(() => {});
assert.equal(policy.accept(session, 'INITIAL_SESSION'), false);
await Promise.resolve();
policy.dispose();
store.set(key, JSON.stringify({
  startedAt: Date.now(), lastActiveAt: Date.now(),
}));
policy = createSessionPolicy(() => {});
assert.equal(policy.accept(session, 'INITIAL_SESSION'), true);
policy.dispose();
```

Resultado: ambas as assertivas passaram. Os timestamps antigos foram recusados; a mesma identidade de sessão foi aceita após substituir apenas os timestamps locais. O token fictício serve exclusivamente ao controlador local; não constitui token aceito pelo Supabase.

### Correção específica e teste de bloqueio

Se 72 horas devem ser uma garantia de segurança, impor a duração no Supabase Auth hospedado e manter a interface como conveniência. O mecanismo nativo requer plano compatível e verifica expiração na renovação; JWTs emitidos podem permanecer válidos até seu próprio vencimento. Para bloqueio estrito no instante limite, adicionar verificação confiável da sessão e de sua criação no servidor às operações sensíveis, considerando auth.sessions e session_id validado, com privilégios mínimos e search_path fixo. Não usar timestamps enviados pelo navegador como fonte da regra. O limite ocioso nativo mede ausência de renovação, e não ausência de interação humana.

**Teste de regressão proposto, não executado:** em Auth/banco isolado, preparar sessão de teste com idade acima do limite; tentar renovar e acessar RPCs/dados diretamente, sem carregar a SPA e após adulterar localStorage. As operações devem falhar conforme o contrato escolhido, inclusive a janela de validade do JWT. Sessão recente deve continuar permitindo operações autorizadas e usuário comum continuar sem acesso administrativo. Testes apenas do componente não provam imposição no servidor.

**Esforço estimado:** baixo para configuração nativa e testes de integração; médio para controle estrito customizado (aproximadamente 1–3 dias, sujeito à infraestrutura). Efeitos: novo login periódico, possível exigência de plano pago e consultas adicionais se houver verificação de sessão nas operações. Não considerar corrigido apenas por editar config.toml.

Referência oficial: [Sessões Supabase](https://supabase.com/docs/guides/auth/sessions), incluindo verificação na renovação e validade residual do JWT.

## Controles observados e suspeitas não confirmadas

- **Isolamento de perfil e administração:** profiles tem RLS forçada, leitura/edição do titular confirmado e UPDATE por colunas. is_admin não está nos grants editáveis nem é derivado de user_metadata. Não foi demonstrada autopromoção.
- **Vendas/custos:** RPCs verificam usuário confirmado e is_admin antes de operações privilegiadas, usam search_path vazio, validam limites e calculam totais com preços obtidos do banco. update_sale restringe sale_item_id à venda editada. Funções internas têm EXECUTE revogado dos clientes; recipe_costs usa security_invoker. Essas observações são estáticas, não resultados de execução SQL nesta auditoria.
- **Convites:** verify_jwt=false não foi reportado como bypass, pois a função valida o Bearer no Auth e consulta is_admin no banco. Ausência de Origin não equivale a autorização; a autenticação continua obrigatória. O corpo é lido integralmente antes do segundo limite de tamanho; explorar consumo de memória exigiria sessão administrativa e depende dos limites do gateway. Não houve demonstração suficiente para classificá-lo como vulnerabilidade distinta.
- **Senha/recuperação:** hash é verificado como recovery/invite e falhas bloqueiam o formulário. Acesso à página de recuperação sem hash com uma sessão existente permite a chamada normal de alteração de senha do próprio usuário; isso, por si só, não demonstra takeover. Exigência de reautenticação e política de senha dependem do Auth remoto.
- **XSS/CSRF:** não foi encontrada inserção explícita de HTML não confiável nos pontos pesquisados; dados são renderizados via React. Autorização usa Bearer, não cookies de sessão automaticamente enviados entre sites. A persistência de refresh token em localStorage aumenta impacto de eventual XSS, mas não prova que exista XSS explorável. CSP está configurada na Vercel, sem confirmação HTTP remota.
- **Segredos:** busca local por padrões de chave Supabase secreta, PEM privado e token GitHub em arquivos rastreados não encontrou correspondências. Não é uma varredura de todos os formatos ou histórico Git. A publishable key é pública por projeto; referências a variáveis service_role no servidor não são vazamento de valor. Valores de credenciais não foram impressos.

## Dependências e consulta atualizada

Versões extraídas de package-lock.json: React Router/DOM 6.30.6, @remix-run/router 1.23.4, Vite 7.3.7, Rollup 4.64.5, esbuild 0.28.2, Supabase JS e subpacotes 2.117.3, Ionic React/Router 9.0.7, Capacitor Core/CLI 8.5.3, tar 7.5.22 e glob 13.0.6. React instalado: 19.3.0.

Consultas oficiais realizadas para casos relevantes, sem enviar fontes, lockfile ou credenciais:

- [React Router GHSA-9jcx-v3wj-wh4m](https://github.com/remix-run/react-router/security/advisories/GHSA-9jcx-v3wj-wh4m): correção na linha 6 a partir de 6.30.2; a versão resolvida 6.30.6 não está no intervalo afetado.
- [React Router DOM GHSA-jjmj-jmhj-qwj2](https://github.com/remix-run/react-router/security/advisories/GHSA-jjmj-jmhj-qwj2): correção em 6.30.6; o lockfile já resolve essa versão.
- [Vite GHSA-p9ff-h696-f583](https://github.com/vitejs/vite/security/advisories/GHSA-p9ff-h696-f583): intervalo afetado da linha 7 termina em 7.3.1; 7.3.7 não é afetado por esse aviso. Trata-se do servidor de desenvolvimento, não de execução do build estático em produção.

Não foi feita consulta automatizada de todos os pacotes transitivos nem atestada a integridade dos tarballs. O aviso antigo de seis vulnerabilidades em docs/supabase.md não foi assumido como diagnóstico atual. Não foi executado npm audit: a consulta remota transmite metadados do grafo de dependências, e não foi necessário transmitir esse inventário para confirmar o achado local. Não se conclui ausência de outras vulnerabilidades conhecidas a partir desta amostra.

## Hipóteses e verificações externas pendentes

Estes pontos **não entram na contagem de achados confirmados**:

1. **Cadastro público:** docs/admin.md registra que desativar signup ainda depende de configuração remota. Se estiver aberto, um terceiro poderá criar conta e, após confirmação, ler o catálogo e manter seu próprio perfil. Isso não concede acesso administrativo pelas policies atuais. Confirmar a configuração e testar signup somente em ambiente de teste.
2. **Auth:** confirmar política de senha, reautenticação em mudança de senha, MFA administrativo, rate limits, provedores habilitados, duração de JWT e templates/redirects exatos. A ausência de prova dessas configurações não foi tratada como prova de exploração.
3. **Banco publicado:** verificar migrações realmente aplicadas, grants padrão, schemas expostos, policies adicionais e storage. Não foram encontradas definições locais de buckets; não é possível inferir as permissões de buckets remotos.
4. **Infraestrutura:** verificar headers efetivamente servidos, deploy da Edge Function, limites de corpo/tempo e quotas de convite/SMTP. Não houve teste de carga ou e-mails reais.

## Ferramentas, comandos e limitações

| Verificação | Comando/método | Resultado |
| --- | --- | --- |
| Instruções, arquitetura e fluxos | cat, rg, rg --files e nl -ba em arquivos locais | Revisão estática dos pontos descritos |
| Estado do repositório | git status --short; git diff --stat | .agents/ já estava não rastreado; nenhum diff de aplicação durante a auditoria |
| Testes existentes | npm test | 11 testes/arquivos reportados pelo runner; 11 passaram, zero falhas |
| Tipos | npm run typecheck | Passou |
| Lint | npm run lint | Passou, exit code 0 |
| Desvio de sessão | node --experimental-strip-types --input-type=module via stdin | Reprodução isolada passou; sem rede |
| Dependências resolvidas | Leitura local do JSON com Node | Versões listadas acima |
| Padrões de segredos | Python + git ls-files, sem imprimir valores | Zero correspondências nos três padrões pesquisados |
| Avisos/documentação oficial | Busca e abertura de páginas públicas Supabase e mantenedores no GitHub | Consulta direcionada realizada; não equivale a scanner completo |
| Disponibilidade de banco de testes | command -v psql; command -v supabase; consulta de PGlite local | Ferramentas não encontradas nas verificações realizadas |

Ambiente de execução: Node v25.0.0, npm 11.6.2. Os testes passaram nesse ambiente; não se validou matriz de versões.

Os testes SQL do repositório **não foram executados** nesta auditoria por ausência de ambiente local de banco preparado. Relatos de execuções anteriores na documentação não foram contabilizados como execuções desta revisão. Build não foi repetido: não houve alteração de aplicação e build não valida a hipótese de autorização/sessão; testes, tipos e lint foram executados. Não houve teste de navegador ponta a ponta, scanner dinâmico, auditoria do histórico Git ou exploração de produção. Uma busca ampla de arquivos em /tmp retornou permissões negadas em diretórios de serviços do sistema; isso não impediu a revisão do projeto.

## Plano recomendado

1. Rever a aceitação de risco de SEC-01: se 72h forem requisito de segurança, implementar imposição no servidor e validar em ambiente isolado. Se a decisão de controle apenas visual for mantida, registrar explicitamente que não limita credenciais/API.
2. Antes de exposição real, validar as pendências de Auth, migrações, RLS e hosting contra o ambiente implantado; executar os sete testes SQL existentes em banco descartável com as migrações atuais.
3. Completar análise automatizada de dependências com ferramenta aprovada para o inventário privado, confirmar cada aviso em fonte oficial e reproduzir apenas os aplicáveis. Não usar correção automática indiscriminada.

Nenhum item foi marcado como corrigido. Somente este relatório foi criado.


## Complemento — execução dos testes SQL em 11/10/2026

A pedido do usuário, os testes SQL pendentes foram executados após a auditoria inicial. Esta seção atualiza as observações anteriores sobre testes SQL não executados; a versão original foi preservada em `security-audit.before-sql-tests-20261011.md`.

**Resultado: 10/10 migrações aplicadas e 7/7 arquivos de testes aprovados**, sem alterações nas migrações ou nos testes.

Ambiente: PostgreSQL 18.3 via PGlite 0.5.8, banco em memória, timezone America/Sao_Paulo. O pacote foi instalado exclusivamente em `/tmp/estouro-sql-audit`, sem modificar package.json ou package-lock.json do projeto. A primeira tentativa de download encontrou bloqueio de DNS no sandbox; o download posterior foi autorizado e concluído. Nenhum código privado, credencial ou dado pessoal foi enviado ao registry.

Preparação: schema auth mínimo com auth.users (id, email, email_confirmed_at, raw_user_meta_data), função auth.uid() lendo as configurações request.jwt.claim.sub/request.jwt.claims e papéis anon/authenticated sem privilégios elevados; service_role com BYPASSRLS. Migrações executadas como administrador do banco em ordem lexicográfica, sem alterar seu conteúdo. Os testes mudaram para os papéis previstos usando SET LOCAL ROLE e usaram exclusivamente dados fictícios.

| Arquivo | Execução | Contagens após rollback |
| --- | --- | --- |
| costs_security.sql | Passou | Restauradas |
| dashboard_security.sql | Passou | Restauradas |
| management_crud_security.sql | Passou | Restauradas |
| products_security.sql | Passou | Restauradas |
| profile_isolation.sql | Passou | Restauradas |
| sale_customers_security.sql | Passou | Restauradas |
| sales_security.sql | Passou | Restauradas |

Cobertura dos testes existentes: isolamento dos perfis, bloqueio de autopromoção por metadados/UPDATE, acesso de anônimos/membros/não confirmados, operações administrativas legítimas, preços e recebimentos inválidos, snapshots históricos, idempotência, revisão otimista, rollback de operações inválidas, custos/conversões de unidades e indicadores/paginação. Os cenários de revisão são sequenciais; não comprovam comportamento sob múltiplas conexões concorrentes.

Verificação adicional após cada arquivo: contagens de auth.users, profiles, products, sales, sale_items, customers, materials, recipes e recipe_items iguais ao estado inicial (39 produtos e zero registros nas demais). O banco em memória foi fechado ao terminar.

Comandos: `npm install --prefix /tmp/estouro-sql-audit --cache /tmp/estouro-npm-cache --no-audit --no-fund --ignore-scripts --fetch-retries=0 --fetch-timeout=10000 @electric-sql/pglite`; `node /tmp/estouro-sql-audit/run.mjs`. Runner e resultados JSON estão nesse diretório temporário e podem desaparecer com a limpeza de /tmp.

**Limites:** PGlite executa PostgreSQL real compilado para WebAssembly, mas o schema e os papéis Auth foram simulados. Esta execução não valida Supabase Auth/GoTrue, gateway PostgREST, JWTs reais, e-mails, Edge Function, configuração remota, diferenças de versão do PostgreSQL publicado ou concorrência entre conexões. Nenhum banco remoto foi acessado. O achado SEC-01 continua pendente; estes testes não validam nem corrigem a expiração de sessão.
