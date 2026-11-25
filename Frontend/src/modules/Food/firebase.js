import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getPublicConfig } from '@/services/publicConfig';

// Firebase web config comes from the backend public config (Admin > Environment Managements)
const getFirebaseConfig = () => {
  const { vapidKey, ...config } = getPublicConfig().firebase;
  return config;
};

// Internal state
let app = null;
let firebaseAuth = null;
let googleProvider = null;
let firebaseRealtimeDb = null;

/**
 * Checks whether Firebase credentials are validly provided in environment variables.
 */
export function isFirebaseConfigured() {
  const apiKey = String(getFirebaseConfig().apiKey || '').trim();
  const projectId = String(getFirebaseConfig().projectId || '').trim();
  return Boolean(apiKey && apiKey.length > 5 && projectId);
}

/**
 * Ensures Firebase app is initialized safely.
 */
function initializeBaseApp() {
  if (app) return app;
  if (!isFirebaseConfigured()) return null;
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(getFirebaseConfig());
    }
    return app;
  } catch (err) {
    console.warn('[Firebase] App initialization skipped:', err?.message || err);
    return null;
  }
}

/**
 * Get the initialized Firebase Auth instance lazily.
 */
export function getFirebaseAuth() {
  if (!firebaseAuth) {
    if (!isFirebaseConfigured()) return null;
    const firebaseApp = initializeBaseApp();
    if (!firebaseApp) return null;
    try {
      firebaseAuth = getAuth(firebaseApp);
    } catch (err) {
      console.warn('[Firebase] Auth initialization skipped:', err?.message || err);
      firebaseAuth = null;
    }
  }
  return firebaseAuth;
}

/**
 * Get the initialized Google Auth Provider lazily.
 */
export function getGoogleAuthProvider() {
  if (!googleProvider) {
    if (!isFirebaseConfigured()) return null;
    try {
      googleProvider = new GoogleAuthProvider();
    } catch (err) {
      console.warn('[Firebase] Google Auth Provider skipped:', err?.message || err);
      googleProvider = null;
    }
  }
  return googleProvider;
}

/**
 * Legacy support: ensuring Firebase is initialized.
 * Now it only initializes the basic App and Realtime DB if requested and configured.
 * Auth initialization is skipped by default to avoid stale 'getProjectConfig' calls.
 */
export function ensureFirebaseInitialized(options = {}) {
  const { enableAuth = false, enableRealtimeDb = true } = options;
  if (!isFirebaseConfigured()) return null;

  const firebaseApp = initializeBaseApp();
  if (!firebaseApp) return null;

  if (enableAuth) {
    getFirebaseAuth();
  }

  if (enableRealtimeDb && !firebaseRealtimeDb) {
    try {
      firebaseRealtimeDb = getFirebaseConfig().databaseURL
        ? getDatabase(firebaseApp, getFirebaseConfig().databaseURL)
        : getDatabase(firebaseApp);
    } catch (err) {
      console.warn('[Firebase] Realtime Database initialization skipped:', err?.message || err);
      firebaseRealtimeDb = null;
    }
  }
  
  return firebaseApp;
}

// Proxies for export
export { app as firebaseApp, firebaseAuth, googleProvider, firebaseRealtimeDb };

