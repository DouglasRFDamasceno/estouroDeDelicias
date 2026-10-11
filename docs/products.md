# Catálogo de produtos

A migração `20261010000300_products.sql` cria `public.products` e cadastra os 13 sabores do catálogo público nas apresentações de 50 g, 100 g e 150 g (39 registros). Preços em centavos conforme `src/pages/Landing.tsx`; os três produtos fictícios de `services/demo.ts` não foram importados e não foram inventados custos.

A tabela permite qualquer categoria e apresentação, incluindo unidade, caixa, peso e outros produtos futuros. Nome + categoria + apresentação são únicos sem distinguir maiúsculas ou espaços externos. IDs e datas são gerados pelo banco; limites de tamanho e preço são validados também por constraints.

O catálogo é compartilhado pela Estouro de Delícias, não um catálogo privado por usuário ou multiempresa. Somente contas confirmadas podem consultar. Somente administradores definidos em `profiles.is_admin` podem cadastrar. RLS verifica o papel no banco a cada inserção; metadados do usuário não concedem permissão. A migração `20261010000800_management_crud.sql` libera atualização de nome, categoria, apresentação e preço apenas para administradores confirmados. Campos de identificação, data e versão não são editáveis pelo navegador. A migração `20261010000400_products_delete.sql` permite DELETE apenas para administradores confirmados, com a mesma verificação por RLS. A interface exige confirmação em modal, identifica nome e apresentação e remove da lista somente após retornar o ID excluído. Itens de vendas mantêm nomes e preços históricos mesmo após remover o produto do catálogo. Cancelamento, falha do servidor e exclusão confirmada foram testados no navegador com dados simulados; nenhum produto real foi excluído durante a validação. Nenhuma chave administrativa vai para o frontend. Os perfis pessoais continuam restritos ao titular.

A tela `/demo/produtos` consulta o catálogo real e apresenta o botão de cadastro aos administradores. Visitantes recebem um link para login. Clientes e Vendas também estão integrados; Visão geral e Custos continuam demonstrativos. O catálogo público da página inicial ainda é estático; cadastrar um produto nesta tela não altera a vitrine automaticamente.

Migração aplicada ao projeto Supabase conectado em 10/10/2026. Interface apenas local enquanto não houver commit/publicação.

Validação: testes de domínio para preços e campos; políticas exercitadas em PostgreSQL temporário (PGlite) com papéis Auth simulados, incluindo anônimo, confirmado comum, não confirmado, administrador, administrador revogado, duplicidade, preço negativo e campos gerados. Os testes não substituem a validação do fluxo completo no navegador com contas reais.

## Filtros, ordenação e paginação

A migração `20261010000500_product_names.sql` remove o prefixo “Pipoca gourmet · ” dos produtos da categoria Pipocas gourmet, preservando IDs e demais campos. Conflitos de nomes causam rollback, sem excluir registros.

A tabela consulta apenas uma página via `loadProducts`: 10, 25 ou 50 itens. Busca por nome, categoria e apresentação usa filtros combinados no PostgREST. Os cabeçalhos alternam ordenação crescente/decrescente; ID é o critério de desempate. Total filtrado vem de `count: exact`, não da quantidade de linhas da página. Respostas antigas são canceladas/ignoradas. Cadastro e remoção recarregam a página do backend, sem ordenar ou montar páginas com o catálogo em memória.

`Pagination` e `pageRange` são reutilizáveis nas próximas tabelas. A regra de paginação no backend foi registrada em `AGENTS.md`. Outras seções ainda exibem listas demonstrativas, sem tabelas reais integradas.

Validações: migração preserva os demais campos; limites de paginação; navegador com API simulada conferindo filtros, contagem, ordenação, limite/offset, troca de tamanho, resultado vazio e remoção do último item de uma página. Referência: https://supabase.com/docs/reference/javascript/using-modifiers-range.

## Edição

A ação Editar abre um modal preenchido. O envio usa o ID e a versão lida (`revision`); alterações concorrentes são recusadas e exigem reabrir o registro. A versão é incrementada no banco. Exclusões também comparam a versão. A vitrine pública estática continua independente do catálogo da gestão.
