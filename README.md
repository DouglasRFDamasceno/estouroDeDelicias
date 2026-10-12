> **Regra atual de acesso:** cadastro somente por convite de administrador. Veja [o guia de administração](docs/admin.md). O fluxo de cadastro público descrito na etapa anterior foi substituído. Migrações e criação do primeiro admin ainda dependem de aplicação remota.

# Estouros de Delícias — etapa 1

Vitrine pública de delícias gourmet, inicialmente pipocas, e área de gestão de custos e vendas com layout Ionic demonstrativo em português. **Cadastro e login integrados ao código via Supabase Auth.** A ativação depende da configuração do seu projeto e aplicação da migração: siga [docs/supabase.md](docs/supabase.md). A área `/demo` permanece fictícia; não há cadastros de vendas nem publicação.

## 1. Executar localmente

Use Node 22 LTS atualizado (mínimo 22.12) e npm. Com nvm, `nvm install` e `nvm use` utilizam `.nvmrc`. A implementação foi verificada neste ambiente com Node 25.0.0/npm 11.6.2; a versão 22 não foi executada aqui.

No terminal do VS Code, dentro desta pasta:

```bash
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. Encerre o servidor com Ctrl+C. `npm ci` instala exatamente o lockfile; use `npm install` apenas ao alterar dependências. A vitrine funciona sem configuração. Para autenticação real, configure `.env.local` e o Supabase conforme [o guia](docs/supabase.md).

## Padronização do código

Use `npm run format` para formatar o código com Prettier e `npm run lint:fix` para aplicar as correções automáticas do ESLint. O padrão usa dois espaços, aspas simples em JavaScript/TypeScript, ponto e vírgula e largura de referência de 100 caracteres. O arquivo `.editorconfig` compartilha as convenções com o editor.

Antes de abrir um PR, execute `npm run check`: ele verifica ESLint (sem avisos), formatação, testes e build com validação de tipos. Também é possível executar `npm run lint` e `npm run format:check` separadamente. O ESLint verifica TypeScript, imports de tipos e regras/dependências dos Hooks do React; as funções Supabase têm suporte ao global `Deno`. Arquivos gerados e dependências ficam fora da análise.

## 2. Validar em passos pequenos

1. Na página inicial, confira a foto real, os sabores e a seleção de tamanhos (50 g, 100 g e 150 g). Confirme que os preços mudam conforme o cardápio enviado.
   Os links de pedido abrem o WhatsApp com uma mensagem para revisão; nenhum pedido é registrado no sistema.
2. Clique em Criar conta e siga o fluxo de confirmação de e-mail. Com Supabase configurado, Entrar valida as credenciais e abre `/conta`.
3. No rodapé, clique em Demonstração da gestão, ou abra `/demo/dashboard` e navegue por produtos, custos, clientes e vendas.
4. Reduza a janela a 390 px e abra o menu no cabeçalho. Confira também tablet e desktop, sem rolagem horizontal.
5. Use Tab para navegar pelos links. Recarregue `/demo/vendas` diretamente e teste um endereço inexistente.
6. Confira o aviso permanente de demonstração e os valores em reais/datas brasileiras. Sem Supabase configurado, o formulário fica desabilitado. Com configuração, e-mail/senha são enviados por HTTPS somente ao Auth.

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`build` também verifica os tipos e gera `dist/`. `preview` serve o build em http://127.0.0.1:4173. Testes cobrem recebimento parcial, valores em centavos e resultado sem vendas. Servidor Vite verificado com HTTP 200 na landing e em `/demo/vendas`. Build e testes não substituem validação visual em navegador/dispositivo; esta etapa não teve teste automatizado de navegador nem compilação nativa.

## 3. Organização e próximas etapas

Leia [arquitetura, modelagem proposta, regras e plano](docs/arquitetura.md). A separação entre telas, componentes, serviços, tipos e domínio permite compartilhar regras entre web e aplicativo. O cliente Supabase já está instalado; o guia de ativação explica migração, RLS e configurações. `.env.example` reserva apenas URL e chave pública; todas as variáveis `VITE_` ficam visíveis no cliente. Nunca usar chave administrativa/service_role/secret nesse arquivo.

A etapa atual implementa Auth e perfil privado. A próxima é validar os fluxos no seu Supabase e depois criar empresas, vínculos e RLS empresarial antes dos cadastros de negócio.

## 4. Android e iOS — preparação, sem execução nesta etapa

`capacitor.config.ts` aponta para `dist/`. O appId é provisório: escolher identificador definitivo antes de distribuir. Core e CLI estão na mesma versão 8.5.3. Ainda não foram gerados os projetos android/ios.

Para Android, instalar Android Studio 2025.2.1 ou superior, SDK/Build Tools API 36 e usar o JDK fornecido pelo Android Studio. Exige ambiente nativo configurado, emulador ou aparelho com depuração USB. Depois:

```bash
npm install @capacitor/android@8.5.3
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Para iOS, é necessário macOS, Xcode 26+ e Command Line Tools. O Linux atual não compila iOS. Capacitor 8 usa Swift Package Manager por padrão. No Mac:

```bash
npm install @capacitor/ios@8.5.3
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Após alterações web, gerar build e sincronizar novamente. Os comandos acima são passos futuros, não foram executados. Testar teclado virtual, rolagem de formulários, botão voltar, rotação e safe areas em dispositivos reais. O layout atual usa viewport-fit=cover, safe-area insets, IonContent e menu adaptativo. Ajustes de teclado serão feitos quando houver formulários. Assinatura, certificados e contas das lojas serão necessários para distribuição; nada foi publicado.

### Confirmação e recuperação web/mobile

Antes de ativar Auth, definir callbacks HTTPS web (`/auth/callback`, `/auth/recovery`) e URL de retorno nativa; registrar redirects permitidos no Supabase. Configurar Universal Links/App Links ou esquema próprio no AndroidManifest e Info.plist. Integrar `@capacitor/app` para retorno com app aberto e início a frio (`appUrlOpen`/`getLaunchUrl`); validar origem, caminho, estado e erros, trocar código PKCE por sessão e encaminhar recuperação para alteração de senha. Evitar dupla troca de código, exposição de tokens e redirecionamento aberto. Testar links expirados, confirmação, recuperação, app fechado/aberto e retorno web. Persistência e renovação de sessão serão testadas nos dois ambientes. Callbacks web já estão implementados. O retorno nativo ainda depende desses passos.

## 5. Cloudflare Pages — somente planejamento

A versão web será um site estático: comando `npm run build`, diretório `dist`, Node 22 atualizado. O Pages oferece fallback para SPA quando não há `404.html` no nível superior; validar recarregamento direto das rotas e callbacks na futura implantação. Cadastrar o domínio HTTPS de produção nos redirects do Supabase e configurar apenas variáveis públicas necessárias antes do build. Nenhum projeto Cloudflare, deploy ou recurso remoto foi criado.

## 6. Git

A pasta fornecida tem `.git` reservado e somente leitura, mas não contém um repositório válido (`git status` falha). Nenhum commit foi criado. Não remova essa pasta. Para começar em uma pasta comum, fora desse diretório reservado, copie os arquivos de código, excluindo `.git`, `node_modules`, `dist`, `.agents`, `.codex`, `.aws` e arquivos `.env` reais. Na cópia:

```bash
git init -b main
git add .
git diff --cached
git commit -m "feat: estrutura inicial e demonstracao Ionic"
```

Revise os arquivos antes do commit. Nas próximas etapas, faça um commit por entrega validada. Não configurar remoto ou push nesta etapa.

## 7. Versões e fontes oficiais

Consulta em 10/10/2026, antes da implementação. `npm view` confirmou os peerDependencies; `npm ls --depth=0` não apresentou incompatibilidades. `package-lock.json` registra versões exatas:

| Dependência | Versão instalada / decisão |
| --- | --- |
| Ionic React e Ionic Router | 9.0.7; peers React 18/19 e React Router >=6.4 <7 |
| React / React DOM | 19.3.0 |
| React Router / DOM | 6.30.6; compatível com Ionic 9 |
| Capacitor Core / CLI | 8.5.3; Node >=22 |
| Vite / plugin React | 7.3.7 / 5.2.0; par compatível, Node >=22.12 |
| TypeScript | 5.9.3 |
| Supabase JS | 2.117.3 instalada, exige Node >=22 |

Vite 8 foi consultado; foi escolhido Vite 7, com patch atual da linha e compatibilidade explícita com o plugin React 5. O build informa um chunk principal acima de 500 kB; separar telas por carregamento sob demanda é uma melhoria futura antes de otimizar produção.

`npm audit` encontrou 6 alertas moderados: React Router 6/Ionic Router e dependências xcode/uuid do Capacitor CLI. As correções sugeridas para Router saem da faixa suportada pelo Ionic; não foi aplicado `audit fix --force`. O protótipo só usa destinos de navegação constantes e não usa SSR/hidratação de dados. Antes de produção, reavaliar versões corrigidas suportadas. Os alertas do CLI pertencem às ferramentas de desenvolvimento nativo; nenhum build nativo foi executado. Nenhum alerta alto/crítico na consulta. Isso não constitui auditoria completa de segurança.

Fontes:

- [Navegação Ionic React](https://ionicframework.com/docs/react/navigation)
- [Requisitos Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Guia Vite](https://vite.dev/guide/)
- [Supabase Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase deep links](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [React no Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Fallback SPA no Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering)

Fontes web externas Google Fonts são opcionais; a interface usa fontes locais de fallback quando indisponíveis. Nenhuma imagem ou biblioteca de gráficos adicional foi necessária.

## Atualização visual — vitrine gourmet

A página pública apresenta pipocas gourmet com identidade inspirada nos materiais enviados: rosa #eb0956, azul #008bc8, amarelo #ffdb49 e roxo #452365, sobre fundo creme. A foto real de presente (com laços roxos) e o cardápio foram copiados para `public/images`; não há dependência do diretório Downloads na execução. O cardápio fornecido é público pelo link da vitrine e contém os contatos e QR codes presentes no original.

Os sabores e valores do catálogo foram transcritos do cardápio fornecido (não são os dados fictícios da área `/demo`). A disponibilidade e o valor final são confirmados no WhatsApp. O catálogo é estático nesta etapa e não está conectado aos produtos da gestão. A foto é real; os cartões de sabores usam composição gráfica CSS, sem fotos inventadas de produtos. Não há pagamento integrado, checkout ou envio automático de mensagem.

Para validar: alterne os três tamanhos, confira Ninho (R$ 9/16/22) e Morango (R$ 7,50/13/18), abra o cardápio, confira o texto do link de WhatsApp e teste larguras de 390, 768 e 1440 px. Ative movimento reduzido no sistema e navegue por Tab. O build e os tipos foram verificados; a inspeção visual em navegador e aparelho continua manual.

O catálogo público exibe todos os 13 sabores em um menu compacto, sem carrossel nem expansão. Cada opção mostra apenas nome, preço e link de pedido acessível. São três colunas no computador, duas em tablets e uma lista no celular; a seleção de tamanho atualiza todos os preços. Ilustrações e descrições repetidas foram retiradas para reduzir a carga visual.

### Catálogo em modal

A seção de sabores agora oferece o botão “Ver todos os sabores”, que abre um modal Ionic com os 13 cards. O seletor de tamanho permanece no cabeçalho durante a rolagem. No celular, o catálogo ocupa a tela inteira. Validar abertura, fechamento pelo botão/Escape, retorno do foco ao botão de abertura, rolagem, preços e links de pedido. Não há descrições repetidas nos cards.


### Auth e perfil privado

Veja [docs/supabase.md](docs/supabase.md) para a entrega atual: cadastro, login real, recuperação, callbacks web, sessão, logout, perfil e migração com RLS. `/conta` é protegida; `/demo` continua público e fictício. Nenhum projeto remoto foi alterado e nenhum segredo foi criado.
