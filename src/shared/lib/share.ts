import { copyToClipboard, getNavigator } from './browser';

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export type ShareResult =
  | { ok: true; method: 'native' | 'clipboard' }
  | { ok: false; reason: 'cancelled' | 'unsupported' | 'error' };

/**
 * Web Share API wrapper. Falls back to clipboard copy when the API is missing
 * (desktop browsers, older mobile). Returns a structured result so callers can
 * surface a toast — "Скопировано в буфер" vs "Поделено через..." vs "Отмена".
 */
export async function shareInvoice(payload: SharePayload): Promise<ShareResult> {
  const nav = getNavigator() as (Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  }) | undefined;

  const data: ShareData = {};
  if (payload.title) data.title = payload.title;
  if (payload.text)  data.text  = payload.text;
  if (payload.url)   data.url   = payload.url;
  if (payload.files && payload.files.length) (data as ShareData & { files?: File[] }).files = payload.files;

  if (nav?.share && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return { ok: true, method: 'native' };
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      if (name === 'AbortError') return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'error' };
    }
  }

  const fallback = [payload.title, payload.text, payload.url].filter(Boolean).join('\n');
  if (!fallback) return { ok: false, reason: 'unsupported' };
  const copied = await copyToClipboard(fallback);
  return copied ? { ok: true, method: 'clipboard' } : { ok: false, reason: 'unsupported' };
}
