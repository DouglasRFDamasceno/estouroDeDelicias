# Administração e criação de contas — etapa atual

Esta regra substitui o cadastro público da etapa anterior: **somente administradores convidam novas pessoas**. A integração remota ainda depende de acesso administrativo ao projeto.

## Papel no banco

Aplicar, em ordem:

1. `supabase/migrations/20261010000100_user_profiles.sql`
2. `supabase/migrations/20261010000200_admin_flag.sql`

A segunda migração adiciona `profiles.is_admin boolean not null default false`. Não é editável por authenticated/anon e nunca é copiada de metadados. Nem mesmo o administrador altera esse campo pela interface. Promoções são operações administrativas fora do cliente. Essa é uma função global da plataforma, não um papel empresarial; membros de empresas continuam sendo uma modelagem separada.

## Bloqueio real do cadastro aberto

No Supabase Auth, **desabilitar Allow new users to sign up**. Manter login e recuperação por e-mail habilitados. Desabilitar anonymous sign-ins e provedores OAuth não usados; revisar outros caminhos de criação de conta. Ocultar o formulário público não impede chamadas diretas a `/auth/v1/signup` se a configuração do servidor continuar aberta.

Esta configuração é obrigatória e **ainda não foi aplicada remotamente**. A migração SQL por si só não desativa o endpoint Auth. Testar uma tentativa direta de signUp com a chave pública depois de configurar: deve falhar. Não concluir que está bloqueado só pela tela de cadastro.

## Primeiro administrador

E-mail indicado pelo proprietário: `douglas.r.f.damasceno@gmail.com`.

1. Aplicar migrações e configurar o template de convite descrito abaixo.
2. Criar/convidar esse usuário pelo Auth Admin API ou painel administrativo confiável, sem expor service_role na SPA. Preferir convite com senha definida pelo titular.
3. Aceitar convite e confirmar o endereço.
4. Executar `supabase/promote-first-admin.sql`: exige conta confirmada, correspondência única de e-mail e perfil existente, e atualiza somente esse UUID.
5. Validar que somente esse perfil tem is_admin=true e que consegue enviar convites.

Não criar administrador com e-mail inventado ou senha fixa em código/migração. Não criar contas novamente se já existirem. Nenhuma conta foi criada e nenhuma senha foi gerada nesta entrega; falta acesso administrativo remoto. Se for necessário usar senha temporária posteriormente, gerar aleatoriamente em uma ferramenta administrativa confiável, entregar por canal apropriado e substituir imediatamente; não registrar em Git ou logs.

## Convites feitos pelo administrador

A tela `/criar-conta` verifica o papel do usuário para apresentar o formulário de convite. A função `supabase/functions/invite-user/index.ts` valida o JWT no Auth e consulta `profiles.is_admin` novamente no banco para cada POST. Rejeita usuário comum com 403 e sem sessão com 401; aceita apenas nome/e-mail, ignorando campos de papel. Usa `inviteUserByEmail` no servidor. Cada novo perfil nasce is_admin=false. Não libera leitura de CPF/endereço de outras pessoas para o administrador.

Antes de usar, fazer deploy da função e configurar o segredo servidor `APP_ORIGIN`, por exemplo `http://127.0.0.1:5173` no projeto de testes, ou a origem HTTPS definitiva em produção. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são variáveis do ambiente Edge, nunca variáveis VITE_. A configuração `verify_jwt=false` delega a validação à função; ela **sempre** executa `auth.getUser(token)` antes de qualquer operação administrativa. Não remover essa validação. A função não foi publicada nem testada em Deno/Supabase remoto neste ambiente.

## Template e aceite de convite

Em **Authentication → URL Configuration**, definir Site URL como `https://estourosdedelicias.vercel.app` (sem barra final) e adicionar o redirect exato `https://estourosdedelicias.vercel.app/auth/invite`. Acrescentar também os callbacks `/auth/callback` e `/auth/recovery` nessa mesma origem.

Em **Authentication → Email Templates → Invite user**, copiar `supabase/templates/invite.html`. O link usa SiteURL, para funcionar também com os convites feitos diretamente no painel, sem depender de redirectTo informado:

```html
<a href="{{ .SiteURL }}/auth/invite?token_hash={{ .TokenHash }}">Aceitar convite e definir minha senha</a>
```

Salvar as configurações e solicitar um convite novo: e-mails já enviados não são reescritos. O remetente passa esse caminho fixo; não aceita URL de retorno enviada pelo navegador. O callback verifica o hash como `type: invite`, define sessão pelo SDK e permite definir a senha (mínimo 12 caracteres também configurado no servidor). Ao concluir, encerra a sessão e solicita novo login. A URL é limpa após a verificação. Não compartilhar o link: ele concede acesso à conta.

SMTP deve estar configurado para envio a usuários reais. Antes de produção, testar rate limits de convite, SPF/DKIM, expiração/reutilização de links, convite com usuário logado em outra conta e MFA para administradores. Ainda não existe MFA obrigatório na função; não considerar esta implementação pronta para exposição pública sem essa revisão.

## Verificações

As migrações e o teste `supabase/tests/profile_isolation.sql` foram executados em PostgreSQL temporário com papéis Auth simulados. Incluem tentativa de is_admin=true em user_metadata (ignorada), tentativa de autopromoção por UPDATE (negada), acesso cruzado, validação de CPF e conta não confirmada. Build/tipos e testes de domínio passaram.

Depois da conexão real, validar também:

- Signup público diretamente na API negado.
- Convite sem JWT negado; JWT de usuário comum negado, mesmo com is_admin=true no payload.
- Administrador consegue convidar e usuário comum nasce is_admin=false.
- Revogar is_admin interrompe novos convites com o mesmo JWT existente.
- Aceite, senha, login, recuperação e isolamento continuam funcionando.

## Fontes oficiais

- [Admin createUser: somente servidor](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Convites de usuários](https://supabase.com/docs/guides/auth/users)
- [Auth configuração geral](https://supabase.com/docs/guides/auth/general-configuration)
