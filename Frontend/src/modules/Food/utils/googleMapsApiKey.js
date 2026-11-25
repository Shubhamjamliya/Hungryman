/**
 * Google Maps API Key, from the backend public config (Admin > Environment Managements).
 * Works in Vite web dev, production web, and mobile WebView shells.
 */

import { useEffect, useState } from "react";
import { getPublicConfig, loadPublicConfig } from "@/services/publicConfig";
let cachedApiKey = null;

function sanitizeApiKey(value) {
  if (!value) return "";
  return String(value).trim().replace(/^['"]|['"]$/g, "");
}

function getConfigKey() {
  return sanitizeApiKey(getPublicConfig().googleMapsApiKey);
}

/** Resolve Google Maps API key (waits for the public config if it is still loading). */
export async function getGoogleMapsApiKey() {
  if (cachedApiKey) return cachedApiKey;
  await loadPublicConfig();
  cachedApiKey = getConfigKey() || null;
  return cachedApiKey || "";
}

/** Sync peek: the key from the already-loaded public config. */
export function getGoogleMapsApiKeySync() {
  return cachedApiKey || getConfigKey();
}

export function clearGoogleMapsApiKeyCache() {
  cachedApiKey = null;
}

/** Whether maps can be enabled (build-time or after async fetch). */
export function isGoogleMapsConfigured() {
  return Boolean(getGoogleMapsApiKeySync());
}

/** React hook for @react-google-maps/api — resolves API key in web & mobile WebView. */
export function useGoogleMapsApiKey() {
  const [apiKey, setApiKey] = useState(() => getGoogleMapsApiKeySync());

  useEffect(() => {
    let cancelled = false;
    getGoogleMapsApiKey().then((key) => {
      if (!cancelled && key) setApiKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return apiKey;
}
