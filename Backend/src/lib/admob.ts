import crypto from 'crypto';

const ADMOB_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
let cachedKeys: any = null;
let keysCachedAt = 0;
const KEY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getAdMobKeys() {
    if (cachedKeys && (Date.now() - keysCachedAt) < KEY_CACHE_TTL) {
        return cachedKeys;
    }
    const response = await fetch(ADMOB_KEYS_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch AdMob keys: ${response.status}`);
    }
    const data = await response.json() as { keys?: unknown };
    cachedKeys = data.keys || data;
    keysCachedAt = Date.now();
    return cachedKeys;
}

export async function verifyAdMobCallback(rawQueryString: string, signature: string, key_id: string): Promise<boolean> {
    if (!rawQueryString || !signature || !key_id) {
        return false;
    }

    // The message to verify is the exact string up to (but not including) '&signature='
    const sigIndex = rawQueryString.indexOf('&signature=');
    if (sigIndex === -1) {
        console.warn('[Rewards] signature parameter not found in raw string (needs &signature=)');
        return false;
    }
    const message = rawQueryString.substring(0, sigIndex);

    const keys = await getAdMobKeys();
    const keyEntry = Array.isArray(keys)
        ? keys.find(k => String(k.keyId) === String(key_id))
        : null;

    if (!keyEntry) {
        console.warn(`[Rewards] Unknown key_id: ${key_id}`);
        return false;
    }

    try {
        const publicKey = crypto.createPublicKey({
            key: Buffer.from(keyEntry.pem || keyEntry.base64, keyEntry.pem ? 'utf8' : 'base64'),
            format: 'pem',
            type: 'spki'
        });

        const signatureBuffer = Buffer.from(signature, 'base64');
        const verifier = crypto.createVerify('SHA256');
        verifier.update(message);
        return verifier.verify(publicKey, signatureBuffer);
    } catch (err: any) {
        console.error('[Rewards] Signature verification error:', err.message);
        return false;
    }
}
