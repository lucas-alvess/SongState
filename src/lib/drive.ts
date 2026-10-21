/**
 * Cliente mínimo da API do Google Drive para a pasta oculta do aplicativo (appDataFolder).
 * Só enxerga arquivos criados por este app; não tem acesso ao resto do Drive do usuário.
 */

export interface RemoteFile {
  id: string;
  name: string;
  size: number;
  modified: number;
}

export interface DriveApi {
  list(): Promise<RemoteFile[]>;
  download(id: string): Promise<Blob>;
  /** Cria (ou, com `existingId`, substitui o conteúdo). Devolve o id do arquivo. */
  upload(name: string, blob: Blob, existingId?: string): Promise<string>;
  remove(id: string): Promise<void>;
}

/** `kind`: auth = sessão expirada; quota = Drive cheio; network = sem internet; other = resto. */
export class DriveError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'quota' | 'network' | 'other',
    public status = 0,
  ) {
    super(message);
  }
}

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export function createDrive(getToken: () => string | null, doFetch: typeof fetch = (...a) => fetch(...a), sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): DriveApi {
  async function call(url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
    const token = getToken();
    if (!token) throw new DriveError('Entre com o Google para sincronizar.', 'auth', 401);
    let res: Response;
    try {
      res = await doFetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
    } catch {
      throw new DriveError('Sem conexão com o Google.', 'network');
    }
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempts > 1) {
      await sleep(600 * (4 - attempts));
      return call(url, init, attempts - 1);
    }
    let reason = '';
    try {
      const body = (await res.json()) as { error?: { errors?: { reason?: string }[]; message?: string } };
      reason = body.error?.errors?.[0]?.reason ?? body.error?.message ?? '';
    } catch {
      /* sem corpo */
    }
    if (res.status === 401) throw new DriveError('A sessão do Google expirou. Entre de novo.', 'auth', 401);
    if (res.status === 403 && /storageQuotaExceeded/i.test(reason)) throw new DriveError('O espaço do seu Google Drive acabou.', 'quota', 403);
    if (res.status === 403 && /insufficient|scope/i.test(reason)) throw new DriveError('Falta permissão: entre de novo e aceite o acesso aos dados do app.', 'auth', 403);
    if (res.status === 403 && /accessNotConfigured|has not been used|disabled/i.test(reason)) throw new DriveError('A API do Google Drive não está ativada no projeto do Google Cloud.', 'other', 403);
    throw new DriveError(`O Google Drive recusou o pedido (${res.status}${reason ? `: ${reason}` : ''}).`, 'other', res.status);
  }

  return {
    async list() {
      const out: RemoteFile[] = [];
      let page = '';
      do {
        const q = new URLSearchParams({ spaces: 'appDataFolder', pageSize: '1000', fields: 'nextPageToken,files(id,name,size,modifiedTime)' });
        if (page) q.set('pageToken', page);
        const body = (await (await call(`${API}?${q}`)).json()) as { nextPageToken?: string; files?: { id: string; name: string; size?: string; modifiedTime?: string }[] };
        for (const f of body.files ?? []) out.push({ id: f.id, name: f.name, size: Number(f.size) || 0, modified: Date.parse(f.modifiedTime ?? '') || 0 });
        page = body.nextPageToken ?? '';
      } while (page);
      return out;
    },

    async download(id) {
      return (await call(`${API}/${encodeURIComponent(id)}?alt=media`)).blob();
    },

    async upload(name, blob, existingId) {
      // envio "resumable": serve tanto para o JSON pequeno quanto para áudios grandes
      const url = existingId ? `${UPLOAD}/${encodeURIComponent(existingId)}?uploadType=resumable&fields=id` : `${UPLOAD}?uploadType=resumable&fields=id`;
      const init = await call(url, {
        method: existingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': blob.type || 'application/octet-stream' },
        body: JSON.stringify(existingId ? {} : { name, parents: ['appDataFolder'] }),
      });
      const session = init.headers.get('Location');
      if (!session) throw new DriveError('O Google Drive não devolveu o endereço de envio.', 'other');
      const done = await call(session, { method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
      const meta = (await done.json()) as { id?: string };
      if (!meta.id) throw new DriveError('Resposta inesperada do Google Drive.', 'other');
      return meta.id;
    },

    async remove(id) {
      try {
        await call(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (e) {
        if (e instanceof DriveError && e.status === 404) return; // já não existe
        throw e;
      }
    },
  };
}
