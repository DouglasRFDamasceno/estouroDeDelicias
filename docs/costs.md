# Insumos e receitas

Em **Custos e despesas**, há três cadastros reais:

1. **Insumos**: nome, categoria opcional de texto, quantidade comprada, unidade e preço total dessa quantidade. Exemplo: Chocolate, 1 kg, R$ 30,00. Embalagens também podem ser insumos: 100 unidades por R$ 20,00.
2. **Receitas e custos**: nome, categoria, rendimento da preparação (g/kg, ml/l ou un), quantidades usadas de cada insumo ou receita base e apresentações opcionais do catálogo. No cálculo por peso, uma receita atende a vários produtos; as embalagens são configuradas por pacote. O modo anterior por unidades de venda continua disponível. As buscas por produtos, categorias, insumos e receitas são paginadas no backend.

3. **Despesas**: descrição, categoria opcional, data, valor e observações. Gastos do negócio são descontados do lucro bruto no período correspondente, sem repetir os ingredientes e embalagens das receitas. Veja [indicadores e despesas](dashboard.md).

## Uma receita para 50, 100 e 150 g

1. Em **Produtos**, informe o **Peso líquido (g)** de cada apresentação, sem incluir o peso da embalagem. O campo aceita até três casas decimais. Rótulos existentes que contêm somente um número e `g` ou `kg` são convertidos pela migração; apresentações como “Cone” precisam do preenchimento manual.
2. Cadastre uma receita por sabor. Deixe **Cálculo do custo → Por peso · várias apresentações** e informe quanto a preparação pronta rende, por exemplo **1 kg**.
3. Em **Insumos da preparação**, adicione os ingredientes e receitas base usados no lote inteiro.
4. Em **Apresentações e embalagens**, selecione os produtos do mesmo sabor, como 50, 100 e 150 g. Abra **Embalagens por pacote** em cada apresentação e informe a quantidade de saco, etiqueta ou laço usada em **um pacote**.
5. Confira a prévia de preparação, embalagem e custo por pacote, depois salve a receita. Alterar preço de insumo, rendimento ou peso do produto recalcula os custos no banco e as estimativas da Visão geral.

Fórmula: `custo por pacote = custo da preparação × peso líquido do produto ÷ rendimento da preparação + embalagem por pacote`. Uma preparação de 1 kg a R$ 20,00 custa R$ 1,00, R$ 2,00 e R$ 3,00 para 50, 100 e 150 g. Com embalagem de R$ 0,50 por pacote, os custos ficam **R$ 1,50, R$ 2,50 e R$ 3,50**. A embalagem inteira é somada a cada pacote. O custo da receita e o consumo como base incluem somente a preparação.

O cálculo por peso com apresentações exige rendimento em **g ou kg**. Sem apresentações, a receita pode ser uma base por peso, volume ou unidades. Há limite de 50 apresentações e dez insumos de embalagem por apresentação. Cada apresentação tem seu próprio conjunto de embalagens; elas não são copiadas automaticamente entre tamanhos.

As receitas existentes continuam no modo **Por unidades de venda · uma apresentação**, preservando os custos atuais. Para converter, edite a receita, informe o rendimento físico real e escolha o cálculo por peso. A apresentação atual é sugerida; adicione as demais. Se houver embalagens entre os insumos antigos, remova-as da preparação e configure-as por pacote para não contar duas vezes. A conversão só é gravada ao salvar. Clientes antigos não podem editar uma receita já convertida.

Um produto deve ter uma receita de custo: se houver mais de uma receita vinculada ao mesmo produto, a Visão geral sinaliza custo ambíguo e não presume qual delas usar. A migração não une nem exclui receitas antigas.

## Categorias dos insumos

No cadastro ou edição do insumo, preencha **Categoria do insumo (opcional)** com texto livre, como “Ingredientes”, “Coberturas” ou “Embalagens”. Use a mesma grafia para reunir os insumos no mesmo grupo. Deixe em branco para aparecer em **Sem categoria**.

Dentro da receita, os insumos são agrupados por sua categoria, mantendo quantidade, unidade, custo e remoção em cada item. Receitas consumidas como componentes aparecem em **Receitas base**. A categoria organiza a exibição; ela não transforma um insumo em embalagem nem altera o cálculo. Escolha explicitamente se ele pertence à preparação ou à embalagem por pacote.

A tabela de insumos mostra a categoria, permite ordenar por ela e filtrar por texto sem acentos. Filtros, ordenação, contagem e paginação são feitos no backend com RLS; aplicar filtros retorna à primeira página.

## Usar uma receita dentro de outra

1. Cadastre a **pipoca caramelizada** com seus insumos e informe o rendimento pronto, por exemplo **1 kg**. Se ela serve apenas de base, deixe o produto em branco.
2. Na receita de **pipoca gourmet de morango**, use **Adicionar receita base**, selecione a caramelizada e informe quanto dela será usado, por exemplo **300 g**.
3. Acrescente os demais insumos de morango. O custo total soma esses insumos com **30% do custo da caramelizada**. Se a base custa R$ 20,00, os 300 g acrescentam R$ 6,00.

No modo por unidades de venda, o rendimento da preparação é independente do rendimento para venda: uma preparação de 1 kg pode render dez pacotes. Para consumir uma preparação inteira sem medir peso/volume, cadastre o rendimento como **1 un** e use **1 un** na outra receita (ou **0,5 un** para metade).

Receitas base podem usar outras receitas base. Alterar um preço de insumo, a composição ou o rendimento da base recalcula todas as receitas dependentes e as estimativas da Visão geral. O cálculo mantém as frações de centavo nos níveis intermediários. O sistema bloqueia autorreferências e vínculos circulares, inclusive indiretos. Uma receita usada como base não pode ser excluída até remover seus vínculos; também não pode mudar de família de rendimento enquanto estiver em uso.

Na migração de receitas base, receitas já existentes mantêm o rendimento de venda como referência inicial em **un**. Edite o rendimento da preparação quando quiser usá-las por peso ou volume.

Exemplo: usar 200 g do chocolate custa `3000 centavos × 200 g ÷ 1000 g = 600 centavos` (R$ 6,00). Se a receita rende dez pacotes do produto selecionado, o custo de chocolate por pacote é R$ 0,60. O total soma todos os insumos; o custo unitário divide o total sem arredondamento intermediário pelo rendimento. A exibição monetária é arredondada para centavos.

Conversões: kg ↔ g, l ↔ ml e un ↔ un. Massa e volume não são intercambiáveis; o sistema não presume densidade. Quantidades, inclusive rendimento da preparação, permitem três casas decimais, vírgula ou ponto, sem separador de milhares. O rendimento em unidades de venda deve ser inteiro positivo (quantidade de unidades da apresentação selecionada, não o peso da receita).

Os preços de insumos são **referências atuais de compra**. Editar o preço/quantidade de referência recalcula as receitas existentes na consulta ao banco. Não é um histórico de compras, controle de estoque, movimentação de caixa ou custo histórico das vendas. Energia, perdas e mão de obra não são adicionadas automaticamente. A Visão geral usa essas referências para estimar o custo das unidades vendidas, com aviso de cobertura e sem apresentar lucro líquido. Veja [indicadores](dashboard.md).

Cada cadastro permite criar, editar e remover, com confirmação na exclusão. Insumos usados na preparação ou nas embalagens não podem ser excluídos até retirar os vínculos. Um insumo usado também não pode mudar de família de unidade (por exemplo, de kg para ml). Remover receita remove seus itens. Remover produto do catálogo preserva a receita e remove somente os vínculos e embalagens dessa apresentação, permitindo escolher outro produto na edição.

## Copiar uma receita para um novo cadastro

Em **Nova receita**, abra **Começar copiando outra receita**, busque pelo nome e selecione a receita desejada. Clique em **Copiar para o formulário** para preencher insumos, receitas base, categoria, quantidades, rendimentos e observações. A busca continua paginada no backend.

O formulário sugere **Cópia de…** e seleciona o nome para edição. Os vínculos com produtos e as embalagens por apresentação ficam em branco para configurar a nova receita, evitando vinculá-la por engano ao sabor original. O modo de cálculo é copiado. No modo por unidades, o rendimento de venda copiado é reapresentado ao escolher um produto. Revise os campos e clique em **Salvar nova receita**; copiar para o formulário ainda não grava nenhum cadastro.

Se houver preenchimento, escolha **Manter preenchimento** ou **Substituir preenchimento**. Escape cancela essa confirmação sem fechar o formulário. A substituição só acontece depois de carregar a receita inteira; uma falha preserva o rascunho e permite tentar novamente ou escolher outra receita.

A cópia recebe um identificador novo e mantém a original. Alterar os ingredientes ou as quantidades da receita original depois não modifica a cópia. Insumos e receitas base continuam compartilhando os mesmos cadastros de referência, então alterações de preços e custos dessas bases seguem refletidas nas duas receitas. **Adicionar receita base** continua sendo a opção para consumir parte de uma preparação, com o custo proporcional ao rendimento.

A cópia utiliza as mesmas consultas e a RPC de gravação das receitas.

## Categorias das receitas

Receitas vinculadas a um produto exibem sua categoria automaticamente. No cálculo por peso, prevalece a primeira apresentação adicionada; se ela for excluída do catálogo, prevalece a primeira que restar. Esse campo é somente leitura: ao editar a categoria no cadastro do produto, as receitas vinculadas passam a mostrar a nova categoria, sem duplicar a informação.

Receitas base, sem produto, têm **Categoria (opcional)**. A busca oferece as categorias existentes nos produtos e preserva opções ainda usadas por outras bases. É possível limpar a seleção e salvar sem categoria. Os cadastros antigos continuam válidos.

Ao copiar uma receita, sua categoria é sugerida na nova base. Ao selecionar um produto, prevalece a categoria dele. Se remover o produto no formulário, a categoria dele fica sugerida para a base; revise ou limpe antes de salvar. Se o único produto for excluído do catálogo, a receita preservada fica sem categoria até escolher outra na edição.

A listagem exibe a categoria, permite ordenar por ela e oferece **Filtrar por categoria**, aplicado ao selecionar uma opção. **Limpar** remove os filtros por nome e categoria. Busca, filtros, ordenação, contagem e paginação ocorrem no backend com RLS; trocar a categoria retorna à primeira página.

Requer `20261012000200_recipe_categories.sql` antes de publicar o frontend. A migração acrescenta a categoria opcional das bases, a categoria efetiva em `recipe_costs` e a consulta paginável `recipe_categories`. Mantém as assinaturas anteriores de `save_recipe`, preservando a categoria ao salvar por clientes antigos. Verificação isolada: `supabase/tests/recipe_categories.sql`.

Aplicada ao Supabase configurado em 12/10/2026 como `recipe_categories`, versão remota `20261012175905`. A conferência posterior confirmou os mesmos cadastros, itens, revisões e custos anteriores, sem divergências entre as categorias das receitas e seus produtos. A publicação do frontend é uma etapa separada.

## Banco e segurança

A migração `20261012000300_recipe_presentations_material_categories.sql` foi aplicada em 12/10/2026 como `recipe_presentations_material_categories`, versão remota `20261012192505`. A comparação antes/depois preservou receitas, itens, insumos, dados comerciais dos produtos e custos existentes. Os 42 produtos tiveram seus pesos preenchidos a partir de apresentações explícitas; as 12 receitas mantiveram o modo por unidades. O frontend precisa ser publicado para disponibilizar o novo formulário.

Migrações de receitas, componentes, categorias e apresentações:

- `materials`: insumos, categoria de texto e preços/quantidades de referência.
- `products.weight_grams`: peso líquido explícito, independente do rótulo de apresentação.
- `recipe_presentations` e `recipe_packaging`: apresentações ordenadas da receita e insumos por pacote; escrita somente pela RPC.
- `recipe_product_costs`: custos de preparação, embalagem e total por produto, com `security_invoker=true` e frações de centavo preservadas; integra os indicadores da gestão.
- `recipes` e `recipe_items`: receita, produto opcional, rendimentos e quantidades consumidas. Cada item referencia exatamente um insumo ou uma receita base.
- `recipe_costs`: view recursiva com `security_invoker=true`, que respeita RLS e calcula os custos no PostgreSQL com `numeric`, sem arredondamento intermediário. `raw_total_cents` mantém a precisão para composição e indicadores.
- `save_recipe`: RPC transacional para criação/edição, autorização de administrador com e-mail confirmado, validação de unidades/quantidades/IDs, até 50 componentes distintos, versão contra sobrescrita e chave idempotente para repetir a confirmação. Alterações de composição são serializadas para impedir ciclos entre sessões concorrentes. As assinaturas anteriores permanecem compatíveis para receitas por unidades; não podem sobrescrever receitas por peso.

A migração foi aplicada ao projeto Supabase configurado em 12/10/2026, após `20261011000400_accent_insensitive_search.sql`, com a versão remota `20261012151233` (`recipe_components`). As colunas, vínculos, permissões e RLS foram verificados; os cadastros existentes foram preservados. Para disponibilizar o formulário atualizado no site, publicar também o frontend.

Todas as tabelas de custos e suas views têm acesso restrito a administradores confirmados. Permissões de escrita direta de receitas/itens são bloqueadas; somente a RPC pode criá-los/alterá-los. Insumos só concedem escrita nos campos de cadastro; versão e data são controladas no banco. Listagens, filtros por nome, ordenação e contagem são calculados no backend, com páginas de 10/25/50 registros e desempate por ID. Estados de sessão são descartados pelo AuthProvider ao trocar de usuário.

A prévia no formulário usa os preços consultados, e o resultado salvo é calculado com os preços atuais do banco. Em falhas sem confirmação, o formulário preserva a mesma solicitação da receita para repetir sem duplicar. A inclusão de insumo orienta conferir a listagem antes de repetir uma operação sem confirmação.

Validação: `src/domain/costs.test.ts` (conversões, proporcionalidade e entradas inválidas); `supabase/tests/costs_security.sql` (cadastros existentes); `supabase/tests/recipe_components.sql` (composição em vários níveis, bases compartilhadas, recálculo de preço/rendimento, precisão, indicadores, ciclos, rollback, idempotência, integridade e acesso). `supabase/tests/recipe_presentations.sql` verifica tamanhos por peso, embalagens inteiras, precisão, revisões, idempotência, indicadores, conversão de pesos explícitos, limites, exclusões e acesso. Nenhum insumo ou receita real é necessário para executar os testes.
