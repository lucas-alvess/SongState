# SongStation

Site pessoal para estudar guitarra: braço interativo, exercícios de memorização, estudos guiados e backing tracks.

## Rodar

```
npm install
npm run dev        # http://localhost:5173 (também acessível na rede local, ex.: pelo celular)
npm run build      # gera dist/ (site estático, pode ser hospedado em qualquer lugar)
```

## Estrutura

- `src/lib/music.ts` — notas, escalas, afinações e o algoritmo de posições (shapes)
- `src/lib/jam.ts` — motor de Jam Tracks (Web Audio)
- `src/lib/songs.ts` — leitura de links Spotify/YouTube
- `src/components/` — Fretboard (SVG), ScaleBoard (braço + filtros), Metronome, players
- `src/pages/` — Braço, Exercícios, Estudos, Backing tracks

Os dados (músicas, progresso, configurações) ficam no navegador (localStorage / IndexedDB).
