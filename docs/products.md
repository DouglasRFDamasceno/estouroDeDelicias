# Catálogo de produtos

A migração `20261010000300_products.sql` cria `public.products` e cadastra os 13 sabores do catálogo público nas apresentações de 50 g, 100 g e 150 g (39 registros). Preços em centavos conforme `src/pages/Landing.tsx`; os três produtos fictícios de `services/demo.ts` não foram importados e não foram inventados custos.

A tabela permite qualquer categoria e apresentação, incluindo unidade, caixa, peso e outros produtos futuros. Nome + categoria + apresentação são únicos sem distinguir maiúsculas ou espaços externos. IDs e datas são gerados pelo banco; limites de tamanho e preço são validados também por constraints.

O catálogo é compartilhado pela Estouro de Delícias, não um catálogo privado por usuário ou multiempresa. Somente contas confirmadas podem consultar. Somente administradores definidos em `profiles.is_admin` podem cadastrar. RLS verifica o papel no banco a cada inserção; metadados do usuário não concedem permissão. Não há UPDATE/DELETE liberado ao cliente nesta etapa. Nenhuma chave administrativa vai para o frontend. Os perfis pessoais continuam restritos ao titular.

A tela `/demo/produtos` consulta o catálogo real e apresenta o botão de cadastro aos administradores. Visitantes recebem um link para login. Outras seções da gestão continuam demonstrativas. O catálogo público da página inicial ainda é estático; cadastrar um produto nesta tela não altera a vitrine automaticamente.

Migração aplicada ao projeto Supabase conectado em 10/10/2026. Interface apenas local enquanto não houver commit/publicação.

Validação: testes de domínio para preços e campos; políticas exercitadas em PostgreSQL temporário (PGlite) com papéis Auth simulados, incluindo anônimo, confirmado comum, não confirmado, administrador, administrador revogado, duplicidade, preço negativo e campos gerados. Os testes não substituem a validação do fluxo completo no navegador com contas reais.
