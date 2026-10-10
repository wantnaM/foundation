"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const fallback = new Map<string, string>();
const eventName = "foundation-storage";

function read(key: string) {
  try {
    return localStorage.getItem(key) ?? fallback.get(key) ?? null;
  } catch {
    return fallback.get(key) ?? null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(eventName, callback);
  };
}

function parse<T>(
  raw: string | null,
  initial: T,
  validate: (value: unknown) => value is T,
): T {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    return validate(value) ? value : initial;
  } catch {
    return initial;
  }
}

export function useStoredState<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const snapshot = useCallback(() => read(key), [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => undefined);
  const value = useMemo(
    () => parse(raw ?? null, initial, validate),
    [raw, initial, validate],
  );
  const setValue = useCallback(
    (update: T | ((current: T) => T)) => {
      const next =
        typeof update === "function"
          ? (update as (current: T) => T)(parse(read(key), initial, validate))
          : update;
      if (!validate(next)) return;
      const serialized = JSON.stringify(next);
      fallback.set(key, serialized);
      try {
        localStorage.setItem(key, serialized);
      } catch {
        /* Keep an in-memory draft when storage is unavailable. */
      }
      window.dispatchEvent(new Event(eventName));
    },
    [key, initial, validate],
  );
  return [value, setValue, raw !== undefined] as const;
}

export const emptyIds: string[] = [];
export const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
