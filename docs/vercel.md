# Deploy na Vercel

A configuração `vercel.json` usa Vite, `npm run build` e saída `dist`. O rewrite permite abrir e recarregar rotas do React, inclusive os callbacks de autenticação.

## Projeto

Importar o repositório no painel Vercel ou fazer deploy desta pasta via Vercel CLI autenticada. Selecionar Node.js 22.x (mesma versão de `.nvmrc`). A pasta `.git` deste workspace não é um checkout Git utilizável; para importação por Git, será necessário um repositório remoto. A alternativa é publicar pela CLI.

Configurar em Settings → Environment Variables, para Production e os ambientes Preview desejados:

- `VITE_SUPABASE_URL`: URL HTTPS do projeto.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave pública `sb_publishable_...`.

Os valores estão em `.env.local`, que não deve ser enviado. Variáveis `VITE_` entram no JavaScript público: nunca usar service_role, secret, senha de banco ou tokens administrativos. Após mudar variáveis, fazer novo deploy. `.vercelignore` exclui arquivos locais e diretórios administrativos do upload pela CLI.

## Supabase após obter o domínio

Usando `https://SEU-DOMINIO` como exemplo:

1. Authentication → URL Configuration: definir Site URL como `https://SEU-DOMINIO`.
2. Autorizar exatamente `https://SEU-DOMINIO/auth/callback`, `https://SEU-DOMINIO/auth/recovery` e `https://SEU-DOMINIO/auth/invite`.
3. Aplicar os templates de convite e recuperação descritos em `docs/admin.md` e `docs/supabase.md`.
4. Para convites administrativos, configurar `APP_ORIGIN=https://SEU-DOMINIO` nos secrets da Edge Function `invite-user` e confirmar seu deploy no Supabase. A Vercel hospeda o frontend; não publica as funções nem aplica migrações Supabase.
5. Manter URLs locais exatas se ainda houver testes locais; previews precisam de URLs explicitamente autorizadas quando houver testes de autenticação.

## Validação publicada

Abrir diretamente `/entrar`, `/conta` e `/auth/recovery`, recarregar e conferir ausência de 404. Testar login, logout, novo e-mail de recuperação, persistência do perfil e busca de CEP. Confirmar RLS e cadastro público desabilitado conforme `docs/admin.md` antes de usar contas reais.

Referências: https://vercel.com/docs/frameworks/frontend/vite e https://vercel.com/docs/environment-variables.
