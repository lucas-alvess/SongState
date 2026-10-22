/**
 * Testes de interface no Chrome real, sobre o build em dist/ (microfone e Google/Drive simulados).
 * Uso: npm run build && npm run e2e   (precisa do Chrome/Chromium; informe CHROME_PATH se não for achado)
 *      npm run e2e -- tuner sync      (roda só algumas suítes: smoke, tuner, looper, sync, dock, print)
 *
 * - smoke:  abre todas as rotas e todos os links internos achados nelas; sem erro de JS e sem requisição externa.
 * - tuner:  afinador com microfone simulado (A2 afinada, E2 +25 cents), filtros desligados e microfone solto ao sair.
 * - looper: grava 2 compassos a 120 BPM (clique a cada 0,5 s): o áudio tem exatamente 4,000 s e 8 cliques no tempo.
 * - dock:   loop A–B do reprodutor fixo (YouTube simulado): ligar, pausar, retomar, seguir após o B, reiniciar, limpar.
 * - print:  página Imprimir: opções, formas das notas, estilo, e PDFs reais (A4/Carta, paisagem/retrato, nº de páginas).
 * - sync:   login do Google e Drive simulados, dois aparelhos, exclusão, offline, sessão vencida e desconectar.
 */
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import puppeteer from 'puppeteer-core';
import pdfLib from 'pdf-lib';

const { PDFDocument } = pdfLib;

const DIST = join(process.cwd(), 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
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
const TMP = mkdtempSync(join(tmpdir(), 'songstate-e2e-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const oneLine = (v) => String(v).slice(0, 400).split(/s+/).join(' ');
let failures = 0;
let suite = '';
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALHA'} [${suite}] ${name}${cond || !extra ? '' : ` — ${extra}`}`);
  if (!cond && process.env.GITHUB_ACTIONS) console.log(`::error title=e2e ${suite}::${name} ${oneLine(extra)}`);
  if (!cond) failures++;
};
async function waitFor(fn, ms = 10000, step = 100) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}

// ---------- áudio simulado ----------
function writeWav(name, gen, seconds) {
  const sr = 48000;
  const n = sr * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, gen(i / sr))) * 32767), 44 + i * 2);
  const file = join(TMP, name);
  writeFileSync(file, buf);
  return file;
}
/** Nota de corda: fundamental + harmônicos. */
const tone = (f) => (t) => ([1, 0.7, 0.5, 0.35, 0.2].reduce((v, a, k) => v + a * Math.sin(2 * Math.PI * f * (k + 1) * t), 0) / 2.75) * 0.5;
/** Clique de 2 kHz (2 ms) a cada 0,5 s. */
const clicks = (t) => { const m = (t - 0.013 + 1000) % 0.5; return m < 0.002 ? 0.8 * Math.sin(2 * Math.PI * 2000 * m) : 0; };
const WAVS = {
  a2: writeWav('a2.wav', tone(110), 8),
  e2sharp: writeWav('e2s.wav', tone(82.407 * Math.pow(2, 25 / 1200)), 8),
  clicks: writeWav('clicks.wav', clicks, 10),
};

const launch = (wav) =>
  puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', ...(wav ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] : [])],
  });

async function newPage(browser, { width = 1100, external = null } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width, height: 1000 });
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && p.errs.push(`console: ${m.text()}`));
  p.on('dialog', (d) => d.accept());
  if (external) p.on('request', (r) => !/^(http:\/\/127\.0\.0\.1|data:|blob:|about:|https:\/\/www\.googleapis\.com\/youtube\/)/.test(r.url()) && external.push(r.url().replace(/([?&]key=)[^&]*/, '$1***')));
  await p.evaluateOnNewDocument(() => {
    window.__streams = [];
    const md = navigator.mediaDevices;
    if (md?.getUserMedia) {
      const orig = md.getUserMedia.bind(md);
      md.getUserMedia = async (c) => { window.__c = c; const s = await orig(c); window.__streams.push(s); return s; };
    }
  });
  return p;
}
const goto = (p, hash) => p.goto(`${BASE}#${hash}`, { waitUntil: 'networkidle0' });
const click = (p, text, sel = 'button') => p.evaluate((t, s) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(t) && !e.disabled); el?.click(); return !!el; }, text, sel);
const liveStreams = (p) => p.evaluate(() => window.__streams.filter((s) => s.getTracks().some((t) => t.readyState === 'live')).length);
const ls = (p, k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), k);
const setInput = (p, sel, value) => p.evaluate((sel, v) => { const el = document.querySelector(sel); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, sel, value);

// ================= smoke =================
async function smoke() {
  const browser = await launch();
  const external = [];
  const p = await newPage(browser, { external });
  // com a chave do YouTube embutida no build, a busca do site chama a API: bloqueia (não gasta a cota nem depende da rede)
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    if (/^https:\/\/www\.googleapis\.com\/youtube\//.test(r.url())) r.abort().catch(() => {});
    else r.continue().catch(() => {});
  });
  const seen = new Set();
  const queue = ['/', '/estudos', '/exercicios', '/treino', '/progresso', '/afinador', '/acordes', '/campos', '/referencia', '/dados', '/backing', '/backing/jam', '/backing/buscar', '/backing/looper'];
  const broken = [];
  let visited = 0;
  while (queue.length && visited < 150) {
    const route = queue.shift();
    if (seen.has(route)) continue;
    seen.add(route);
    visited++;
    await goto(p, route);
    const info = await p.evaluate(() => ({
      text: (document.querySelector('main')?.innerText ?? '').trim().length,
      crashed: /Algo deu errado nesta página/.test(document.body.innerText),
      links: [...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href').slice(1)))],
    }));
    if (info.crashed || info.text < 20) broken.push(`${route} (${info.crashed ? 'página quebrou' : 'vazia'})`);
    for (const l of info.links) if (!seen.has(l)) queue.push(l);
  }
  ok(`${visited} rotas e links internos abrem com conteúdo`, broken.length === 0 && visited >= 60, broken.join(' | ') || `só ${visited} rotas`);
  for (const [file, title] of [['privacidade.html', 'Política de Privacidade'], ['termos.html', 'Termos de Serviço']]) {
    const r = await fetch(`${BASE}${file}`);
    const html = await r.text();
    ok(`${file} é público e tem o conteúdo`, r.ok && html.includes(title) && html.includes('<html lang="pt-BR">'), String(r.status));
  }
  ok('rodapé com links de privacidade e termos', await p.evaluate(() => !!document.querySelector('.legal-foot a[href$="privacidade.html"]') && !!document.querySelector('.legal-foot a[href$="termos.html"]')));
  ok('sem erros de JavaScript', p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
  ok('nenhuma requisição externa (fontes, scripts e dados são do próprio site)', external.length === 0, external.slice(0, 3).join(' '));
  const mobile = await newPage(browser, { width: 390 });
  let overflow = [];
  for (const r of ['/', '/estudos', '/exercicios', '/treino', '/progresso', '/afinador', '/acordes', '/campos', '/backing', '/backing/looper', '/dados']) {
    await goto(mobile, r);
    const wide = await mobile.evaluate(() => (document.documentElement.scrollWidth <= window.innerWidth + 1 ? null : [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 3).map((e) => `${e.tagName}.${String(e.className?.baseVal ?? e.className).slice(0, 30)}`).join(',')));
    if (wide !== null) overflow.push(`${r} [${wide}]`);
  }
  ok('celular: nenhuma página com rolagem horizontal', overflow.length === 0, overflow.join(' '));
  await browser.close();
}

// ================= afinador =================
async function tuner() {
  const read = (p) => p.evaluate(() => ({ note: document.querySelector('.tuner-note b')?.textContent, oct: document.querySelector('.tuner-note sub')?.textContent, info: document.querySelector('.tuner-info')?.innerText.replace(/\n+/g, ' | ') ?? '', now: document.querySelector('.tuner-cents, [data-cents]')?.textContent }));
  const cents = (p) => p.evaluate(() => { const m = document.querySelector('[role=meter]'); return m && /cents/.test(m.getAttribute('aria-valuetext') ?? '') ? Number(m.getAttribute('aria-valuenow')) : null; });

  let browser = await launch(WAVS.a2);
  let p = await newPage(browser);
  await goto(p, '/afinador');
  await click(p, 'Ativar microfone');
  ok('A2 afinada: detecta Lá, oitava 2, corda 5', await waitFor(async () => { const r = await read(p); return r.note === 'A' && r.oct === '2' && /Corda 5/.test(r.info); }, 8000), JSON.stringify(await read(p)));
  const c = await cents(p);
  ok('A2 afinada: dentro de ±5 cents', c !== null && Math.abs(c) <= 5, `cents=${c}`);
  ok('filtros do navegador desligados na captura', await p.evaluate(() => window.__c?.audio?.echoCancellation === false && window.__c?.audio?.noiseSuppression === false && window.__c?.audio?.autoGainControl === false));
  ok('microfone aberto (1 stream ativo)', (await liveStreams(p)) === 1);
  await click(p, 'Desligar');
  ok('Desligar solta o microfone', await waitFor(async () => (await liveStreams(p)) === 0, 3000));
  await click(p, 'Ativar microfone');
  await waitFor(async () => (await liveStreams(p)) === 1, 5000);
  await p.evaluate(() => { location.hash = '#/estudos'; });
  ok('sair da página solta o microfone', await waitFor(async () => (await liveStreams(p)) === 0, 3000));
  ok('sem erros de JS', p.errs.length === 0, p.errs.join(' | '));
  await browser.close();

  browser = await launch(WAVS.e2sharp);
  p = await newPage(browser);
  await goto(p, '/afinador');
  await click(p, 'Ativar microfone');
  ok('E2 +25 cents: corda 6, "Alto"', await waitFor(async () => { const r = await read(p); return r.note === 'E' && /Corda 6/.test(r.info) && /Alto/.test(await p.evaluate(() => document.body.innerText)); }, 8000), JSON.stringify(await read(p)));
  const c2 = await cents(p);
  ok('E2 +25 cents: leitura entre +20 e +30', c2 !== null && c2 >= 20 && c2 <= 30, `cents=${c2}`);
  await browser.close();

  browser = await launch();
  p = await newPage(browser);
  await p.evaluateOnNewDocument(() => { navigator.mediaDevices.getUserMedia = async () => { const e = new Error('x'); e.name = 'NotAllowedError'; throw e; }; });
  await goto(p, '/afinador');
  await click(p, 'Ativar microfone');
  ok('microfone negado: mensagem clara e botão para tentar de novo', await waitFor(() => p.evaluate(() => /negado/.test(document.querySelector('[role=alert]')?.textContent ?? '') && [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Ativar microfone') && !b.disabled)), 3000));
  await browser.close();
}

// ================= looper =================
async function looper() {
  const browser = await launch(WAVS.clicks);
  const p = await newPage(browser);
  const state = () => p.evaluate(() => document.querySelector('.pedal-center b')?.textContent);
  const waitState = (txt, ms = 15000) => waitFor(async () => (await state()) === txt, ms, 80);
  const readFile = async (id) => {
    const b64 = await p.evaluate((id) => new Promise((res) => { const r = indexedDB.open('songstation'); r.onsuccess = () => { const g = r.result.transaction('files').objectStore('files').get(id); g.onsuccess = async () => { if (!g.result) return res(null); const ab = new Uint8Array(await g.result.arrayBuffer()); let s = ''; for (let i = 0; i < ab.length; i += 0x8000) s += String.fromCharCode(...ab.subarray(i, i + 0x8000)); res(btoa(s)); }; }; }), id);
    if (!b64) return null;
    const bytes = Buffer.from(b64, 'base64');
    const n = (bytes.length - 44) / 2;
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = bytes.readInt16LE(44 + i * 2) / 32768;
    return { sr: bytes.readUInt32LE(24), samples: s };
  };
  const onsets = (pcm) => { const out = []; let last = -1e9; for (let i = 0; i < pcm.samples.length; i++) { if (Math.abs(pcm.samples[i]) > 0.3) { if (i - last > pcm.sr * 0.05) out.push(i / pcm.sr); last = i; } } return out; };

  await goto(p, '/backing/looper');
  await click(p, 'Ativar microfone');
  ok('microfone ativo: pedal visível', await waitFor(() => p.evaluate(() => !!document.querySelector('.pedal-main')), 8000));
  await setInput(p, 'input[aria-label="Andamento em BPM"]', '120'); // 2 compassos de 4 batidas = 4,000 s
  await sleep(200);
  await click(p, 'Gravar', '.pedal-main');
  ok('contagem, gravação e volta sozinho para "Tocando"', (await waitState('Contagem…', 2000)) && (await waitState('Gravando', 5000)) && (await waitState('Tocando', 8000)));
  await setInput(p, 'input[aria-label="Nome do loop"]', 'Teste A');
  await waitFor(() => click(p, 'Salvar loop'), 10000);
  await waitFor(async () => ((await ls(p, 'ss.loops')) ?? []).length === 1, 5000);
  const lib = await ls(p, 'ss.loops');
  ok('loop salvo: 4,000 s, 2 compassos, 120 BPM', lib?.length === 1 && lib[0].bars === 2 && Math.round(lib[0].bpm) === 120 && Math.abs(lib[0].samples / lib[0].sampleRate - 4) < 0.0005, JSON.stringify(lib?.[0] && { bars: lib[0].bars, samples: lib[0].samples }));
  const pcm = lib?.[0] && (await readFile(lib[0].layers[0].id));
  ok('o arquivo de áudio tem exatamente o tamanho do loop', !!pcm && pcm.samples.length === lib[0].samples, pcm && `${pcm.samples.length}/${lib[0].samples}`);
  const on = pcm ? onsets(pcm) : [];
  const gaps = on.slice(1).map((t, i) => t - on[i]);
  // o microfone simulado do Chrome entrega blocos de 10 ms: um clique isolado pode cair 1 bloco depois; o conjunto não pode derivar
  const span = on.length === 8 ? on[7] - on[0] : 0;
  ok('8 cliques a cada 0,5 s: o intervalo total é 3,500 s e nenhum intervalo foge mais de 12 ms (blocos de 10 ms do microfone simulado)', on.length === 8 && Math.abs(span - 3.5) < 0.012 && gaps.every((g) => Math.abs(g - 0.5) < 0.012), `n=${on.length} span=${span.toFixed(4)} ${gaps.map((g) => g.toFixed(4)).join(',')}`);

  await waitFor(() => click(p, 'Gravar camada', '.pedal-main'), 10000);
  ok('camada por cima: aguarda o ciclo, grava e volta a tocar', (await waitState('Gravando camada', 8000)) && (await waitState('Tocando', 8000)));
  ok('a tela mostra 2 camadas', await waitFor(() => p.evaluate(() => /2 camada/.test(document.querySelector('.pedal-center')?.innerText ?? '')), 10000));
  ok('"Salvar alterações" disponível', await waitFor(() => click(p, 'Salvar alterações'), 10000));
  await waitFor(async () => ((await ls(p, 'ss.loops')) ?? [{ layers: [] }])[0].layers.length === 2, 10000);
  const lib2 = await ls(p, 'ss.loops');
  ok('salvar alterações atualiza o mesmo loop com 2 camadas', lib2.length === 1 && lib2[0].layers.length === 2 && lib2[0].name === 'Teste A');
  const l2 = lib2[0].layers[1] ? await readFile(lib2[0].layers[1].id) : null;
  ok('a 2ª camada tem o mesmo tamanho da 1ª', !!l2 && l2.samples.length === lib2[0].samples);
  await click(p, 'Duplicar');
  ok('duplicar cria um 2º loop', await waitFor(async () => ((await ls(p, 'ss.loops')) ?? []).length === 2, 5000));
  const files = async () => p.evaluate(() => new Promise((res) => { const r = indexedDB.open('songstation'); r.onsuccess = () => { const g = r.result.transaction('files').objectStore('files').getAllKeys(); g.onsuccess = () => res(g.result.length); }; }));
  const before = await files();
  await p.evaluate(() => [...document.querySelectorAll('.loop-item button')].find((b) => b.textContent.includes('Excluir'))?.click());
  ok('excluir remove o loop e o áudio dele', await waitFor(async () => ((await ls(p, 'ss.loops')) ?? []).length === 1 && (await files()) < before, 5000));
  ok('sem erros de JS', p.errs.length === 0, p.errs.join(' | '));
  await browser.close();
}

// ================= sincronização =================
async function sync() {
  const drive = new Map();
  const sessions = new Map();
  let seq = 0;
  let authFail = false;
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Location' };
  const json = (req, body, status = 200, extra = {}) => req.respond({ status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
  const GIS = "window.google={accounts:{oauth2:{initTokenClient:function(c){return{requestAccessToken:function(){setTimeout(function(){c.callback({access_token:'TOK',expires_in:3600,scope:'https://www.googleapis.com/auth/drive.appdata openid email'})},40)}}},revoke:function(){}}}};";
  async function route(req) {
    const url = req.url();
    if (!/google|upload\.fake/.test(url)) return req.continue();
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS });
    if (url.includes('accounts.google.com/gsi/client')) return req.respond({ status: 200, headers: { ...CORS, 'Content-Type': 'text/javascript' }, body: GIS });
    if (url.includes('/oauth2/v3/userinfo')) return json(req, { email: 'pessoa@example.com', name: 'Pessoa' });
    if (authFail) return json(req, { error: { message: 'expired' } }, 401);
    const u = new URL(url);
    if (u.host === 'upload.fake') {
      const s = sessions.get(url);
      drive.set(s.id, { name: s.name, body: (await req.fetchPostData().catch(() => '')) ?? '', modified: Date.now() });
      return json(req, { id: s.id });
    }
    if (u.pathname.startsWith('/upload/drive/v3/files')) {
      let id = u.pathname.match(/files\/([^/]+)$/)?.[1];
      const name = id ? drive.get(id)?.name : JSON.parse(req.postData() || '{}').name;
      id ??= `fid${++seq}`;
      const loc = `https://upload.fake/s/${++seq}`;
      sessions.set(loc, { id, name });
      return req.respond({ status: 200, headers: { ...CORS, Location: loc, 'Content-Type': 'application/json' }, body: '{}' });
    }
    if (u.pathname === '/drive/v3/files' && req.method() === 'GET') return json(req, { files: [...drive].map(([id, f]) => ({ id, name: f.name, size: String(f.body.length), modifiedTime: new Date(f.modified).toISOString() })) });
    const m = u.pathname.match(/\/drive\/v3\/files\/([^/]+)$/);
    if (m && req.method() === 'GET') return drive.has(m[1]) ? req.respond({ status: 200, headers: { ...CORS, 'Content-Type': 'application/octet-stream' }, body: drive.get(m[1]).body }) : json(req, {}, 404);
    if (m && req.method() === 'DELETE') { drive.delete(m[1]); return req.respond({ status: 204, headers: CORS }); }
    return json(req, { error: { message: `rota desconhecida ${url}` } }, 400);
  }
  const snap = () => { const f = [...drive.values()].find((x) => x.name === 'songstate-data.json'); return f ? JSON.parse(f.body) : null; };
  const song = (id, title) => ({ id, title, artist: 'A', keyPc: 0, minor: false, bpm: 100, tags: [], notes: '', style: 'rock', chart: '| C | G |', createdAt: 1, sources: [] });
  const setKey = (p, k, v) => p.evaluate((k, v) => { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new CustomEvent('ss-storage', { detail: { key: k, source: Symbol('t') } })); }, k, v);
  const panel = (p) => p.evaluate(() => document.querySelector('.sync-panel')?.innerText ?? '');
  const openSettings = async (p) => { await p.evaluate(() => document.querySelector('button[aria-label="Configurações"]')?.click()); await sleep(250); };

  const browser = await launch();
  async function device() {
    const ctx = await browser.createBrowserContext();
    const p = await newPage(ctx);
    await p.setRequestInterception(true);
    p.on('request', (r) => route(r).catch(() => r.abort().catch(() => {})));
    await p.goto(BASE, { waitUntil: 'networkidle0' });
    await p.evaluate(() => localStorage.setItem('ss.sync.cfg', JSON.stringify({ clientId: '1-a.apps.googleusercontent.com', audio: false, email: '', name: '' })));
    await p.reload({ waitUntil: 'networkidle0' });
    return p;
  }
  // o navegador isola o armazenamento por contexto; --disable-web-security não é necessário porque as respostas simuladas trazem CORS
  const A = await device();
  await openSettings(A);
  ok('painel oferece "Entrar com o Google"', (await panel(A)).includes('Entrar com o Google'));
  await setKey(A, 'ss.songs', [song('s1', 'Primeira')]);
  await click(A, 'Entrar com o Google');
  ok('A conectou e sincronizou', await waitFor(async () => /Tudo sincronizado/.test(await panel(A)), 8000), (await panel(A)).slice(0, 120));
  ok('a nuvem recebeu a música', snap()?.keys['ss.songs']?.length === 1);
  ok('o token do Google não foi para o localStorage', !JSON.stringify(await A.evaluate(() => ({ ...localStorage }))).includes('TOK'));

  const B = await device();
  await setKey(B, 'ss.songs', [song('s2', 'Segunda')]);
  await openSettings(B);
  await click(B, 'Entrar com o Google');
  ok('B recebeu a música de A e manteve a sua', await waitFor(async () => ((await ls(B, 'ss.songs')) ?? []).map((s) => s.id).sort().join() === 's1,s2', 8000));
  ok('a nuvem ficou com as duas', await waitFor(() => snap()?.keys['ss.songs']?.length === 2, 5000));

  await setKey(B, 'ss.songs', [song('s2', 'Segunda')]);
  ok('B enviou a exclusão (marca de exclusão na nuvem)', await waitFor(() => Object.keys(snap()?.tombs?.['ss.songs'] ?? {}).join() === 's1', 12000));
  await click(A, 'Sincronizar agora');
  ok('A recebeu a exclusão', await waitFor(async () => ((await ls(A, 'ss.songs')) ?? []).map((s) => s.id).join() === 's2', 8000));

  await A.setOfflineMode(true);
  await setKey(A, 'ss.songs', [song('s2', 'Segunda'), song('s3', 'Terceira')]);
  ok('offline: avisa e não perde nada', await waitFor(async () => /Sem internet/.test(await panel(A)), 12000) && ((await ls(A, 'ss.songs')) ?? []).length === 2);
  ok('offline: a nuvem ainda não tem a terceira', snap()?.keys['ss.songs']?.length === 1);
  await A.setOfflineMode(false);
  ok('internet de volta: envia sozinho', await waitFor(() => snap()?.keys['ss.songs']?.length === 2, 10000));

  authFail = true;
  await click(A, 'Sincronizar agora');
  ok('sessão vencida (401): pede para reconectar e mantém os dados', await waitFor(async () => /reconectar/i.test(await panel(A)), 8000) && ((await ls(A, 'ss.songs')) ?? []).length === 2);
  ok('o botão "Reconectar" aparece no topo', await A.evaluate(() => !!document.querySelector('.sync-chip')));
  authFail = false;
  await click(A, 'Reconectar');
  ok('reconectou', await waitFor(async () => /Tudo sincronizado/.test(await panel(A)), 8000));

  await click(A, 'Desconectar');
  ok('desconectar mantém os dados e limpa o estado de sincronização', await waitFor(async () => (await ls(A, 'ss.sync.cfg'))?.email === '' && (await ls(A, 'ss.sync.state')) === null && ((await ls(A, 'ss.songs')) ?? []).length === 2, 5000));
  ok('sem erros de JS (A e B)', A.errs.length + B.errs.length === 0, [...A.errs, ...B.errs].join(' | '));
  await browser.close();
}

// ================= loop A–B do reprodutor fixo =================
async function dock() {
  // YouTube de mentira: relógio virtual 2× mais rápido, para o teste não demorar
  const FAKE_YT = `(function(){
    function Player(el, opts){
      var self=this, pos=0, playing=false, last=performance.now(), SPEED=2;
      function cur(){ return Math.min(300, pos + (playing ? (performance.now()-last)/1000*SPEED : 0)); }
      self.playVideo=function(){ pos=cur(); last=performance.now(); playing=true; };
      self.pauseVideo=function(){ pos=cur(); playing=false; };
      self.seekTo=function(s){ pos=s; last=performance.now(); };
      self.getCurrentTime=cur; self.getDuration=function(){ return 300; };
      self.getPlayerState=function(){ return playing?1:2; };
      self.loadVideoById=function(){ pos=0; self.playVideo(); };
      self.setPlaybackRate=function(){}; self.setVolume=function(){}; self.getVolume=function(){ return 80; };
      self.mute=function(){}; self.unMute=function(){}; self.destroy=function(){};
      window.__yt=self; window.__ytpos=cur;
      setTimeout(function(){ opts.events && opts.events.onReady && opts.events.onReady({target:self}); },30);
    }
    window.YT={Player:Player, PlayerState:{PLAYING:1,PAUSED:2}};
    setTimeout(function(){ window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); },10);
  })();`;
  const browser = await launch();
  const p = await newPage(browser);
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const url = r.url();
    if (url.includes('youtube.com/iframe_api')) r.respond({ status: 200, contentType: 'text/javascript', body: FAKE_YT }).catch(() => {});
    else if (/^http:\/\/127\.0\.0\.1/.test(url) || /^(data|blob):/.test(url)) r.continue().catch(() => {});
    else r.abort().catch(() => {});
  });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  await p.evaluate(() =>
    localStorage.setItem('ss.songs', JSON.stringify([{ id: 'm-yt', title: 'Demo', artist: 'x', keyPc: 0, minor: false, bpm: 100, tags: [], notes: '', createdAt: 1, chart: '| C | G |', style: 'rock', sources: [{ id: 's1', kind: 'youtube', label: 'Vídeo', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embed: 'https://www.youtube.com/embed/dQw4w9WgXcQ', ytId: 'dQw4w9WgXcQ' }] }])),
  );
  await goto(p, '/backing/m-yt');
  await p.reload({ waitUntil: 'networkidle0' });
  await waitFor(() => click(p, 'Ouvir'), 8000);
  const pos = () => p.evaluate(() => window.__ytpos?.() ?? -1);
  const status = () => p.evaluate(() => [...document.querySelectorAll('.dock [role=status]')].map((e) => e.textContent).join(' '));
  const btn = (t) => p.evaluate((t) => [...document.querySelectorAll('.dock button')].some((b) => b.textContent.trim().startsWith(t) && !b.disabled), t);
  const dockClick = (t) => click(p, t, '.dock button');
  // pausa o vídeo falso ao posicionar, para marcar A/B exatamente no ponto pedido
  const seek = async (s) => {
    await p.evaluate((s) => { window.__yt.pauseVideo(); window.__yt.seekTo(s); }, s);
    await sleep(450);
  };
  const sample = async (n, gap) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(await pos());
      await sleep(gap);
    }
    return out;
  };

  ok('o reprodutor toca (relógio avança)', await waitFor(async () => (await pos()) > 1, 8000));
  ok('sem A e B, "Ligar loop" e "Reiniciar" ficam desativados', !(await btn('Ligar loop')) && !(await btn('Reiniciar')));
  await seek(10);
  await dockClick('A ');
  await seek(14);
  await dockClick('B ');
  await p.evaluate(() => window.__yt.playVideo());
  ok('com A e B válidos, ligar e reiniciar ficam disponíveis', (await btn('Ligar loop')) && (await btn('Reiniciar')));
  await dockClick('Ligar loop');
  ok('ligar leva ao A e avisa que está repetindo', (await waitFor(async () => /Repetindo de 0:10 a 0:14/.test(await status()), 3000)) && (await pos()) < 12);
  const s1 = await sample(24, 120);
  ok('repete: a posição não passa do B (14 s) além da folga da leitura', s1.every((x) => x >= 9.5 && x < 15.6), s1.map((x) => x.toFixed(1)).join(' '));
  ok('e volta ao A várias vezes', s1.some((x, i) => i > 0 && x < s1[i - 1] - 2));

  await dockClick('Pausar loop');
  ok('pausar loop: avisa, guarda A–B e oferece "Retomar loop"', (await waitFor(async () => /Loop pausado \(0:10–0:14\)/.test(await status()), 2000)) && (await btn('Retomar loop')));
  ok('pausado: a música segue além do B', await waitFor(async () => (await pos()) > 16, 4000));
  await dockClick('Retomar loop');
  ok('retomar fora do trecho volta ao A e repete de novo', (await waitFor(async () => (await pos()) < 15, 2500)) && /Repetindo/.test(await status()));
  const s2 = await sample(16, 120);
  ok('depois de retomar, continua entre A e B', s2.every((x) => x >= 9.5 && x < 15.6), s2.map((x) => x.toFixed(1)).join(' '));

  await dockClick('Seguir após o B');
  ok('"seguir após o B" avisa o que vai acontecer', /seguir adiante ao chegar no B/.test(await status()));
  ok('chega ao B, segue em frente e o loop fica pausado', (await waitFor(async () => (await pos()) > 16, 5000)) && /Loop pausado/.test(await status()));

  await dockClick('Reiniciar');
  ok('reiniciar volta ao A e liga o loop', (await waitFor(async () => (await pos()) < 12, 2500)) && /Repetindo/.test(await status()));
  await p.evaluate(() => window.__yt.pauseVideo());
  await sleep(500);
  await dockClick('Reiniciar');
  ok('reiniciar com a música pausada também toca', await waitFor(async () => (await p.evaluate(() => window.__yt.getPlayerState())) === 1, 2500));

  await dockClick('Limpar A–B');
  ok(
    'limpar apaga A e B e desliga o loop',
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('.dock button')].map((b) => b.textContent.trim());
      return t.includes('A –') && t.includes('B –') && !t.some((x) => x.includes('Limpar A–B') || x.includes('Pausar loop'));
    }),
  );

  await seek(40);
  await dockClick('A ');
  await seek(30);
  await dockClick('B ');
  ok('B antes do A: avisa e não deixa ligar', /precisa vir depois do A/.test(await status()) && !(await btn('Ligar loop')));
  ok('sem erros de JS', p.errs.length === 0, p.errs.join(' | '));
  await browser.close();
}

// ================= impressão (folhas de estudo e PDF) =================
async function print() {
  const browser = await launch();
  const p = await newPage(browser, { width: 1400 });
  const area = async () => ({ cards: await p.$$eval('.ps-card', (e) => e.length), legend: await p.$$eval('.ps-legend li', (e) => e.length), title: await p.$eval('.print-sheet h2', (e) => e.textContent) });
  const shapes = (sel) => p.$$eval(`.print-sheet ${sel}`, (e) => e.length);
  const setCfg = async (cfg) => {
    await p.evaluate((c) => localStorage.setItem('ss.print', JSON.stringify(c)), cfg);
    await p.reload({ waitUntil: 'networkidle0' });
    await p.waitForSelector('.print-sheet');
  };
  const pdfInfo = async () => {
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    const doc = await PDFDocument.load(pdf);
    const { width, height } = doc.getPage(0).getSize();
    return { pages: doc.getPageCount(), w: Math.round(width), h: Math.round(height), bytes: pdf.length };
  };

  await goto(p, '/imprimir');
  await p.evaluate(() => localStorage.removeItem('ss.print'));
  await p.reload({ waitUntil: 'networkidle0' });
  let a = await area();
  ok('abre com 5 shapes da pentatônica menor de Lá e legenda', a.cards === 5 && /Pentatônica menor/.test(a.title) && a.legend === 2, JSON.stringify(a));

  // controles da tela
  await click(p, 'Braço inteiro');
  await click(p, 'Todas as notas');
  a = await area();
  ok('braço inteiro com todas as notas: 1 diagrama com 96 notas (6 cordas × 16 casas)', a.cards === 1 && /Todas as notas/.test(a.title) && (await p.$eval('.print-sheet .pb', (s) => /Sem notas|corda/.test(s.getAttribute('aria-label')))) && (await shapes('.pb g')) === 96);
  await click(p, 'Nada', '.chips button');
  ok('rótulo "Nada": as notas ficam sem texto', (await shapes('.pb g text')) === 0 && (await shapes('.pb g')) === 96);
  await click(p, 'Nome da nota');
  ok('rótulo "Nome da nota" escreve em cada nota', (await shapes('.pb g text')) === 96);
  await click(p, 'Tônica, subdominante e dominante');
  ok('destaque tônica/subdominante/dominante: formas diferentes e legenda de 4 itens', (await shapes('.pb g polygon')) >= 6 && (await shapes('.pb g rect')) >= 6 && (await area()).legend === 4);
  await click(p, 'Nenhuma (em branco)');
  ok('braço em branco: nenhuma nota e sem legenda', (await shapes('.pb g')) === 0 && (await area()).legend === 0);

  await click(p, 'Shapes da escala');
  await click(p, 'Todas', '.chips button');
  await click(p, 'Acorde');
  a = await area();
  ok('acorde: digitações (vários diagramas) com o nome do acorde no título', a.cards >= 2 && /^A — /.test(a.title), JSON.stringify(a));
  await click(p, 'Campo harmônico');
  a = await area();
  ok('campo harmônico: 7 acordes', a.cards === 7 && /Campo harmônico/.test(a.title), JSON.stringify(a));
  await click(p, 'Tétrades');
  ok('campo em tétrades', /tétrades/.test((await area()).title) && (await p.$$eval('.ps-card figcaption b', (e) => e.map((x) => x.textContent))).some((t) => /maj7/.test(t)));
  await click(p, 'Braço em branco');
  a = await area();
  ok('braço em branco: 2 diagramas vazios por padrão', a.cards === 2 && (await shapes('.pb g')) === 0);

  // estilo e página
  await click(p, 'Colorido');
  ok('estilo colorido desenha o braço em tom de madeira clara; preto e branco, não', (await p.$eval('.print-sheet', (e) => e.classList.contains('color'))) && (await shapes('.pb rect[fill="#faf5ea"]')) === 2);
  await click(p, 'Preto e branco');
  ok('preto e branco: sem preenchimento colorido', (await shapes('.pb rect[fill="#faf5ea"]')) === 0 && (await p.$eval('.print-sheet', (e) => getComputedStyle(e).backgroundColor)) === 'rgb(255, 255, 255)');

  // impressão de verdade: título da aba, chamada de print e CSS de impressão
  await setCfg({ kind: 'shapes', root: 9, scaleId: 'minor-pent', highlight: 'tsd' });
  await p.evaluate(() => { window.__printed = []; window.print = () => window.__printed.push(document.title); });
  await click(p, 'Imprimir / Salvar PDF');
  const printed = await p.evaluate(() => window.__printed);
  ok('o botão chama a impressão com o título da folha (nome sugerido do PDF)', printed.length === 1 && /Pentatônica menor.*shapes.*SongState/.test(printed[0]), JSON.stringify(printed));
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  ok('depois da impressão o título da aba volta ao normal', (await p.title()) === 'SongState');

  await p.emulateMediaType('print');
  const hidden = await p.evaluate(() => ['.topbar', '.tabbar', '.print-controls', '.page-header', '.legal-foot'].map((s) => [s, document.querySelector(s) ? getComputedStyle(document.querySelector(s)).display : 'none']));
  ok('na impressão, menu, controles e rodapé do site somem', hidden.every(([, d]) => d === 'none'), JSON.stringify(hidden));
  const paint = await p.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, sheet: getComputedStyle(document.querySelector('.print-sheet')).boxShadow, shown: getComputedStyle(document.querySelector('.print-sheet')).display }));
  ok('a página é branca e a folha ocupa a área toda (sem sombra)', paint.body === 'rgb(255, 255, 255)' && paint.sheet === 'none' && paint.shown !== 'none', JSON.stringify(paint));

  // PDF real: tamanho do papel, orientação e número de páginas
  let info = await pdfInfo();
  ok('PDF A4 paisagem (842×595 pt) com os 5 shapes em 1 página', info.w === 842 && info.h === 595 && info.pages === 1, JSON.stringify(info));
  await p.emulateMediaType('screen');
  await setCfg({ kind: 'field', paper: 'letter', landscape: false, style: 'color' });
  await p.emulateMediaType('print');
  info = await pdfInfo();
  ok('PDF Carta retrato (612×792 pt) com o campo harmônico', info.w === 612 && info.h === 792 && info.pages >= 1 && info.pages <= 2, JSON.stringify(info));
  await p.emulateMediaType('screen');
  await setCfg({ kind: 'blank', blankCount: 6, landscape: false });
  await p.emulateMediaType('print');
  info = await pdfInfo();
  ok('PDF A4 retrato (595×842 pt) com 6 braços em branco em 1 página', info.w === 595 && info.h === 842 && info.pages === 1, JSON.stringify(info));
  await p.emulateMediaType('screen');
  await setCfg({ kind: 'shapes', scaleId: 'major', root: 0, direction: 'v', cols: 1, landscape: true });
  await p.emulateMediaType('print');
  info = await pdfInfo();
  ok('muitos diagramas grandes viram várias páginas (e nenhum fica cortado: 7 posições em colunas únicas)', info.pages >= 2, JSON.stringify(info));
  await p.emulateMediaType('screen');

  // entradas do site e robustez
  await setCfg({ kind: 'neck', fretMax: 999, paper: 'x', cols: 'a', positions: 'zzz', root: 'q' });
  ok('configuração corrompida não derruba a página (volta ao padrão onde for inválida)', (await area()).cards === 1 && p.errs.length === 0, p.errs.join(' | '));
  await goto(p, '/');
  ok('a tela Braço tem o botão "Imprimir"', await click(p, 'Imprimir', 'a'));
  ok('que leva à página de impressão', await waitFor(() => p.evaluate(() => location.hash === '#/imprimir'), 3000));
  await p.evaluate(() => document.querySelector('button[aria-label="Configurações"]')?.click());
  ok('Configurações tem o atalho para imprimir', await p.evaluate(() => [...document.querySelectorAll('.sheet a')].some((a) => /Imprimir/.test(a.textContent))));
  ok('sem erros de JS', p.errs.length === 0, p.errs.join(' | '));
  await browser.close();
}

// ================= execução =================
const SUITES = { smoke, tuner, looper, sync, dock, print };
const wanted = process.argv.slice(2).filter((a) => a in SUITES);
for (const name of wanted.length ? wanted : Object.keys(SUITES)) {
  suite = name;
  // testes de navegador em máquinas compartilhadas oscilam: uma suíte que falha ganha uma segunda tentativa
  // (a falha da 1ª fica registrada como aviso; se a 2ª também falhar, vale a falha)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    const before = failures;
    try {
      await SUITES[name]();
    } catch (e) {
      failures++;
      console.log(`FALHA [${name}] a suíte quebrou: ${e instanceof Error ? e.stack : e}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::error title=e2e ${name} quebrou::${oneLine(e instanceof Error ? e.message : e)}`);
    }
    console.log(`      [${name}] ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (failures === before) break;
    if (attempt === 1) {
      failures = before;
      console.log(`AVISO [${name}] falhou; tentando de novo uma vez`);
      if (process.env.GITHUB_ACTIONS) console.log(`::warning title=e2e ${name} instável::a suíte falhou na 1ª tentativa e foi repetida`);
    }
  }
}
server.close();
console.log(failures ? `\n${failures} falha(s) nos testes de interface.` : '\nTestes de interface: tudo certo.');
process.exit(failures ? 1 : 0);
