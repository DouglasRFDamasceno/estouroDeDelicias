# Nome da marca

O nome exibido da marca é **Estouros de Delícias**. A atualização de 12/10/2026 cobre a marca compartilhada, login, gestão, catálogo, nomes acessíveis, título e descrição HTML, nome do aplicativo Capacitor e modelos de convite e recuperação de senha. O pacote npm e a entrada raiz do lockfile usam `estouros-de-delicias`.

Repositório Git, identificador Capacitor `br.com.estourodelicias.app`, chaves de sessão, perfis sociais e informações de contato continuam identificando os serviços existentes. Renomear esses identificadores depende de uma migração dos serviços; a alteração do nome comercial não altera autenticação, banco, permissões ou rotas.

## Imagens

- `public/images/cardapio-gourmet.jpeg`: o logotipo já diz **Estouros de Delícias**. Preços, contatos e códigos QR preservados.
- `public/images/pipocas-presente.jpeg`, `pipocas-hero-480.webp` e `pipocas-hero-960.webp`: os rótulos já usam **Estouros**; imagens preservadas.
- `public/images/pipocas-gourmet.jpeg`: rótulos com a grafia singular atualizados pela ferramenta integrada `image_gen`, mantendo o arquivo público e as dimensões de 900 × 1600. A imagem editada é uma composição com IA; detalhes pequenos dos rótulos podem variar. A foto não é referenciada atualmente pela interface, mas continua disponível pelo endereço público existente.
- `public/brand-icon.png`, favicons e ícone Apple: símbolos sem texto; nenhuma mudança necessária.

Prompt usado na edição de `pipocas-gourmet.jpeg`:

> Use case: text-localization. Image 1 is the EDIT TARGET: authentic portrait photograph of gourmet popcorn cone packages on a wicker basket. Make ONLY a precise brand spelling correction on the printed product labels: every brand word currently reading 'Estouro' must read exactly 'Estouros' (add the final lowercase s), forming the brand 'Estouros de Delícias'. Some labels already have the plural 'Estouros'; preserve those unchanged. Correct ALL singular labels including the upside-down bottom label and angled right labels. Preserve the exact photo composition, resolution/aspect ratio, basket, food, packaging, ribbons, lighting, all label design/color/type style/position/perspective, flavor names, package weights, phone numbers, Instagram handles and other contact strings. Instagram handles are existing external identifiers and must not be renamed. No new objects, no new logo designs, no extra text, no cropping, no enhancements beyond the requested letters. Output one corrected photo asset.

## Histórico e publicação

Capturas de auditorias, relatórios arquivados, prompts originais de geração de imagens e migrações já aplicadas registram o estado anterior e permanecem como evidências históricas; não são conteúdo exibido pela aplicação. A palavra comum “estouro” permanece nos slogans, como “Feito com amor em cada estouro”.

Os modelos HTML de e-mail estão atualizados no repositório. Para refletir a marca em e-mails enviados pelo Supabase, publicar esses modelos no painel Auth; Se houver SMTP próprio no futuro, conferir também o nome do remetente. O responsável optou por manter o serviço padrão do Supabase, sem configurar SMTP próprio nesta alteração. A troca de domínio e a publicação na Vercel foram autorizadas posteriormente; consulte `docs/vercel.md` para o estado da publicação.

## Validação

`npm run check` passou: lint, formatação, 41 testes, tipos e build. O navegador Chromium verificou o site, os 13 cartões do catálogo e a marca do menu da gestão nas larguras de 360, 390, 768, 1280 e 1536 px, com dados simulados. Também foram conferidos login, rota inexistente, título, descrição e nome acessível do link para o início. As imagens públicas foram inspecionadas visualmente. Não foram alterados dados reais nem enviadas mensagens de teste.
