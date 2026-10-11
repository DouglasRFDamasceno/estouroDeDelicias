# Logout e dados em memória

O botão Sair na gestão e no perfil usa `logoutCurrentSession`, que chama `supabase.auth.signOut({ scope: 'local' })`. Isso encerra a sessão atual do navegador. Outros dispositivos permanecem conectados. O SDK remove as credenciais persistidas e sincroniza o evento de saída entre abas da mesma origem.

O AuthProvider limpa a identidade ao receber uma sessão nula e remonta a árvore de páginas quando muda o usuário autenticado. Isso descarta o estado dos formulários e o cache de páginas do Ionic, inclusive ao trocar de conta. Após a saída, `location.replace('/entrar')` abre um novo documento; páginas restauradas pelo back/forward cache são recarregadas para consultar a sessão atual. Consultas em andamento do catálogo são canceladas ao desmontar. Dados e credenciais de outros aplicativos não são apagados.

Se a revogação remota falhar, o SDK atual ainda pode remover a sessão local. Nesse caso o login exibe um aviso explícito, sem afirmar que o servidor confirmou o encerramento. Se a sessão persistir, o botão informa a falha e permite tentar novamente.

Limite do Supabase: revogar o refresh token não invalida imediatamente um access token JWT já emitido; ele pode continuar válido até expirar. Não prometer revogação instantânea de um token previamente copiado. Referência: https://supabase.com/docs/guides/auth/signout.

Validação com sessões e rede simuladas em navegador: logout com sucesso, erro 503, remoção da credencial local, limpeza da tabela em segunda aba, histórico sem tabela autenticada e /conta redirecionando para login. Build e testes de domínio passaram.
