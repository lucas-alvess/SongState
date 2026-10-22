/**
 * Verificação automática de acessibilidade (axe-core) sobre o build em dist/.
 * Uso: npm run build && npm run a11y   (precisa do Chrome/Chromium; informe CHROME_PATH se não for achado)
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const DIST = join(process.cwd(), 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!CHROME) {
  console.error('Chrome não encontrado. Defina CHROME_PATH.');
  process.exit(2);
}
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ não existe. Rode "npm run build" antes.');
  process.exit(2);
}

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^([/\\])+/, '');
  let file = join(DIST, path || 'index.html');
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const PAGES = [
  ['/', 'Braço'],
  ['/estudos', 'Estudos'],
  ['/estudos/campo-maior', 'Lição'],
  ['/estudos/pent-menor-caixa1', 'Lição com tablatura tocável'],
  ['/estudos/acordes-abertos', 'Lição com acordes tocáveis'],
  ['/exercicios', 'Exercícios'],
  ['/exercicios/note-name', 'Exercício de notas'],
  ['/exercicios/field-chord', 'Exercício de campos'],
  ['/acordes', 'Acordes'],
  ['/campos', 'Campos (tabela)'],
  ['/campos', 'Campos (progressões e montagem)', async (p) => { await p.evaluate(() => document.querySelector('[aria-label="Acordes do campo"] button')?.click()); await sleep(150); }],
  ['/campos', 'Campos (círculo)', async (p) => clickText(p, 'Círculo')],
  ['/campos', 'Campos (roda)', async (p) => clickText(p, 'Roda')],
  ['/referencia', 'Referência'],
  ['/afinador', 'Afinador'],
  ['/treino', 'Treino (início)'],
  ['/treino', 'Treino (pergunta)', async (p) => { await clickText(p, 'Começar'); }],
  ['/backing', 'Backing'],
  ['/backing/looper', 'Looper'],
  ['/backing/looper', 'Looper (biblioteca com loops)', async (p) => { await p.evaluate(() => { localStorage.setItem('ss.loops', JSON.stringify([{ id: 'l1', name: 'Riff', kind: 'loop', bpm: 100, beats: 4, bars: 2, sampleRate: 48000, samples: 96000, layers: [{ id: 'lp-x', vol: 1, mute: false }], createdAt: 1, updatedAt: 1 }, { id: 'l2', name: 'Riff 2', kind: 'loop', bpm: 100, beats: 4, bars: 2, sampleRate: 48000, samples: 96000, layers: [{ id: 'lp-y', vol: 1, mute: false }], createdAt: 2, updatedAt: 2 }])); }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(300); await p.evaluate(() => document.querySelector('.loop-item input[type=checkbox]')?.click()); await sleep(150); }],
  ['/backing/m-demo', 'Música com gravação', async (p) => { await p.evaluate(() => { localStorage.setItem('ss.songs', JSON.stringify([{ id: 'm-demo', title: 'Demo', artist: 'x', keyPc: 0, minor: false, bpm: 100, tags: [], notes: '', createdAt: 1, chart: '| C | G |', style: 'rock', sources: [] }])); }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(300); }],
  ['/imprimir', 'Imprimir (shapes)'],
  ['/imprimir', 'Imprimir (campo harmônico colorido)', async (p) => { await p.evaluate(() => localStorage.setItem('ss.print', JSON.stringify({ kind: 'field', style: 'color', highlight: 'root', label: 'degree' }))); await p.reload({ waitUntil: 'networkidle0' }); await sleep(300); }],
  ['/imprimir', 'Imprimir (braço em branco)', async (p) => { await p.evaluate(() => localStorage.setItem('ss.print', JSON.stringify({ kind: 'blank', blankCount: 2 }))); await p.reload({ waitUntil: 'networkidle0' }); await sleep(300); }],
  ['/backing/m-key', 'Música com tom detectado e recomendações', async (p) => { await p.evaluate(() => { localStorage.setItem('ss.songs', JSON.stringify([{ id: 'm-key', title: 'Demo', artist: 'x', keyPc: null, minor: false, bpm: 100, tags: [], notes: '', createdAt: 1, chart: '| Am | Dm | E7 | Am | F | G | E7 | Am |', style: 'rock', sources: [] }])); }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(400); }],
  ['/', 'Braço com 5 formas (CAGED)', async (p) => { await p.evaluate(() => { localStorage.setItem('ss.board', JSON.stringify({ root: 9, scaleId: 'natural-minor', pos: 0, system: 'caged', label: 'note', fretMax: 15 })); }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(300); }],
  ['/progresso', 'Progresso (vazio)'],
  ['/progresso', 'Progresso (com dados)', async (p) => { await p.evaluate(() => { const d = {}; const now = new Date(); for (let i = 0; i < 70; i++) { if (i % 3 === 2) continue; const t = new Date(now); t.setDate(t.getDate() - i); const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; d[k] = { n: (i * 7) % 25, ok: (i * 5) % 20, by: { note: [(i * 7) % 25, (i * 5) % 20] }, ms: ((i * 37) % 50) * 60000, pg: { braco: ((i * 37) % 50) * 60000 } }; } localStorage.setItem('ss.days', JSON.stringify(d)); }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(300); }],
  ['/dados', 'Dados e backup'],
  ['/', 'Configurações (painel aberto)', async (p) => { await p.evaluate(() => document.querySelector('button[aria-label="Configurações"]')?.click()); await sleep(250); }],
  ['/', 'Configurações (conta Google ligada)', async (p) => { await p.evaluate(() => { localStorage.setItem('ss.sync.cfg', JSON.stringify({ clientId: '1-a.apps.googleusercontent.com', audio: true, email: 'pessoa@example.com', name: 'Pessoa' })); }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(300); await p.evaluate(() => document.querySelector('button[aria-label="Configurações"]')?.click()); await sleep(250); }],
];
const VIEWPORTS = [
  ['desktop', { width: 1280, height: 900 }],
  ['celular', { width: 390, height: 844, isMobile: true, hasTouch: true }],
];

// Desligadas de propósito:
//  - region: o app é uma página única, sem o conteúdo solto que essa regra procura;
//  - label-content-name-mismatch: nas fatias do círculo/roda o texto visível é uma sigla (ex.: "I" e "C" em
//    <text> separados) e o nome acessível é a frase completa ("I C, Tônica, ative para ouvir").
const RULES = { region: { enabled: false }, 'label-content-name-mismatch': { enabled: false } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickText(page, text) {
  await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t))?.click(), text);
  await sleep(250);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
let failures = 0;
for (const [vpName, vp] of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  for (const [route, name, prep] of PAGES) {
    await page.goto(`${BASE}#${route}`, { waitUntil: 'networkidle0' });
    await sleep(300);
    if (prep) await prep(page);
    await page.evaluate(axeSource);
    const result = await page.evaluate((rules) => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules }), RULES);
    const bad = result.violations;
    const tag = `${vpName} · ${name}`;
    if (!bad.length) console.log(`ok    ${tag}`);
    for (const v of bad) {
      failures++;
      console.log(`FALHA ${tag}: [${v.impact}] ${v.id} - ${v.help} (${v.nodes.length})`);
      for (const n of v.nodes.slice(0, 3)) console.log(`        ${n.target.join(' ')}  ${n.html.slice(0, 110).replace(/\s+/g, ' ')}`);
    }
  }
  if (pageErrors.length) {
    failures++;
    console.log(`FALHA ${vpName}: erros de JavaScript`, pageErrors);
  }
  await page.close();
}
await browser.close();
server.close();
console.log(failures ? `\n${failures} problema(s) de acessibilidade.` : '\nSem violações de acessibilidade nas páginas testadas.');
process.exit(failures ? 1 : 0);
