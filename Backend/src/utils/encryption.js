import crypto from 'crypto';

// ENCRYPTION_KEY must be set in the server's .env. There is no fallback key:
// a key written in the code would let anyone with the repo decrypt the secrets.
const getSecretKey = () => {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('ENCRYPTION_KEY is not set in .env');
    }
    // 32 byte key for aes-256-cbc
    return crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
};

// Throws on failure, so a value is never stored unencrypted by mistake
export const encrypt = (text) => {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(getSecretKey()), iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Returns null when the value can't be decrypted (wrong/missing key, corrupt value),
// so callers never use the encrypted text as if it were the real secret
export const decrypt = (text) => {
    if (!text) return text;
    try {
        const [ivHex, dataHex] = String(text).split(':');
        if (!ivHex || !dataHex) return null;
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(getSecretKey()), Buffer.from(ivHex, 'hex'));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption error:', error.message);
        return null;
    }
};
