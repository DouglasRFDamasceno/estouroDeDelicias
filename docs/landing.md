# Landing interativa

A branch `feat/landing-interativa` amplia o catálogo público sem conectar a vitrine aos registros da gestão. Os 13 sabores e preços existentes foram movidos para `src/domain/landingCatalog.ts`, mantendo os valores originais.

- Busca ignora acentos e maiúsculas, com estado vazio e botão para limpar os filtros.
- Corações marcam favoritos; o filtro mostra somente os sabores marcados.
- Seleção combina sabores, embalagens de 50/100/150 g e quantidades de 1 a 99 por combinação. Diminuir de uma unidade remove o item. Alterar o tamanho no catálogo não altera os itens já escolhidos.
- Subtotal calculado em centavos, sem frete. O link do WhatsApp prepara uma única mensagem com todos os itens e pede confirmação de disponibilidade e valor final. Não registra vendas, reserva estoque ou cobra pagamentos.
- Seleção e favoritos sobrevivem ao fechamento do modal, mas são descartados ao recarregar ou desmontar a página.
- Atalho fixo no celular abre o catálogo; o cabeçalho do modal permite saltar para a seleção. Perguntas frequentes usam `details`/`summary`, com teclado e estados nativos.

Validação automatizada: `npm run check` (lint, formatação, testes de domínio, tipos e build). Testes verificam subtotal com diferentes tamanhos/quantidades, conteúdo da mensagem e rejeição de itens inválidos.

Revisão manual antes de publicar: abrir em larguras de 360, 390, 768 e 1440 px; buscar “limao”, favoritar e filtrar; adicionar o mesmo sabor em tamanhos diferentes; alterar e remover quantidades; fechar e reabrir o modal; testar mensagem no WhatsApp; percorrer os controles com Tab e fechar com Escape. Verificar favoritos vazios, busca sem resultados, atalho da seleção e perguntas frequentes. A validação visual em navegador ainda não foi executada nesta sessão.
