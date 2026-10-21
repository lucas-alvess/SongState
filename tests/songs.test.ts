import { describe, expect, it } from 'vitest';
import { parseLink, safeEmbedUrl, safeHref, sanitizeSong } from '../src/lib/songs';

describe('links de músicas', () => {
  it('reconhece Spotify e YouTube', () => {
    expect(parseLink('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc', 'a')).toMatchObject({ kind: 'spotify', uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC' });
    expect(parseLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'a')).toMatchObject({ kind: 'youtube', ytId: 'dQw4w9WgXcQ' });
    expect(parseLink('https://youtu.be/dQw4w9WgXcQ', 'a')).toMatchObject({ kind: 'youtube', ytId: 'dQw4w9WgXcQ' });
    expect(parseLink('   ', 'a')).toBeNull();
  });
});

describe('segurança de URLs', () => {
  it('só aceita iframes de hosts conhecidos e https', () => {
    expect(safeEmbedUrl('https://open.spotify.com/embed/track/abc')).toBeTruthy();
    expect(safeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBeTruthy();
    expect(safeEmbedUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeEmbedUrl('https://evil.example.com/embed/x')).toBeUndefined();
    expect(safeEmbedUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeEmbedUrl(undefined)).toBeUndefined();
  });

  it('safeHref bloqueia esquemas perigosos', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('JaVaScRiPt:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html;base64,AAAA')).toBeUndefined();
  });
});

describe('importação de músicas (sanitizeSong)', () => {
  it('descarta lixo e entradas inválidas', () => {
    expect(sanitizeSong(null)).toBeNull();
    expect(sanitizeSong('texto')).toBeNull();
    expect(sanitizeSong({})).toBeNull();
    expect(sanitizeSong({ id: 'x' })).toBeNull(); // sem título
  });

  it('limita tamanhos, normaliza o id e ignora campos desconhecidos', () => {
    const s = sanitizeSong({ id: 'a b<c>', title: 'T'.repeat(500), bpm: 9999, keyPc: 99, evil: '<script>', sources: 'nope', tags: ['a', '', 5] })!;
    expect(s.id).toBe('abc');
    expect(s.title.length).toBe(200);
    expect(s.bpm).toBe(300);
    expect(s.keyPc).toBeNull();
    expect(s.sources).toEqual([]);
    expect(s).not.toHaveProperty('evil');
  });

  it('fontes com javascript: ou iframes arbitrários são recusadas', () => {
    const s = sanitizeSong({
      id: 'm1',
      title: 'Teste',
      sources: [
        { url: 'javascript:alert(1)', id: 's1' },
        { url: 'https://example.com/ok', id: 's2', embed: 'javascript:alert(2)' },
        { kind: 'file', fileId: 'abc', url: '' },
      ],
    })!;
    for (const src of s.sources) {
      expect(src.embed === undefined || safeEmbedUrl(src.embed) !== undefined).toBe(true);
      expect(src.url?.toLowerCase().startsWith('javascript:')).not.toBe(true);
    }
    expect(s.sources.some((x) => x.kind === 'file')).toBe(false);
  });
});
