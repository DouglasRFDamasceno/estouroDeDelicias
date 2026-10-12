# Insumos e receitas

Em **Custos e despesas**, há dois cadastros reais:

1. **Insumos**: nome, quantidade comprada, unidade e preço total dessa quantidade. Exemplo: Chocolate, 1 kg, R$ 30,00. Embalagens também podem ser insumos: 100 unidades por R$ 20,00.
2. **Receitas e custos**: nome, rendimento da preparação (g/kg, ml/l ou un), produto/apresentação opcional do catálogo, rendimento em unidades de venda e quantidades usadas de cada insumo ou receita base. As buscas por produtos, insumos e receitas são paginadas no backend.

## Usar uma receita dentro de outra

1. Cadastre a **pipoca caramelizada** com seus insumos e informe o rendimento pronto, por exemplo **1 kg**. Se ela serve apenas de base, deixe o produto em branco.
2. Na receita de **pipoca gourmet de morango**, use **Adicionar receita base**, selecione a caramelizada e informe quanto dela será usado, por exemplo **300 g**.
3. Acrescente os demais insumos de morango. O custo total soma esses insumos com **30% do custo da caramelizada**. Se a base custa R$ 20,00, os 300 g acrescentam R$ 6,00.

O rendimento da preparação é independente do rendimento para venda: uma preparação de 1 kg pode render dez pacotes. Para consumir uma preparação inteira sem medir peso/volume, cadastre o rendimento como **1 un** e use **1 un** na outra receita (ou **0,5 un** para metade).

Receitas base podem usar outras receitas base. Alterar um preço de insumo, a composição ou o rendimento da base recalcula todas as receitas dependentes e as estimativas da Visão geral. O cálculo mantém as frações de centavo nos níveis intermediários. O sistema bloqueia autorreferências e vínculos circulares, inclusive indiretos. Uma receita usada como base não pode ser excluída até remover seus vínculos; também não pode mudar de família de rendimento enquanto estiver em uso.

Na migração, receitas já existentes mantêm o rendimento de venda como referência inicial em **un**. Edite o rendimento da preparação quando quiser usá-las por peso ou volume.

Exemplo: usar 200 g do chocolate custa `3000 centavos × 200 g ÷ 1000 g = 600 centavos` (R$ 6,00). Se a receita rende dez pacotes do produto selecionado, o custo de chocolate por pacote é R$ 0,60. O total soma todos os insumos; o custo unitário divide o total sem arredondamento intermediário pelo rendimento. A exibição monetária é arredondada para centavos.

Conversões: kg ↔ g, l ↔ ml e un ↔ un. Massa e volume não são intercambiáveis; o sistema não presume densidade. Quantidades, inclusive rendimento da preparação, permitem três casas decimais, vírgula ou ponto, sem separador de milhares. O rendimento em unidades de venda deve ser inteiro positivo (quantidade de unidades da apresentação selecionada, não o peso da receita).

Os preços de insumos são **referências atuais de compra**. Editar o preço/quantidade de referência recalcula as receitas existentes na consulta ao banco. Não é um histórico de compras, controle de estoque, movimentação de caixa ou custo histórico das vendas. Energia, perdas e mão de obra não são adicionadas automaticamente. A Visão geral usa essas referências para estimar o custo das unidades vendidas, com aviso de cobertura e sem apresentar lucro líquido. Veja [indicadores](dashboard.md).

Cada cadastro permite criar, editar e remover, com confirmação na exclusão. Insumos usados em receitas não podem ser excluídos até retirar os vínculos. Um insumo usado também não pode mudar de família de unidade (por exemplo, de kg para ml). Remover receita remove seus itens. Remover produto do catálogo preserva a receita e seu rótulo, permitindo escolher outro produto na edição.

## Copiar uma receita para um novo cadastro

Em **Nova receita**, abra **Começar copiando outra receita**, busque pelo nome e selecione a receita desejada. Clique em **Copiar para o formulário** para preencher insumos, receitas base, quantidades, rendimentos e observações. A busca continua paginada no backend.

O formulário sugere **Cópia de…** e seleciona o nome para edição. O produto fica em branco para escolher o produto da nova receita, evitando vinculá-la por engano ao sabor original. Ao escolher um produto, o rendimento de venda copiado é reapresentado. Revise os campos e clique em **Salvar nova receita**; copiar para o formulário ainda não grava nenhum cadastro.

Se houver preenchimento, escolha **Manter preenchimento** ou **Substituir preenchimento**. Escape cancela essa confirmação sem fechar o formulário. A substituição só acontece depois de carregar a receita inteira; uma falha preserva o rascunho e permite tentar novamente ou escolher outra receita.

A cópia recebe um identificador novo e mantém a original. Alterar os ingredientes ou as quantidades da receita original depois não modifica a cópia. Insumos e receitas base continuam compartilhando os mesmos cadastros de referência, então alterações de preços e custos dessas bases seguem refletidas nas duas receitas. **Adicionar receita base** continua sendo a opção para consumir parte de uma preparação, com o custo proporcional ao rendimento.

Esta opção utiliza as consultas e a RPC existentes; não requer outra migração de banco.

## Banco e segurança

Migrações `20261010000900_materials_recipes.sql` e `20261012000100_recipe_components.sql`:

- `materials`: insumos e preços/quantidades de referência.
- `recipes` e `recipe_items`: receita, produto opcional, rendimentos e quantidades consumidas. Cada item referencia exatamente um insumo ou uma receita base.
- `recipe_costs`: view recursiva com `security_invoker=true`, que respeita RLS e calcula os custos no PostgreSQL com `numeric`, sem arredondamento intermediário. `raw_total_cents` mantém a precisão para composição e indicadores.
- `save_recipe`: RPC transacional para criação/edição, autorização de administrador com e-mail confirmado, validação de unidades/quantidades/IDs, até 50 componentes distintos, versão contra sobrescrita e chave idempotente para repetir a confirmação. Alterações de composição são serializadas para impedir ciclos entre sessões concorrentes. A assinatura anterior permanece compatível.

A migração foi aplicada ao projeto Supabase configurado em 12/10/2026, após `20261011000400_accent_insensitive_search.sql`, com a versão remota `20261012151233` (`recipe_components`). As colunas, vínculos, permissões e RLS foram verificados; os cadastros existentes foram preservados. Para disponibilizar o formulário atualizado no site, publicar também o frontend.

Todas as tabelas e a view têm acesso restrito a administradores confirmados. Permissões de escrita direta de receitas/itens são bloqueadas; somente a RPC pode criá-los/alterá-los. Insumos só concedem escrita nos campos de cadastro; versão e data são controladas no banco. Listagens, filtros por nome, ordenação e contagem são calculados no backend, com páginas de 10/25/50 registros e desempate por ID. Estados de sessão são descartados pelo AuthProvider ao trocar de usuário.

A prévia no formulário usa os preços consultados, e o resultado salvo é calculado com os preços atuais do banco. Em falhas sem confirmação, o formulário preserva a mesma solicitação da receita para repetir sem duplicar. A inclusão de insumo orienta conferir a listagem antes de repetir uma operação sem confirmação.

Validação: `src/domain/costs.test.ts` (conversões, proporcionalidade e entradas inválidas); `supabase/tests/costs_security.sql` (cadastros existentes); `supabase/tests/recipe_components.sql` (composição em vários níveis, bases compartilhadas, recálculo de preço/rendimento, precisão, indicadores, ciclos, rollback, idempotência, integridade e acesso). Nenhum insumo ou receita real é necessário para executar os testes.
