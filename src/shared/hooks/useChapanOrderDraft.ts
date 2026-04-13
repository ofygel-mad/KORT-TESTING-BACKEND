/**
 * useChapanOrderDraft
 *
 * Saves and restores react-hook-form values to/from sessionStorage so that
 * a partially-filled order form survives SPA navigation, accidental tab
 * refreshes and component remounts.
 *
 * Usage:
 *   const draft = useChapanOrderDraft({ storageKey: 'chapan:new-order:v3', form: methods });
 *   // on successful submit:  draft.clearDraft();
 */
import { useEffect, useRef } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

type Options<TForm extends FieldValues> = {
  storageKey: string;
  form: Pick<UseFormReturn<TForm>, 'watch' | 'reset' | 'getValues'>;
  enabled?: boolean;
  version?: string;
};

type StoredDraft<TForm> = {
  version: string;
  savedAt: string;
  values: Partial<TForm>;
};

const DEFAULT_VERSION = 'v1';
const SAVE_DELAY_MS   = 350;

function isClient() {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

function readDraft<TForm>(storageKey: string): StoredDraft<TForm> | null {
  if (!isClient()) return null;
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDraft<TForm>;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

function writeDraft<TForm>(storageKey: string, payload: StoredDraft<TForm>) {
  if (!isClient()) return;
  sessionStorage.setItem(storageKey, JSON.stringify(payload));
}

export function useChapanOrderDraft<TForm extends FieldValues>({
  storageKey,
  form,
  enabled = true,
  version = DEFAULT_VERSION,
}: Options<TForm>) {
  const hydratedRef = useRef(false);
  const timerRef    = useRef<number | null>(null);

  // Restore draft once on mount
  useEffect(() => {
    if (!enabled || hydratedRef.current || !isClient()) return;

    const saved = readDraft<TForm>(storageKey);
    if (saved && saved.version === version) {
      form.reset({ ...form.getValues(), ...saved.values });
    }
    hydratedRef.current = true;
  }, [enabled, form, storageKey, version]);

  // Auto-save on every change (debounced)
  useEffect(() => {
    if (!enabled || !isClient()) return;

    const subscription = form.watch((values) => {
      if (!hydratedRef.current) return;

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        writeDraft<TForm>(storageKey, {
          version,
          savedAt: new Date().toISOString(),
          values:  values as Partial<TForm>,
        });
      }, SAVE_DELAY_MS);
    });

    return () => {
      subscription.unsubscribe();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [enabled, form, storageKey, version]);

  function clearDraft() {
    if (!isClient()) return;
    sessionStorage.removeItem(storageKey);
  }

  function restoreDraft(): boolean {
    const saved = readDraft<TForm>(storageKey);
    if (!saved || saved.version !== version) return false;
    form.reset({ ...form.getValues(), ...saved.values });
    return true;
  }

  return {
    clearDraft,
    restoreDraft,
    hasDraft: !!readDraft<TForm>(storageKey),
  };
}
