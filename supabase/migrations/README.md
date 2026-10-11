# Migrações SQL versionadas

`20261010000100_user_profiles.sql` cria o perfil privado, trigger de provisionamento, constraints, grants mínimos e RLS por titular confirmado.

`20261010000200_admin_flag.sql` adiciona o indicador administrativo, sem permissão de autopromoção pelo cliente. Aplicar depois da migração de perfis. Veja também [administração](../../docs/admin.md).

Veja [configuração e testes](../../docs/supabase.md) antes de aplicar. Nenhuma migração foi executada em banco remoto. A tabela é para dados pessoais; autorização e isolamento por empresa virão em migrações próprias.

Arquivos futuros seguem `YYYYMMDDHHMMSS_descricao.sql`. Não editar uma migração já aplicada: criar outra para evoluir. Versionar tabelas, constraints, grants, funções e RLS juntos. Nunca incluir credenciais.

`20261011000100_server_session_deadline.sql` deve ser aplicada após as dez migrações anteriores. Acrescenta validação de sessão existente e prazo absoluto de 72 horas ao helper de autorização central, sem exigir plano Pro. Publicar também a função `invite-user` atualizada. Ver [sessões e testes](../../docs/sessions.md). Enquanto migração e função não forem aplicadas remotamente, a proteção publicada não está comprovada.
