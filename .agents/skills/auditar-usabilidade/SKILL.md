---
name: auditar-usabilidade
description: Auditar a usabilidade da aplicação por navegação real, incluindo login, rotas e tarefas principais, com evidências e melhorias priorizadas. Usar para auditorias de usabilidade e implementação solicitada de seus achados; não para simples refinamento visual.
---

# Auditar usabilidade

Avaliar a usabilidade da aplicação por meio de navegação real,
incluindo login, rotas públicas, rotas autenticadas e fluxos principais.

Identificar dificuldades que afetem a compreensão, a navegação
e a conclusão de tarefas. Apresentar melhorias específicas,
priorizadas e compatíveis com o layout existente.

Usar auditoria como padrão. Implementar melhorias somente quando
o usuário solicitar. Se auditoria e implementação já forem solicitadas,
executar ambas para mudanças locais reversíveis.

## ETAPA 1 — PREPARAR A AUDITORIA

- Ler AGENTS.md e as instruções aplicáveis ao projeto.
- Identificar como executar a aplicação e seus testes.
- Identificar rotas, menus, perfis de acesso e funcionalidades.
- Identificar as ferramentas de navegador disponíveis.
- Preferir ambiente local ou de homologação com dados fictícios.
- Executar a aplicação quando necessário e verificar sua disponibilidade.
- Perguntar apenas pelas informações indispensáveis que estiverem
  ausentes: URL, ambiente, conta de teste ou perfil a avaliar.

Não presumir que uma ferramenta de navegador está disponível.
Se não for possível navegar, realizar uma análise parcial do código
e declarar que a auditoria interativa não foi executada.

## ETAPA 2 — FAZER LOGIN

- Usar uma sessão existente ou conta de teste fornecida para a auditoria.
- Solicitar credenciais por um mecanismo seguro disponível.
- Quando não houver um mecanismo seguro, pedir que o usuário faça
  o login manualmente no navegador controlado.
- Nunca incluir senhas, tokens ou cookies em relatórios, arquivos,
  screenshots ou logs.
- Não contornar autenticação, CAPTCHA ou autenticação de dois fatores.
- Se o acesso estiver bloqueado, continuar pelas rotas públicas
  e informar quais áreas não puderam ser avaliadas.

Avaliar o login:
- Clareza dos campos e instruções.
- Labels, preenchimento automático e visibilidade de senha.
- Feedback de carregamento e prevenção de envios duplicados.
- Mensagens úteis para campos inválidos e credenciais incorretas.
- Recuperação de acesso, quando houver.
- Destino após autenticação e retorno à rota originalmente solicitada.

Testar erros de login apenas com conta de teste e poucas tentativas,
evitando bloqueios. Não solicitar redefinição de senha ou enviar
mensagens externas sem autorização específica.

## ETAPA 3 — MAPEAR E PERCORRER AS ROTAS

Combinar a leitura das definições de rotas com a navegação real.

Criar um inventário contendo:
- Rota ou padrão de rota.
- Finalidade.
- Perfil necessário.
- Forma de acesso pela interface.
- Resultado da visita.
- Motivo de bloqueio ou de não avaliação.

Verificar:
- Rotas públicas e autenticadas.
- Links dos menus, botões e breadcrumbs.
- Acesso direto por URL.
- Atualização da página em rotas internas.
- Comportamento dos botões voltar e avançar do navegador.
- Preservação de filtros e contexto quando esperado.
- Redirecionamentos após login e logout.
- Páginas inexistentes e recuperação após erro.
- Rotas inacessíveis pela navegação ou links quebrados.

Para rotas dinâmicas, usar registros de teste representativos.
Não enumerar indiscriminadamente identificadores de usuários reais.

Se existirem vários perfis, avaliar os perfis disponíveis e informar
a cobertura. Não concluir que uma rota está quebrada apenas porque
o perfil utilizado não tem permissão.

Não afirmar que todas as rotas foram verificadas sem comparar
o inventário com as rotas efetivamente visitadas.

## ETAPA 4 — TESTAR TAREFAS COMPLETAS

Identificar as principais tarefas a partir da aplicação.
Para cada tarefa, definir objetivo, estado inicial e resultado esperado.

Em uma aplicação de vendas e custos, considerar, se existirem:
- Cadastrar um produto.
- Registrar um custo.
- Registrar uma venda.
- Encontrar e editar um registro.
- Filtrar dados e compreender um relatório.
- Corrigir um erro de preenchimento.
- Cancelar uma operação sem perder contexto indevidamente.

Executar os fluxos do início ao fim com dados fictícios em ambiente
de teste. Identificar dúvidas, passos desnecessários, erros,
interrupções e dificuldade para recuperar uma operação.

Em produção, limitar-se à navegação e leitura por padrão.
Não concluir compras, pagamentos, exclusões, envio de mensagens
ou alterações de dados reais sem autorização explícita.

Não confundir quantidade de cliques com qualidade de uso.
Avaliar clareza, esforço, prevenção de erros e conclusão da tarefa.

## ETAPA 5 — AVALIAR USABILIDADE

Verificar:
- Clareza dos títulos, rótulos, instruções e ações.
- Consistência de termos e componentes.
- Identificação da página atual e próximos passos.
- Visibilidade das ações principais.
- Feedback de carregamento, sucesso e erro.
- Estados vazios com orientação útil.
- Validação de formulários e preservação de dados após erro.
- Confirmação ou recuperação de ações destrutivas.
- Busca, filtros, ordenação e paginação.
- Formatação de datas, moeda, números e unidades.
- Compreensão de tabelas, indicadores e relatórios.
- Ausência de ações sem resposta, links quebrados e becos sem saída.

Avaliar também:
- Uso por teclado e foco visível.
- Labels e nomes acessíveis.
- Contraste e mensagens que não dependem apenas de cor.
- Ordem de foco e comportamento de modais.
- Ampliação de texto e zoom quando possível.
- Áreas de toque e ações que não dependam de hover.

Distinguir problemas de acessibilidade, usabilidade e preferências
estéticas. Não declarar conformidade completa de acessibilidade
com base em uma inspeção limitada.

## ETAPA 6 — VERIFICAR DIFERENTES DISPOSITIVOS

Testar os fluxos principais em viewports representativas:
- Celular: aproximadamente 360–390 px.
- Tablet: aproximadamente 768 px.
- Desktop: aproximadamente 1280–1440 px.

Verificar:
- Menus, formulários, tabelas e modais.
- Cortes, sobreposições e rolagem horizontal involuntária.
- Acessibilidade das ações principais.
- Legibilidade e esforço de preenchimento.
- Conteúdo longo e mensagens de erro.
- Orientação paisagem e teclado virtual quando verificáveis.

Registrar as dimensões testadas.
Distinguir simulação no navegador de testes em dispositivos reais.

## ETAPA 7 — VALIDAR E PRIORIZAR OS ACHADOS

Para cada problema:
- Registrar rota, perfil, viewport e passos de reprodução.
- Explicar comportamento observado e efeito sobre a tarefa.
- Separar observação comprovada de hipótese a validar com usuários.
- Anexar screenshot quando útil, sem dados pessoais ou credenciais.
- Propor uma melhoria específica e compatível com a arquitetura.

Priorizar por:
- Impacto na conclusão da tarefa.
- Frequência provável no fluxo.
- Abrangência das telas e perfis afetados.
- Existência de alternativa ou recuperação.
- Confiança na evidência.

Usar:
- P0: impede uma tarefa essencial, sem alternativa viável.
- P1: gera grande dificuldade ou risco de erro.
- P2: cria atrito relevante, mas permite concluir a tarefa.
- P3: melhoria pequena de clareza ou consistência.

Apresentar até 10 achados principais, sem inventar problemas
para completar a lista. Informar outros achados existentes.

Não apresentar preferências pessoais como falhas comprovadas.
Não inventar taxas de abandono, tempos de tarefa ou ganhos percentuais.

## ETAPA 8 — ENTREGAR O RELATÓRIO

Criar usability-audit.md na raiz do projeto, salvo instrução contrária.
Preservar o conteúdo de relatórios anteriores: acrescentar uma seção datada para a nova auditoria, sem apagar evidências ou resultados anteriores.

Incluir:
1. Ambiente, perfis e dimensões avaliados.
2. Inventário de rotas visitadas, bloqueadas e não avaliadas.
3. Tarefas executadas e seus resultados.
4. Tabela dos achados:
   ID | prioridade | rota/fluxo | problema | melhoria | esforço.
5. Detalhamento com evidências e passos de reprodução.
6. Melhorias rápidas e mudanças que exigem mais trabalho.
7. Limitações da auditoria.

Explicar que esta avaliação identifica problemas por inspeção
e execução de tarefas; ela não substitui testes com usuários reais.

## ETAPA 9 — IMPLEMENTAR QUANDO SOLICITADO

- Preservar o layout predefinido, a identidade visual e as funcionalidades.
- Corrigir os achados autorizados sem introduzir um redesenho amplo.
- Priorizar componentes compartilhados quando apropriado.
- Preservar alterações existentes do usuário.
- Caso uma melhoria exija mudar a estrutura, explicar a proposta
  antes de implementar essa mudança.
- Repetir os fluxos afetados após as correções.
- Executar as verificações técnicas pertinentes.
- Atualizar o relatório com o resultado e as evidências.
- Não marcar um achado como resolvido sem verificar seu comportamento.
- Não publicar a aplicação automaticamente.
