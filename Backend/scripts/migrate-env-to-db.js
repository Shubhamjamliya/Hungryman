/**
 * Copy admin-managed credentials from Backend/.env into MongoDB (EnvSetting, encrypted).
 *
 *   node scripts/migrate-env-to-db.js            -> dry run: shows what would change (key names only)
 *   node scripts/migrate-env-to-db.js --apply    -> writes to the DB
 *   add --overwrite to replace values already saved in the DB (default: keep DB values)
 *
 * Startup keys (Mongo, JWT, Redis, PORT...) are never copied: they stay in .env.
 * Requires ENCRYPTION_KEY in .env, and the SAME key must be in the server's .env.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { config } from '../src/config/env.js';
import EnvSetting, { ENV_SETTINGS_COLLECTION } from '../src/models/EnvSetting.js';
import { encrypt } from '../src/utils/encryption.js';
import { ALLOWED_ENV_KEYS } from '../src/controllers/admin/envSettingController.js';

const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');

// Strict decrypt: returns null when the value can't be decrypted with the current key
const tryDecrypt = (text) => {
    try {
        const [ivHex, dataHex] = String(text).split(':');
        if (!ivHex || !dataHex) return null;
        const key = crypto.createHash('sha256').update(String(process.env.ENCRYPTION_KEY))
            .digest('base64').substring(0, 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(ivHex, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString();
    } catch {
        return null;
    }
};

const main = async () => {
    if (!process.env.ENCRYPTION_KEY) {
        console.error('ENCRYPTION_KEY is not set in .env. Add it first (and put the same key on the server).');
        process.exit(1);
    }
    if (!fs.existsSync(envPath)) {
        console.error(`.env not found at ${envPath}`);
        process.exit(1);
    }

    const fileValues = dotenv.parse(fs.readFileSync(envPath));
    const host = config.mongodbUri.replace(/\/\/[^@]*@/, '//***@').split('?')[0];
    console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} -> ${host}  collection: ${ENV_SETTINGS_COLLECTION}\n`);

    await mongoose.connect(config.mongodbUri);

    const existing = new Map((await EnvSetting.find({})).map((d) => [d.key, d]));
    const unreadable = [...existing.values()]
        .filter((d) => d.isEncrypted && tryDecrypt(d.value) === null)
        .map((d) => d.key);

    const result = { create: [], update: [], same: [], keptDb: [], empty: [] };

    for (const key of ALLOWED_ENV_KEYS) {
        const value = (fileValues[key] ?? '').trim();
        if (!value) { result.empty.push(key); continue; }

        const doc = existing.get(key);
        const current = doc ? (doc.isEncrypted ? tryDecrypt(doc.value) : doc.value) : undefined;

        if (!doc) result.create.push(key);
        else if (current === value) { result.same.push(key); continue; }
        else if (!OVERWRITE && current !== null) { result.keptDb.push(key); continue; }
        else result.update.push(key);

        if (APPLY) {
            await EnvSetting.findOneAndUpdate(
                { key },
                { value: encrypt(value), isEncrypted: true },
                { upsert: true }
            );
        }
    }

    const show = (label, list) => console.log(`${label} (${list.length}): ${list.join(', ') || '-'}`);
    show(APPLY ? 'Created' : 'Will create', result.create);
    show(APPLY ? 'Updated' : 'Will update', result.update);
    show('Already same', result.same);
    show('Different in DB, kept (use --overwrite)', result.keptDb);
    show('Not in .env / empty, skipped', result.empty);
    if (unreadable.length) {
        console.log(`\nWARNING: ${unreadable.length} DB values can't be decrypted with this ENCRYPTION_KEY: ${unreadable.join(', ')}`);
        console.log('They will be replaced from .env where .env has a value.');
    }
    const notManaged = Object.keys(fileValues).filter((k) => !ALLOWED_ENV_KEYS.includes(k));
    console.log(`\nStays in .env only (${notManaged.length}): ${notManaged.join(', ')}`);
    if (!APPLY) console.log('\nNothing written. Re-run with --apply to save.');

    await mongoose.disconnect();
};

main().catch(async (err) => {
    console.error('Migration failed:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
