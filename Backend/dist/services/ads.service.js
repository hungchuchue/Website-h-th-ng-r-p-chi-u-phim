"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adsService = void 0;
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const config_1 = require("../config");
const ads_repository_1 = require("../repositories/ads.repository");
const logger_1 = require("../utils/logger");
const integrity_service_1 = require("./integrity.service");
const validation_1 = require("../utils/validation");
const admobRisk_service_1 = require("./admobRisk.service");
const remoteConfig_service_1 = require("./remoteConfig.service");
const imageTask_repository_1 = require("../repositories/imageTask.repository");
const INTEGRITY_HASH_PREFIX = 'reward_session_integrity';
const INTEGRITY_HASH_VERSION = 'v1';
const MOCK_INTEGRITY_TOKEN_PREFIX = 'mock_integrity_v1_';
const INTEGRITY_REWARD_ID_PREFIX = 'integrity_';
function buildRewardSessionIntegrityHash(deviceId) {
    return crypto_1.default
        .createHash('sha256')
        .update(`${INTEGRITY_HASH_PREFIX}\n${INTEGRITY_HASH_VERSION}\n${deviceId}`)
        .digest('hex');
}
function getVerdictRequestHash(payload) {
    return payload.requestDetails?.requestHash || payload.requestDetails?.nonce;
}
function getIntegrityTokenExpiresAt() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config_1.config.integrityTokenTtlDays);
    return expiresAt;
}
exports.adsService = {
    async createAdSession(deviceId) {
        const settings = await remoteConfig_service_1.remoteConfigService.getGenerationSettings();
        const generatedToday = await imageTask_repository_1.imageTaskRepository.countDailySucceeded(deviceId);
        if (generatedToday >= settings.generationLimit) {
            throw new logger_1.AppError(403, 'Images generation limit reached for today', `Images generation limit reached for today`);
        }
        const blockStatus = await admobRisk_service_1.admobRiskService.getBlockStatus(deviceId);
        if (blockStatus.blocked) {
            throw new logger_1.AppError(409, 'DEVICE_UNDER_REVIEW', 'Device is temporarily blocked due to suspicious ad callback activity.');
        }
        const adsRequired = settings.requiredAdViews;
        const sessionId = (0, uuid_1.v4)();
        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + config_1.config.rewards.sessionTtlMinutes);
        await ads_repository_1.adsRepository.createSession(sessionId, deviceId, adsRequired, expiresAt);
        const newSession = await ads_repository_1.adsRepository.getSession(sessionId, deviceId);
        if (!newSession) {
            throw new logger_1.AppError(500, 'FAILED_TO_RETRIEVE_AD_SESSION', "Failed to retrieve created ad session");
        }
        return newSession;
    },
    async getAdSession(sessionId, deviceId) {
        const session = await ads_repository_1.adsRepository.getSession(sessionId, deviceId);
        if (session && session.status !== 'used' && session.status !== 'expired') {
            if (new Date() > new Date(session.expires_at)) {
                session.status = 'expired';
                await ads_repository_1.adsRepository.updateSessionStatus(sessionId, 'expired');
            }
        }
        return session;
    },
    buildRewardSessionIntegrityHash,
    async verifyIntegrity(input) {
        const integrityToken = input.integrityToken.trim();
        const playIntegrityEnabled = await remoteConfig_service_1.remoteConfigService.isPlayIntegrityEnabled();
        if (playIntegrityEnabled && !integrityToken) {
            throw new logger_1.AppError(400, 'INVALID_INTEGRITY_TOKEN', 'integrity_token is required');
        }
        const expectedRequestHash = buildRewardSessionIntegrityHash(input.deviceId);
        const tokenHash = (0, validation_1.hashToken)(integrityToken);
        const storedToken = await ads_repository_1.adsRepository.getIntegrityToken(input.deviceId, tokenHash);
        if (storedToken) {
            if (storedToken.status === 'expired' || new Date() >= new Date(storedToken.expires_at)) {
                await ads_repository_1.adsRepository.markIntegrityTokenExpired(input.deviceId, tokenHash);
                throw new logger_1.AppError(410, 'INTEGRITY_TOKEN_EXPIRED', 'Integrity token expired');
            }
            await ads_repository_1.adsRepository.touchIntegrityToken(input.deviceId, tokenHash);
            return {
                accepted: true,
                expires_at: storedToken.expires_at
            };
        }
        else {
            if (integrityToken.startsWith(MOCK_INTEGRITY_TOKEN_PREFIX) || !playIntegrityEnabled) {
                console.warn('[Integrity] Bypassed by remote config', {
                    deviceId: input.deviceId,
                });
            }
            else {
                const payload = await integrity_service_1.integrityService.decodeToken(integrityToken);
                const verdictRequestHash = getVerdictRequestHash(payload);
                if (verdictRequestHash !== expectedRequestHash) {
                    throw new logger_1.AppError(400, 'INTEGRITY_REQUEST_HASH_MISMATCH', 'Play Integrity verdict requestHash does not match');
                }
            }
            const expiresAt = getIntegrityTokenExpiresAt();
            await ads_repository_1.adsRepository.saveIntegrityToken(input.deviceId, tokenHash, expiresAt);
            return {
                accepted: true,
                expires_at: expiresAt
            };
        }
    },
    async submitReward(input) {
        const session = await this.getAdSession(input.sessionId, input.deviceId);
        if (!session) {
            throw new logger_1.AppError(404, 'AD_SESSION_NOT_FOUND', 'Ad session not found');
        }
        if (session.status === 'used' || session.status === 'expired') {
            throw new logger_1.AppError(409, 'AD_SESSION_CLOSED', 'Ad session is expired or already used');
        }
        const client = await (0, database_1.connectWithRetry)();
        try {
            await client.query('BEGIN');
            const lockedSession = await ads_repository_1.adsRepository.getSessionForUpdate(client, input.sessionId, input.deviceId);
            if (!lockedSession) {
                throw new logger_1.AppError(404, 'AD_SESSION_NOT_FOUND', 'Ad session not found');
            }
            if (lockedSession.status === 'used') {
                throw new logger_1.AppError(409, 'AD_SESSION_ALREADY_USED', 'Ad session already used');
            }
            if (lockedSession.status !== 'expired' && new Date() > new Date(lockedSession.expires_at)) {
                throw new logger_1.AppError(409, 'AD_SESSION_EXPIRED', 'Ad session expired');
            }
            if (lockedSession.status === 'expired') {
                throw new logger_1.AppError(409, 'AD_SESSION_EXPIRED', 'Ad session expired');
            }
            if (lockedSession.status === 'ready' || lockedSession.ads_watched >= lockedSession.ads_required) {
                if (lockedSession.status !== 'ready') {
                    await client.query(`
                        UPDATE ad_sessions
                        SET status = 'ready'
                        WHERE session_id = $1
                          AND device_id = $2
                    `, [input.sessionId, input.deviceId]);
                }
                await client.query('COMMIT');
                return {
                    accepted: true,
                    ads_watched: lockedSession.ads_watched,
                    ads_required: lockedSession.ads_required,
                    ready: true,
                    status: 'ready'
                };
            }
            const newWatchCount = lockedSession.ads_watched + 1;
            const isReady = newWatchCount >= lockedSession.ads_required;
            const rewardId = `${INTEGRITY_REWARD_ID_PREFIX}${input.sessionId}_${(0, uuid_1.v4)()}`;
            await ads_repository_1.adsRepository.logIntegrityAdWatch(client, input.sessionId, input.deviceId, rewardId, newWatchCount, isReady);
            await client.query('COMMIT');
            return {
                accepted: true,
                ads_watched: newWatchCount,
                ads_required: lockedSession.ads_required,
                ready: isReady,
                status: isReady ? 'ready' : 'pending'
            };
        }
        catch (err) {
            await client.query('ROLLBACK');
            if (err.code === '23505') {
                const currentSession = await ads_repository_1.adsRepository.getSession(input.sessionId, input.deviceId);
                if (currentSession) {
                    return {
                        accepted: true,
                        ads_watched: currentSession.ads_watched,
                        ads_required: currentSession.ads_required,
                        ready: currentSession.status === 'ready' || currentSession.ads_watched >= currentSession.ads_required,
                        status: currentSession.status
                    };
                }
            }
            throw err;
        }
        finally {
            client.release();
        }
    },
    async acceptSessionIntegrity(input) {
        const integrityToken = input.integrityToken.trim();
        const playIntegrityEnabled = await remoteConfig_service_1.remoteConfigService.isPlayIntegrityEnabled();
        if (playIntegrityEnabled && !integrityToken) {
            throw new logger_1.AppError(400, 'INVALID_INTEGRITY_TOKEN', 'integrity_token is required');
        }
        const session = await this.getAdSession(input.sessionId, input.deviceId);
        if (!session) {
            throw new logger_1.AppError(404, 'AD_SESSION_NOT_FOUND', 'Ad session not found');
        }
        if (session.status === 'used' || session.status === 'expired') {
            throw new logger_1.AppError(409, 'AD_SESSION_CLOSED', 'Ad session is expired or already used');
        }
        const expectedRequestHash = buildRewardSessionIntegrityHash(input.deviceId);
        const tokenHash = (0, validation_1.hashToken)(integrityToken);
        const storedToken = await ads_repository_1.adsRepository.getIntegrityToken(input.deviceId, tokenHash);
        if (storedToken) {
            if (storedToken.status === 'expired' || new Date() >= new Date(storedToken.expires_at)) {
                await ads_repository_1.adsRepository.markIntegrityTokenExpired(input.deviceId, tokenHash);
                throw new logger_1.AppError(410, 'INTEGRITY_TOKEN_EXPIRED', 'Integrity token expired');
            }
            await ads_repository_1.adsRepository.touchIntegrityToken(input.deviceId, tokenHash);
        }
        else {
            if (integrityToken.startsWith(MOCK_INTEGRITY_TOKEN_PREFIX) || !playIntegrityEnabled) {
                // Mock tokens are accepted after session/device validation above.
                console.warn('[Integrity] Bypassed by remote config', {
                    sessionId: input.sessionId,
                    deviceId: input.deviceId,
                });
            }
            else {
                const payload = await integrity_service_1.integrityService.decodeToken(integrityToken);
                const verdictRequestHash = getVerdictRequestHash(payload);
                if (verdictRequestHash !== expectedRequestHash) {
                    throw new logger_1.AppError(400, 'INTEGRITY_REQUEST_HASH_MISMATCH', 'Play Integrity verdict requestHash does not match');
                }
            }
            await ads_repository_1.adsRepository.saveIntegrityToken(input.deviceId, tokenHash, getIntegrityTokenExpiresAt());
        }
        const client = await (0, database_1.connectWithRetry)();
        try {
            await client.query('BEGIN');
            const lockedSession = await ads_repository_1.adsRepository.getSessionForUpdate(client, input.sessionId, input.deviceId);
            if (!lockedSession) {
                throw new logger_1.AppError(404, 'AD_SESSION_NOT_FOUND', 'Ad session not found');
            }
            if (lockedSession.status === 'used') {
                throw new logger_1.AppError(409, 'AD_SESSION_ALREADY_USED', 'Ad session already used');
            }
            if (lockedSession.status !== 'expired' && new Date() > new Date(lockedSession.expires_at)) {
                throw new logger_1.AppError(409, 'AD_SESSION_EXPIRED', 'Ad session expired');
            }
            if (lockedSession.status === 'expired') {
                throw new logger_1.AppError(409, 'AD_SESSION_EXPIRED', 'Ad session expired');
            }
            if (lockedSession.status === 'ready' || lockedSession.ads_watched >= lockedSession.ads_required) {
                if (lockedSession.status !== 'ready') {
                    await client.query(`
                        UPDATE ad_sessions
                        SET status = 'ready'
                        WHERE session_id = $1
                          AND device_id = $2
                    `, [input.sessionId, input.deviceId]);
                }
                await client.query('COMMIT');
                return {
                    accepted: true,
                    ads_watched: lockedSession.ads_watched,
                    ads_required: lockedSession.ads_required,
                    ready: true,
                    status: 'ready'
                };
            }
            const newWatchCount = lockedSession.ads_watched + 1;
            const isReady = newWatchCount >= lockedSession.ads_required;
            const rewardId = `${INTEGRITY_REWARD_ID_PREFIX}${tokenHash}_${(0, uuid_1.v4)()}`;
            await ads_repository_1.adsRepository.logIntegrityAdWatch(client, input.sessionId, input.deviceId, rewardId, newWatchCount, isReady);
            await client.query('COMMIT');
            return {
                accepted: true,
                ads_watched: newWatchCount,
                ads_required: lockedSession.ads_required,
                ready: isReady,
                status: isReady ? 'ready' : 'pending'
            };
        }
        catch (err) {
            await client.query('ROLLBACK');
            if (err.code === '23505') {
                const currentSession = await ads_repository_1.adsRepository.getSession(input.sessionId, input.deviceId);
                if (currentSession) {
                    return {
                        accepted: true,
                        ads_watched: currentSession.ads_watched,
                        ads_required: currentSession.ads_required,
                        ready: currentSession.status === 'ready' || currentSession.ads_watched >= currentSession.ads_required,
                        status: currentSession.status
                    };
                }
            }
            throw err;
        }
        finally {
            client.release();
        }
    },
    async verifySessionReady(sessionId, deviceId) {
        const session = await ads_repository_1.adsRepository.getSession(sessionId, deviceId);
        if (!session) {
            throw new Error('AD_SESSION_NOT_FOUND');
        }
        if (session.status === 'used') {
            throw new Error('AD_SESSION_ALREADY_USED');
        }
        if (session.status !== 'expired' && new Date() > new Date(session.expires_at)) {
            session.status = 'expired';
            await ads_repository_1.adsRepository.updateSessionStatus(sessionId, 'expired');
        }
        if (session.status === 'expired') {
            throw new Error('AD_SESSION_EXPIRED');
        }
        if (session.status !== 'ready' || session.ads_watched < session.ads_required) {
            throw new Error('AD_QUOTA_NOT_MET');
        }
    },
};
