"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteConfigService = void 0;
const firebase_1 = require("../lib/firebase");
const PLAY_INTEGRITY_ENABLED_KEY = 'PLAY_INTEGRITY_ENABLED';
const IMAGE_GENERATION_LIMIT_KEY = 'img_generation_limit';
const IMAGE_REQUIRED_AD_VIEWS_KEY = 'img_required_ad_views';
const DEFAULT_CACHE_TTL_MS = 60 * 1000;
class RemoteConfigService {
    playIntegrityEnabledCache = null;
    numberCache = new Map();
    async getNumber(key, fallback) {
        const now = Date.now();
        const cached = this.numberCache.get(key);
        if (cached && cached.expiresAt > now) {
            return cached.value;
        }
        try {
            const remoteValue = await (0, firebase_1.getRemoteConfigNumber)(key);
            const value = remoteValue === null ? fallback : Math.floor(remoteValue);
            const normalized = value > 0 ? value : fallback;
            this.numberCache.set(key, {
                value: normalized,
                expiresAt: now + DEFAULT_CACHE_TTL_MS,
            });
            return normalized;
        }
        catch (error) {
            console.error(`[Remote Config] Failed to fetch ${key}:`, error.message);
            return fallback;
        }
    }
    async isPlayIntegrityEnabled() {
        const envOverride = process.env.PLAY_INTEGRITY_ENABLED;
        if (envOverride !== undefined) {
            return !['false', '0', 'no', 'off'].includes(envOverride.trim().toLowerCase());
        }
        const now = Date.now();
        if (this.playIntegrityEnabledCache && this.playIntegrityEnabledCache.expiresAt > now) {
            return this.playIntegrityEnabledCache.value;
        }
        try {
            const remoteValue = await (0, firebase_1.getRemoteConfigBoolean)(PLAY_INTEGRITY_ENABLED_KEY);
            const value = remoteValue ?? true;
            this.playIntegrityEnabledCache = {
                value,
                expiresAt: now + DEFAULT_CACHE_TTL_MS,
            };
            return value;
        }
        catch (error) {
            console.error('[Remote Config] Failed to fetch PLAY_INTEGRITY_ENABLED:', error.message);
            return true;
        }
    }
    async getGenerationSettings() {
        const [generationLimit, requiredAdViews] = await Promise.all([
            this.getNumber(IMAGE_GENERATION_LIMIT_KEY, 10),
            this.getNumber(IMAGE_REQUIRED_AD_VIEWS_KEY, 2),
        ]);
        return { generationLimit, requiredAdViews };
    }
}
exports.remoteConfigService = new RemoteConfigService();
