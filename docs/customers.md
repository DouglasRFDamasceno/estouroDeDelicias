# Clientes

Gestão → Clientes exibe os registros reais de `public.customers`. **Cadastrar cliente +** abre um modal para informar o nome da pessoa ou empresa, de 2 a 120 caracteres. Após salvar, a listagem é recarregada e os filtros são limpos para mostrar o catálogo completo.

O cadastro usa a tabela e as permissões da migração `20261010000700_sale_customers.sql`, já compartilhadas com Vendas. Novos registros aparecem na busca de clientes da nova venda. Não são copiados dados dos exemplos nem dos perfis pessoais de usuários.

A tabela oferece filtros por nome e intervalo de cadastro (datas em UTC), ordenação por nome ou data com desempate por ID, contagem exata e páginas de 10, 25 ou 50 registros. Filtros, ordenação e paginação ocorrem no backend. Mudanças voltam à primeira página. Nomes iguais são permitidos e o identificador curto diferencia clientes homônimos.

Consulta e inclusão são restritas por RLS a administradores com e-mail confirmado. Os únicos dados coletados nesta etapa são nome, identificador e data de cadastro. Sem persistência dos clientes em cache local; o AuthProvider descarta o estado ao trocar de sessão. Erros de rede orientam conferir a listagem antes de repetir uma inclusão cuja confirmação não chegou.

Validação: build, testes de domínio e testes SQL de permissões de clientes. O fluxo de interface foi validado com backend simulado para paginação, ordenação, filtro, cadastro, modal no celular e seleção do novo cliente em Vendas.

## Atualização e remoção

Cada linha possui Editar e Remover. A edição abre o mesmo modal preenchido; a remoção exige confirmação. RLS limita ambas a administradores confirmados. A migração `20261010000800_management_crud.sql` adiciona `revision` e permissões de UPDATE somente para nome; o banco incrementa a versão. As operações comparam ID e versão para impedir sobrescrita/exclusão de registros alterados por outra sessão.

Remover cliente desvincula `sales.customer_id`, mas preserva os nomes históricos das vendas. Renomear cliente altera o cadastro e a busca de novas vendas, sem reescrever automaticamente o histórico. A paginação é corrigida após remover o último registro de uma página.
