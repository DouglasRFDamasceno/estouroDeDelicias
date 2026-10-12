# Deploy na Vercel

A configuração `vercel.json` usa Vite, `npm run build` e saída `dist`. O rewrite permite abrir e recarregar rotas do React, inclusive os callbacks de autenticação.

## Projeto

Importar o repositório no painel Vercel ou fazer deploy desta pasta via Vercel CLI autenticada. Selecionar Node.js 22.x (mesma versão de `.nvmrc`). O projeto está vinculado ao repositório `DouglasRFDamasceno/estouroDeDelicias`, com branch de produção `main`. Também é possível publicar pela CLI autenticada.

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


## Nome e domínio de produção

Projeto: `estourosdedelicias`. Endereço: `https://estourosdedelicias.vercel.app`.

No Supabase Auth → URL Configuration, usar essa origem como Site URL (sem barra final) e autorizar os callbacks exatos `/auth/invite`, `/auth/callback` e `/auth/recovery`. O template de convite usa SiteURL, e a aplicação usa `window.location.origin` para os callbacks de recuperação/confirmação. Não há domínio antigo fixo no frontend. Caso a Edge Function `invite-user` seja publicada, configurar seu segredo servidor `APP_ORIGIN=https://estourosdedelicias.vercel.app`.

A vinculação local da CLI mantém o mesmo projectId e orgId; somente projectName muda. O nome do pacote npm é independente do domínio e não precisa ser alterado.

### Renomeação publicada em 12/10/2026

O mesmo projeto Vercel foi renomeado para `estourosdedelicias`. O domínio `https://estourosdedelicias.vercel.app` está verificado e publicado com a marca nova. Deployment de produção: `dpl_65BMt3HXsKZLCxoemhnSodZMkaSX`, enviado pela CLI a partir da branch `feat/rename-brand-estouros` e promovido após o build remoto concluir. O repositório Git permanece com o nome existente e `main` continua sendo a branch de produção para deploys por Git; as alterações de marca foram preparadas nessa branch para integração na `main`, mantendo os próximos deploys por Git alinhados à publicação manual.

`APP_ORIGIN` de produção foi atualizado para `https://estourosdedelicias.vercel.app`. Os domínios antigos `estourodedelicias.vercel.app` e `estouro-de-delicias.vercel.app` fazem redirect 307 para o novo, preservando caminho e query string. A sessão do navegador é vinculada à origem; usuários podem precisar entrar novamente no domínio novo.

Os três callbacks novos do Supabase foram verificados como destinos autorizados. Após ajuste do responsável no painel, o Site URL também foi confirmado na origem nova. A verificação usou hashes inválidos, sem consumir convites reais ou enviar e-mails. Não há Edge Functions publicadas neste projeto, portanto não houve segredo `APP_ORIGIN` de função para atualizar. Os modelos de e-mail podem ser atualizados no painel Auth com os HTMLs em `supabase/templates`. O responsável confirmou que não há SMTP próprio configurado e optou por manter o serviço padrão do Supabase; configurar SMTP não é requisito desta publicação.

Validação publicada: HTTP 200 no início, login, conta, gestão, nos três callbacks e na foto atualizada; redirects 307 dos dois domínios antigos, inclusive com caminho de recuperação e parâmetro de teste; um pedido vazio retornou 400 antes da admissão/gravação, confirmando que a API aceita a origem nova. Site, 13 cartões do catálogo e login foram conferidos em Chromium nas larguras de 390 e 1280 px, sem erros JavaScript. Não foram feitos login real, envio de pedido válido ou envio de e-mails nesta validação.

## Cabeçalhos de segurança

Na Vercel, os cabeçalhos para todas as rotas são definidos em `vercel.json`. O arquivo `public/_headers` serve como configuração equivalente em provedores que reconhecem esse formato; a Vercel não o usa para configurar respostas.

A Content-Security-Policy permite scripts apenas da própria origem, bloqueia scripts inline/event handlers, objetos, frames, incorporação do site em outros sites e alteração de base URL. Permite os estilos inline usados pelo Ionic/React, Google Fonts, imagens locais/data URI e conexões com Supabase e ViaCEP. Links externos de navegação, como WhatsApp, continuam disponíveis. A Permissions-Policy desabilita câmera, microfone, localização, pagamento, USB, captura de tela e sensores que a aplicação não utiliza. HSTS é fornecido pela Vercel no HTTPS; os cabeçalhos existentes de tipo de conteúdo, referência e frames são preservados.

Depois do próximo deploy, verificar os cabeçalhos com `curl -I https://estourosdedelicias.vercel.app/` e também `/entrar` e `/conta`. Repetir a avaliação no Security Headers. Testar modal de sabores, ícones Ionic, fontes, login, recuperação e consulta de CEP; conferir no console do navegador se há violações de CSP. `vite preview` não aplica os cabeçalhos definidos pela Vercel. A nota só pode ser confirmada após publicação e nova análise.

Referências: [headers na Vercel](https://vercel.com/docs/project-configuration#headers), [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) e [Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy).
