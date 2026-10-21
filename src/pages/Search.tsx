import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Integrations } from '../components/Integrations';
import { Chips, Toggle } from '../components/ui';
import { BUILTIN_SONGS } from '../lib/library';
import { sourceFromTrack, usePlayer, type Track } from '../lib/player';
import { parseLink, type Song } from '../lib/songs';
import { spotifyOembed, spotifySearch, useSpotifyConnected } from '../lib/spotify';
import { uid, useIntegrations, useLocalStorage, useStoredList } from '../lib/storage';
import { explainYoutubeError, youtubeOembed, youtubeSearch, youtubeThumb } from '../lib/youtube';

type Provider = 'youtube' | 'spotify';

export function Search() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { play, track: playing } = usePlayer();
  const [cfg] = useIntegrations();
  const connected = useSpotifyConnected();
  const [songs, setSongs] = useStoredList<Song>('ss.songs');
  const [prefs, setPrefs] = useLocalStorage<{ provider: Provider; addBacking: boolean }>('ss.search', { provider: 'youtube', addBacking: true });

  const songId = params.get('song');
  const target = useMemo(() => (songId ? (songs.find((s) => s.id === songId) ?? BUILTIN_SONGS.find((s) => s.id === songId)) : undefined), [songId, songs]);

  const [q, setQ] = useState(params.get('q') ?? '');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => sessionStorage.getItem('ss.spotify.error'));
  const [link, setLink] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    sessionStorage.removeItem('ss.spotify.error');
  }, []);

  const ready = prefs.provider === 'youtube' ? !!cfg.youtubeKey : connected;

  const search = useCallback(
    async (text: string, provider: Provider = prefs.provider) => {
      const query = text.trim();
      if (!query) return;
      setLoading(true);
      setError(null);
      setResults([]);
      try {
        if (provider === 'youtube') {
          const r = await youtubeSearch(prefs.addBacking && !/backing|base|playback|karaok/i.test(query) ? `${query} backing track` : query, cfg.youtubeKey);
          setResults(r.map((x) => ({ provider: 'youtube', id: x.id, title: x.title, artist: x.channel, thumb: x.thumb })));
        } else {
          const r = await spotifySearch(query);
          setResults(r.map((x) => ({ provider: 'spotify', id: x.id, uri: x.uri, title: x.title, artist: x.subtitle, thumb: x.thumb })));
        }
      } catch (e) {
        const msg = (e as Error).message;
        setError(provider === 'youtube' ? explainYoutubeError(msg, window.location.origin) : msg);
      } finally {
        setLoading(false);
      }
    },
    [prefs.provider, prefs.addBacking, cfg.youtubeKey],
  );

  // busca automática quando chega com ?q= (vinda da página de uma música)
  useEffect(() => {
    const initial = params.get('q');
    if (initial && ready) void search(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const playLink = async () => {
    const src = parseLink(link, uid());
    setError(null);
    if (src?.kind === 'youtube' && src.ytId) {
      const info = await youtubeOembed(src.url!);
      play({ provider: 'youtube', id: src.ytId, title: info?.title ?? 'Vídeo do YouTube', artist: info?.author, thumb: youtubeThumb(src.ytId) });
      setLink('');
    } else if (src?.kind === 'spotify' && src.uri) {
      const info = await spotifyOembed(src.url!);
      play({ provider: 'spotify', id: src.uri.split(':')[2], uri: src.uri, title: info?.title ?? 'Spotify', thumb: info?.thumb });
      setLink('');
    } else setError('Cole um link de vídeo do YouTube ou de faixa/playlist do Spotify.');
  };

  const attach = (t: Track) => {
    const source = sourceFromTrack(t);
    if (target) {
      if (target.builtin) {
        const copy: Song = { ...target, id: uid(), builtin: false, createdAt: Date.now(), sources: [source] };
        setSongs((l) => [...l, copy]);
        nav(`/backing/${copy.id}`);
      } else {
        setSongs((l) => l.map((s) => (s.id === target.id ? { ...s, sources: [...s.sources, source] } : s)));
        nav(`/backing/${target.id}`);
      }
      return;
    }
    const song: Song = { id: uid(), title: t.title, artist: t.provider === 'youtube' ? '' : (t.artist ?? '').split(' · ')[0], keyPc: null, minor: false, bpm: null, style: 'rock', chart: '', tags: [], notes: '', sources: [source], createdAt: Date.now() };
    setSongs((l) => [...l, song]);
    setAdded((a) => new Set(a).add(`${t.provider}:${t.id}`));
  };

  return (
    <>
      {target && (
        <div className="panel banner">
          Escolha o áudio para <b>{target.title}</b>. Ele será adicionado à música. <Link to={`/backing/${target.id}`}>Cancelar</Link>
        </div>
      )}

      <section className="panel">
        <div className="search-top">
          <Chips
            value={prefs.provider}
            onChange={(provider) => {
              setPrefs({ ...prefs, provider });
              setResults([]);
              setError(null);
            }}
            options={[
              { value: 'youtube', label: 'YouTube' },
              { value: 'spotify', label: 'Spotify' },
            ]}
          />
          {prefs.provider === 'youtube' && <Toggle label='Procurar "backing track"' checked={prefs.addBacking} onChange={(addBacking) => setPrefs({ ...prefs, addBacking })} />}
        </div>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setParams(q ? { q, ...(songId ? { song: songId } : {}) } : {}, { replace: true });
            void search(q);
          }}
        >
          <input className="search" placeholder={prefs.provider === 'youtube' ? 'Ex.: Hotel California backing track Bm' : 'Ex.: nome da música ou artista'} value={q} onChange={(e) => setQ(e.target.value)} disabled={!ready} />
          <button type="submit" className="btn primary" disabled={!ready || !q.trim() || loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {!ready && (
          <div className="form-warn">
            {prefs.provider === 'youtube' ? 'Para buscar no YouTube, informe sua chave de API abaixo.' : 'Para buscar e tocar no Spotify, informe o Client ID e conecte sua conta abaixo.'} Você também pode colar um link direto aqui.
          </div>
        )}

        <div className="search-form" style={{ marginTop: 10 }}>
          <input className="search" placeholder="Ou cole um link do YouTube / Spotify" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && link && void playLink()} />
          <button type="button" className="btn" disabled={!link.trim()} onClick={() => void playLink()}>
            <Icon name="play" size={14} /> Ouvir
          </button>
        </div>
      </section>

      {error && <div className="panel error-box">{error}</div>}

      {results.length > 0 && (
        <div className="result-list">
          {results.map((t) => {
            const key = `${t.provider}:${t.id}`;
            const on = playing?.provider === t.provider && playing.id === t.id;
            return (
              <div key={key} className={`result${on ? ' playing' : ''}`}>
                {t.thumb ? <img src={t.thumb} alt="" loading="lazy" /> : <div className="result-ph" />}
                <div className="result-body">
                  <b title={t.title}>{t.title}</b>
                  <span className="muted">{t.artist}</span>
                </div>
                <div className="result-actions">
                  <button type="button" className="btn small primary" onClick={() => play(t)}>
                    <Icon name="play" size={13} /> {on ? 'Tocando' : 'Ouvir'}
                  </button>
                  <button type="button" className="btn small" onClick={() => attach(t)} disabled={added.has(key)}>
                    {added.has(key) ? (
                      <>
                        <Icon name="check" size={13} /> Salva
                      </>
                    ) : target ? (
                      'Usar nesta música'
                    ) : (
                      <>
                        <Icon name="plus" size={13} /> Salvar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && !error && results.length === 0 && ready && <p className="muted">Busque uma música para ouvir aqui mesmo, sem sair do site. O reprodutor fica fixo na tela enquanto você navega.</p>}

      <details className="panel soft" open={!ready || undefined} style={{ marginTop: 18 }}>
        <summary>Configurar Spotify e YouTube</summary>
        <Integrations />
      </details>
    </>
  );
}
