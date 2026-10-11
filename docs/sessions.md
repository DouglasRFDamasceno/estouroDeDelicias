# Logout e dados em memória

O botão Sair na gestão e no perfil usa `logoutCurrentSession`, que chama `supabase.auth.signOut({ scope: 'local' })`. Isso encerra a sessão atual do navegador. Outros dispositivos permanecem conectados. O SDK remove as credenciais persistidas e sincroniza o evento de saída entre abas da mesma origem.

O AuthProvider limpa a identidade ao receber uma sessão nula e remonta a árvore de páginas quando muda o usuário autenticado. Isso descarta o estado dos formulários e o cache de páginas do Ionic, inclusive ao trocar de conta. Após a saída, `location.replace('/entrar')` abre um novo documento; páginas restauradas pelo back/forward cache são recarregadas para consultar a sessão atual. Consultas em andamento do catálogo são canceladas ao desmontar. Dados e credenciais de outros aplicativos não são apagados.

Se a revogação remota falhar, o SDK atual ainda pode remover a sessão local. Nesse caso o login exibe um aviso explícito, sem afirmar que o servidor confirmou o encerramento. Se a sessão persistir, o botão informa a falha e permite tentar novamente.

Limite do Supabase: revogar o refresh token não invalida imediatamente um access token JWT já emitido; ele pode continuar válido até expirar. Não prometer revogação instantânea de um token previamente copiado. Referência: https://supabase.com/docs/guides/auth/signout.

Validação com sessões e rede simuladas em navegador: logout com sucesso, erro 503, remoção da credencial local, limpeza da tabela em segunda aba, histórico sem tabela autenticada e /conta redirecionando para login. Build e testes de domínio passaram.

## Duração e inatividade

A aplicação encerra a sessão após **72 horas desde o login** ou **72 horas sem interação**, o que ocorrer primeiro. Atividade não estende a duração total. Como os dois limites são iguais, o prazo absoluto será atingido antes ou junto do prazo ocioso; as constantes separadas em `src/domain/sessionPolicy.ts` permitem reduzir o prazo ocioso depois.

Cliques, movimento do ponteiro, teclado, toque e rolagem em uma aba visível registram atividade, compartilhada entre abas por `localStorage` e identificada pelo `session_id` do JWT. Renovação de token, recarga, foco e consultas em segundo plano não renovam os prazos. Há verificação a cada segundo e ao retornar à página, antes de registrar novas interações. Suspensão do navegador adia a execução até ele retomar. Ao expirar, as páginas autenticadas são desmontadas e a aplicação tenta revogar a sessão local, encaminhando para o login com uma mensagem de expiração.

Sessões anteriores à implantação, sem metadados de prazo, exigem novo login ao serem restauradas. Falha de leitura/escrita do armazenamento também exige autenticação. Os metadados não contêm tokens. O controle no navegador depende do relógio e do armazenamento do dispositivo e não substitui imposição de prazos no servidor.

### Configuração do Supabase hospedado

O projeto mantém o plano atual, sem contratar Pro. A migração `20261011000100_server_session_deadline.sql` impõe o limite absoluto de 72 horas no PostgreSQL, usando o `session_id` do JWT validado pelo gateway e a data `auth.sessions.created_at`, comparados ao relógio do servidor. Não confia em `iat`, relógio do dispositivo ou localStorage. Sessão inexistente, de outro usuário, com data futura ou com `not_after` vencido é recusada. O limite é exclusivo: ao completar 72 horas, novas operações protegidas são negadas.

O controle foi integrado a `private.confirmed_user()`, já usado pelas policies de perfis/catálogo/negócio e pelas RPCs. A RPC `current_session_valid()` só responde sobre a sessão do próprio chamador. A função `invite-user` consulta essa RPC com o Bearer do usuário antes de usar suas credenciais administrativas. O navegador não recebe acesso a `auth.sessions` nem ao helper privado. Credenciais de serviço continuam privilegiadas e devem permanecer somente no servidor.

Para ativar no ambiente hospedado, aplicar a nova migração após as anteriores e publicar a versão atualizada de `invite-user`. Estas etapas remotas ainda não foram executadas. Publicar a função antes da migração faz convites falharem de forma segura enquanto a RPC estiver ausente. Não é necessário alterar plano ou habilitar controles pagos do Auth.

O Auth ainda pode emitir/renovar tokens após 72h; esses tokens não autorizam os dados e operações protegidos do aplicativo. A alteração não modifica os endpoints internos do Auth (por exemplo, alteração da senha do próprio usuário), nem adiciona políticas a buckets/serviços futuros. Novas funcionalidades devem adotar o mesmo controle. A inatividade humana continua medida somente na interface; como o prazo absoluto também é 72h, ele já limita a duração máxima. Dados já entregues e requisições iniciadas antes do limite não são retroativamente removidos.

`supabase/config.toml` mantém os controles nativos apenas para desenvolvimento local. A configuração nativa hospedada é opcional, exige plano compatível e não faz parte desta solução.

Nos controles nativos opcionais do Supabase, inatividade significa ausência de renovação de token, enquanto na interface significa ausência de interação humana. O Supabase verifica esses limites na renovação e um JWT emitido pode continuar válido até expirar; manter a expiração usual de JWT (1 hora), sem aumentá-la para três dias. Referências: [sessões](https://supabase.com/docs/guides/auth/sessions) e [configuração local](https://supabase.com/docs/guides/local-development/cli/config).

### Verificação local

Executar todos os arquivos `supabase/tests/*.sql` como postgres em banco local/de testes após as migrações. As fixtures agora incluem sessões e o claim `session_id`. `session_deadline_security.sql` verifica sessões recentes, imediatamente antes do limite, no limite, vencidas, revogadas, com ID inválido/ausente e de outro usuário; valida leitura/escrita/RPCs negadas e acesso legítimo preservado. Tudo termina em rollback. Nunca executar essas fixtures em produção.

Para testar o handler de convite sem rede ou Deno: `node --test supabase/tests/invite_session.test.mjs`. Ele executa o handler real com respostas Auth/RPC simuladas e confirma que nenhuma operação de convite acontece quando a sessão é inválida ou a verificação falha. Não substitui teste de integração do gateway/Auth real.
