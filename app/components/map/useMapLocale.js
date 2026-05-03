"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_MAP_LOCALE,
  MAP_LANGUAGES,
  translateMap,
} from "@/lib/mapI18n";

const STORAGE_KEY = "mapLocale";

function getStoredLocale() {
  if (typeof window === "undefined") return DEFAULT_MAP_LOCALE;

  const savedLocale = localStorage.getItem(STORAGE_KEY);
  const isSupported = MAP_LANGUAGES.some(
    (language) => language.code === savedLocale
  );

  return isSupported ? savedLocale : DEFAULT_MAP_LOCALE;
}

function subscribeLocaleChange(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("mapLocaleChange", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("mapLocaleChange", callback);
  };
}

export default function useMapLocale() {
  const locale = useSyncExternalStore(
    subscribeLocaleChange,
    getStoredLocale,
    () => DEFAULT_MAP_LOCALE
  );

  function setLocale(nextLocale) {
    const isSupported = MAP_LANGUAGES.some(
      (language) => language.code === nextLocale
    );

    if (!isSupported) return;

    localStorage.setItem(STORAGE_KEY, nextLocale);
    window.dispatchEvent(new Event("mapLocaleChange"));
  }

  const t = useMemo(
    () => (key) => translateMap(locale, key),
    [locale]
  );

  return { locale, setLocale, t };
}
