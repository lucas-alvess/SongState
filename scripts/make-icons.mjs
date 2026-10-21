/**
 * Gera todos os ícones do SongState a partir de public/icons/guitar-neon-icon.png:
 *   icon-512.png, icon-192.png (cantos transparentes), maskable-512.png (Android, arte reduzida para a zona segura),
 *   apple-touch-icon.png (iOS, opaco), favicon-32.png / logo-96.png / favicon.svg (recorte só da guitarra),
 *   icon.svg (a arte completa embutida — é uma imagem raster dentro de um SVG, não uma vetorização).
 *
 * Uso (o sharp não é dependência do projeto, instale só para gerar):
 *   npm install --no-save sharp
 *   node scripts/make-icons.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../public', import.meta.url)).replace(/\\/g, '/');
const SRC = `${ROOT}/icons/guitar-neon-icon.png`;
const OUT = `${ROOT}/icons`;

// ---------- 1) máscara do ícone: o que está FORA do quadrado arredondado é preto puro ----------
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const dark = (i) => data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2] < 22; // quase preto
const outside = new Uint8Array(W * H);
// preenchimento por inundação a partir dos 4 cantos (só atravessa pixels quase pretos)
const stack = [0, W - 1, (H - 1) * W, H * W - 1].filter(dark);
stack.forEach((i) => (outside[i] = 1));
while (stack.length) {
  const i = stack.pop();
  const x = i % W;
  const y = (i / W) | 0;
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const j = ny * W + nx;
    if (!outside[j] && dark(j)) {
      outside[j] = 1;
      stack.push(j);
    }
  }
}
let minX = W, minY = H, maxX = 0, maxY = 0, inside = 0;
for (let i = 0; i < W * H; i++) {
  if (outside[i]) continue;
  inside++;
  const x = i % W, y = (i / W) | 0;
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
console.log(`ícone ocupa x ${minX}..${maxX}, y ${minY}..${maxY} (${maxX - minX + 1}x${maxY - minY + 1}); área dentro = ${(inside / (W * H) * 100).toFixed(1)}% da imagem`);

// alpha suavizado (anti-aliasing da borda)
const alphaRaw = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) alphaRaw[i] = outside[i] ? 0 : 255;
const alphaOut = await sharp(alphaRaw, { raw: { width: W, height: H, channels: 1 } }).blur(1.1).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
if (alphaOut.info.channels !== 1 || alphaOut.data.length !== W * H) throw new Error('alpha com formato inesperado: ' + alphaOut.info.channels + ' canais');
const alpha = alphaOut.data;
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = data[i * 4];
  rgba[i * 4 + 1] = data[i * 4 + 1];
  rgba[i * 4 + 2] = data[i * 4 + 2];
  rgba[i * 4 + 3] = alpha[i];
}
// O braço da guitarra ultrapassa o topo do quadrado arredondado (efeito do design): preservamos isso.
// Corpo do ícone = x 26..1227, y 26..1227 (1202 px). O braço sobe até y=0.
const BODY = 1202;
const BX = 26;
const BY = 26;
const rgbaImg = () => sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
// (a) arte completa: corpo centrado numa tela com margem, braço sobressaindo no topo
const C = 1260;
const padL = Math.round((C - BODY) / 2);
const neck = await rgbaImg().extract({ left: BX, top: 0, width: BODY, height: BODY + BY }).png().toBuffer();
const master = await sharp({ create: { width: C, height: C, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: neck, left: padL, top: padL - BY }])
  .png()
  .toBuffer();
// (b) só o corpo (sem o braço sobressalente): para o ícone opaco do iOS
const body = await rgbaImg().extract({ left: BX, top: BY, width: BODY, height: BODY }).png().toBuffer();
console.log('arte completa:', C, 'px | corpo:', BODY, 'px');

const resize = (buf, n, sharpen) => {
  let s = sharp(buf).resize(n, n, { kernel: 'lanczos3', fit: 'fill' });
  if (sharpen) s = s.sharpen({ sigma: sharpen });
  return s;
};

// ---------- 2) cor do fundo escuro do ícone (para áreas opacas / maskable) ----------
const BG = { r: 3, g: 5, b: 30 };

// ---------- 3) saídas ----------
await resize(master, 512).png({ compressionLevel: 9 }).toFile(`${OUT}/icon-512.png`);
await resize(master, 192, 0.5).png({ compressionLevel: 9 }).toFile(`${OUT}/icon-192.png`);

// iOS: opaco (sem transparência); o sistema aplica o arredondamento
await resize(body, 180, 0.5).flatten({ background: BG }).png({ compressionLevel: 9 }).toFile(`${OUT}/apple-touch-icon.png`);

// maskable (Android): fundo cheio e a arte reduzida para caber no círculo de segurança (raio = 40% da largura)
const MASK = 512;
const art = Math.round(MASK * 0.78);
const artBuf = await resize(master, art, 0.4).png().toBuffer();
await sharp({ create: { width: MASK, height: MASK, channels: 3, background: BG } })
  .composite([{ input: artBuf, left: Math.round((MASK - art) / 2), top: Math.round((MASK - art) / 2) }])
  .png({ compressionLevel: 9 })
  .toFile(`${OUT}/maskable-512.png`);

// pequenos (favicon e logo do cabeçalho): recorte só da guitarra — o texto "SongState" não é legível a 16-32 px
const CROP = { left: 227, top: 26, width: 800, height: 800 };
const cropRaw = await sharp(SRC).extract(CROP).png().toBuffer();
const rounded = (n) => Buffer.from(`<svg width="${n}" height="${n}"><rect width="${n}" height="${n}" rx="${n * 0.2237}"/></svg>`);
const tile = async (n, sharpen) => {
  const img = await sharp(cropRaw).resize(n, n, { kernel: 'lanczos3' }).sharpen({ sigma: sharpen }).ensureAlpha().png().toBuffer();
  return sharp(img).composite([{ input: rounded(n), blend: 'dest-in' }]).png({ compressionLevel: 9 });
};
await (await tile(32, 0.6)).toFile(`${OUT}/favicon-32.png`);
await (await tile(96, 0.4)).toFile(`${OUT}/logo-96.png`);
const favicon256 = await (await tile(128, 0.4)).toBuffer();

// SVG: envelopa o PNG (256 px) — é uma imagem raster dentro de um SVG, não uma vetorização
const png256 = await resize(master, 256, 0.4).png({ compressionLevel: 9 }).toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" width="256" height="256"><title>SongState</title><image width="256" height="256" xlink:href="data:image/png;base64,${png256.toString('base64')}"/></svg>\n`;
fs.writeFileSync(`${OUT}/icon.svg`, svg);
fs.writeFileSync(`${ROOT}/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" width="256" height="256"><title>SongState</title><image width="256" height="256" xlink:href="data:image/png;base64,${favicon256.toString('base64')}"/></svg>
`);

console.log('favicon.svg'.padEnd(22), (fs.statSync(`${ROOT}/favicon.svg`).size / 1024).toFixed(1) + ' KB');
for (const f of ['icon-512.png', 'icon-192.png', 'apple-touch-icon.png', 'maskable-512.png', 'favicon-32.png', 'logo-96.png', 'icon.svg']) {
  console.log(f.padEnd(22), (fs.statSync(`${OUT}/${f}`).size / 1024).toFixed(1) + ' KB');
}
