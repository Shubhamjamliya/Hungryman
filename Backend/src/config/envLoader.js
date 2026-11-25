import { readEnvSettings } from '../models/EnvSetting.js';
import { decrypt } from '../utils/encryption.js';
import { updateConfig } from './env.js';
import { ALLOWED_ENV_KEYS } from '../controllers/admin/envSettingController.js';

export const loadEnvFromDb = async () => {
    try {
        const settings = await readEnvSettings();
        let count = 0;

        for (const [key, stored] of Object.entries(settings)) {
            // Only admin-managed keys; startup keys (Mongo, JWT, ...) always come from .env
            if (!ALLOWED_ENV_KEYS.includes(key) || stored == null) continue;
            const value = decrypt(stored);
            if (value === null) {
                console.error(`Skipping ${key}: cannot decrypt (check ENCRYPTION_KEY)`);
                continue;
            }
            process.env[key] = value;
            count++;
        }
        
        if (count > 0) {
            updateConfig();
            console.log(`Loaded ${count} environment variables from Database`);
        }
    } catch (error) {
        console.error('Error loading env settings from DB:', error.message);
    }
};
