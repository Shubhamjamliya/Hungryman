/**
 * Public config for the web frontend (and WebView apps).
 * Only browser-safe values: keys that are public by design (Google Maps browser key,
 * Firebase web config). Never put secrets here: this endpoint needs no login.
 * Values come from the admin panel (DB) or .env, already loaded into process.env.
 */
const read = (key) => String(process.env[key] ?? '').trim().replace(/^['"]|['"]$/g, '');

const isTrue = (key) => /^(true|1|yes|on)$/i.test(read(key));

export const getPublicConfig = (req, res) => {
    const testPhoneEnabled = isTrue('USE_DEFAULT_TEST_PHONE');

    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).json({
        success: true,
        data: {
            googleMapsApiKey: read('GOOGLE_MAPS_API_KEY'),
            fbPixelId: read('FB_PIXEL_ID'),
            firebase: {
                apiKey: read('VITE_FIREBASE_API_KEY'),
                authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
                projectId: read('VITE_FIREBASE_PROJECT_ID'),
                appId: read('VITE_FIREBASE_APP_ID'),
                messagingSenderId: read('VITE_FIREBASE_MESSAGING_SENDER_ID'),
                storageBucket: read('VITE_FIREBASE_STORAGE_BUCKET'),
                measurementId: read('VITE_FIREBASE_MEASUREMENT_ID'),
                databaseURL: read('VITE_FIREBASE_DATABASE_URL'),
                vapidKey: read('VITE_FIREBASE_VAPID_KEY'),
            },
            // Prefills the login phone field for testing, only when enabled in the admin panel
            defaultTestPhone: testPhoneEnabled ? read('DEFAULT_TEST_PHONE').replace(/\D/g, '').slice(0, 10) : '',
        },
    });
};
