# Migrações SQL versionadas

`20261010000100_user_profiles.sql` cria o perfil privado, trigger de provisionamento, constraints, grants mínimos e RLS por titular confirmado.

`20261010000200_admin_flag.sql` adiciona o indicador administrativo, sem permissão de autopromoção pelo cliente. Aplicar depois da migração de perfis. Veja também [administração](../../docs/admin.md).

Veja [configuração e testes](../../docs/supabase.md) antes de aplicar. As 15 migrações deste diretório estão aplicadas no projeto configurado (`kbjuwlvhqzunrokwqekm`), conforme verificação em 12/10/2026. A tabela é para dados pessoais; autorização e isolamento por empresa virão em migrações próprias.

Arquivos futuros seguem `YYYYMMDDHHMMSS_descricao.sql`. Não editar uma migração já aplicada: criar outra para evoluir. Versionar tabelas, constraints, grants, funções e RLS juntos. Nunca incluir credenciais.

`20261011000100_server_session_deadline.sql` deve ser aplicada após as dez migrações anteriores. Acrescenta validação de sessão existente e prazo absoluto de 72 horas ao helper de autorização central, sem exigir plano Pro. Publicar também a função `invite-user` atualizada. Ver [sessões e testes](../../docs/sessions.md). Enquanto migração e função não forem aplicadas remotamente, a proteção publicada não está comprovada.

`20261011000200_pending_orders.sql` cria pedidos pendentes privados, cotas de gravação e tentativa, limpeza e confirmação administrativa idempotente. Requer API Vercel configurada; Turnstile é opcional e está desativado no modo atual. Veja [ativação e limites](../../docs/public-orders.md).

`20261011000400_accent_insensitive_search.sql` adiciona campos calculados para buscas sem acentos em produtos, clientes, insumos, receitas, vendas e pedidos. Aplicar antes de publicar o frontend que usa esses filtros; mantém RLS, contagens e paginação nas consultas originais. Verificação SQL: `supabase/tests/accent_insensitive_search.sql`.

`20261012000100_recipe_components.sql` permite usar receitas como componentes de outras receitas, com rendimento da preparação por peso, volume ou unidades, produto opcional e custo proporcional em vários níveis. Preserva custos e rendimentos de venda existentes, bloqueia ciclos e exclusões de bases usadas e atualiza os indicadores. Aplicar antes do frontend atualizado. Ver [insumos e receitas](../../docs/costs.md) e `supabase/tests/recipe_components.sql`.

`20261012000200_recipe_categories.sql` acrescenta categorias às receitas: derivadas do produto vinculado ou opcionais em bases sem produto, com opções compartilhadas do catálogo. Preserva cadastros, custos, RLS, controle de versão, idempotência e as assinaturas anteriores de `save_recipe`. A view `recipe_categories` permite buscar e paginar as opções no backend. Aplicar antes do frontend que consulta os novos campos. Ver `supabase/tests/recipe_categories.sql`.

Aplicada em 12/10/2026 pelo conector Supabase como `recipe_categories` (versão remota `20261012175905`). Cadastros, itens, revisões e custos foram comparados antes/depois e permaneceram iguais. RLS, views com `security_invoker` e permissões foram verificadas; os testes com dados fictícios ocorreram somente no banco isolado local. Publicar o frontend separadamente para disponibilizar os campos e filtros.

Em 12/10/2026, foram aplicadas as duas migrações pendentes pelo conector Supabase: `server_session_deadline` (versão remota `20261012151228`) e `recipe_components` (`20261012151233`). As versões remotas são geradas no momento da aplicação e diferem dos nomes dos arquivos locais. Foram verificadas as funções, colunas, constraints, permissões e RLS; as contagens e verificações de integridade dos cadastros permaneceram iguais. Os testes com dados fictícios foram executados apenas no banco local isolado. A publicação do frontend e da função `invite-user` é uma operação separada.
