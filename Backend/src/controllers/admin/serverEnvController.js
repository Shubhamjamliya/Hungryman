/**
 * Server .env keys (startup settings) shown in Admin > Environment Managements.
 * These stay in the Backend/.env file (they are needed before MongoDB is connected).
 * Saving here rewrites that file; changes apply after "Reload Servers".
 *
 * - Secrets are never sent to the browser: only "set" + a masked hint.
 * - ENCRYPTION_KEY is read-only: changing it would make every saved secret unreadable.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ENV_FILE = path.join(BACKEND_ROOT, '.env');
const ENV_BACKUP_FILE = path.join(BACKEND_ROOT, '.env.previous');

// key -> rules. secret: masked, never returned. readOnly: shown only.
export const SERVER_ENV_FIELDS = {
    NODE_ENV: { options: ['development', 'production', 'test'] },
    PORT: { type: 'port' },
    SOCKET_PORT: { type: 'port' },
    TZ: {},
    MONGODB_URI: { secret: true, type: 'mongo' },
    JWT_ACCESS_SECRET: { secret: true, minLength: 16 },
    JWT_ACCESS_EXPIRES: {},
    JWT_REFRESH_SECRET: { secret: true, minLength: 16 },
    JWT_REFRESH_EXPIRES: {},
    FRONTEND_URL: {},
    SOCKET_CORS_ORIGIN: {},
    REDIS_ENABLED: { options: ['true', 'false'] },
    REDIS_URL: { secret: true },
    BULLMQ_ENABLED: { options: ['true', 'false'] },
    UPLOAD_PATH: {},
    ENCRYPTION_KEY: { secret: true, readOnly: true },
};

const readEnvFile = () => (fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '');

// Show enough to recognise a value without revealing it
const maskValue = (key, value) => {
    if (!value) return '';
    if (SERVER_ENV_FIELDS[key]?.type === 'mongo' || /^[a-z+]+:\/\//i.test(value)) {
        return value.replace(/\/\/[^@/]*@/, '//•••@').split('?')[0];
    }
    return `••••••••${value.length > 8 ? value.slice(-4) : ''}`;
};

// ?reveal=1 also returns secret values (used only by the ".env format" view, SUPER_ADMIN route)
export const getServerEnv = (req, res) => {
    try {
        const values = dotenv.parse(readEnvFile());
        const reveal = String(req.query?.reveal || '') === '1';
        const data = {};
        for (const [key, rules] of Object.entries(SERVER_ENV_FIELDS)) {
            const value = String(values[key] ?? '').trim();
            data[key] = {
                value: rules.secret ? '' : value,
                isSet: Boolean(value),
                isSecret: Boolean(rules.secret),
                readOnly: Boolean(rules.readOnly),
                masked: rules.secret ? maskValue(key, value) : '',
                options: rules.options || null,
                ...(reveal && rules.secret ? { secretValue: value } : {}),
            };
        }
        if (reveal) res.set('Cache-Control', 'no-store');
        res.status(200).json({ success: true, data, file: '.env' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const validate = (key, value) => {
    const rules = SERVER_ENV_FIELDS[key];
    if (!rules) return `${key} is not a server setting`;
    if (rules.readOnly) return `${key} can't be changed from the admin panel`;
    if (/[\r\n]/.test(value)) return `${key}: must be a single line`;
    if (value.length > 2000) return `${key}: value is too long`;
    if (value === '') return null;
    if (rules.options && !rules.options.includes(value)) return `${key}: must be one of ${rules.options.join(', ')}`;
    if (rules.type === 'port') {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 65535) return `${key}: must be a port number (1-65535)`;
    }
    if (rules.type === 'mongo' && !/^mongodb(\+srv)?:\/\//.test(value)) return `${key}: must start with mongodb:// or mongodb+srv://`;
    if (rules.minLength && value.length < rules.minLength) return `${key}: must be at least ${rules.minLength} characters`;
    return null;
};

// Write a value the way dotenv reads it back
const formatValue = (value) => {
    if (!/[\s#"'`]/.test(value)) return value;
    if (!value.includes("'")) return `'${value}'`;
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const updateServerEnv = async (req, res) => {
    try {
        const updates = req.body && typeof req.body === 'object' ? req.body : {};
        const errors = [];
        const changes = {};

        for (const [key, raw] of Object.entries(updates)) {
            const value = String(raw ?? '').trim();
            const rules = SERVER_ENV_FIELDS[key];
            // Empty secret = keep the current value (the browser never had it)
            if (rules?.secret && value === '') continue;
            const error = validate(key, value);
            if (error) errors.push(error);
            else changes[key] = value;
        }

        if (errors.length) {
            return res.status(400).json({ success: false, message: errors.join('. ') });
        }
        if (!Object.keys(changes).length) {
            return res.status(200).json({ success: true, message: 'No server .env changes', changed: [] });
        }

        const original = readEnvFile();
        const eol = original.includes('\r\n') ? '\r\n' : '\n';
        let text = original;

        for (const [key, value] of Object.entries(changes)) {
            const lineRe = new RegExp(`^${escapeRegExp(key)}=.*(?:\\r?\\n)?`, 'm');
            if (value === '') {
                text = text.replace(lineRe, ''); // remove: the app falls back to its default
            } else if (lineRe.test(text)) {
                text = text.replace(new RegExp(`^${escapeRegExp(key)}=.*$`, 'm'), () => `${key}=${formatValue(value)}`);
            } else {
                if (text && !text.endsWith('\n')) text += eol;
                text += `${key}=${formatValue(value)}${eol}`;
            }
        }

        // Safety check: the new file must parse back to exactly the intended values
        const parsed = dotenv.parse(text);
        for (const [key, value] of Object.entries(changes)) {
            if ((parsed[key] ?? '') !== value) {
                return res.status(500).json({ success: false, message: `Could not write ${key} safely. Nothing was changed.` });
            }
        }

        // Keep the previous file, then replace atomically
        if (original) fs.writeFileSync(ENV_BACKUP_FILE, original, { mode: 0o600 });
        const tmp = `${ENV_FILE}.tmp`;
        fs.writeFileSync(tmp, text, { mode: 0o600 });
        fs.renameSync(tmp, ENV_FILE);
        try { fs.chmodSync(ENV_FILE, 0o600); } catch { /* not supported on Windows */ }

        res.status(200).json({
            success: true,
            message: 'Server .env updated. Click "Reload Servers" to apply.',
            changed: Object.keys(changes),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
