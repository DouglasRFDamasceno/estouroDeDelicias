# Insumos e receitas

Em **Custos e despesas**, há dois cadastros reais:

1. **Insumos**: nome, quantidade comprada, unidade e preço total dessa quantidade. Exemplo: Chocolate, 1 kg, R$ 30,00. Embalagens também podem ser insumos: 100 unidades por R$ 20,00.
2. **Receitas e custos**: nome, produto/apresentação do catálogo, rendimento em unidades de venda e quantidades usadas de cada insumo. A busca por produtos e insumos é paginada no backend.

Exemplo: usar 200 g do chocolate custa `3000 centavos × 200 g ÷ 1000 g = 600 centavos` (R$ 6,00). Se a receita rende dez pacotes do produto selecionado, o custo de chocolate por pacote é R$ 0,60. O total soma todos os insumos; o custo unitário divide o total sem arredondamento intermediário pelo rendimento. A exibição monetária é arredondada para centavos.

Conversões: kg ↔ g, l ↔ ml e un ↔ un. Massa e volume não são intercambiáveis; o sistema não presume densidade. Quantidades permitem três casas decimais, vírgula ou ponto, sem separador de milhares. Rendimento deve ser inteiro positivo (quantidade de unidades da apresentação selecionada, não o peso da receita).

Os preços de insumos são **referências atuais de compra**. Editar o preço/quantidade de referência recalcula as receitas existentes na consulta ao banco. Não é um histórico de compras, controle de estoque, movimentação de caixa ou custo histórico das vendas. Energia, perdas e mão de obra não são adicionadas automaticamente. A Visão geral usa essas referências para estimar o custo das unidades vendidas, com aviso de cobertura e sem apresentar lucro líquido. Veja [indicadores](dashboard.md).

Cada cadastro permite criar, editar e remover, com confirmação na exclusão. Insumos usados em receitas não podem ser excluídos até retirar os vínculos. Um insumo usado também não pode mudar de família de unidade (por exemplo, de kg para ml). Remover receita remove seus itens. Remover produto do catálogo preserva a receita e seu rótulo, permitindo escolher outro produto na edição.

## Banco e segurança

Migração `20261010000900_materials_recipes.sql`:

- `materials`: insumos e preços/quantidades de referência.
- `recipes` e `recipe_items`: receita, produto, rendimento e quantidades consumidas.
- `recipe_costs`: view com `security_invoker=true`, que respeita RLS e calcula os custos no PostgreSQL com `numeric`.
- `save_recipe`: RPC transacional para criação/edição, autorização de administrador com e-mail confirmado, validação de unidades/quantidades/IDs, até 50 insumos distintos, versão contra sobrescrita e chave idempotente para repetir a confirmação.

Todas as tabelas e a view têm acesso restrito a administradores confirmados. Permissões de escrita direta de receitas/itens são bloqueadas; somente a RPC pode criá-los/alterá-los. Insumos só concedem escrita nos campos de cadastro; versão e data são controladas no banco. Listagens, filtros por nome, ordenação e contagem são calculados no backend, com páginas de 10/25/50 registros e desempate por ID. Estados de sessão são descartados pelo AuthProvider ao trocar de usuário.

A prévia no formulário usa os preços consultados, e o resultado salvo é calculado com os preços atuais do banco. Em falhas sem confirmação, o formulário preserva a mesma solicitação da receita para repetir sem duplicar. A inclusão de insumo orienta conferir a listagem antes de repetir uma operação sem confirmação.

Validação: `src/domain/costs.test.ts` (conversões e entradas inválidas); `supabase/tests/costs_security.sql` (cálculo, recálculo, edição, idempotência, conflitos, rollback, integridade e acesso); fluxo de navegador com dados simulados (compra, busca, receita, total, rendimento, edição, remoção e layout no celular). Nenhum insumo ou receita real foi criado durante os testes.
