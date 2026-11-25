import { useState, useEffect, useMemo } from "react";
import { adminAPI } from "@food/api";
import { toast } from "sonner";
import {
  Save, RotateCw, FileText, LayoutGrid, Search, Eye, EyeOff, Undo2, X, Lock,
  CreditCard, KeyRound, MessageSquare, Flame, MapPin, Mail, Cloud, PhoneCall, PhoneIncoming,
  Store, Activity, ShieldCheck, Server, AlertTriangle, Monitor, Copy,
} from "lucide-react";

/* ─────────────────────────────── Sections ───────────────────────────────
 * Server (.env) first, then by importance. source "db": stored encrypted in MongoDB (admin-managed).
 * source "server": startup keys kept in the server's Backend/.env file.
 */
const SECTIONS = [
  {
    id: "server", title: "Server (.env file)", icon: Server, source: "server",
    subtitle: "Startup settings kept in the server's .env file. Needed before the database connects.",
    keys: ["NODE_ENV", "PORT", "SOCKET_PORT", "TZ", "MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_ACCESS_EXPIRES", "JWT_REFRESH_SECRET", "JWT_REFRESH_EXPIRES", "FRONTEND_URL", "SOCKET_CORS_ORIGIN", "REDIS_ENABLED", "REDIS_URL", "BULLMQ_ENABLED", "UPLOAD_PATH", "ENCRYPTION_KEY"],
  },
  {
    id: "payments", title: "Payments", icon: CreditCard, source: "db",
    subtitle: "Choose Test or Live mode for Razorpay, then fill in that mode's keys.",
    keys: ["RAZORPAY_MODE", "RAZORPAY_LIVE_KEY_ID", "RAZORPAY_LIVE_KEY_SECRET", "RAZORPAY_TEST_KEY_ID", "RAZORPAY_TEST_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    providerKey: "RAZORPAY_MODE",
    defaultProvider: "test",
    providers: {
      test: ["RAZORPAY_TEST_KEY_ID", "RAZORPAY_TEST_KEY_SECRET"],
      live: ["RAZORPAY_LIVE_KEY_ID", "RAZORPAY_LIVE_KEY_SECRET"],
    },
    // Shown in both modes
    sharedKeys: ["RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  },
  {
    id: "otp", title: "OTP & Login", icon: KeyRound, source: "db",
    subtitle: "How login codes are generated, limited and tested.",
    keys: ["USE_DEFAULT_OTP", "USE_DEFAULT_TEST_PHONE", "DEFAULT_TEST_PHONE", "DEFAULT_TEST_PHONES", "OTP_EXPIRY_MINUTES", "OTP_EXPIRY_SECONDS", "OTP_EXPIRY", "OTP_MAX_ATTEMPTS", "OTP_RATE_LIMIT", "OTP_RATE_WINDOW"],
  },
  {
    id: "sms", title: "SMS", icon: MessageSquare, source: "db",
    subtitle: "Choose the SMS gateway that delivers login OTPs, then fill in its keys.",
    keys: [
      "SMS_PROVIDER",
      "SMS_INDIA_HUB_USERNAME", "SMS_INDIA_HUB_API_KEY", "SMS_INDIA_HUB_SENDER_ID", "SMS_INDIA_HUB_DLT_TEMPLATE_ID", "SMS_INDIA_HUB_OTP_TEMPLATE",
      "SMSWALA_API_URL", "SMSWALA_API_KEY", "SMSWALA_SENDER_ID", "SMSWALA_TEMPLATE_ID", "SMSWALA_PE_ID", "SMSWALA_CAMPAIGN_ID", "SMSWALA_ROUTE_ID",
      "MSG91_AUTH_KEY", "MSG91_SENDER_ID", "MSG91_TEMPLATE_ID",
    ],
    // Only the chosen provider's fields are shown
    providerKey: "SMS_PROVIDER",
    defaultProvider: "smsindiahub",
    providers: {
      smsindiahub: ["SMS_INDIA_HUB_USERNAME", "SMS_INDIA_HUB_API_KEY", "SMS_INDIA_HUB_SENDER_ID", "SMS_INDIA_HUB_DLT_TEMPLATE_ID", "SMS_INDIA_HUB_OTP_TEMPLATE"],
      smswala: ["SMSWALA_API_URL", "SMSWALA_API_KEY", "SMSWALA_SENDER_ID", "SMSWALA_TEMPLATE_ID", "SMSWALA_PE_ID", "SMSWALA_CAMPAIGN_ID", "SMSWALA_ROUTE_ID"],
      msg91: ["MSG91_AUTH_KEY", "MSG91_SENDER_ID", "MSG91_TEMPLATE_ID"],
    },
  },
  {
    id: "firebase-server", title: "Firebase · Server", icon: Flame, source: "db",
    subtitle: "Push notifications and realtime tracking from the backend.",
    keys: ["FIREBASE_SERVICE_ACCOUNT", "FIREBASE_PROJECT_ID", "VITE_FIREBASE_DATABASE_URL"],
  },
  {
    id: "firebase-web", title: "Firebase · Web app", icon: Flame, source: "db",
    subtitle: "Public web config sent to browsers for login and web push.",
    keys: ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_APP_ID", "VITE_FIREBASE_MEASUREMENT_ID", "VITE_FIREBASE_VAPID_KEY"],
  },
  {
    id: "maps", title: "Maps & AI", icon: MapPin, source: "db",
    subtitle: "Google Maps for addresses and tracking; Hugging Face for AI features.",
    keys: ["GOOGLE_MAPS_API_KEY", "HUGGINGFACE_API_KEY"],
  },
  {
    id: "email", title: "Email (SMTP)", icon: Mail, source: "db",
    subtitle: "Outgoing email such as password resets and reports.",
    keys: ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM"],
  },
  {
    id: "cloudinary", title: "Media storage", icon: Cloud, source: "db",
    subtitle: "Cloudinary account for uploaded images.",
    keys: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
  },
  {
    id: "voip", title: "VoIP calls (Apple)", icon: PhoneCall, source: "db",
    subtitle: "Apple Push Notification service for incoming-call alerts on iPhone.",
    keys: ["APNS_TEAM_ID", "APNS_KEY_ID", "APNS_VOIP_P8_PATH", "APNS_VOIP_PFX_PATH", "APNS_VOIP_CERT_PASSWORD", "APNS_PRODUCTION", "APNS_VOIP_TOPIC", "APNS_VOIP_TOPIC_RESTAURANT", "APNS_VOIP_TOPIC_DELIVERY", "APNS_TOPIC", "APNS_TOPIC_RESTAURANT", "APNS_TOPIC_DELIVERY"],
  },
  {
    id: "obd", title: "Voice call alerts", icon: PhoneIncoming, source: "db",
    subtitle: "Automated phone calls (OBD) that alert restaurants about new orders.",
    keys: ["OBD_API_URL", "OBD_UKEY", "OBD_SERVICENO", "OBD_VOICEFILE", "OBD_IVRTEMPLATEID", "OBD_SOURCETYPE", "OBD_CAMPAIGNTYPE", "OBD_FILETYPE", "OBD_RETRYDURATION", "OBD_DTMFLENGTH", "OBD_WAITDURATION"],
  },
  {
    id: "petpooja", title: "Petpooja POS", icon: Store, source: "db",
    subtitle: "Restaurant menu sync with Petpooja.",
    keys: ["PETPOOJA_SYNC_ENABLED", "PETPOOJA_APP_KEY", "PETPOOJA_APP_SECRET"],
  },
  {
    id: "analytics", title: "Analytics", icon: Activity, source: "db",
    subtitle: "Tracking IDs loaded in the customer website.",
    keys: ["FB_PIXEL_ID"],
  },
  {
    id: "security", title: "Rate limiting & Security", icon: ShieldCheck, source: "db",
    subtitle: "Request limits per user/IP and password hashing strength.",
    keys: ["RATE_LIMIT_ENABLED", "RATE_LIMIT_WINDOW", "RATE_LIMIT_WINDOW_MS", "RATE_LIMIT_MAX", "AUTH_RATE_LIMIT_WINDOW", "AUTH_RATE_LIMIT_MAX", "BCRYPT_SALT_ROUNDS"],
  },
];

const DB_SECTIONS = SECTIONS.filter((s) => s.source === "db");
const DB_KEYS = DB_SECTIONS.flatMap((s) => s.keys);

/* ───────────────────────────── Field details ─────────────────────────────
 * type: text (default) | secret | bool | select | json | number
 * wide: spans both columns
 */
const FIELDS = {
  // Payments
  RAZORPAY_MODE: {
    label: "Payment mode", type: "choice", fallback: "test",
    hint: "Live charges real money. Test uses Razorpay's test keys.",
    options: [
      { value: "test", label: "Test" },
      { value: "live", label: "Live" },
    ],
  },
  RAZORPAY_LIVE_KEY_ID: { label: "Live key ID", ph: "rzp_live_xxxxxxxxxxxx" },
  RAZORPAY_LIVE_KEY_SECRET: { label: "Live key secret", type: "secret" },
  RAZORPAY_TEST_KEY_ID: { label: "Test key ID", ph: "rzp_test_xxxxxxxxxxxx" },
  RAZORPAY_TEST_KEY_SECRET: { label: "Test key secret", type: "secret" },
  RAZORPAY_WEBHOOK_SECRET: { label: "Webhook secret", type: "secret", hint: "Razorpay Dashboard → Webhooks." },
  RAZORPAY_KEY_ID: { label: "Active key ID (override)", ph: "rzp_test_xxxxxxxxxxxx", hint: "Optional. Used when it matches the mode." },
  RAZORPAY_KEY_SECRET: { label: "Active key secret (override)", type: "secret" },
  // OTP
  USE_DEFAULT_OTP: { label: "Default OTP 123456", type: "bool", hint: "Development only. Keep off in production." },
  USE_DEFAULT_TEST_PHONE: { label: "Prefill test phone on login", type: "bool" },
  DEFAULT_TEST_PHONE: { label: "Test phone", ph: "9999999999" },
  DEFAULT_TEST_PHONES: { label: "Test phones", ph: "9999999999,8888888888", hint: "Comma separated." },
  OTP_EXPIRY_MINUTES: { label: "OTP expiry (minutes)", type: "number", ph: "5" },
  OTP_EXPIRY_SECONDS: { label: "OTP expiry (seconds)", type: "number", ph: "300" },
  OTP_EXPIRY: { label: "OTP expiry (legacy, seconds)", type: "number", ph: "300" },
  OTP_MAX_ATTEMPTS: { label: "Max wrong attempts", type: "number", ph: "5" },
  OTP_RATE_LIMIT: { label: "OTP requests allowed", type: "number", ph: "3" },
  OTP_RATE_WINDOW: { label: "Request window (seconds)", type: "number", ph: "600" },
  // SMS
  SMS_PROVIDER: {
    label: "SMS provider", type: "choice", fallback: "smsindiahub", hint: "Only this gateway is used to send OTPs.",
    options: [
      { value: "smsindiahub", label: "SMS India Hub" },
      { value: "smswala", label: "SMSWala" },
      { value: "msg91", label: "MSG91" },
    ],
  },
  SMS_INDIA_HUB_USERNAME: { label: "Username" },
  SMSWALA_API_URL: { label: "API URL", ph: "https://...", wide: true },
  SMSWALA_API_KEY: { label: "API key", type: "secret" },
  SMSWALA_SENDER_ID: { label: "Sender ID" },
  SMSWALA_TEMPLATE_ID: { label: "DLT template ID" },
  SMSWALA_PE_ID: { label: "PE ID (DLT entity)" },
  SMSWALA_CAMPAIGN_ID: { label: "Campaign ID" },
  SMSWALA_ROUTE_ID: { label: "Route ID" },
  MSG91_AUTH_KEY: { label: "Auth key", type: "secret" },
  MSG91_SENDER_ID: { label: "Sender ID" },
  MSG91_TEMPLATE_ID: { label: "Template ID" },
  SMS_INDIA_HUB_API_KEY: { label: "API key", type: "secret" },
  SMS_INDIA_HUB_SENDER_ID: { label: "Sender ID" },
  SMS_INDIA_HUB_DLT_TEMPLATE_ID: { label: "DLT template ID" },
  SMS_INDIA_HUB_OTP_TEMPLATE: { label: "OTP message template", wide: true },
  // Firebase
  FIREBASE_SERVICE_ACCOUNT: { label: "Service account JSON", type: "json", wide: true, ph: '{"type":"service_account","project_id":"..."}', hint: "Firebase Console → Project settings → Service accounts → Generate key." },
  FIREBASE_PROJECT_ID: { label: "Project ID", ph: "your-project-id" },
  VITE_FIREBASE_DATABASE_URL: { label: "Realtime Database URL", ph: "https://your-project.firebaseio.com" },
  VITE_FIREBASE_API_KEY: { label: "Web API key", ph: "AIzaSy..." },
  VITE_FIREBASE_AUTH_DOMAIN: { label: "Auth domain", ph: "your-project.firebaseapp.com" },
  VITE_FIREBASE_PROJECT_ID: { label: "Project ID", ph: "your-project-id" },
  VITE_FIREBASE_STORAGE_BUCKET: { label: "Storage bucket", ph: "your-project.appspot.com" },
  VITE_FIREBASE_MESSAGING_SENDER_ID: { label: "Messaging sender ID", ph: "123456789012" },
  VITE_FIREBASE_APP_ID: { label: "App ID", ph: "1:123456789012:web:abc123" },
  VITE_FIREBASE_MEASUREMENT_ID: { label: "Measurement ID", ph: "G-XXXXXXXXXX" },
  VITE_FIREBASE_VAPID_KEY: { label: "Web push key (VAPID)", ph: "BL...", wide: true },
  // Maps & AI
  GOOGLE_MAPS_API_KEY: { label: "Google Maps API key", ph: "AIzaSy...", hint: "Sent to browsers. Restrict it to your domains in Google Cloud." },
  HUGGINGFACE_API_KEY: { label: "Hugging Face token", type: "secret", ph: "hf_..." },
  // Email
  EMAIL_HOST: { label: "SMTP host", ph: "smtp.gmail.com" },
  EMAIL_PORT: { label: "SMTP port", type: "number", ph: "587" },
  EMAIL_USER: { label: "Username", ph: "you@gmail.com" },
  EMAIL_PASS: { label: "Password / app password", type: "secret" },
  EMAIL_FROM: { label: "From address", ph: "Your App <no-reply@example.com>", wide: true },
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: { label: "Cloud name", ph: "your-cloud-name" },
  CLOUDINARY_API_KEY: { label: "API key", ph: "123456789012345" },
  CLOUDINARY_API_SECRET: { label: "API secret", type: "secret" },
  // VoIP
  APNS_TEAM_ID: { label: "Apple Team ID", ph: "ABCDE12345" },
  APNS_KEY_ID: { label: "Key ID", ph: "XYZ987WVUT" },
  APNS_VOIP_P8_PATH: { label: ".p8 key file path", ph: "certs/AuthKey_XYZ987WVUT.p8", hint: "Path to the file on the server." },
  APNS_VOIP_PFX_PATH: { label: ".p12 certificate path", ph: "certs/voip.p12", hint: "Path to the file on the server." },
  APNS_VOIP_CERT_PASSWORD: { label: "Certificate password", type: "secret" },
  APNS_PRODUCTION: { label: "Production APNs", type: "bool", hint: "Off uses Apple's sandbox (development builds)." },
  APNS_VOIP_TOPIC: { label: "VoIP topic (default)", ph: "com.yourapp.voip" },
  APNS_VOIP_TOPIC_RESTAURANT: { label: "VoIP topic · Restaurant app", ph: "com.yourapp.restaurant.voip" },
  APNS_VOIP_TOPIC_DELIVERY: { label: "VoIP topic · Delivery app", ph: "com.yourapp.delivery.voip" },
  APNS_TOPIC: { label: "App bundle ID (default)", ph: "com.yourapp" },
  APNS_TOPIC_RESTAURANT: { label: "Bundle ID · Restaurant app", ph: "com.yourapp.restaurant" },
  APNS_TOPIC_DELIVERY: { label: "Bundle ID · Delivery app", ph: "com.yourapp.delivery" },
  // OBD
  OBD_API_URL: { label: "API URL", ph: "https://...", wide: true },
  OBD_UKEY: { label: "User key", type: "secret" },
  OBD_SERVICENO: { label: "Service number" },
  OBD_VOICEFILE: { label: "Voice file" },
  OBD_IVRTEMPLATEID: { label: "IVR template ID" },
  OBD_SOURCETYPE: { label: "Source type" },
  OBD_CAMPAIGNTYPE: { label: "Campaign type" },
  OBD_FILETYPE: { label: "File type" },
  OBD_RETRYDURATION: { label: "Retry duration", type: "number" },
  OBD_DTMFLENGTH: { label: "DTMF length", type: "number" },
  OBD_WAITDURATION: { label: "Wait duration", type: "number" },
  // Petpooja
  PETPOOJA_SYNC_ENABLED: { label: "Menu sync", type: "bool" },
  PETPOOJA_APP_KEY: { label: "App key", type: "secret" },
  PETPOOJA_APP_SECRET: { label: "App secret", type: "secret" },
  // Analytics
  FB_PIXEL_ID: { label: "Meta (Facebook) Pixel ID", ph: "1234567890123456", hint: "Leave empty to turn tracking off." },
  // Security
  RATE_LIMIT_ENABLED: { label: "Rate limiting", type: "bool" },
  RATE_LIMIT_WINDOW: { label: "API window (minutes)", type: "number", ph: "15" },
  RATE_LIMIT_WINDOW_MS: { label: "API window (milliseconds)", type: "number", ph: "900000" },
  RATE_LIMIT_MAX: { label: "API requests per window", type: "number", ph: "100" },
  AUTH_RATE_LIMIT_WINDOW: { label: "Login window (minutes)", type: "number", ph: "15" },
  AUTH_RATE_LIMIT_MAX: { label: "Login requests per window", type: "number", ph: "20" },
  BCRYPT_SALT_ROUNDS: { label: "Password hash rounds", type: "number", ph: "10", hint: "10–12 recommended. Higher is slower." },
  // Server (.env)
  NODE_ENV: { label: "Environment", type: "select", options: ["development", "production", "test"] },
  PORT: { label: "API port", type: "number", ph: "5000" },
  SOCKET_PORT: { label: "Socket port", type: "number", ph: "5001" },
  TZ: { label: "Timezone", ph: "Asia/Kolkata" },
  MONGODB_URI: { label: "MongoDB URI", type: "secret", wide: true, ph: "mongodb+srv://user:pass@cluster/db" },
  JWT_ACCESS_SECRET: { label: "Access token secret", type: "secret", hint: "Changing it logs everyone out." },
  JWT_ACCESS_EXPIRES: { label: "Access token lifetime", ph: "15m" },
  JWT_REFRESH_SECRET: { label: "Refresh token secret", type: "secret", hint: "Changing it logs everyone out." },
  JWT_REFRESH_EXPIRES: { label: "Refresh token lifetime", ph: "7d" },
  FRONTEND_URL: { label: "Frontend URL", ph: "https://yourdomain.com", hint: "Allowed for CORS." },
  SOCKET_CORS_ORIGIN: { label: "Socket allowed origins", ph: "https://yourdomain.com" },
  REDIS_ENABLED: { label: "Redis", type: "bool" },
  REDIS_URL: { label: "Redis URL", type: "secret", ph: "redis://127.0.0.1:6379" },
  BULLMQ_ENABLED: { label: "Background queues (BullMQ)", type: "bool" },
  UPLOAD_PATH: { label: "Upload folder", ph: "uploads/ (default)", hint: "Leave empty for the default folder." },
  ENCRYPTION_KEY: { label: "Encryption key", type: "secret", hint: "Encrypts the keys saved in the database. Can't be changed here." },
};

const fieldOf = (key) => FIELDS[key] || { label: key };

/* ───────────────────────────── .env text helpers ───────────────────────────── */
const formatEnvValue = (value) => {
  const v = String(value ?? "");
  if (v === "") return "";
  if (!/[\s#"'`]/.test(v)) return v;
  if (v.includes('"') && !v.includes("'")) return `'${v}'`;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
};

// Server keys that can be written from the .env text view (ENCRYPTION_KEY is read-only)
const SERVER_TEXT_KEYS = SECTIONS.find((s) => s.source === "server").keys.filter((k) => k !== "ENCRYPTION_KEY");

// Frontend/.env keys: ignored if pasted here (they belong in Frontend/.env)
const FRONTEND_TEXT_KEYS = ["VITE_API_BASE_URL", "VITE_SOCKET_PORT"];

const banner = (title) => `# ─────────────── ${title} ───────────────`;

/**
 * Build the full backend env text:
 *   1. Backend/.env (server settings, real values; SUPER_ADMIN only)
 *   2. Keys saved in the database (admin panel)
 * `server` = { values, meta, secrets }: secrets = real secret values (from ?reveal=1).
 */
const toEnvText = (values, server = null) => {
  const blocks = [];
  if (server) {
    const lines = [banner("Backend/.env (server settings)")];
    [...SERVER_TEXT_KEYS, "ENCRYPTION_KEY"].forEach((k) => {
      const typed = server.values[k] ?? "";
      const v = typed || server.secrets?.[k] || "";
      lines.push(`${k}=${formatEnvValue(v)}`);
    });
    blocks.push(lines.join("\n"));
  }
  blocks.push(banner("Saved in the database (admin panel)"));
  DB_SECTIONS.forEach((s) => {
    blocks.push([`# ${s.title}`, ...s.keys.map((k) => `${k}=${formatEnvValue(values[k])}`)].join("\n"));
  });
  return blocks.join("\n\n") + "\n";
};

const parseEnvText = (text, allowServer = false) => {
  const values = {};
  const serverValues = {};
  const readOnly = {};
  const unknown = [];
  const invalid = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) { invalid.push(i + 1); return; }
    const key = m[1];
    let value = m[2].trim();
    const q = value[0];
    if ((q === '"' || q === "'" || q === "`") && value.length > 1 && value.endsWith(q)) {
      value = value.slice(1, -1);
      if (q === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    if (DB_KEYS.includes(key)) values[key] = value;
    else if (allowServer && SERVER_TEXT_KEYS.includes(key)) serverValues[key] = value;
    else if (key === "ENCRYPTION_KEY") readOnly[key] = value;
    else if (FRONTEND_TEXT_KEYS.includes(key)) return; // Frontend/.env key: not saved from here
    else unknown.push(key);
  });
  return { values, serverValues, readOnly, unknown, invalid };
};

/* ───────────────────────────── Small UI pieces ───────────────────────────── */
const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition " +
  "focus:border-slate-400 focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300 dark:focus:ring-slate-300/10";

function StatusPill({ status }) {
  const styles = {
    edited: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
    set: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
    empty: "bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
    locked: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };
  const label = { edited: "Edited", set: "Set", empty: "Not set", locked: "Read-only" }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles[status]}`}>
      {status === "set" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {status === "edited" && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
      {status === "locked" && <Lock className="h-3 w-3" />}
      {label}
    </span>
  );
}

function Field({ envKey, value, original, isSet, masked, readOnly, onChange, onUndo, onClear }) {
  const meta = fieldOf(envKey);
  const [reveal, setReveal] = useState(false);
  const type = meta.type || "text";
  const edited = value !== original;
  const status = readOnly ? "locked" : edited ? "edited" : (isSet || value) ? "set" : "empty";
  const placeholder = masked ? `${masked}  ·  type to replace` : meta.ph ? `e.g. ${meta.ph}` : "Not set";

  let jsonError = "";
  if (type === "json" && value.trim()) {
    try { JSON.parse(value); } catch { jsonError = "Not valid JSON"; }
  }
  let numberError = "";
  if (type === "number" && value.trim() && !/^\d+$/.test(value.trim())) numberError = "Numbers only";

  let control;
  if (type === "choice") {
    const current = value || meta.fallback || "";
    control = (
      <div className="flex flex-wrap gap-2">
        {(meta.options || []).map((o) => {
          const selected = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(o.value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${selected ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-slate-500"}`}>
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    );
  } else if (type === "bool") {
    control = (
      <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
        {[["true", "On"], ["false", "Off"]].map(([v, l]) => (
          <button
            key={v}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(v)}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              value === v
                ? v === "true" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-400 text-white shadow-sm dark:bg-slate-600"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    );
  } else if (type === "select") {
    control = (
      <select value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} className={`${inputBase} border-slate-300 dark:border-slate-700`}>
        <option value="">Not set</option>
        {(meta.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (type === "json") {
    control = (
      <textarea
        value={value}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={value ? 4 : 2}
        spellCheck={false}
        className={`${inputBase} resize-y leading-5 ${jsonError ? "border-red-300" : "border-slate-300 dark:border-slate-700"}`}
      />
    );
  } else {
    const isSecret = type === "secret";
    control = (
      <div className="relative">
        <input
          type={isSecret && !reveal ? "password" : "text"}
          inputMode={type === "number" ? "numeric" : undefined}
          value={value}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          placeholder={readOnly ? (masked || "Not set") : placeholder}
          autoComplete="new-password"
          spellCheck={false}
          className={`${inputBase} ${isSecret ? "pr-10" : ""} ${numberError ? "border-red-300" : "border-slate-300 dark:border-slate-700"}`}
        />
        {isSecret && !readOnly && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title={reveal ? "Hide" : "Show"}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  }

  // One row: name + key + hint on the left, value on the right
  return (
    <div className="group grid grid-cols-1 items-center gap-1.5 px-4 py-2.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{meta.label}</span>
          <StatusPill status={status} />
        </div>
        <div className="truncate text-xs text-slate-400">{envKey}</div>
        {meta.hint && <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{meta.hint}</p>}
      </div>
      <div className="min-w-0">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">{control}</div>
          {edited ? (
            <button type="button" onClick={onUndo} title="Undo change" className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
              <Undo2 className="h-4 w-4" />
            </button>
          ) : !readOnly && value && onClear ? (
            <button type="button" onClick={onClear} title="Clear value" className="mt-0.5 rounded p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}
        </div>
        {(jsonError || numberError) && <p className="mt-1 text-xs text-red-600">{jsonError || numberError}</p>}
      </div>
    </div>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */
/* Frontend/.env template for a new developer (example values) */
const FRONTEND_TEMPLATE = [
  "VITE_API_BASE_URL=http://localhost:5000/api/v1",
  "VITE_SOCKET_PORT=5001",
].join("\n");

function FrontendEnvSection() {
  const [open, setOpen] = useState(false);
  const copyText = async (value, message) => {
    try {
      await navigator.clipboard.writeText(value + "\n");
      toast.success(message);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-indigo-600 pb-3 dark:border-indigo-400">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white dark:bg-indigo-500">
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              Frontend (.env file)
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">Frontend/.env</span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Add this in Frontend/.env to start the frontend.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:bg-slate-800 dark:text-indigo-300"
        >
          <FileText className="h-4 w-4" />
          {open ? "Hide template" : "Show Frontend/.env template"}
        </button>
      </div>

      {open && (
        <div className="overflow-hidden rounded-xl border border-indigo-200 dark:border-indigo-500/30">
          <div className="border-b border-indigo-800 bg-indigo-950 px-4 py-2 text-xs text-indigo-200">
            Add this env to <code className="font-semibold text-white">Frontend/.env</code> to start the frontend.
          </div>
          <div className="flex items-start justify-between gap-3 bg-slate-950 px-4 py-3">
            <pre className="overflow-x-auto font-mono text-[13px] leading-6 text-indigo-50">{FRONTEND_TEMPLATE}</pre>
            <button
              type="button"
              onClick={() => copyText(FRONTEND_TEMPLATE, "Template copied. Paste it into Frontend/.env")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-indigo-700 px-2.5 py-1.5 text-xs font-medium text-indigo-100 hover:bg-indigo-900"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
        </div>
      )}

    </section>
  );
}

/* Backend/.env template for a new developer. Example values only: never real secrets. */
const randomSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const buildBackendTemplate = (jwtAccess, jwtRefresh) => [
  "NODE_ENV=development",
  "PORT=5000",
  "MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/DATABASE",
  `JWT_ACCESS_SECRET=${jwtAccess}`,
  `JWT_REFRESH_SECRET=${jwtRefresh}`,
  "ENCRYPTION_KEY=ASK_ADMIN_FOR_THE_SAME_KEY",
].join("\n");

function BackendEnvSetupSection() {
  const [open, setOpen] = useState(false);
  const [secrets] = useState(() => [randomSecret(), randomSecret()]);
  const text = buildBackendTemplate(secrets[0], secrets[1]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text + "\n");
      toast.success("Copied. Paste it into Backend/.env");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-teal-600 pb-3 dark:border-teal-400">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white dark:bg-teal-500">
            <Server className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              Backend (.env file)
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">Backend/.env</span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Add this in Backend/.env to start the server.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 dark:border-teal-500/40 dark:bg-slate-800 dark:text-teal-300"
        >
          <FileText className="h-4 w-4" />
          {open ? "Hide template" : "Show Backend/.env template"}
        </button>
      </div>

      {open && (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-900 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
            <span>
              Add this env to <code className="font-semibold">Backend/.env</code> to start the server.
              Fill in <code className="font-semibold">MONGODB_URI</code> and <code className="font-semibold">ENCRYPTION_KEY</code> (ask the admin).
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-teal-200 dark:border-teal-500/30">
            <div className="flex items-start justify-between gap-3 bg-slate-950 px-4 py-3">
              <pre className="overflow-x-auto font-mono text-[13px] leading-6 text-teal-50">{text}</pre>
              <button
                type="button"
                onClick={copy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-teal-700 px-2.5 py-1.5 text-xs font-medium text-teal-100 hover:bg-teal-900"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function EnvManagements() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [viewMode, setViewMode] = useState("form"); // "form" | "env"
  const [envText, setEnvText] = useState("");
  const [query, setQuery] = useState("");

  // DB (admin-managed) keys
  const [dbOriginal, setDbOriginal] = useState({});
  const [dbDraft, setDbDraft] = useState({});
  // Server .env keys
  const [server, setServer] = useState({});
  const [serverDraft, setServerDraft] = useState({});
  const [canManageServer, setCanManageServer] = useState(false); // SUPER_ADMIN only
  // Real secret values of Backend/.env, loaded only when the "Full backend env" view opens
  const [serverSecrets, setServerSecrets] = useState({});

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [dbRes, serverRes] = await Promise.all([
        adminAPI.getEnvSettings(),
        // Only SUPER_ADMIN may read server .env settings; others get 403 and the section is hidden
        adminAPI.getServerEnv().catch((err) => {
          if (err?.response?.status === 403) return null;
          throw err;
        }),
      ]);
      setCanManageServer(Boolean(serverRes));
      const dbData = dbRes?.data?.data || {};
      const values = {};
      DB_KEYS.forEach((k) => { values[k] = String(dbData[k]?.value ?? ""); });
      setDbOriginal(values);
      setDbDraft(values);

      const serverData = serverRes?.data?.data || {};
      setServer(serverData);
      const sv = {};
      Object.entries(serverData).forEach(([k, v]) => { sv[k] = String(v?.value ?? ""); });
      setServerDraft(sv);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const serverOriginal = useMemo(() => {
    const o = {};
    Object.entries(server).forEach(([k, v]) => { o[k] = String(v?.value ?? ""); });
    return o;
  }, [server]);

  const dbChanges = useMemo(() => DB_KEYS.filter((k) => (dbDraft[k] ?? "") !== (dbOriginal[k] ?? "")), [dbDraft, dbOriginal]);
  const serverChanges = useMemo(
    () => Object.keys(serverDraft).filter((k) => (serverDraft[k] ?? "") !== (serverOriginal[k] ?? "")),
    [serverDraft, serverOriginal]
  );
  const changeCount = dbChanges.length + serverChanges.length;

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!changeCount) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [changeCount]);

  const isFieldSet = (section, key) =>
    section.source === "server" ? Boolean(server[key]?.isSet || serverDraft[key]) : Boolean(dbDraft[key]);

  // Keys shown for a section (SMS: only the chosen provider's fields)
  const sectionKeys = (sec) => {
    if (!sec.providerKey) return sec.keys;
    const chosen = dbDraft[sec.providerKey] || sec.defaultProvider;
    return [sec.providerKey, ...(sec.providers[chosen] || []), ...(sec.sharedKeys || [])];
  };

  const matches = (key) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return key.toLowerCase().includes(q) || fieldOf(key).label.toLowerCase().includes(q);
  };

  const visibleSections = SECTIONS
    .filter((s) => s.source !== "server" || canManageServer)
    .map((s) => ({ ...s, visibleKeys: sectionKeys(s).filter(matches) }))
    .filter((s) => s.visibleKeys.length);

  // Server block in the .env text only for SUPER_ADMIN
  const serverTextSource = (values, secrets = serverSecrets) =>
    (canManageServer ? { values, meta: server, secrets } : null);

  /**
   * Read the .env text back into the drafts. Database keys: a missing line clears the key.
   * Server keys: a missing line keeps the current value (so deleting a line can't wipe PORT etc.);
   * a secret left as it was (or emptied) is kept; an empty non-secret removes it from .env.
   * Returns { db, server } or null when the text has errors.
   */
  const applyEnvText = () => {
    const { values, serverValues, readOnly, unknown, invalid } = parseEnvText(envText, canManageServer);
    if (invalid.length) {
      toast.error(`Invalid line(s): ${invalid.join(", ")}. Use KEY=value format.`);
      return null;
    }
    if (unknown.length) toast.warning(`Ignored (not managed here): ${unknown.join(", ")}`);
    if ("ENCRYPTION_KEY" in readOnly && readOnly.ENCRYPTION_KEY !== (serverSecrets.ENCRYPTION_KEY ?? readOnly.ENCRYPTION_KEY)) {
      toast.warning("ENCRYPTION_KEY can't be changed from the admin panel. Your change was ignored.");
    }
    const nextDb = {};
    DB_KEYS.forEach((k) => { nextDb[k] = values[k] ?? ""; });
    setDbDraft(nextDb);

    let nextServer = serverDraft;
    if (canManageServer) {
      nextServer = { ...serverDraft };
      SERVER_TEXT_KEYS.forEach((k) => {
        if (!(k in serverValues)) return;
        const v = serverValues[k];
        // Secret shown with its real value and not edited: nothing to save
        if (server[k]?.isSecret && v === (serverSecrets[k] ?? "")) nextServer[k] = "";
        else nextServer[k] = v;
      });
      setServerDraft(nextServer);
    }
    return { db: nextDb, server: nextServer };
  };

  const switchView = async (mode) => {
    if (mode === viewMode) return;
    if (mode === "env") {
      let secrets = serverSecrets;
      if (canManageServer) {
        try {
          const res = await adminAPI.getServerEnv(true);
          secrets = {};
          Object.entries(res?.data?.data || {}).forEach(([k, v]) => {
            if (v?.secretValue !== undefined) secrets[k] = v.secretValue;
          });
          setServerSecrets(secrets);
        } catch (error) {
          toast.error(error?.response?.data?.message || "Could not load server secrets");
        }
      }
      setEnvText(toEnvText(dbDraft, serverTextSource(serverDraft, secrets)));
    } else {
      if (!applyEnvText()) return;
      setServerSecrets({}); // don't keep real secrets in memory outside this view
    }
    setViewMode(mode);
  };

  const discardChanges = () => {
    setDbDraft(dbOriginal);
    setServerDraft(serverOriginal);
    if (viewMode === "env") setEnvText(toEnvText(dbOriginal, serverTextSource(serverOriginal)));
  };

  const handleSave = async () => {
    let draft = dbDraft;
    let sDraft = serverDraft;
    if (viewMode === "env") {
      const parsed = applyEnvText();
      if (!parsed) return;
      draft = parsed.db;
      sDraft = parsed.server;
    }
    const dbKeys = DB_KEYS.filter((k) => (draft[k] ?? "") !== (dbOriginal[k] ?? ""));
    const srvKeys = canManageServer ? Object.keys(sDraft).filter((k) => (sDraft[k] ?? "") !== (serverOriginal[k] ?? "")) : [];
    if (!dbKeys.length && !srvKeys.length) {
      toast.info("No changes to save");
      return;
    }

    // Basic checks before saving
    const problems = [];
    [...dbKeys.map((k) => [k, draft[k] ?? ""]), ...srvKeys.map((k) => [k, sDraft[k] ?? ""])].forEach(([k, v]) => {
      const t = fieldOf(k).type;
      if (t === "json" && v.trim()) { try { JSON.parse(v); } catch { problems.push(`${fieldOf(k).label}: not valid JSON`); } }
      if (t === "number" && v.trim() && !/^\d+$/.test(v.trim())) problems.push(`${fieldOf(k).label}: numbers only`);
    });
    if (problems.length) { toast.error(problems.join(". ")); return; }

    try {
      setSaving(true);
      if (dbKeys.length) {
        const payload = {};
        dbKeys.forEach((k) => { payload[k] = draft[k] ?? ""; });
        await adminAPI.updateEnvSettings(payload);
      }
      if (srvKeys.length) {
        const payload = {};
        srvKeys.forEach((k) => { payload[k] = sDraft[k] ?? ""; });
        await adminAPI.updateServerEnv(payload);
      }
      toast.success(`Saved ${dbKeys.length + srvKeys.length} change(s). Reload servers to apply everywhere.`);
      setNeedsReload(true);
      setViewMode("form");
      setServerSecrets({});
      await fetchAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReloadServers = async () => {
    if (!window.confirm("Reload all backend servers now? Live requests may be interrupted for a few seconds.")) return;
    try {
      setReloading(true);
      const response = await adminAPI.reloadServers();
      if (response?.data?.success) {
        toast.success(response.data.message || "Reloading servers...");
        setNeedsReload(false);
        setTimeout(() => { fetchAll(); setReloading(false); }, 8000);
        return;
      }
      setReloading(false);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reload servers");
      setReloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-28 md:p-6 md:pb-28 lg:p-8 lg:pb-28">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Environment & Keys</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            API keys and server settings. Saved keys are encrypted in the database{canManageServer ? "; server settings live in the .env file" : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReloadServers}
            disabled={reloading || saving}
            title="Restart all backend processes so every server uses the saved values"
            className="relative inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <RotateCw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} />
            {reloading ? "Reloading..." : "Reload servers"}
            {needsReload && !reloading && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!changeCount && viewMode === "form")}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-slate-400 dark:border-t-slate-900" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : changeCount ? `Save ${changeCount} change${changeCount > 1 ? "s" : ""}` : "Save"}
          </button>
        </div>
      </div>

      {/* Toolbar: search + view */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={viewMode === "env"}
            placeholder="Search keys, e.g. razorpay, smtp, firebase"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {needsReload && (
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Saved. Reload servers to apply.
            </span>
          )}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
            {[
              { mode: "form", label: "Fields", Icon: LayoutGrid },
              { mode: "env", label: "Full backend env", Icon: FileText },
            ].map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchView(mode)}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === mode ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === "env" ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The full configuration as <code className="font-mono">KEY=value</code> lines, with real values:
            {canManageServer ? " Backend/.env first, then" : ""} the keys saved in the database. Copy it to set up a new machine, or paste a whole .env here and save.
            {" "}Database keys: delete a line or leave it empty to clear it.
            {canManageServer && " Server keys: a deleted line is kept as it is. ENCRYPTION_KEY is shown only and can't be changed here."}
            {canManageServer && <strong className="font-semibold text-slate-700 dark:text-slate-200"> Contains secrets: don't share screenshots of it.</strong>}
          </p>
          <textarea
            value={envText}
            onChange={(e) => setEnvText(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            rows={Math.min(40, Math.max(16, envText.split("\n").length + 1))}
            className="w-full overflow-auto whitespace-pre rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[13px] leading-6 text-slate-100 outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
      ) : (
        <div className="space-y-8">
          {query && !visibleSections.length && (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
              No keys match "{query}".
            </div>
          )}
          {!query && <FrontendEnvSection />}
          {!query && <BackendEnvSetupSection />}
          {visibleSections.map((s) => {
            const isServer = s.source === "server";
            const shownKeys = sectionKeys(s);
            const setCount = shownKeys.filter((k) => isFieldSet(s, k)).length;
            const Icon = s.icon;
            return (
              <section key={s.id} className="space-y-3">
                {/* Section heading */}
                <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-900 pb-3 dark:border-slate-200">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                        {s.title}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${isServer ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                          {isServer ? ".env file" : "Database · encrypted"}
                        </span>
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{s.subtitle}</p>
                    </div>
                  </div>
                  <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">{setCount}</span> / {shownKeys.length} set
                  </span>
                </div>

                {isServer && (
                  <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span>
                      Secret values are never shown. Leave a secret empty to keep it; type a new value to replace it.
                      A wrong database URI or JWT secret can stop the server or log everyone out, so double-check before saving.
                    </span>
                  </div>
                )}

                {/* Fields */}
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800">
                  {s.visibleKeys.map((k) =>
                    isServer ? (
                      <Field
                        key={k}
                        envKey={k}
                        value={serverDraft[k] ?? ""}
                        original={serverOriginal[k] ?? ""}
                        isSet={server[k]?.isSet}
                        masked={server[k]?.masked}
                        readOnly={server[k]?.readOnly}
                        onChange={(v) => setServerDraft((d) => ({ ...d, [k]: v }))}
                        onUndo={() => setServerDraft((d) => ({ ...d, [k]: serverOriginal[k] ?? "" }))}
                        onClear={server[k]?.isSecret ? null : () => setServerDraft((d) => ({ ...d, [k]: "" }))}
                      />
                    ) : (
                      <Field
                        key={k}
                        envKey={k}
                        value={dbDraft[k] ?? ""}
                        original={dbOriginal[k] ?? ""}
                        onChange={(v) => setDbDraft((d) => ({ ...d, [k]: v }))}
                        onUndo={() => setDbDraft((d) => ({ ...d, [k]: dbOriginal[k] ?? "" }))}
                        onClear={() => setDbDraft((d) => ({ ...d, [k]: "" }))}
                      />
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Unsaved changes bar */}
      {changeCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl ring-1 ring-black/10 dark:bg-white dark:text-slate-900">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              {changeCount} unsaved change{changeCount > 1 ? "s" : ""}
            </span>
            <button type="button" onClick={discardChanges} className="rounded-md px-3 py-1.5 font-medium text-slate-300 hover:bg-white/10 hover:text-white dark:text-slate-600 dark:hover:bg-slate-100 dark:hover:text-slate-900">
              Discard
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-md bg-white px-3 py-1.5 font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
