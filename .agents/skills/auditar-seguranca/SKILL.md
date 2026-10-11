---
name: auditar-seguranca
description: Auditar a segurança deste projeto com evidências e priorização de vulnerabilidades reais; implementar e verificar correções quando solicitado. Usar para auditorias de segurança ou correção de seus achados, não para revisões comuns de código.
---

# Auditar segurança

Atuar como especialista em segurança de aplicações e identificar
até 10 vulnerabilidades reais do projeto, ordenadas pelo risco efetivo.
Fornecer evidências, explicar o impacto e propor correções específicas.
Quando solicitado, implementar as correções e verificar o resultado.

## Modos

1. Auditoria: analisar e gerar relatório, sem alterar código da aplicação.
2. Correção: implementar os achados solicitados pelo usuário, começando
   pelos mais graves, e executar as verificações pertinentes.

Usar auditoria como padrão. Se o usuário já solicitar auditoria e
correção, executar ambos os modos sem pedir confirmação novamente
para mudanças locais reversíveis.

## ETAPA 1 — ENTENDER O PROJETO

- Ler AGENTS.md e as instruções aplicáveis ao repositório.
- Identificar linguagens, frameworks, gerenciadores de pacotes,
  frontend, backend, banco de dados e infraestrutura.
- Mapear endpoints, autenticação, permissões, integrações e fluxos
  de dados sensíveis.
- Identificar os limites de confiança entre cliente, servidor,
  banco de dados e serviços externos.
- Verificar configurações e arquivos de dependências com suas
  versões efetivamente resolvidas nos lockfiles.
- Identificar testes e ferramentas de segurança já disponíveis.
- Não presumir tecnologias ou configurações que não foram encontradas.

## ETAPA 2 — INVESTIGAR

Examinar, conforme a arquitetura encontrada:

- Autenticação, recuperação de senha, sessões, cookies e tokens.
- Autorização no servidor, acesso a objetos por ID, permissões
  administrativas e isolamento entre usuários ou organizações.
- Injeções SQL, NoSQL, comandos, templates e outras entradas perigosas.
- XSS, CSRF e configurações de CORS.
- SSRF, uploads, caminhos de arquivos e desserialização insegura.
- Segredos expostos, dados pessoais em logs e respostas excessivas.
- Dependências vulneráveis e integridade da cadeia de fornecimento.
- Configurações de produção, debug, headers e exposição de serviços.
- Abuso de regras de negócio, concorrência, limites de requisições
  e operações que possam gerar custos indevidos.

Se houver Supabase ou tecnologia equivalente, revisar políticas de
acesso, RLS, permissões de storage e uso de credenciais privilegiadas.
Distinguir chaves públicas previstas pela arquitetura de segredos reais.

Para aplicações de vendas e custos, verificar especialmente se um
usuário consegue acessar ou modificar vendas, custos, produtos ou
relatórios pertencentes a outro usuário.

Usar categorias OWASP e CWE como apoio à investigação, sem limitar
a auditoria a dez categorias predefinidas.

## ETAPA 3 — VALIDAR AS EVIDÊNCIAS

- Ler o contexto completo de cada suspeita.
- Seguir o caminho da entrada até a operação sensível e conferir
  controles existentes em middleware, serviços e banco de dados.
- Usar ferramentas apropriadas à stack quando disponíveis.
- Registrar comandos executados, resultados e limitações.
- Não executar correções automáticas de dependências durante a auditoria.
- Antes de usar ferramentas externas, verificar quais dados elas enviam.
  Não enviar código privado, segredos ou dados pessoais sem autorização.
- Consultar avisos oficiais de segurança e documentação dos mantenedores
  para confirmar versões afetadas e versões corrigidas.
- Se não houver acesso à internet, declarar que a consulta atualizada
  de vulnerabilidades conhecidas não pôde ser concluída.
- Não inventar CVEs, resultados de scanners ou execuções de testes.
- Não considerar um alerta de dependência prova automática de que
  a aplicação é explorável. Explicar sua aplicabilidade e exposição.
- Separar achados sustentados por evidências de hipóteses que ainda
  dependem de configuração ou informação indisponível. Não contar hipóteses
  como vulnerabilidades confirmadas.
- Validar com testes locais isolados e dados fictícios.
  Não realizar exploração em produção sem autorização explícita.
- Nunca mostrar valores completos de credenciais encontradas.

## ETAPA 4 — PRIORIZAR

Selecionar até 10 achados distintos, considerando:

- Impacto sobre confidencialidade, integridade e disponibilidade.
- Exposição real da funcionalidade.
- Facilidade de exploração e privilégios necessários.
- Quantidade e sensibilidade dos dados afetados.
- Controles de proteção existentes.

Classificar a severidade como crítica, alta, média ou baixa.
Informar separadamente a confiança na evidência.
Não atribuir pontuação CVSS sem justificar seu cálculo.

Agrupar ocorrências da mesma causa raiz.
Não preencher a lista com recomendações genéricas ou problemas
meramente estéticos. Se houver menos de 10 achados, informar isso.
Se houver mais, informar a quantidade restante e destacar qualquer
achado crítico que tenha ficado fora do detalhamento.

## ETAPA 5 — ENTREGAR O RELATÓRIO

Criar security-audit.md na raiz do projeto, salvo instrução contrária.
Não sobrescrever um relatório existente sem preservar seu conteúdo integral, incluindo alterações não commitadas. Antes de atualizar, criar uma cópia com nome datado e sem colisão.

Incluir:

1. Resumo da arquitetura, escopo e limitações.
2. Tabela dos achados em ordem de prioridade:
   ID | vulnerabilidade | severidade | confiança | localização.
3. Detalhamento de cada achado:
   - Arquivo e linhas relevantes.
   - Evidência concreta e causa raiz.
   - Condições necessárias para explorar o problema.
   - Impacto explicado em linguagem simples.
   - Reprodução local segura ou demonstração pelo fluxo do código.
   - Correção específica para a arquitetura encontrada.
   - Teste que verifica o bloqueio da vulnerabilidade, distinguindo testes propostos de testes efetivamente executados.
   - Esforço estimado e possíveis efeitos sobre funcionalidades.
   - Referências oficiais quando utilizadas.
4. Ferramentas executadas e verificações não realizadas.
5. Plano recomendado de correção.

Não afirmar que o projeto está seguro apenas porque nenhum achado
foi encontrado. Explicar o que efetivamente foi examinado.

## ETAPA 6 — CORRIGIR, QUANDO SOLICITADO

- Preservar alterações existentes do usuário.
- Implementar mudanças pequenas, voltadas à causa raiz.
- Não desativar funcionalidades ou verificações para esconder alertas.
- Criar testes de regressão que demonstrem o cenário vulnerável
  e confirmem que ele foi bloqueado.
- Verificar também que o fluxo legítimo continua funcionando.
- Executar testes, análise de tipos e build conforme a mudança.
- Atualizar o relatório com corrigido, parcialmente corrigido
  ou pendente, incluindo as evidências.
- Não marcar como corrigido algo que depende de uma configuração
  externa ainda não aplicada.
- Não publicar, executar migrações em produção ou trocar credenciais
  externas apenas por ter corrigido arquivos locais.
