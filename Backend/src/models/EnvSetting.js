import mongoose from 'mongoose';
import { ENV_GROUPS, groupOfKey } from '../config/envGroups.js';

/**
 * All admin-panel keys are stored in ONE document, grouped by service:
 *   {
 *     name: "app_env",
 *     settings: {
 *       razorpay:   { RAZORPAY_MODE: "<encrypted>", RAZORPAY_TEST_KEY_ID: "<encrypted>", ... },
 *       sms:        { SMS_PROVIDER: "<encrypted>", SMS_INDIA_HUB_API_KEY: "<encrypted>", ... },
 *       cloudinary: { CLOUDINARY_CLOUD_NAME: "<encrypted>", ... },
 *       ...
 *     }
 *   }
 * Groups are defined in config/envGroups.js. Every value is encrypted with ENCRYPTION_KEY.
 * Collection is not "envsettings": older server code reads that one on startup.
 */
export const ENV_SETTINGS_COLLECTION = 'app_env_settings';
const DOC_NAME = 'app_env';

const envSettingsSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, default: DOC_NAME },
  // { group: { KEY: encryptedValue } }
  settings: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, minimize: false });

const EnvSettings = mongoose.model('EnvSettings', envSettingsSchema, ENV_SETTINGS_COLLECTION);

/** All stored keys, flattened: { KEY: encryptedValue }. */
export const readEnvSettings = async () => {
  const doc = await EnvSettings.findOne({ name: DOC_NAME }).lean();
  const flat = {};
  for (const [group, values] of Object.entries(doc?.settings || {})) {
    if (!values || typeof values !== 'object') continue;
    for (const [key, encrypted] of Object.entries(values)) {
      // Only keys that belong to this group
      if (groupOfKey(key) === group && encrypted != null) flat[key] = encrypted;
    }
  }
  return flat;
};

/** Set and/or remove keys (each under its group) in one atomic update. */
export const writeEnvSettings = async (set = {}, unset = []) => {
  const path = (key) => {
    const group = groupOfKey(key);
    if (!group) throw new Error(`${key} has no settings group`);
    return `settings.${group}.${key}`;
  };
  const update = {};
  const setEntries = Object.entries(set);
  if (setEntries.length) update.$set = Object.fromEntries(setEntries.map(([k, v]) => [path(k), v]));
  if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [path(k), '']));
  if (!update.$set && !update.$unset) return;
  await EnvSettings.updateOne({ name: DOC_NAME }, update, { upsert: true });
};

/** Build the grouped object from a flat { KEY: encryptedValue } map. */
export const groupSettings = (flat) => {
  const grouped = Object.fromEntries(Object.keys(ENV_GROUPS).map((g) => [g, {}]));
  for (const [key, encrypted] of Object.entries(flat)) {
    const group = groupOfKey(key);
    if (group) grouped[group][key] = encrypted;
  }
  return grouped;
};

export default EnvSettings;
