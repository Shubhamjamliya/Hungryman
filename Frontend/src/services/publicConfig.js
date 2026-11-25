/**
 * Public config from the backend (GET /public-config): Google Maps key, Firebase web config, ...
 * Managed in Admin > Environment Managements. The frontend has no keys in its own .env.
 *
 * - loadPublicConfig() is awaited once in index.jsx before the app renders.
 * - Cached in localStorage, so later visits start instantly and refresh in the background.
 * - getPublicConfig() is synchronous and safe to call anywhere after that.
 */
import { API_BASE_URL } from "./api/config.js";

const STORAGE_KEY = "public_config_v2"; // bump when the config shape changes
const FETCH_TIMEOUT_MS = 5000;

const EMPTY_CONFIG = {
  googleMapsApiKey: "",
  fbPixelId: "",
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: "",
    messagingSenderId: "",
    storageBucket: "",
    measurementId: "",
    databaseURL: "",
    vapidKey: "",
  },
  defaultTestPhone: "",
};

const normalize = (data) => ({
  ...EMPTY_CONFIG,
  ...(data || {}),
  firebase: { ...EMPTY_CONFIG.firebase, ...(data?.firebase || {}) },
});

const readCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

let current = readCache() || EMPTY_CONFIG;
let loadPromise = null;

async function fetchPublicConfig() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/public-config`, {
      signal: controller.signal,
      credentials: "omit",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    current = normalize(body?.data);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      /* storage full or blocked: keep in memory only */
    }
    return current;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load the config. With a cached copy it resolves immediately and refreshes in the background;
 * without one it waits for the backend (max FETCH_TIMEOUT_MS). Never rejects.
 */
export function loadPublicConfig() {
  if (!loadPromise) {
    const network = fetchPublicConfig().catch((err) => {
      console.warn("[PublicConfig] Could not load config from backend:", err?.message || err);
      return current;
    });
    loadPromise = readCache() ? Promise.resolve(current) : network;
  }
  return loadPromise;
}

/** Current config (cached or freshly loaded). */
export function getPublicConfig() {
  return current;
}
