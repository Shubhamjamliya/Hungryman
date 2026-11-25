import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { readEnvSettings, writeEnvSettings } from '../../models/EnvSetting.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { updateConfig } from '../../config/env.js';

// Keys that must stay in the server's .env file: they are needed before the DB is
// connected, or are read only once while the app is being built. Never taken from the DB.
export const BOOTSTRAP_ENV_KEYS = [
    'PORT', 'SOCKET_PORT', 'HOST', 'NODE_ENV', 'TZ', 'ENCRYPTION_KEY',
    'MONGODB_URI',
    'JWT_SECRET', 'JWT_ACCESS_SECRET', 'JWT_ACCESS_EXPIRES', 'JWT_REFRESH_SECRET', 'JWT_REFRESH_EXPIRES',
    'REDIS_ENABLED', 'REDIS_URL', 'BULLMQ_ENABLED',
    'FRONTEND_URL', 'SOCKET_CORS_ORIGIN', 'UPLOAD_PATH', 'UPLOAD_DIR'
];

// Keys managed from the admin panel, grouped by service (see config/envGroups.js)
export { ALLOWED_ENV_KEYS } from '../../config/envGroups.js';
import { ALLOWED_ENV_KEYS } from '../../config/envGroups.js';

export const getAllEnvSettings = async (req, res) => {
    try {
        const stored = await readEnvSettings();
        const settingsMap = {};
        for (const [key, encrypted] of Object.entries(stored)) {
            const value = decrypt(encrypted);
            if (value !== null) settingsMap[key] = value;
        }

        // Merge with process.env for keys that don't exist in DB yet
        const result = {};
        ALLOWED_ENV_KEYS.forEach(key => {
            // Priority: DB value > process.env value
            const dbValue = settingsMap[key];
            const envValue = process.env[key];
            
            result[key] = {
                value: dbValue !== undefined ? dbValue : (envValue || ''),
                isOverridden: dbValue !== undefined
            };
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateEnvSettings = async (req, res) => {
    try {
        const updates = req.body;
        
        const mode = updates.RAZORPAY_MODE;
        if (mode && !['test', 'live'].includes(String(mode).trim().toLowerCase())) {
            return res.status(400).json({ success: false, message: 'RAZORPAY_MODE must be test or live' });
        }

        const provider = updates.SMS_PROVIDER;
        if (provider && !['smsindiahub', 'smswala', 'msg91'].includes(String(provider).trim().toLowerCase())) {
            return res.status(400).json({ success: false, message: 'SMS_PROVIDER must be smsindiahub, smswala or msg91' });
        }

        const toSet = {};
        const toUnset = [];
        for (const [key, value] of Object.entries(updates)) {
            if (!ALLOWED_ENV_KEYS.includes(key)) continue;
            if (value === null || value === undefined || value === '') {
                toUnset.push(key); // empty = remove the key
            } else {
                toSet[key] = encrypt(String(value));
            }
        }

        // One atomic update of the single settings document
        await writeEnvSettings(toSet, toUnset);

        // Reflect immediately in this process (other processes: Reload servers)
        for (const key of Object.keys(toSet)) process.env[key] = String(updates[key]);
        for (const key of toUnset) delete process.env[key];
        
        // Update the app config object
        updateConfig();
        
        res.status(200).json({ success: true, message: 'Environment settings updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Backend root (where ecosystem.config.cjs lives)
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ECOSYSTEM_FILE = path.join(BACKEND_ROOT, 'ecosystem.config.cjs');
let reloadInProgress = false;

/**
 * Reload every PM2 process of this project (API cluster, socket, scheduler, workers)
 * so they all re-read the env settings from the DB on startup.
 * Only the apps in ecosystem.config.cjs are reloaded, not other apps on the server.
 */
export const reloadServers = async (req, res) => {
    // pm_id is set by PM2 for every process it manages
    if (process.env.pm_id === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Server is not running under PM2. Restart it manually to apply changes.'
        });
    }
    if (reloadInProgress) {
        return res.status(409).json({ success: false, message: 'A reload is already in progress' });
    }

    reloadInProgress = true;
    res.status(202).json({
        success: true,
        message: 'Reloading all servers. This takes a few seconds.'
    });

    // Run after the response is sent, detached, so it survives this process being reloaded
    setTimeout(() => {
        try {
            const child = spawn('pm2', ['reload', ECOSYSTEM_FILE], {
                cwd: BACKEND_ROOT,
                detached: true,
                stdio: 'ignore',
                shell: true
            });
            child.on('error', (err) => {
                console.error('PM2 reload failed:', err.message);
                reloadInProgress = false;
            });
            child.unref();
        } catch (error) {
            console.error('PM2 reload failed:', error.message);
            reloadInProgress = false;
        }
        // Safety reset in case this process is not among the reloaded ones
        setTimeout(() => { reloadInProgress = false; }, 60000).unref();
    }, 500);
};
