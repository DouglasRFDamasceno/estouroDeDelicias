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

Em **Authentication > Sessions**, definir **Time-box user sessions = 72 horas** e **Inactivity timeout = 72 horas**. A configuração nativa exige plano Pro ou superior. `supabase/config.toml` registra `timebox = "72h"` e `inactivity_timeout = "72h"` para o ambiente local; editar esse arquivo não altera o projeto hospedado. As ferramentas conectadas nesta sessão não oferecem atualização das configurações de Auth; por decisão do responsável, os limites remotos não serão configurados e a política de 72 horas será aplicada somente pelo aplicativo.

No servidor, inatividade significa ausência de renovação de token, enquanto na interface significa ausência de interação humana. O Supabase verifica esses limites na renovação e um JWT emitido pode continuar válido até expirar; manter a expiração usual de JWT (1 hora), sem aumentá-la para três dias. Referências: [sessões](https://supabase.com/docs/guides/auth/sessions) e [configuração local](https://supabase.com/docs/guides/local-development/cli/config).
