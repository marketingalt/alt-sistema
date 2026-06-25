"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SAVE_DELAY = 1000; // 1s debounce
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DraftEnvelope<T> {
  data: T;
  savedAt: string; // ISO string
  version: number;
}

// ---------- Utilities (no React) ----------

export function getDraft<T>(key: string): { data: T; savedAt: Date } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env: DraftEnvelope<T> = JSON.parse(raw);
    return { data: env.data, savedAt: new Date(env.savedAt) };
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------- Hook ----------

export function useAutoSave<T>(
  key: string,
  data: T,
  enabled: boolean,
): { savedAt: Date | null; isSaving: boolean } {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dataRef = useRef(data);
  const keyRef = useRef(key);
  const prevSerializedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushOnUnmountRef = useRef(false);

  // Keep refs in sync
  dataRef.current = data;
  keyRef.current = key;

  const doSave = useCallback((value: T, k: string) => {
    try {
      const env: DraftEnvelope<T> = {
        data: value,
        savedAt: new Date().toISOString(),
        version: 1,
      };
      localStorage.setItem(k, JSON.stringify(env));
      prevSerializedRef.current = JSON.stringify(value);
      setSavedAt(new Date(env.savedAt));
    } catch (err) {
      // QuotaExceededError — retry without imagemReferencia
      if (
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" || err.code === 22)
      ) {
        try {
          const cloned = structuredClone(value) as Record<string, unknown>;
          const itens = (cloned as { itens?: unknown[] }).itens;
          if (itens) {
            for (const item of itens) {
              (item as Record<string, unknown>).imagemReferencia = undefined;
            }
          }
          const env: DraftEnvelope<unknown> = {
            data: cloned,
            savedAt: new Date().toISOString(),
            version: 1,
          };
          localStorage.setItem(k, JSON.stringify(env));
          prevSerializedRef.current = JSON.stringify(value);
          setSavedAt(new Date(env.savedAt));
        } catch {
          // give up
        }
      }
    }
  }, []);

  // Debounced save effect
  useEffect(() => {
    if (!enabled) return;

    const serialized = JSON.stringify(data);
    if (serialized === prevSerializedRef.current) {
      // No change — nothing to save
      return;
    }

    // Mark that we have pending data (used by cleanup)
    flushOnUnmountRef.current = true;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave(dataRef.current, keyRef.current);
      flushOnUnmountRef.current = false;
    }, SAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, doSave]);

  // Flush on unmount (catches tab close / navigation)
  useEffect(() => {
    return () => {
      if (flushOnUnmountRef.current && dataRef.current !== undefined) {
        try {
          const env: DraftEnvelope<T> = {
            data: dataRef.current,
            savedAt: new Date().toISOString(),
            version: 1,
          };
          localStorage.setItem(keyRef.current, JSON.stringify(env));
        } catch {
          // best-effort
        }
      }
    };
  }, []);

  // isSaving: true during the debounce window (data changed but not yet written)
  const lastSerialized = prevSerializedRef.current;
  const isSaving =
    enabled &&
    (timerRef.current !== null || JSON.stringify(data) !== lastSerialized);

  return { savedAt, isSaving };
}
