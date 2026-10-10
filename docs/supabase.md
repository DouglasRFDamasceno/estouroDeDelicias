> **Regra atual de acesso:** cadastro somente por convite de administrador. Veja [o guia de administração](admin.md). O fluxo de cadastro público descrito na etapa anterior foi substituído. Migrações e criação do primeiro admin ainda dependem de aplicação remota.

# Supabase — ativação e verificação da etapa de autenticação

## O que foi implementado

Cliente oficial Supabase JS 2.117.3, cadastro com nome/e-mail/senha, login real por senha, sessão persistente, logout, recuperação e callbacks web PKCE. A rota `/conta` exige sessão e carrega o perfil com o usuário validado pelo Auth. A tabela `public.profiles` é criada por migração; nenhuma mudança foi aplicada em projeto remoto. Sem URL/chave pública configuradas, cadastro e login ficam desabilitados.

**Decisão de minimização:** no cadastro inicial enviar apenas nome, e-mail e senha. O banco cria o perfil na mesma transação de criação de `auth.users`. Após confirmar o e-mail e entrar, completar telefone, CPF e endereço em `/conta`. CPF/endereço opcionais, sem consulta externa. CPF validado por dígitos verificadores, não comprova identidade nem titularidade. CNPJ não faz parte desta etapa; dados da empresa virão em tabelas próprias.

Documento/endereço nunca vão em `user_metadata`, JWT, URL, logs ou localStorage de formulário. A senha só é enviada ao Supabase Auth por HTTPS e não existe na tabela de perfil. O nome inicial é metadado não confiável, usado apenas como dado de apresentação. Nenhum valor de metadado concede papel/permissão.

## 1. Configurar projeto de desenvolvimento

Crie/selecione um projeto Supabase separado de produção. No painel:

- Authentication → Providers: habilitar e-mail/senha e **Confirm email**.
- Configurar política de senha no servidor: mínimo **12 caracteres** (o HTML sozinho pode ser contornado). Ativar proteção contra senhas vazadas quando disponível no plano.
- Manter Secure email change e habilitar Secure password change/reauthentication conforme a configuração disponível; o formulário reporta necessidade de novo link se o servidor recusar uma alteração.
- Revisar rate limits. Para uso público, configurar CAPTCHA/Turnstile com integração do token nos formulários **antes de abrir cadastro ao público**; o widget ainda não foi implementado. Não basta habilitar CAPTCHA no painel: sem token, os formulários serão rejeitados.
- Configurar SMTP próprio e remetente para usuários reais; o serviço padrão de teste tem limites/restrições. Habilitar MFA nas contas que administram o projeto Supabase.

Essas opções não podem ser comprovadas pelo frontend e ainda não foram configuradas/verificadas neste projeto.

## 2. Aplicar a migração antes do primeiro cadastro

Abra `supabase/migrations/20261010000100_user_profiles.sql`, revise e execute o conteúdo uma única vez no SQL Editor do projeto de desenvolvimento. O arquivo é transacional; uma falha reverte a criação. Ele não substitui nem remove uma tabela `profiles` existente: em um projeto que já a tenha, revisar a compatibilidade antes de aplicar.

Alternativa futura pelo Supabase CLI: iniciar/vincular o projeto local e usar migrações (`supabase init`, `supabase start`, `supabase db reset`); aplicar remoto apenas ao projeto correto e após validar. CLI e Docker não estavam instalados neste ambiente. Não executamos `db push` nem acessamos um banco remoto.

A migração cria:

- `profiles.id` como PK e FK para `auth.users.id`, com exclusão em cascata ao remover a conta.
- Nome, telefone, CPF, CEP, rua, número, complemento, bairro, cidade, UF e timestamps.
- RLS habilitada/forçada; SELECT e UPDATE apenas pelo titular com e-mail confirmado.
- Nenhum acesso para anon; nenhum INSERT/DELETE direto para authenticated.
- UPDATE autorizado apenas nas colunas editáveis; ID e timestamps não são modificáveis pelo cliente.
- Trigger privado com `SECURITY DEFINER`, `search_path` vazio e EXECUTE público revogado.
- Constraints de tamanhos, telefone/CEP/UF e CPF no PostgreSQL, além da validação da interface.
- Perfis para contas existentes, sem copiar documentos de metadados.

Não guardar papel administrativo nem vínculos empresariais nesta tabela. Cadastrar-se **não** dá acesso aos dados de gestão. O isolamento entre empresas será implementado em migrações próprias; `/demo` continua público e fictício.

## 3. Configurar a aplicação sem compartilhar segredos

Copie `.env.example` para `.env.local` e preencha localmente:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
```

Obtenha a URL e a **publishable key** no painel do projeto. O código aceita apenas URL HTTPS padrão `*.supabase.co` e chave moderna `sb_publishable_`. Domínios próprios e Supabase local exigirão configuração explícita futura. O Vite bloqueia dev/build se detectar formato de chave privada/legada nessas variáveis, antes de gerar um bundle. Configuração parcial também falha com erro sem imprimir valores. Uma publishable key não é segredo; a proteção dos dados depende de grants e RLS. Nunca usar `sb_secret_`, `service_role`, senha do banco ou token de administração no frontend. `.env.local` está ignorado pelo Git; não envie suas credenciais no chat. Reinicie `npm run dev` depois de alterar variáveis.

## 4. Configurar os redirects exatos

Authentication → URL Configuration:

- Site URL de desenvolvimento: `http://127.0.0.1:5173`.
- Redirect permitido: `http://127.0.0.1:5173/auth/callback`.
- Redirect permitido: `http://127.0.0.1:5173/auth/recovery`.

Se usar localhost ou outra porta, cadastrar os dois endereços correspondentes e acessar pelo mesmo hostname. Produção exigirá URLs HTTPS exatas; evitar curingas de produção. O código usa a origem atual, nunca um parâmetro arbitrário `next`/redirect. Manter os templates de e-mail usando `{{ .ConfirmationURL }}` para o fluxo padrão de confirmação. PKCE depende do verificador no navegador que iniciou o fluxo: abrir o link no mesmo navegador/perfil. Links expirados, repetidos ou de outro navegador podem exigir novo pedido. O SDK processa o código automaticamente, sem troca manual duplicada. Nunca copiar tokens em logs ou suporte.

### Recuperação de senha entre navegadores

Em **Authentication → Email Templates → Reset password**, copiar o conteúdo de `supabase/templates/recovery.html`:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Definir uma nova senha</a>
```

O callback `/auth/recovery` verifica o hash com `verifyOtp({ token_hash, type: 'recovery' })` e limpa a URL. Esse formato não depende do verificador PKCE do navegador que pediu o e-mail. Manter o redirect exato da origem em uso na lista permitida (localhost e 127.0.0.1 são origens diferentes). O link precisa apontar para um aplicativo acessível no dispositivo que abrirá o e-mail; localhost no celular aponta para o próprio celular.

**Configuração remota pendente:** este repositório não aplica templates nem URLs ao projeto hospedado automaticamente. Publicar o template no painel, salvar os redirects e solicitar um e-mail novo. Links antigos continuam sujeitos ao fluxo antigo e à expiração. A tela de falha permite pedir outro link sem conhecer a senha. Nunca redefinir a senha por SQL.

Validar com uma conta de teste: pedir recuperação, abrir o novo link em outro navegador, definir senha com pelo menos 12 caracteres, entrar com a nova senha e verificar que a antiga falha. Reabrir o link consumido ou expirado deve apresentar a opção de solicitar outro. Verificar também que hashes inválidos não permitem usar uma sessão já existente para alterar a senha.

Callbacks Android/iOS **não estão integrados ainda**. Não distribuir a versão Capacitor com este fluxo: ainda é necessário configurar App/Universal Links, listener de retorno com app aberto e início a frio e armazenamento adequado, além de testes nativos. Esta entrega autentica a versão web, inclusive no navegador do celular.

## 5. Validar em pequenos passos

1. Criar uma conta de teste em `/criar-conta`; verificar que `profiles` nasceu automaticamente com o mesmo UUID do Auth, e sem senha/CPF/endereço em metadados.
2. Antes de confirmar o e-mail, tentar login: deve ser negado pelo servidor com Confirm email habilitado.
3. Confirmar o e-mail no mesmo navegador; verificar o retorno a `/conta`.
4. Preencher o perfil, salvar e recarregar. Testar CPF inválido, CEP incorreto e campos vazios opcionais.
5. Sair e abrir `/conta` diretamente: deve voltar ao login. Entrar com e-mail/senha reais de teste; recarregar e verificar a persistência.
6. Informar senha incorreta e e-mail desconhecido: a resposta deve ser genérica, sem revelar existência de conta. Solicitar recuperação, seguir o link, alterar a senha e entrar novamente. A senha antiga deve falhar.
7. Repetir com duas contas; nenhuma deve acessar o perfil da outra, inclusive usando chamadas diretas à API com seu JWT e a chave pública.
8. Testar perda de conexão, expiração de sessão, links expirados e repetidos, celular com teclado e teclado Tab.

Mensagens de cadastro/recuperação evitam confirmar a existência de e-mail. A proteção contra enumeração também depende das configurações e respostas do Supabase; mensagens genéricas não eliminam todos os canais de enumeração.

## 6. Testes de segurança do banco

`supabase/tests/profile_isolation.sql` cria três usuários de teste dentro de uma transação e faz rollback. Executar **somente no banco local/de testes**, como postgres, após a migração. Exemplo com CLI local/psql:

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profile_isolation.sql
```

Ele verifica o trigger, leitura isolada, bloqueio de atualização cruzada, CPF inválido, troca de ID, INSERT/DELETE e acesso de conta não confirmada. A variável de conexão é local, não `VITE_` e não deve ser commitada.

Nesta entrega, migração e testes SQL passaram em PostgreSQL temporário via PGlite, com schema Auth e papéis simulados. Isso valida a semântica SQL/RLS, mas **não** valida o serviço Supabase Auth real, e-mails, SMTP, configuração do painel ou o fluxo em navegador. `npm run build` e `npm test` também passaram. A validação ponta a ponta depende do projeto configurado.

## 7. Limites e próximos cuidados concretos

A sessão web é persistida pelo SDK em localStorage, inclusive refresh token: isso mantém o login após recarregar, mas scripts executados na origem poderiam ler os tokens. Não inserir HTML não confiável, scripts de terceiros ou dados com `dangerouslySetInnerHTML`. Não persistimos campos pessoais do formulário. Em dispositivo compartilhado, sair ao terminar. Para níveis maiores de proteção, avaliar BFF com cookies HttpOnly e MFA, com arquitetura própria — isso não existe nesta SPA.

`public/_headers` prepara CSP, anti-framing, no-referrer e nosniff para a futura hospedagem estática Cloudflare Pages. Esses headers **não são aplicados pelo Vite dev/preview**; validar na hospedagem antes de liberar produção. CSP permite estilos inline necessários ao Ionic, mas restringe scripts à própria origem. Sem analytics ou CAPTCHA de terceiros nesta etapa. Configurar novos provedores exige revisar CSP.

O npm ainda reporta seis avisos moderados herdados de React Router/Ionic Router e CLI Capacitor. A atualização sugerida do Router está fora dos peers suportados pelo Ionic; não forçar atualização incompatível. Reavaliar correções suportadas antes de produção. Esta entrega não equivale a auditoria independente nem certificação de segurança. Sem publicação remota.

## Referências oficiais consultadas

- [Dados de usuário e triggers](https://supabase.com/docs/guides/auth/managing-user-data)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Autenticação por senha](https://supabase.com/docs/guides/auth/passwords)
- [Segurança de senhas](https://supabase.com/docs/guides/auth/password-security)
- [Fluxo PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Rate limits](https://supabase.com/docs/guides/auth/rate-limits)
