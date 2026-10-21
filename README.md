# SongState

Site pessoal para estudar guitarra: braço interativo, estudos em capítulos, exercícios de memorização, dicionário de acordes e backing tracks que tocam dentro do próprio site.

**Site no ar:** https://lucas-alvess.github.io/SongState/

## O que tem

| Página | Descrição |
| --- | --- |
| **Braço** | Braço de guitarra interativo com 20 escalas e modos, 7 posições (3 notas por corda) ou 5 caixas (pentatônicas), filtros por grau, corda e casas, modo teste que esconde os nomes, 9 afinações, modo canhoto e nomes C D E ou Dó Ré Mi. |
| **Estudos** | 63 lições em 13 capítulos (Iniciante, Intermediário, Avançado): primeiros passos, teoria essencial, campos harmônicos, harmonia avançada e mais. Cada lição traz teoria, exemplos (tablaturas e formas de acordes), dicas, passos com checklist, braço pré-configurado, metrônomo e atalhos para exercícios. Também aceita estudos próprios. |
| **Exemplos tocáveis** | Tablaturas e acordes em texto das lições têm botões para **ouvir**, com a nota atual destacada no braço, andamento e repetição (formatos: tablatura de 6 linhas com h, p, / e \; e `corda:`/`casa:`). |
| **Exercícios** | 15 treinos com pontuação: notas, escalas e shapes, intervalos, acordes, campos harmônicos e ouvido. |
| **Treino de hoje** | Sessão curta com revisão espaçada (variação do SM-2): mistura notas no braço, intervalos, graus, acordes e campos harmônicos; acertou, a pergunta volta em 1, 3, 8… dias; errou, volta em minutos e reaparece na mesma sessão. Mostra pontos fracos e dias seguidos. Fica em Exercícios → Treino de hoje (`#/treino`). |
| **Looper e gravação** | Em Backing → Looper (`#/backing/looper`): pedal de loop com gravação de precisão de amostra (AudioWorklet), 1–8 compassos ou modo livre, contagem e metrônomo, até 8 camadas com volume e mudo, desfazer, ajuste e medição de latência. Biblioteca de loops (salvar, renomear, duplicar, baixar WAV, excluir) com **empilhar** e **encadear**. Na página de qualquer música com cifra, **Gravar minha execução** grava junto com a base (a contagem inclusive) e depois toca a gravação alinhada com a base. Use fones de ouvido. O áudio fica só no aparelho (IndexedDB) e entra no backup quando você marca "incluir áudio". |
| **Afinador** | Afinador pelo microfone (`#/afinador`): detecção de altura por YIN, ponteiro em cents, modo por corda (qualquer afinação do app) ou cromático, lá de referência 430–450 Hz, tom de referência para afinar de ouvido e escolha da entrada de áudio. Funciona offline; o áudio é analisado no aparelho e nunca gravado ou enviado. Acesso: Configurações → Afinador, Exercícios ou atalho do app instalado. |
| **Progresso** | Estatísticas de estudo (`#/progresso`): dias seguidos e melhor sequência, meta semanal em minutos ou respostas, minutos por dia, calendário de 12 semanas, acerto semana a semana, acerto por assunto e onde você estuda. O tempo só conta com a aba visível e interação recente. O ícone 🔥 no menu leva para a página (tracejado = hoje ainda sem estudo). |
| **Campos** | Campos harmônicos (maior, menores natural/harmônica/melódica, maior harmônica e os modos) em **tabela**, **círculo das quintas**, **roda do campo**, **todos os 12 tons** e **comparação** entre campos. Tríades e tétrades, funções (T, SD, D), progressões comuns, áudio e **modo estudo** que esconde as respostas. | Cada progressão tem **Tocar na base**, que abre no Backing no tom escolhido, e dá para **montar a sua** (até 12 acordes).
| **Acordes** | Clique nas casas e o site descobre o acorde (cifra e nome por extenso). Dicionário com 29 tipos e digitações geradas por algoritmo. |
| **Referência** | Glossário de termos e tabelas de escalas, intervalos, acordes e armaduras de clave (geradas pelos mesmos dados do app). |
| **Backing** | Cifra → base tocada no site (bateria, baixo e acordes) com transposição e contagem; jam tracks; busca e reprodução de YouTube e Spotify sem sair do site. |

## Rodar localmente

```bash
npm install
npm run dev        # http://127.0.0.1:5173 (também acessível pela rede local)
npm run build      # gera dist/ (site estático)
npm run preview    # serve o build para conferir
npm test           # testes automáticos (música, acordes, campos, conteúdo, banco de dados, backup)
npm run a11y       # acessibilidade (axe-core) sobre o build; precisa do Chrome (CHROME_PATH se não for achado)
```

Use `127.0.0.1` em vez de `localhost` se for conectar o Spotify (o Spotify não aceita `localhost`).

## Publicação (GitHub Pages)

O deploy é automático: a cada push no `main`, o workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) instala as dependências, roda os testes (`npm test`) e o build (`npm run build`) e publica a pasta `dist/`.

Configuração feita uma única vez no GitHub:

1. Abra **Settings → Pages** do repositório.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Faça um push no `main` (ou rode o workflow manualmente em **Actions → Deploy no GitHub Pages → Run workflow**).

Se algum teste ou a verificação de tipos falhar, **nada é publicado** e o site continua na versão anterior.

O site usa rotas com `#` (HashRouter) e `base: './'`, então funciona em qualquer subcaminho sem configuração extra.

## Instalar como aplicativo (PWA)

O SongState é um PWA: pode ser instalado e abre em janela própria, inclusive sem internet (as partes que não dependem de YouTube/Spotify/Google).

- **Chrome / Edge (computador):** ícone de instalar na barra de endereço, ou o botão **Instalar app** no topo do site, ou menu ⋮ → *Instalar SongState*.
- **Android (Chrome):** menu ⋮ → *Instalar app* (ou o botão **Instalar app** no topo).
- **iPhone / iPad (Safari):** *Compartilhar* → *Adicionar à Tela de Início*.

Como funciona: [`public/sw.js`](public/sw.js) guarda o app em cache na primeira visita (navegação com rede primeiro, arquivos com hash em cache primeiro). A cada build, o `vite.config.ts` carimba o service worker com um id novo, então cada deploy invalida o cache antigo sozinho. Requisições para outros domínios (YouTube, Spotify, Google) não passam pelo service worker. ### Ícone oficial

O ícone do site é [`public/icons/guitar-neon-icon.png`](public/icons/guitar-neon-icon.png) (1254×1254). Todas as variações são geradas a partir dele por [`scripts/make-icons.mjs`](scripts/make-icons.mjs):

| Arquivo | Uso |
| --- | --- |
| `icon-512.png`, `icon-192.png` | Ícone do app (cantos transparentes, o braço da guitarra sobressai no topo como no original) |
| `maskable-512.png` | Android adaptável: arte reduzida para caber na zona segura (círculo de 40%) sobre fundo azul-escuro |
| `apple-touch-icon.png` | iOS: 180×180 opaco (o sistema aplica o arredondamento) |
| `favicon-32.png`, `favicon.svg`, `logo-96.png` | Aba do navegador e logo do cabeçalho: recorte só da guitarra, pois o texto não é legível em 16–32 px |
| `icon.svg` | A arte completa embutida em um SVG (é uma imagem raster dentro de um SVG, não uma vetorização) |

Para trocar o ícone, substitua o PNG de origem e rode:

```bash
npm install --no-save sharp   # só para gerar; não é dependência do projeto
node scripts/make-icons.mjs
```

## Spotify e YouTube (opcional)

Tocar um link do YouTube não exige configuração. Para **buscar** e usar o player completo do Spotify, abra **Ajustes → Spotify e YouTube** no site:

- **YouTube:** informe uma chave gratuita da YouTube Data API v3. A chave aparece nas requisições do navegador, então **restrinja-a** no Google Cloud: em *Restrições de aplicativo* use *Sites (referenciadores HTTP)* com `https://lucas-alvess.github.io/*` (e `http://127.0.0.1:5173/*` para testes locais) e, em *Restrições de API*, permita apenas a *YouTube Data API v3*.
- **Spotify:** informe o *Client ID* de um app criado em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) e adicione ao app o *Redirect URI* exibido nessa tela. Para o site publicado, é `https://lucas-alvess.github.io/SongState/`. O player completo exige conta Premium e navegador de computador.

As chaves ficam salvas **somente no navegador** de quem as digita (localStorage). Nenhuma chave está no repositório.

Depois de conectar o Spotify, use **Testar conexão** (Configurações → Spotify e YouTube): ele confere o login, a conta, se é Premium, se o navegador serve e se há DRM, e diz o que corrigir em cada passo.

## Fontes

Inter e Space Grotesk (licença OFL, em `public/fonts`) são servidas pelo próprio site e guardadas pelo service worker: nenhuma requisição ao Google Fonts, e o visual é o mesmo offline.

## Login Google e sincronização (opcional)

Entrando com o Google, seus dados passam a ficar também na **sua conta**, numa pasta oculta do Drive (`appDataFolder`) que só o SongState enxerga — o app pede só a permissão `drive.appdata` e o e-mail. Sem login, tudo segue como antes (somente neste navegador). **Offline primeiro:** os dados sempre ficam no aparelho; o envio acontece quando há internet e login válido.

**O que sincroniza:** músicas, estudos próprios, progresso das lições, estatísticas, revisão espaçada, dias de estudo e, se você ligar a opção, os loops, gravações e arquivos de áudio. Preferências de tela e chaves (Spotify/YouTube) **nunca** saem do aparelho.

**Como funciona:** cada aparelho mescla seus dados com os da nuvem (união; no mesmo item vale o mais recente; exclusões viajam como marcas de exclusão para os outros aparelhos). O login do Google dura cerca de 1 hora e não existe renovação sem servidor, então ao reabrir o app aparece **Reconectar** (um toque) e, enquanto isso, nada se perde.

### Configuração (uma vez, no Google Cloud)

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto (ex.: *SongState*).
2. **APIs e serviços → Biblioteca:** ative a **Google Drive API**.
3. **Tela de consentimento OAuth:** tipo *Externo*; preencha nome e e-mail; em *Escopos* adicione `.../auth/drive.appdata`; deixe em *Testando* e inclua seu e-mail (e de quem for usar) em *Usuários de teste*. (Para liberar a qualquer pessoa, publique o app — o escopo `drive.appdata` não exige verificação.)
4. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.** Em *Origens JavaScript autorizadas* coloque `https://lucas-alvess.github.io` (e `http://localhost:5173` para testes). Não precisa de URI de redirecionamento.
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`; é público, não é segredo) e use **um** dos caminhos:
   - no GitHub: *Settings → Secrets and variables → Actions → Variables → New repository variable* com o nome `GOOGLE_CLIENT_ID` e rode o deploy de novo; ou
   - no site: *Configurações → Conta e sincronização → Configuração avançada*, cole o ID (vale só naquele navegador).

## Testes

- `npm test`: testes unitários (Vitest) — música, revisão espaçada, backup, WAV, looper, sincronização com um Drive falso etc.
- `npm run a11y`: acessibilidade (axe-core) em todas as telas, no computador e no celular.
- `npm run e2e`: testes no Chrome real sobre o build (`npm run build` antes), com microfone e Google/Drive simulados: abre todas as rotas e links internos, afinador (A2 e E2 +25 cents), looper (4,000 s exatos e 8 cliques no tempo) e sincronização entre dois aparelhos. Dá para rodar só algumas suítes: `npm run e2e -- tuner sync`.
- Os três rodam no GitHub Actions antes de cada publicação.

## Estrutura

```
src/
  lib/          música e áudio: music.ts (escalas, afinações, posições), harmony.ts (campos harmônicos),
                curriculum.ts + curriculum-extra.ts (estudos), reference.ts (glossário), chords.ts (acordes,
                detecção, cifras, digitações), db.ts (IndexedDB versionado), migrations.ts (migração dos dados salvos), backup.ts (backup e restauração), jam.ts (motor de backing em Web Audio),
                curriculum.ts (estudos), exercises.ts, spotify.ts, youtube.ts, player.tsx
  components/   Fretboard (SVG), ScaleBoard, BackingPlayer, Dock (reprodutor fixo),
                ChordDiagram, Metronome, Integrations ...
  tests/        testes automáticos (Vitest)
  scripts/      make-icons.mjs (ícones), a11y.mjs (acessibilidade com axe-core)
  pages/        Explorer, Studies, StudyDetail, ExerciseList, quizzes, Chords, Backing, Search, SongPage
```

## Dados e privacidade

Músicas, progresso, configurações e arquivos de áudio ficam no navegador de cada dispositivo (localStorage e IndexedDB). Só saem dele se você exportar um backup ou ligar o login Google (acima).

A página **Dados e backup** (Configurações → Backup e armazenamento, ou `#/dados`) gera um arquivo único com músicas, estudos próprios, lições concluídas, histórico dos exercícios e preferências, e restaura esse arquivo mesclando ou substituindo. Os arquivos de áudio entram se você marcar a opção. As chaves do Spotify e do YouTube **nunca** vão para o arquivo, e tudo o que é importado é validado. A página também mostra o espaço usado e pede ao navegador para não apagar os dados do site.

A lista de músicas isolada continua disponível em **Exportar/Importar lista** na aba Backing.

## Tecnologias

React 19, TypeScript, Vite, React Router. Sem backend. Áudio sintetizado com Web Audio API.
