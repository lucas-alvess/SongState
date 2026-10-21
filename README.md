# SongState

Site pessoal para estudar guitarra: braço interativo, estudos em capítulos, exercícios de memorização, dicionário de acordes e backing tracks que tocam dentro do próprio site.

**Site no ar:** https://lucas-alvess.github.io/SongState/

## O que tem

| Página | Descrição |
| --- | --- |
| **Braço** | Braço de guitarra interativo com 20 escalas e modos, 7 posições (3 notas por corda) ou 5 caixas (pentatônicas), filtros por grau, corda e casas, modo teste que esconde os nomes, 9 afinações, modo canhoto e nomes C D E ou Dó Ré Mi. |
| **Estudos** | 35 lições em 9 capítulos (Iniciante, Intermediário, Avançado) com teoria, passos com checklist, braço pré-configurado, metrônomo e histórico. Também aceita estudos próprios. |
| **Exercícios** | 12 treinos com pontuação: notas, escalas e shapes, intervalos, acordes e ouvido. |
| **Acordes** | Clique nas casas e o site descobre o acorde (cifra e nome por extenso). Dicionário com 29 tipos e digitações geradas por algoritmo. |
| **Backing** | Cifra → base tocada no site (bateria, baixo e acordes) com transposição e contagem; jam tracks; busca e reprodução de YouTube e Spotify sem sair do site. |

## Rodar localmente

```bash
npm install
npm run dev        # http://127.0.0.1:5173 (também acessível pela rede local)
npm run build      # gera dist/ (site estático)
npm run preview    # serve o build para conferir
```

Use `127.0.0.1` em vez de `localhost` se for conectar o Spotify (o Spotify não aceita `localhost`).

## Publicação (GitHub Pages)

O deploy é automático: a cada push no `main`, o workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) instala as dependências, roda `npm run build` e publica a pasta `dist/`.

Configuração feita uma única vez no GitHub:

1. Abra **Settings → Pages** do repositório.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Faça um push no `main` (ou rode o workflow manualmente em **Actions → Deploy no GitHub Pages → Run workflow**).

O site usa rotas com `#` (HashRouter) e `base: './'`, então funciona em qualquer subcaminho sem configuração extra.

## Instalar como aplicativo (PWA)

O SongState é um PWA: pode ser instalado e abre em janela própria, inclusive sem internet (as partes que não dependem de YouTube/Spotify/Google).

- **Chrome / Edge (computador):** ícone de instalar na barra de endereço, ou o botão **Instalar app** no topo do site, ou menu ⋮ → *Instalar SongState*.
- **Android (Chrome):** menu ⋮ → *Instalar app* (ou o botão **Instalar app** no topo).
- **iPhone / iPad (Safari):** *Compartilhar* → *Adicionar à Tela de Início*.

Como funciona: [`public/sw.js`](public/sw.js) guarda o app em cache na primeira visita (navegação com rede primeiro, arquivos com hash em cache primeiro). A cada build, o `vite.config.ts` carimba o service worker com um id novo, então cada deploy invalida o cache antigo sozinho. Requisições para outros domínios (YouTube, Spotify, Google) não passam pelo service worker. Os ícones foram gerados a partir de [`public/icons/icon.svg`](public/icons/icon.svg).

## Spotify e YouTube (opcional)

Tocar um link do YouTube não exige configuração. Para **buscar** e usar o player completo do Spotify, abra **Ajustes → Spotify e YouTube** no site:

- **YouTube:** informe uma chave gratuita da YouTube Data API v3. A chave aparece nas requisições do navegador, então **restrinja-a** no Google Cloud: em *Restrições de aplicativo* use *Sites (referenciadores HTTP)* com `https://lucas-alvess.github.io/*` (e `http://127.0.0.1:5173/*` para testes locais) e, em *Restrições de API*, permita apenas a *YouTube Data API v3*.
- **Spotify:** informe o *Client ID* de um app criado em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) e adicione ao app o *Redirect URI* exibido nessa tela. Para o site publicado, é `https://lucas-alvess.github.io/SongState/`. O player completo exige conta Premium e navegador de computador.

As chaves ficam salvas **somente no navegador** de quem as digita (localStorage). Nenhuma chave está no repositório.

## Estrutura

```
src/
  lib/          música e áudio: music.ts (escalas, afinações, posições), chords.ts (acordes,
                detecção, cifras, digitações), jam.ts (motor de backing em Web Audio),
                curriculum.ts (estudos), exercises.ts, spotify.ts, youtube.ts, player.tsx
  components/   Fretboard (SVG), ScaleBoard, BackingPlayer, Dock (reprodutor fixo),
                ChordDiagram, Metronome, Integrations ...
  pages/        Explorer, Studies, StudyDetail, ExerciseList, quizzes, Chords, Backing, Search, SongPage
```

## Dados e privacidade

Músicas, progresso, configurações e arquivos de áudio ficam no navegador de cada dispositivo (localStorage e IndexedDB). Para levar a lista de músicas a outro aparelho, use **Exportar/Importar lista** na aba Backing (os arquivos de áudio não são exportados).

## Tecnologias

React 19, TypeScript, Vite, React Router. Sem backend. Áudio sintetizado com Web Audio API.
