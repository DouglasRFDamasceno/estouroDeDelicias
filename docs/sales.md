# Vendas

Em Gestão → Vendas, **Nova venda** abre o modal. Cliente e produto usam seletores com busca por nome no backend (dez opções por página, com navegação). Digite para filtrar e clique em uma opção, ou use as setas e Enter. Escape fecha as opções sem fechar o modal. Produtos são adicionados aos itens ao selecionar; ajuste suas quantidades abaixo. O cliente é opcional (Consumidor final); o valor recebido acompanha automaticamente o total ao adicionar, remover ou alterar quantidades. É possível ajustar manualmente para registrar recebimento parcial ou zero. Para registrar recebimento, selecione Pix, dinheiro, cartão ou outro. Observações são opcionais. Os dados são registros manuais, sem processamento de pagamento.

A listagem tem filtro por cliente, ordenação por data/cliente/total e paginação no backend. A seleção de produtos também consulta páginas no backend. A Visão geral consulta as vendas reais por período, com recebimentos, pendências e custos estimados conforme [as regras dos indicadores](dashboard.md).

## Banco e segurança

Migração: `supabase/migrations/20261010000600_sales.sql`.

- `sales`: cliente, data, total, recebido, pagamento, observações, autor e chave de idempotência.
- `sale_items`: produto, quantidade e cópia do nome, categoria, apresentação e preço no momento da venda. Excluir o produto do catálogo preserva o histórico.
- RLS: somente administradores com e-mail confirmado podem consultar vendas e itens. A autorização vem de `profiles.is_admin`, nunca dos metadados editáveis do usuário.
- A criação ocorre exclusivamente pela RPC `create_sale`, em uma transação. INSERT e UPDATE diretos pelo navegador são bloqueados; a remoção é permitida apenas a administradores confirmados por RLS. O servidor valida os produtos e calcula o total com preços do catálogo; preços desatualizados são rejeitados. Limites: 50 produtos distintos, 999 unidades por item, data entre 2000 e hoje (America/Sao_Paulo), recebido entre zero e o total.
- Uma chave por solicitação e um bloqueio transacional evitam duplicação em tentativas simultâneas ou repetidas. Quando a confirmação de rede falha, o modal preserva e bloqueia a edição do envio até repetir a mesma solicitação. Confira a listagem antes de abandonar uma tentativa sem confirmação e abrir outra venda.
- Valores em centavos inteiros; sem coleta de CPF, endereço ou dados de cartão. Dados carregados permanecem em memória e são descartados pela troca de sessão no AuthProvider.

Teste de integração SQL: `supabase/tests/sales_security.sql` (executar apenas em banco de teste, com as migrações aplicadas). Usa transação revertida e verifica acesso, idempotência, totais, recebimento inválido, preço adulterado, escrita direta bloqueada e preservação do histórico.

## Seleção de clientes

A migração `20261010000700_sale_customers.sql` cria `customers` (ID, nome e data), com consulta e inclusão restritas a administradores com e-mail confirmado. Os nomes reais do histórico são importados; exemplos da seção demonstrativa não são importados. Nomes iguais são permitidos (pessoas distintas); o seletor mostra um identificador curto para diferenciá-los.

No seletor, **Cadastrar cliente “nome”** salva um novo cadastro e o seleciona. Esse cadastro permanece mesmo ao cancelar a venda. A seção Clientes lista os cadastros reais e permite cadastrar novos clientes.

A venda referencia `customer_id` e preserva o nome na data da venda. A RPC resolve o nome pelo ID no banco, rejeita IDs inexistentes e mantém criação transacional e idempotência. O cálculo original fica em função privada, sem permissão de execução para o navegador. O parâmetro opcional preserva compatibilidade com vendas sem cliente identificado.

Teste adicional: `supabase/tests/sale_customers_security.sql` verifica permissões e vínculo da venda, rejeição de cliente inexistente, nome calculado no servidor e bloqueio da função interna.

## Edição e remoção

A migração `20261010000800_management_crud.sql` adiciona edição transacional pela RPC `update_sale` e remoção administrativa. Cada linha tem Editar (mesmo modal preenchido) e Remover (confirmação com cliente, data e total). Remover venda exclui também seus itens. Não existe integração de cobrança/estorno financeiro nesta etapa.

A edição permite cliente, data, itens, quantidades, recebido, pagamento e observações. O valor recebido original é mantido ao abrir; mudanças no total preenchem automaticamente o valor recebido, que continua ajustável. Itens existentes conservam o preço e a descrição originais, inclusive se o produto foi removido ou teve seu preço alterado. Novos itens usam preços atuais do catálogo. O servidor resolve snapshots por ID de item pertencente à venda, sem confiar em descrições/preços enviados. O nome do cliente selecionado é resolvido no servidor ao salvar a edição.

A versão `revision` é incrementada no banco e comparada ao editar/excluir. Edições concorrentes exigem reabrir o registro, evitando sobrescritas silenciosas. Uma chave de solicitação permite repetir a última edição sem aplicá-la novamente. Itens e total são atualizados juntos; qualquer erro reverte toda a transação. `supabase/tests/management_crud_security.sql` cobre autorizações, conflitos, repetição, preço histórico, campos protegidos, rollback e exclusão sem itens órfãos.
