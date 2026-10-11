---
name: modernizar-interface
description: Modernizar visualmente interfaces existentes no código, preservando layout, identidade visual, funcionalidades e responsividade. Usar para refinamento visual de telas e componentes; não para criar aplicações ou redesenhar sua estrutura sem solicitação.
---

# Modernizar interface

Melhorar a apresentação da aplicação existente. Quando o usuário solicitar implementação, executar as melhorias no código e validar o resultado, sem se limitar a sugestões.

## Preservar o layout

Tratar o layout existente como contrato de estrutura. Preservar:

- Ordem e hierarquia das seções.
- Posição e função dos menus e da navegação.
- Organização de formulários, cards, tabelas e ações.
- Conteúdo, rotas, fluxos de uso, funcionalidades e regras de negócio.
- Padrões responsivos que já funcionam corretamente.

Não mover seções, substituir a navegação, criar um novo dashboard, adicionar funcionalidades ou redesenhar a estrutura sem solicitação. Ajustar espaçamento, dimensões, alinhamento e distribuição quando melhorar a apresentação ou corrigir responsividade, mantendo a hierarquia e a intenção do layout. Respeitar mudanças estruturais explicitamente solicitadas pelo usuário dentro do escopo autorizado.

## Entender a interface antes de editar

- Ler `AGENTS.md` e as instruções aplicáveis ao escopo.
- Identificar framework, biblioteca de componentes, estilos, temas, tokens, breakpoints e componentes compartilhados.
- Examinar as telas e seus estados; identificar inconsistências, problemas de legibilidade, excesso de estilos locais e falhas de adaptação entre dispositivos.
- Executar a aplicação localmente quando possível. Inspecionar no navegador e registrar referências visuais para comparação quando houver ferramentas disponíveis.

Não presumir que a tela está correta apenas pela leitura do código. Se a inspeção visual não for possível, declarar essa limitação. Uma prévia isolada ou com dados de exemplo deve ser identificada como tal, sem equipará-la à tela integrada.

## Definir a direção visual

Derivar a modernização da identidade e dos componentes existentes. Priorizar tipografia legível, hierarquia clara, paleta coerente com cores de ação e estados definidos, espaçamentos consistentes, alinhamentos e proporções equilibrados, bordas, raios e sombras discretos, estados de interação claros e densidade adequada ao conteúdo.

Reutilizar e consolidar tokens de cores, tipografia, espaçamento, bordas e elevação, evitando valores arbitrários repetidos. Usar ícones consistentes com a biblioteca existente.

Preservar a marca e a direção visual predominante. Não trocar fontes, biblioteca de componentes ou framework apenas para obter outra aparência. Evitar decoração sem função, excesso de gradientes, sombras fortes, animações chamativas e efeitos que prejudiquem leitura ou desempenho.

## Implementar com consistência

- Priorizar componentes compartilhados dentro do escopo; revisar as telas afetadas por alterações globais.
- Seguir as convenções do projeto, preservar alterações existentes do usuário e evitar conflitos de CSS e uso indiscriminado de `!important`.
- Manter textos, eventos, validações, estados, integrações e seletores usados por testes ou automações.
- Não adicionar dependências quando os recursos existentes bastarem.
- Refinar, conforme existirem e forem pertinentes ao escopo: botões, campos, selects, mensagens de validação, cards, tabelas, listas, cabeçalhos, menus, abas, navegação, modais, notificações e feedback.
- Considerar estados de carregamento, vazio, erro, sucesso, desabilitado e interação, sem alterar seu significado.

Em Ionic, respeitar componentes, temas, variáveis CSS, áreas seguras e padrões de navegação. Não modificar globalmente comportamentos específicos de plataforma sem verificar o resultado.

## Garantir responsividade

Respeitar os breakpoints existentes; adaptá-los somente por necessidade demonstrada pelo conteúdo. Inspecionar pelo menos:

- Celular estreito: 320 ou 360 px.
- Celular comum: aproximadamente 390 px.
- Tablet: aproximadamente 768 px.
- Desktop: aproximadamente 1280 px.
- Tela ampla: aproximadamente 1536 px.

Verificar também larguras intermediárias e transições dos breakpoints; essas medidas são referências, não uma lista fixa de aparelhos.

Conferir ausência de rolagem horizontal involuntária na página, cortes e sobreposições em textos, campos e botões. Verificar conteúdo em retrato e paisagem, textos longos e listas com muitos itens. Usar flex, grid, quebras de linha e dimensões fluidas conforme o conteúdo.

Garantir modais compatíveis com largura e altura disponíveis, formulários utilizáveis com teclado virtual quando verificável, áreas de toque confortáveis e ações sem depender de hover. Respeitar áreas seguras quando aplicável.

Permitir rolagem horizontal dentro de tabelas largas quando necessário, preservando leitura e funcionalidades. Não transformar tabelas em outro layout sem necessidade demonstrada. Não esconder informações ou ações essenciais para fazer a tela caber. Não mascarar overflow da página com `overflow-x: hidden`; resolver sua causa.

## Preservar acessibilidade

- Manter contraste adequado, usando WCAG AA como referência.
- Garantir foco visível e navegação por teclado; preservar labels, semântica e nomes acessíveis.
- Não comunicar estados apenas por cor; respeitar `prefers-reduced-motion`.
- Verificar ampliação de texto e zoom de 200% quando possível.
- Não diminuir fontes ou áreas de interação apenas para acomodar mais conteúdo.
- Não remover indicadores de foco ou mensagens de erro.

## Validar e entregar

Executar build, análise de tipos e verificações existentes pertinentes à mudança. Inspecionar visualmente as telas alteradas nas larguras acima; comparar com as referências iniciais para confirmar a preservação da estrutura. Verificar navegação, formulários, modais, ações, estados de interação e conteúdo afetados. Conferir outras telas atingidas por alterações globais e corrigir problemas encontrados antes de concluir.

Não criar testes que apenas reproduzam valores de CSS. Usar testes funcionais ou visuais quando verificarem riscos reais e forem compatíveis com a infraestrutura existente.

Não afirmar que a responsividade foi validada apenas porque o build passou. Distinguir viewport simulada de dispositivo real e informar verificações que não puderam ser executadas.

Na entrega, apresentar de forma objetiva:

- Melhorias implementadas e telas/componentes afetados.
- Evidências de preservação da estrutura.
- Larguras e comportamentos verificados.
- Resultados das verificações e limitações pendentes.

Não publicar a aplicação apenas por concluir mudanças locais; publicação exige autorização aplicável.
