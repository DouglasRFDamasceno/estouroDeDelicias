# Auditoria de usabilidade — 11/10/2026

## Ambiente e cobertura

- Aplicação publicada: https://estourodedelicias.vercel.app/ (Vercel). Disponibilidade HTTP 200 e navegação real verificadas.
- Perfis: visitante sem sessão e administrador autenticado manualmente pelo usuário em um perfil temporário do Chrome. Nenhuma credencial foi solicitada pelo chat ou incluída neste relatório.
- Viewports: celular **390 × 844**, tablet **768 × 1000**, desktop **1440 × 1000**, em pixels CSS. Simulação no Chrome Linux; não foram utilizados aparelhos físicos.
- Método: inspeção de rotas e componentes do checkout local, navegação no site publicado e execução de interações pelo Chrome DevTools Protocol. A correspondência integral entre o checkout e a versão publicada não foi verificada.
- Escopo: auditoria, sem correções de código ou publicação. Foram criados somente este relatório e imagens de evidência. O ambiente publicado foi tratado como produção: sem salvar cadastros, alterar registros existentes, excluir dados, preparar pedidos no servidor, enviar WhatsApp, emitir convites ou solicitar recuperação por e-mail. O logout foi testado ao final.

**Resultado:** sete achados reproduzidos na interface e um identificado no código, com confirmação interativa ainda pendente. Nenhum bloqueio P0 foi observado nas interações realizadas. Isso não comprova a ausência de bloqueios nos salvamentos que não foram executados.

Esta avaliação identifica problemas por inspeção e execução de tarefas; não substitui testes com usuários reais. Não foram estimadas taxas de abandono ou ganhos percentuais.

## Inventário de rotas

Todas as linhas abaixo foram visitadas por URL direta nas três viewports, com a exceção explicitada para o padrão curinga. A abertura direta recarrega a aplicação; a disponibilidade de cada tela foi verificada após o carregamento. Não foram enumerados identificadores de registros.

| Rota/padrão | Finalidade | Perfil necessário | Acesso pela interface | Resultado e limitações |
| --- | --- | --- | --- | --- |
| `/` | Apresentação, catálogo e seleção de sabores | Público | Marca e links “Voltar ao site” | Visitada como visitante; catálogo aberto e seleção local testada nas três dimensões. |
| `/entrar` | Login e solicitação de recuperação | Público; com sessão redireciona à gestão | Cabeçalho e rodapé do site | Visitada sem sessão; login manual concluído na janela de administrador; logout retornou a esta tela. Erros de credenciais não foram provocados. |
| `/criar-conta` | Orientação de acesso por convite e formulário administrativo | Público para orientação; administrador para convidar | Login, rodapé e “Acesso e convites” no perfil | Visitada com e sem sessão. Orientação pública e formulário de convite administrativo disponíveis. Nenhum convite enviado. |
| `/conta` | Perfil e endereço | Autenticado | “Meu perfil” na gestão | Visitada como administrador; sem sessão redirecionou a `/entrar`. Sem alteração ou salvamento de dados pessoais. |
| `/auth/callback` | Confirmação de cadastro | Link válido de autenticação | E-mail de confirmação | Visitada sem token: mensagem de link inválido/expirado e retorno ao login. Sucesso com link válido não avaliado. |
| `/auth/invite` | Definição de senha por convite | Convite válido | E-mail de convite | Visitada sem token: recuperação por retorno ao login. Aceitação de convite não avaliada. |
| `/auth/recovery` | Recuperação de senha | Link válido para redefinir; público para pedir novo link | E-mail e fluxo de recuperação | Visitada sem token: mensagem explicativa e campo para solicitar novo link. Nenhuma solicitação enviada; redefinição não avaliada. |
| `/demo/dashboard` | Indicadores, período e tabelas da gestão | Administrador para indicadores | Menu “Visão geral” e links de demonstração | Visitada com e sem sessão. Indicadores carregaram para administrador; visitante recebeu aviso de acesso exclusivo, sem demonstração funcional. |
| `/demo/produtos` | Consulta e cadastro de produtos | Autenticado para consultar; administrador para gerenciar | Menu “Produtos” | Visitada com e sem sessão. Como administrador: filtros, paginação, ordenação e formulário de cadastro testados sem salvar. Visitante recebeu link de login. |
| `/demo/custos` | Insumos, receitas e custos de produção | Administrador | Menu “Custos e despesas” | Visitada com e sem sessão. Abas, formulário de insumo e estado vazio de receitas avaliados. Sem salvar insumos ou receitas. |
| `/demo/clientes` | Consulta e cadastro de clientes | Administrador | Menu “Clientes” | Visitada com e sem sessão. Abertura de cadastro, validação vazia, fechamento e rascunho local testados. Dados de clientes não reproduzidos no relatório. |
| `/demo/vendas` | Pedidos recebidos e vendas registradas | Administrador | Menu “Vendas” e atalhos do dashboard | Visitada com e sem sessão. Abas e formulário de nova venda testados sem salvar; pedidos recebidos estavam vazios. Conversão de pedido em venda não avaliada. |
| `/demo/:section` desconhecida | Recuperação de seção inexistente | Shell público | URL direta de teste `/demo/inexistente` | Visitada como visitante; título de página inexistente e link para visão geral. Texto de “próxima etapa” não explica a diferença entre endereço inválido e funcionalidade futura. |
| `*` | Página inexistente | Público | URL direta de teste `/rota-inexistente` | Visitada nas três dimensões; retorno ao início disponível. Texto ainda promete demonstração pública fictícia que não corresponde ao acesso observado. Não foram testadas todas as URLs possíveis do curinga. |

As cinco seções conhecidas de `/demo/:section` foram comparadas ao menu e visitadas com os dois perfis. Não foram avaliados outros perfis autenticados, links de autenticação válidos, links externos de WhatsApp ou todos os estados internos possíveis de cada rota.

## Tarefas e resultados

| Tarefa e estado inicial | Resultado esperado | Execução e resultado |
| --- | --- | --- |
| Entrar sem sessão | Autenticar e acessar a gestão | Login manual concluído pelo usuário com conta de administrador. Senha não capturada. Validação de formulário vazio e alternância Mostrar/Ocultar verificadas separadamente nas três viewports. |
| Explorar o catálogo a partir do site público | Abrir catálogo, selecionar sabor e conferir subtotal | Executado nas três viewports: seleção de um item, aumento de quantidade e subtotal correspondente; fechar e reabrir preservou a seleção. Busca `limao` encontrou Limão e seleção de 100 g foi testada adicionalmente no celular. Não foi acionado “Preparar pedido”. |
| Recuperar uma busca sem favoritos | Entender estado vazio e encontrar saída | Filtro de favoritos vazio apresentou orientação e botão “Ver todos os sabores”. Nenhum pedido enviado. |
| Cadastrar produto a partir da lista | Encontrar formulário e campos necessários | Formulário aberto nas três viewports, campos e foco inicial inspecionados; cancelado. Criação persistida não executada. |
| Encontrar produtos | Aplicar filtro, percorrer páginas e ordenar | “Próxima” levou à página 2; filtro `Ninho` retornou à página 1. Ordenar por Categoria também retornou à página 1. Trocar para 25 itens exibiu 25 linhas. Perda de filtro reproduzida ao navegar pelo menu e voltar pelo histórico. |
| Cadastrar cliente e corrigir campo vazio | Receber validação antes de envio | Formulário aberto nas três viewports; `reportValidity()` identificou nome obrigatório e focou o input. Cancelamento testado. Rascunho fictício com Escape testado adicionalmente no desktop; foi descartado sem confirmação. |
| Registrar custo de produção | Localizar insumo e receita | Formulário “Novo insumo” aberto e cancelado nas três viewports; campos de quantidade, unidade e preço presentes. Aba de receitas abriu com estado vazio. Cálculo com receita persistida não testado. |
| Registrar venda a partir do dashboard | Chegar à ação de nova venda | Atalho abriu a aba Pedidos recebidos. Após escolher Vendas registradas, formulário “Nova venda” abriu nas três viewports, dentro dos limites da viewport e com rolagem interna no celular. Nenhuma venda salva. |
| Navegar por teclado | Trocar abas e operar modais | ArrowRight alternou as abas de vendas e moveu o foco. Modal nativo aberto com fundo modal. Escape com evento nativo fechou o cadastro de cliente; retorno ao botão de origem não foi observado. Não foi executada uma verificação exaustiva de todos os ciclos de Tab. |
| Consultar e sair do perfil | Acessar perfil e retomar a gestão | Perfil carregou; não há link direto de volta à gestão na tela. Botão Sair da gestão retornou a `/entrar` e removeu os controles autenticados. Revogação de todas as sessões remotas não foi verificada. |
| Usar histórico e recarregar rotas | Voltar/avançar sem perder contexto esperado | Voltar e avançar entre login e orientação de cadastro funcionaram. Navegação pelo menu da gestão e retorno ao catálogo funcionaram, mas perderam o filtro. Abertura direta das rotas foi testada como recarga completa. |
| Encontrar e editar registro existente | Abrir, alterar, salvar e confirmar alteração | Consulta de listas executada; edição persistida e remoção não executadas no ambiente publicado. Não são classificadas como aprovadas. |

## Achados priorizados

Prioridade considera impacto, frequência provável, abrangência, alternativa disponível e confiança da evidência. P0 impede tarefa essencial sem alternativa; P1 gera grande dificuldade ou risco de erro; P2 cria atrito relevante com alternativa; P3 melhora clareza ou consistência. Esforço é qualitativo, sem estimativa de horas: pequeno para texto, destino ou link localizado; médio para estado de navegação ou comportamento compartilhado.

| ID | Prioridade | Rota/fluxo | Problema | Melhoria compatível com o layout | Esforço |
| --- | --- | --- | --- | --- | --- |
| U01 | P1 | Demonstração pública e página inexistente | Convites para explorar uma demonstração levam a áreas sem conteúdo demonstrativo acessível ao visitante; a página inexistente afirma que há dados fictícios e ausência de salvamento. | Alinhar rótulos e explicações ao acesso real; se a demonstração continuar sendo oferecida, disponibilizar modo isolado com dados fictícios. | Pequeno para corrigir comunicação; médio para modo demonstrativo |
| U02 | P2 | Dashboard → registrar venda | “Registrar uma venda” abre Pedidos recebidos, sem abrir cadastro ou selecionar Vendas registradas. | Transportar a intenção na URL e selecionar a aba/formulário de nova venda. | Pequeno a médio |
| U03 | P2 | Produtos → outra seção → Voltar | Filtros se perdem ao retornar pelo histórico. | Preservar filtros, página, tamanho e ordenação na URL, mantendo consultas no backend e reset para página 1 quando apropriado. | Médio |
| U04 | P2 | Tabela de produtos em celular/tablet | Preço e ações exigem rolagem lateral que não tem indicação textual. | Indicar “Deslize para ver preço e ações”, fornecer nome acessível para a região e avaliar fixar a coluna de ações. | Pequeno a médio |
| U05 | P2 | Login → Criar conta | A ação sugere cadastro autônomo, mas a página só informa acesso por convite para visitantes. | Usar “Acesso por convite” ou explicar a exigência ao lado do link antes da navegação. | Pequeno |
| U06 | P2 | Gestão → Meu perfil | Perfil oferece retorno ao site público, sem atalho para retomar a gestão. | Incluir “Voltar à gestão” com retorno à seção de origem quando disponível. | Pequeno |
| U07 | P2 | Cadastro de cliente → Escape | Fechamento descarta rascunho sem confirmação e não devolve o foco ao botão que abriu o cadastro. | Proteger rascunhos alterados e restaurar foco ao acionador após fechar. | Médio |
| U08 | P2 provisório | Acesso a `/conta` sem sessão → login | Código descarta o destino solicitado e fixa o pós-login no dashboard. Teste completo dessa sequência pendente. | Guardar destino interno permitido e retornar a ele após autenticação. | Pequeno a médio |

### U01 — A demonstração prometida não está disponível ao visitante

- **Perfil/viewport:** visitante; 390 × 844, 768 × 1000 e 1440 × 1000. A página inexistente também pode ser acessada autenticada.
- **Reprodução:** entrar em `/entrar`, acionar “Explorar a demonstração”, chegar a `/demo/dashboard`; percorrer as demais seções. Abrir também `/rota-inexistente` e ler a descrição da demonstração.
- **Observado:** dashboard informa que indicadores são exclusivos para administradores. Custos, clientes e vendas também restringem o conteúdo; Produtos pede login. A página inexistente afirma: “A demonstração é pública, usa dados fictícios e não salva informações.” Na sessão administrativa, as mesmas rotas carregam a gestão operacional.
- **Efeito:** o visitante não consegue experimentar o que o convite promete. A afirmação sobre ausência de salvamento também pode induzir uma compreensão errada do ambiente por quem chega autenticado. Não foram efetuadas gravações para testar essa afirmação.
- **Proposta:** corrigir primeiro a comunicação nos pontos de entrada e na página inexistente. Se o objetivo do produto for oferecer uma demonstração, separá-la explicitamente da gestão autenticada e de suas operações persistentes. A decisão de criar esse modo exige trabalho próprio; não se recomenda simplesmente expor dados da gestão.
- **Evidência:** [página inexistente em celular](docs/usability-audit-2026-10-11/pagina-inexistente-390.png); `src/pages/Login.tsx:180`, `src/pages/Landing.tsx:254`, `src/pages/AuthNotice.tsx`, restrições de acesso em Dashboard, Costs, Customers e Sales.
- **Confiança:** alta na inconsistência entre promessa e resultado; impacto em confiança e conversão é hipótese a validar com usuários.

### U02 — O atalho para registrar venda não conduz à ação correspondente

- **Perfil/viewport:** administrador; três dimensões.
- **Reprodução:** em `/demo/dashboard`, acionar “Registrar uma venda”.
- **Observado:** destino `/demo/vendas`, aba selecionada **Pedidos recebidos**, nenhum formulário aberto. Para iniciar o cadastro é necessário selecionar **Vendas registradas** e depois **+ Nova venda**.
- **Efeito:** a pessoa precisa descobrir uma mudança de aba para realizar a tarefa sugerida pelo atalho, especialmente quando a lista de pedidos está vazia.
- **Proposta:** manter a tela atual e transportar intenção, por exemplo `?aba=vendas&acao=nova`, validando os valores aceitos. Selecionar a aba adequada e abrir o formulário; se a decisão de produto for apenas abrir a lista, ajustar o rótulo do atalho.
- **Evidência:** navegação repetida nas três viewports; `src/components/Dashboard.tsx:74`, estado inicial `tab = 'orders'` em `src/components/Sales.tsx:35`.
- **Confiança:** alta. Não é uma avaliação baseada apenas em quantidade de cliques, mas na correspondência entre ação e destino.

### U03 — Retorno pelo navegador perde o filtro de produtos

- **Perfil/viewport:** administrador; três dimensões.
- **Reprodução:** em `/demo/produtos`, aplicar Produto = `Ninho`; navegar a Custos e despesas pelo menu; usar Voltar do navegador.
- **Observado:** o campo retorna vazio e a lista volta ao estado inicial. O teste também reproduziu a perda após navegação com recarga completa.
- **Efeito:** interrompe a busca por um conjunto específico de registros e exige refazer a consulta depois de conferir informações em outra seção.
- **Proposta:** persistir filtros aplicados, ordenação, página e tamanho de página em parâmetros de URL conhecidos. Diferenciar filtros em edição dos já aplicados. Reutilizar `Pagination.tsx` e `domain/pagination.ts`; continuar filtrando, contando e ordenando no backend, respeitando RLS, limites de página e desempate por chave única. Alterar filtros/ordenação/tamanho deve continuar voltando à página 1; exclusões devem continuar corrigindo páginas vazias.
- **Evidência:** filtro trouxe seis apresentações correspondentes, e o retorno pelo histórico trouxe o campo vazio nas três dimensões; estado local de filtros em `src/components/Products.tsx:39`.
- **Confiança:** alta para Produtos. Não se afirma que a perda foi reproduzida em todas as outras tabelas.

### U04 — Ações da tabela ficam fora da área visível sem orientação de rolagem

- **Perfil/viewport:** administrador; celular e tablet. Desktop utilizado como comparação.
- **Reprodução:** abrir `/demo/produtos`, descer até a tabela e procurar preço ou Editar mantendo a rolagem horizontal inicial.
- **Observado:** no celular, a região tem 326 px visíveis para 625 px de conteúdo; no tablet, 621 px para 657 px. No desktop, 890 px visíveis para 890 px de conteúdo. Preço e ações aparecem à direita no celular e precisam de rolagem lateral; não há instrução textual junto à tabela. A página inteira não transborda horizontalmente.
- **Efeito:** ações de editar/remover ficam menos descobríveis, embora permaneçam disponíveis ao rolar a região. Não se classifica a rolagem interna, por si só, como erro.
- **Proposta:** manter a tabela e acrescentar indicação quando houver conteúdo lateral; considerar ações fixas à direita e região com nome acessível. Verificar operação por teclado nas versões de navegador suportadas antes de escolher `tabIndex`; a ausência desse atributo, isoladamente, não comprova inacessibilidade no Chrome atual.
- **Evidência:** [celular](docs/usability-audit-2026-10-11/produtos-390.png), [tablet](docs/usability-audit-2026-10-11/produtos-768.png), [desktop](docs/usability-audit-2026-10-11/produtos-1440.png). Identidade da sessão e uma coluna de conteúdo foram ocultadas somente para capturar estas imagens; os espaços em branco dessas áreas não são defeitos da aplicação.
- **Confiança:** alta para o posicionamento e ausência de orientação; dificuldade percebida deve ser confirmada com usuários.

### U05 — “Criar conta” não esclarece a exigência de convite

- **Perfil/viewport:** visitante; três dimensões.
- **Reprodução:** abrir `/entrar` e seguir “Ainda não tem conta? Criar conta”; repetir pelo rodapé do site.
- **Observado:** `/criar-conta` explica que contas são criadas somente por convite de administrador; não oferece cadastro público. A restrição é legítima, mas aparece depois do clique.
- **Efeito:** a pessoa começa um fluxo com expectativa de cadastro e encontra apenas orientação, precisando procurar um administrador fora dele.
- **Proposta:** preservar acesso por convite e ajustar o rótulo para “Preciso de um convite”/“Como obter acesso”, ou explicitar a exigência antes do link. Se houver canal de solicitação definido pelo produto, apresentá-lo sem criar envio automático ou integração não autorizada.
- **Evidência:** `src/pages/Login.tsx:176`, `src/pages/Landing.tsx:253`, `src/pages/Register.tsx` e visita pública às telas.
- **Confiança:** alta na divergência de expectativa; não se recomenda abrir cadastro público como correção automática.

### U06 — Perfil não oferece retorno direto à gestão

- **Perfil/viewport:** administrador; tela inspecionada nas três dimensões, destinos dos links confirmados no desktop.
- **Reprodução:** na gestão, abrir Meu perfil e procurar uma ação para voltar à seção de trabalho.
- **Observado:** em `/conta`, os destinos de links são `/` e `/criar-conta`; não existe link para `/demo/...`. A ação “Voltar ao site” leva à página pública.
- **Efeito:** consultar o perfil interrompe a navegação da gestão; a alternativa é o histórico do navegador ou voltar pelo site.
- **Proposta:** acrescentar “Voltar à gestão” no cabeçalho existente, preferencialmente preservando a seção de origem. Manter também o acesso ao site se necessário.
- **Evidência:** inventário de links da página e `src/pages/Account.tsx:205`.
- **Confiança:** alta; não é um bloqueio, pois existem caminhos alternativos.

### U07 — Escape descarta rascunho e perde a referência de foco

- **Perfil/viewport:** administrador; reprodução completa de rascunho com Escape em desktop 1440 × 1000. Abertura, validação e cancelamento simples avaliados também nas outras dimensões.
- **Reprodução:** abrir Cadastrar cliente, escrever um nome fictício sem salvar, pressionar Escape com o campo focado e reabrir o cadastro.
- **Observado:** o modal fecha sem confirmação e o campo fica vazio ao reabrir. O foco após o fechamento não retorna ao botão Cadastrar cliente; o contexto retornado corresponde ao conteúdo geral da página.
- **Efeito:** um fechamento por teclado pode apagar trabalho em andamento e dificultar retomar a navegação por teclado. Não foi medido tempo perdido nem frequência desse evento.
- **Proposta:** quando houver alterações, confirmar descarte ou preservar rascunho; no fechamento confirmado, devolver foco ao acionador por uma referência estável. Não exigir confirmação quando o formulário não foi alterado. Verificar o comportamento nos demais modais antes de aplicar uma solução compartilhada.
- **Evidência:** rascunho fictício descartado na interface; `src/components/Customers.tsx:323` fecha diretamente no evento `cancel`, e o formulário desmonta ao fechar.
- **Confiança:** alta no descarte observado e ausência de retorno ao acionador. O comportamento de todos os outros formulários não foi extrapolado.

### U08 — Destino original após login não é preservado no código

- **Perfil/viewport:** visitante acessando `/conta`; redirecionamento observado nas três dimensões. Conclusão da sequência com novo login não repetida.
- **Reprodução a completar:** acessar `/conta` sem sessão, autenticar e verificar se retorna ao perfil.
- **Observado:** sem sessão, `/conta` redireciona a `/entrar`. No checkout inspecionado, esse redirecionamento não leva estado ou parâmetro de retorno; após autenticação, Login usa destino fixo `/demo/dashboard`. O login manual desta auditoria partiu de `/entrar`, portanto não validou o retorno a `/conta` de ponta a ponta.
- **Efeito provável:** a pessoa que tentou abrir o perfil precisa procurá-lo novamente depois de autenticar.
- **Proposta:** preservar e validar um destino interno permitido, usando dashboard como fallback. Não aceitar URLs externas ou destinos de autenticação recursivos como retorno.
- **Evidência:** `src/pages/Account.tsx:201` e `src/pages/Login.tsx:62`.
- **Confiança:** alta para o checkout; confirmação na versão publicada pendente. Prioridade provisória P2.

## Melhorias rápidas e trabalho maior

**Pequenas alterações:** alinhar textos da demonstração e página inexistente; explicar acesso por convite; acrescentar retorno à gestão no perfil; indicar rolagem lateral nas tabelas. Mantêm a estrutura e identidade existentes.

**Trabalho de comportamento:** transportar intenção de nova venda; preservar contexto de consulta na URL; proteger rascunhos e restaurar foco; preservar destino após login. Um modo demonstrativo isolado exige definição própria de dados e operações permitidas.

Não foram adicionados achados apenas para atingir dez. Observações secundárias para uma próxima rodada: texto de “próxima etapa” em seção inválida e diferença entre datas de clientes em UTC e indicadores em horário de Brasília. Não foi observado um registro concreto com data incorreta; a repercussão dessa diferença precisa de validação específica.

## Aspectos positivos verificados

- Evidências do catálogo com seleção local, sem dados pessoais: [celular](docs/usability-audit-2026-10-11/catalogo-390.png), [tablet](docs/usability-audit-2026-10-11/catalogo-768.png) e [desktop](docs/usability-audit-2026-10-11/catalogo-1440.png).
- Login possui labels associados, autocomplete de usuário/senha, alternância acessível Mostrar/Ocultar e feedback com região de status. O código bloqueia envios durante operações; não foram provocadas tentativas de autenticação repetidas.
- Filtro de produtos, ordenação e mudança de tamanho respeitaram retorno à primeira página. O código de consulta de produtos usa contagem, filtros, ordenação e intervalo no backend, com coluna conhecida e desempate por `id`; não foi executada auditoria independente de RLS.
- Catálogo apresenta tamanho, subtotal, aviso de frete e confirmação posterior por conversa. Seleção local sobrevive ao fechamento/reabertura, e o estado vazio de favoritos oferece saída clara.
- As rotas autenticadas avaliadas carregaram com o administrador. Restrições ao visitante foram tratadas como permissão, não como rotas quebradas.
- Não houve transbordamento horizontal da página inteira nas dimensões testadas. A tabela de produtos usa uma região própria de rolagem.
- Abas de vendas responderam às setas com atualização de seleção e foco. Validação local do cadastro de cliente focou o campo obrigatório.

## Limitações e validação futura

- Fluxos de criação, edição, remoção, confirmação de pedido e salvamento de perfil **não foram concluídos** em produção. Este relatório não certifica sucesso, idempotência, mensagens de servidor ou recuperação após falha dessas operações. Para isso é necessário ambiente de teste com dados fictícios.
- Não foram testados login incorreto, bloqueio por tentativas, recuperação enviada por e-mail, convite válido, troca de senha, CAPTCHA ou segundo fator. Nenhuma autenticação foi contornada.
- A conta administrativa foi disponibilizada pelo usuário; não se presumiu que os registros existentes fossem fictícios. Não foram anexadas informações pessoais, conteúdo de formulários de perfil ou dados de clientes.
- Contraste não foi medido sistematicamente. Não foram executados testes com leitor de tela, ampliação real de texto/zoom a 200%, teclado virtual, orientação paisagem, dispositivos físicos ou outros navegadores. Não há declaração de conformidade completa de acessibilidade.
- Menus, formulários e tabelas foram avaliados nas três viewports; algumas reproduções adicionais estão explicitamente limitadas ao desktop ou celular. Não foi testada toda combinação de perfil, estado e rota.
- Capturas são momentos de uma sessão de auditoria, não testes visuais de regressão. Manipulações temporárias de ocultação para privacidade ocorreram apenas no navegador de captura e não alteraram arquivos da aplicação.
- Comandos do projeto identificados: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build` e `npm run check`. Não foram executados testes de código ou builds nesta tarefa de relatório; não houve alteração de implementação a validar.
- Próxima rodada recomendada: homologação com conta de administrador e perfil comum, dados descartáveis, salvamentos completos e recuperação de erro; validar U08 no site publicado e rever os fluxos afetados depois de correções solicitadas.

---

## Correções locais e revalidação — 11/10/2026

Implementação solicitada após a auditoria. As seções anteriores preservam o diagnóstico e as evidências da versão publicada antes das mudanças. Os resultados abaixo se referem **à versão local compilada**, em `http://127.0.0.1:4173`, não a uma nova publicação na Vercel.

### Resultado por achado

| ID | Resultado local | Evidência de revalidação |
| --- | --- | --- |
| U01 | Comunicação corrigida. Links públicos agora indicam gestão com conta autorizada, sem promessa de demonstração fictícia. Página inexistente e identificação do visitante foram alinhadas. Não foi criado um novo modo demonstrativo. | Login e página inexistente percorridos sem sessão em 390 × 844, 768 × 1000 e 1440 × 1000; chamadas de demonstração e afirmação sobre dados fictícios ausentes. Destino da página inexistente é o login. |
| U02 | Atalho abre diretamente a aba Vendas registradas e o formulário Nova venda. A intenção de abertura é consumida na URL para não reabrir ao fechar. | Abertura e fechamento repetidos nas três dimensões; aba correta, formulário aberto e fechamento sem reabertura automática. |
| U03 | Filtros aplicados, página, tamanho e ordenação de Produtos são mantidos na URL, com validação de entradas. | Filtro `Ninho` preservado após navegar a Custos pelo menu, usar Voltar e recarregar, nas três dimensões. Ordenação retornou à página 1; tamanho 25 exibiu 25 linhas. |
| U04 | Região da tabela recebeu nome acessível e foco por teclado. Orientação de rolagem aparece somente quando existe conteúdo lateral. | Orientação presente no celular/tablet e ausente no desktop sem overflow. Região comparada às medidas reais nas três dimensões; seta direita do teclado moveu a rolagem horizontal no celular. [Celular](docs/usability-audit-2026-10-11/correcoes/produtos-390.png), [tablet](docs/usability-audit-2026-10-11/correcoes/produtos-768.png), [desktop](docs/usability-audit-2026-10-11/correcoes/produtos-1440.png). |
| U05 | Login e rodapé explicam acesso por convite antes da navegação. | Texto “O acesso é por convite” e link “Como obter acesso” verificados no login nas três dimensões; restrição administrativa preservada. |
| U06 | Perfil oferece Voltar à gestão, preservando seção e parâmetros de consulta da origem. | Produtos → Meu perfil → Voltar à gestão preservou seção, ordenação e tamanho 25 nas três dimensões. |
| U07 | Cadastro/edição de cliente protege alterações ao fechar por Escape, Cancelar ou Fechar; permite continuar editando ou descartar explicitamente. Foco retorna ao acionador. | Nas três dimensões: rascunho fictício → Escape → confirmação; Continuar editando manteve o texto; descarte fechou o modal e restaurou foco; formulário vazio fechou sem confirmação. [Confirmação no celular](docs/usability-audit-2026-10-11/correcoes/confirmar-descarte-390.png). |
| U08 | Destino interno é preservado ao exigir login, com validação de rota conhecida e fallback para o dashboard. | Visitante em `/conta` foi enviado ao login com destino preservado nas três dimensões. Sessão manual autenticada chegou ao perfil com retorno para Produtos e filtro `Ninho`. Testes automatizados rejeitaram URLs externas, barras invertidas, caracteres de controle, rotas desconhecidas e retorno recursivo ao login. |

### Verificação técnica e limites

- `npm run check` concluído com sucesso: lint, formatação, **38 testes**, TypeScript e build. Novos testes cobrem interpretação segura da consulta de Produtos e validação de destinos de retorno.
- Build emitiu o aviso existente de bundle maior que 500 kB; divisão de bundle não fez parte desta correção de usabilidade.
- `git diff --check` sem problemas de whitespace.
- Consultas de produtos continuam com filtros, contagem, ordenação e intervalo no backend. Foram preservados os tamanhos 10/25/50, a lista de colunas permitidas, desempate por `id` e correção de página após exclusões. Nenhum `slice` foi adicionado para paginar registros no frontend.
- A navegação foi testada no Chrome com conta de administrador e visitante. O Ionic mantém telas anteriores ocultas no DOM; verificações passaram a considerar os elementos visíveis, e as novas ações por URL foram limitadas à seção ativa para não disparar em telas ocultas.
- As imagens de correção ocultam apenas a identificação da sessão. Registros pessoais e valores de campos de perfil não foram incluídos.
- Nenhum cadastro, edição persistida, exclusão, convite ou pedido foi enviado durante a revalidação. Testes de rascunho usaram apenas texto fictício em memória. A validação de persistência continua exigindo ambiente com dados descartáveis.
- Responsividade verificada em viewports simuladas, sem certificação de acessibilidade ou testes em aparelhos físicos. Proteção de rascunhos foi aplicada ao modal de clientes avaliado em U07; não se declara que todos os demais formulários já oferecem essa proteção.
- Nada foi publicado automaticamente. Os achados foram corrigidos e verificados localmente; a versão publicada precisa receber as mudanças por um fluxo de deploy autorizado.

---

## Copiar receitas — auditoria e implementação de 12/10/2026

### Escopo e ambiente

Avaliação focada no pedido de copiar uma receita para o formulário de um novo cadastro, usando a skill `auditar-usabilidade`. As auditorias anteriores permanecem acima; seus resultados não foram reclassificados nesta rodada.

- Aplicação local: `http://127.0.0.1:4180/demo/custos`, com Vite e Chromium headless via Playwright.
- Perfil administrativo e sessão **simulados**, com respostas fictícias da API interceptadas no navegador. Não foi usado um login real, nem avaliada a autenticação do Supabase nesta rodada. As chamadas para destinos externos foram interceptadas ou bloqueadas.
- Baseline: 1280 × 900. Revalidação: desktop 1440 × 1000, tablet 768 × 1000 e celular 390 × 844. São viewports simuladas, não aparelhos físicos.
- Dados: pipocas fictícias, insumos, produto e receita base; lista de 11 receitas para verificar a navegação entre páginas. Nenhum cadastro real foi criado ou alterado.

### Inventário de rotas

| Rota | Finalidade e perfil | Visita nesta rodada |
| --- | --- | --- |
| `/demo/custos` | Cadastro de insumos e receitas; administrador | Acesso direto, aba Receitas e custos, Nova receita, cópia, edição e cancelamento percorridos com API simulada. |
| `/demo/dashboard`, `/demo/produtos`, `/demo/clientes`, `/demo/vendas` | Outras áreas de gestão | Não avaliadas; fora do escopo da cópia. |
| `/`, `/entrar`, `/criar-conta` | Páginas públicas e entrada | Não avaliadas nesta rodada. O login não foi testado. |
| `/conta`, `/auth/callback`, `/auth/invite`, `/auth/recovery` | Perfil e autenticação | Não avaliadas; sem necessidade de usar credenciais reais para este teste local. |
| Rotas inexistentes | Recuperação de navegação | Não reavaliadas. |

### Achado priorizado

| ID | Prioridade | Rota/fluxo | Problema observado | Melhoria | Esforço |
| --- | --- | --- | --- | --- | --- |
| RC01 | P2 | Custos → Nova receita | O formulário começa vazio. A ação Adicionar receita base acrescenta uma referência à preparação, sem preencher seus ingredientes no formulário. Para criar variações semelhantes, é necessário redigitar a composição. | Opção de copiar uma receita existente para um novo formulário, com revisão, confirmação de substituição e recuperação de falhas. Implementada e verificada localmente. | Médio |

**Reprodução do baseline:** abrir Custos, selecionar Receitas e custos e abrir Nova receita. Não existe uma opção para copiar os campos de outra receita; o nome e a composição estão vazios. [Evidência antes da alteração](docs/usability-audit-2026-10-12/recipe-copy/antes-1280.png).

O esforço de repetir os campos é verificável pela inspeção e navegação. Não foram medidos tempo de preenchimento, taxa de erro ou preferência de usuários reais. O pedido autoriza a implementação desta melhoria; não foi feito um redesenho geral da gestão.

### Comportamento implementado

- **Começar copiando outra receita** aparece no início de Nova receita, em uma seção expansível. O formulário manual continua disponível quando a opção não é usada ou não há receitas encontradas.
- A busca reutiliza o seletor existente, com filtros, contagem e páginas no backend, desempate por ID e RLS. Selecionar uma receita apenas escolhe a origem; o preenchimento exige **Copiar para o formulário**.
- Copia insumos, receitas base, quantidades, unidades, rendimentos e observações. Sugere um nome com **Cópia de…**, limitado ao tamanho permitido, e foca/seleciona esse campo para revisão. O produto fica em branco para escolher o da nova receita; o rendimento de venda copiado reaparece quando um produto é selecionado.
- Mostra carregamento e bloqueia ações conflitantes. O preenchimento é aplicado apenas após carregar os metadados e todos os componentes; falhas preservam os campos atuais e permitem repetir ou escolher outra origem.
- Se houver rascunho, apresenta **Manter preenchimento** e **Substituir preenchimento**, com foco inicial na primeira opção. Escape cancela somente essa confirmação. Recolher a seção também libera o formulário sem substituir dados.
- Copiar não grava nada. **Salvar nova receita** usa UUID novo e revisão inicial zero. A composição original permanece igual; os cadastros compartilhados de insumos e receitas base continuam sendo referências atuais de custos.
- O fluxo de edição continua disponível e não oferece a cópia para sobrescrever uma receita existente. Cancelar uma cópia em andamento aborta a leitura e impede que o resultado preencha outro formulário aberto depois.

### Tarefas executadas e resultados

| Tarefa | Resultado verificado |
| --- | --- |
| Abrir a opção por teclado, buscar e selecionar uma receita | Funcionou nas três dimensões; seleção por setas/Enter e navegação à segunda página. |
| Selecionar a origem sem acionar a cópia | Nome e composição permaneceram vazios; nenhum salvamento enviado. |
| Copiar receita com insumo e outra receita como componente | Quantidades, unidades, rendimentos e observações preenchidos; produto em branco; foco e seleção do novo nome confirmados. |
| Alterar quantidade copiada e escolher novo produto | Custo recalculado na prévia e rendimento de venda copiado preservado. |
| Salvar a nova receita | Requisição simulada com UUID diferente da origem, revisão zero e os componentes revisados. Original preservada. |
| Falha de salvamento e nova tentativa | Mensagem de erro exibida; preenchimento preservado e envio posterior concluído na API simulada. |
| Clique duplo ao copiar | Uma única leitura dos metadados da origem. |
| Recusar a substituição do rascunho | Campos preservados e foco devolvido ao botão de cópia. Escape também preservou o formulário aberto. |
| Falha na leitura dos componentes | Nome, rendimento, observações e quantidade do rascunho permaneceram iguais; repetição posterior preencheu corretamente. |
| Cancelar durante a leitura e abrir Nova receita novamente | O formulário seguinte permaneceu vazio, sem receber o resultado da operação anterior. |
| Busca sem resultados | Mensagem vazia e botão de cópia indisponível; cadastro manual permaneceu utilizável. |
| Nome longo no celular | Nome sugerido respeitou o limite de 120 caracteres, sem transbordamento horizontal do modal. |
| Abrir a edição de uma receita | Composição carregada normalmente e opção de cópia ausente, preservando a finalidade do fluxo. |

### Evidências e verificações técnicas

- Opção de cópia: [desktop](docs/usability-audit-2026-10-12/recipe-copy/opcao-1440.png), [tablet](docs/usability-audit-2026-10-12/recipe-copy/opcao-768.png), [celular](docs/usability-audit-2026-10-12/recipe-copy/opcao-390.png).
- Formulário revisado após a cópia: [desktop](docs/usability-audit-2026-10-12/recipe-copy/preenchido-1440.png), [tablet](docs/usability-audit-2026-10-12/recipe-copy/preenchido-768.png), [celular](docs/usability-audit-2026-10-12/recipe-copy/preenchido-390.png).
- [Confirmação antes de substituir o rascunho](docs/usability-audit-2026-10-12/recipe-copy/confirmacao-1440.png).
- Fluxos acima executados por Playwright com respostas simuladas. Foram medidos largura do modal, conteúdo e página, sem rolagem horizontal involuntária nas três dimensões.
- `npm run check`: lint, formatação, 41 testes, TypeScript e build aprovados. A suíte inclui testes que abrem uma porta local e foi executada fora do sandbox restrito. O build mantém o aviso existente sobre tamanho do bundle.
- A cópia utiliza o banco e a RPC existentes; nenhuma migração adicional é necessária.

### Melhorias rápidas, trabalho maior e limitações

A melhoria solicitada foi concluída no formulário existente. As proteções de rascunho desta rodada se referem à **substituição por cópia**; não se declara uma revisão geral do descarte de rascunhos nos demais modais. Adicionar versões históricas das receitas ou clonar também os cadastros dos insumos seria outro escopo, sem necessidade para este pedido.

Não foram avaliados login real, callbacks, recuperação de senha, autorização/RLS em uma nova sessão real, persistência no Supabase remoto, leitor de tela, contraste sistemático, zoom a 200%, teclado virtual, orientação paisagem ou outros navegadores. Os cenários de salvamento validam a interface e as requisições capturadas pela API simulada. A avaliação não substitui testes com usuários reais nem certifica conformidade completa de acessibilidade. A aplicação não foi publicada nesta tarefa.

## 2026-10-12 — Organização do formulário de receitas

Auditoria e implementação focadas no pedido de melhorar o formulário de nova receita. Foi aplicada a skill `auditar-usabilidade`, preservando os relatórios anteriores. O mesmo formulário atende à edição, que também foi verificada. Campos, referências, cálculos e payload da RPC `save_recipe` foram preservados; nenhuma migração foi necessária.

### Ambiente e cobertura

- Vite local em `http://127.0.0.1:4190`, Chromium headless e Playwright.
- Perfil administrativo, sessão e respostas do Supabase **simulados**, com ingredientes, produtos, receitas base e embalagens fictícios. Requisições externas interceptadas ou bloqueadas; nenhum registro real alterado.
- Baseline em 390 × 844 e 1280 × 900. Revalidação em 360 × 800, 390 × 844, 768 × 1000, 1280 × 900 e 844 × 390. São simulações de viewport, não aparelhos físicos.

| Rota | Finalidade / perfil | Cobertura nesta rodada |
| --- | --- | --- |
| `/demo/custos` | Gestão de receitas / administrador | Acesso direto, listagem, novo cadastro, edição, cópia, navegação entre abas, cancelamento e salvamento com API simulada. |
| `/demo/dashboard`, `/demo/produtos`, `/demo/clientes`, `/demo/vendas` | Outras áreas de gestão | Fora do escopo; não reavaliadas. |
| `/`, `/entrar`, `/criar-conta`, `/conta` e callbacks de autenticação | Páginas públicas e conta | Não reavaliadas; login real não executado. |
| Rotas inexistentes e navegação voltar/avançar do navegador | Recuperação e histórico | Não reavaliados; a organização interna do modal não altera a rota. |

### Achados priorizados

| ID | Prioridade | Fluxo | Problema observado | Melhoria implementada | Esforço |
| --- | --- | --- | --- | --- | --- |
| RF01 | P2 | Nova receita e edição | Identificação, rendimento, cálculo, ingredientes e apresentações aparecem em uma única sequência longa, sem navegação entre as partes. | Três abas: Receita, Ingredientes e Apresentações, com instruções específicas e navegação direta ou pelos botões Próximo/Voltar. | Médio |
| RF02 | P2 | Preenchimento e revisão de custos | O resumo de custo, os botões de salvar/cancelar e o fechamento exigem voltar a diferentes extremos da rolagem conforme cresce a composição. | Cabeçalho e rodapé permanecem visíveis; apenas o conteúdo da aba rola. Custo da preparação e quantidade de itens aparecem no rodapé. | Médio |
| RF03 | P3 | Cadastro sem composição | Salvar fica indisponível quando não há itens, sem uma mensagem apresentada por essa ação para indicar o que falta. | Salvar explica a necessidade de composição e abre Ingredientes. Campos obrigatórios inválidos abrem sua aba e recebem foco; embalagens recolhidas são expandidas quando necessário. | Pequeno |

**Reprodução do baseline:** acessar Custos → Receitas e custos → Nova receita. Percorrer o formulário, adicionar ingredientes e apresentações e localizar o custo total e as ações de salvar. O formulário vazio já possuía conteúdo maior que a área visível: 1.794 px de conteúdo para 818 px de altura interna no celular e 1.528 px para 808 px no desktop. Estes números descrevem a rolagem observada, sem estimar tempo de tarefa ou ganho percentual.

Evidências anteriores: [desktop](docs/usability-audit-2026-10-12/recipe-form/antes-1280.png) e [celular](docs/usability-audit-2026-10-12/recipe-form/antes-390.png).

### Comportamento e tarefas verificadas

| Tarefa | Resultado |
| --- | --- |
| Preencher nome, rendimento e observações; avançar e voltar | Campos preservados. A categoria continua derivada do produto quando há vínculo. |
| Alternar abas diretamente ou por Próximo/Voltar | Apenas uma aba visível; conteúdo volta ao início ao trocar. Próximo não envia a receita. |
| Navegar pelas abas com teclado | Setas esquerda/direita com retorno entre extremos, Home/End, foco visível e associações tab/tabpanel verificadas. |
| Adicionar ingredientes e receita base, editar quantidades e remover a base | Grupos, índices de edição e custo mantidos; resumo atualizado no rodapé. |
| Adicionar apresentações de 50, 100 e 150 g com embalagem própria | Custos por pacote de R$ 1,50, R$ 2,50 e R$ 3,50 na fixture; embalagens separadas da preparação no payload. Produto sem peso continua mostrando orientação. |
| Salvar com nome ou quantidade obrigatória vazios em outra aba | Envio bloqueado, aba correta aberta e campo focado. |
| Salvar com rendimento zero, unidade incompatível ou composição vazia | Mensagem específica e abertura de Receita ou Ingredientes para correção. |
| Salvar com quantidade de embalagem vazia e seção recolhida | Seção expandida, campo focado e nenhum envio realizado. |
| Salvar receita por peso e editar receita existente | Payload conserva ingredientes, apresentações, embalagens, observações, ID e revisão esperados. |
| Editar receita no modo por unidades | Produto, rendimento de 10 unidades e payload legado preservados. |
| Copiar receita e salvar como base sem apresentações | Nome sugerido e foco preservados, composição copiada, ID novo e apresentações em branco. |
| Receber erro de salvamento e resposta incerta | Preenchimento preservado após erro definitivo; resposta incerta bloqueia alterações e oferece Confirmar novamente, repetindo exatamente o mesmo payload. |
| Percorrer todas as abas e rolar o conteúdo nas cinco dimensões | Cabeçalho e rodapé dentro da viewport; nenhum transbordamento horizontal de campos, botões, modal ou página. |

As abas mantêm os campos montados. O formulário revela e valida o primeiro campo obrigatório inválido antes do salvamento, para que campos de outras abas possam ser corrigidos. As validações de negócio direcionam à seção correspondente. A paginação, buscas no backend e RLS existentes não foram alteradas.

### Evidências após a alteração

| Parte | Desktop | Tablet | Celular |
| --- | --- | --- | --- |
| Receita | [1280 px](docs/usability-audit-2026-10-12/recipe-form/receita-1280.png) | [768 px](docs/usability-audit-2026-10-12/recipe-form/receita-768.png) | [390 px](docs/usability-audit-2026-10-12/recipe-form/receita-390.png) |
| Ingredientes | [1280 px](docs/usability-audit-2026-10-12/recipe-form/ingredientes-1280.png) | [768 px](docs/usability-audit-2026-10-12/recipe-form/ingredientes-768.png) | [390 px](docs/usability-audit-2026-10-12/recipe-form/ingredientes-390.png) |
| Apresentações | [1280 px](docs/usability-audit-2026-10-12/recipe-form/apresentacoes-1280.png) | [768 px](docs/usability-audit-2026-10-12/recipe-form/apresentacoes-768.png) | [390 px](docs/usability-audit-2026-10-12/recipe-form/apresentacoes-390.png) |

### Validação técnica, próximos trabalhos e limites

`npm run check` aprovado: lint, Prettier, 44 testes, TypeScript e build. O build mantém o aviso existente de bundle acima de 500 kB. Os fluxos de interface foram executados por Playwright com API simulada, incluindo as medições de dimensões e a inspeção das requisições de salvamento.

As três melhorias foram implementadas e verificadas localmente. Não foi identificado trabalho adicional indispensável para este pedido. Persistência de rascunho entre sessões e um estudo com pessoas que cadastram receitas podem ser avaliados em outro escopo.

A avaliação identifica dificuldades por inspeção e execução de tarefas; não substitui testes com usuários reais. Não foram avaliados persistência no Supabase remoto, login real, políticas RLS em nova sessão, leitores de tela, zoom a 200%, contraste sistemático, teclado virtual ou outros navegadores. Não se declara conformidade completa de acessibilidade. Aplicação não publicada nesta tarefa.
