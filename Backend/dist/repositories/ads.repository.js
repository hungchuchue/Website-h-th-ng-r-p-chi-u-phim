"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adsRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.adsRepository = {
    async getDailyAdWatchCount(deviceId) {
        const res = await database_1.default.query(`
            SELECT COUNT(*) as count
            FROM ad_watch_log
            WHERE device_id = $1
              AND watched_at >= CURRENT_DATE
        `, [deviceId]);
        return parseInt(res.rows[0].count, 10);
    },
    async createSession(sessionId, deviceId, adsRequired, expiresAt) {
        await database_1.default.query(`
            INSERT INTO ad_sessions (session_id, device_id, ads_required, expires_at)
            VALUES ($1, $2, $3, $4)
        `, [sessionId, deviceId, adsRequired, expiresAt]);
    },
    async getSession(sessionId, deviceId) {
        let query = 'SELECT * FROM ad_sessions WHERE session_id = $1';
        const params = [sessionId];
        if (deviceId) {
            query += ' AND device_id = $2';
            params.push(deviceId);
        }
        const res = await database_1.default.query(query, params);
        if (res.rows.length === 0)
            return null;
        return res.rows[0];
    },
    async getSessionForUpdate(client, sessionId, deviceId) {
        const res = await client.query(`
            SELECT *
            FROM ad_sessions
            WHERE session_id = $1
              AND device_id = $2
            FOR UPDATE
        `, [sessionId, deviceId]);
        if (res.rows.length === 0)
            return null;
        return res.rows[0];
    },
    async checkRewardDuplicate(rewardId) {
        const res = await database_1.default.query('SELECT id FROM ad_watch_log WHERE reward_id = $1', [rewardId]);
        return res.rows.length > 0;
    },
    async getIntegrityToken(deviceId, tokenHash) {
        const res = await database_1.default.query(`
            SELECT device_id, integrity_token_hash, status, verified_at, last_used_at, expires_at
            FROM play_integrity_tokens
            WHERE device_id = $1
              AND integrity_token_hash = $2
        `, [deviceId, tokenHash]);
        if (res.rows.length === 0)
            return null;
        return res.rows[0];
    },
    async saveIntegrityToken(deviceId, tokenHash, expiresAt) {
        await database_1.default.query(`
            INSERT INTO play_integrity_tokens (
                device_id,
                integrity_token_hash,
                status,
                verified_at,
                last_used_at,
                expires_at
            )
            VALUES ($1, $2, 'active', NOW(), NOW(), $3)
            ON CONFLICT (device_id, integrity_token_hash) DO UPDATE
            SET status = 'active',
                verified_at = NOW(),
                last_used_at = NOW(),
                expires_at = EXCLUDED.expires_at
        `, [deviceId, tokenHash, expiresAt]);
    },
    async touchIntegrityToken(deviceId, tokenHash) {
        await database_1.default.query(`
            UPDATE play_integrity_tokens
            SET last_used_at = NOW()
            WHERE device_id = $1
              AND integrity_token_hash = $2
              AND status = 'active'
        `, [deviceId, tokenHash]);
    },
    async markIntegrityTokenExpired(deviceId, tokenHash) {
        await database_1.default.query(`
            UPDATE play_integrity_tokens
            SET status = 'expired'
            WHERE device_id = $1
              AND integrity_token_hash = $2
        `, [deviceId, tokenHash]);
    },
    async updateSessionStatus(sessionId, status) {
        await database_1.default.query(`
            UPDATE ad_sessions
            SET status = $1
            WHERE session_id = $2
        `, [status, sessionId]);
    },
    async logAdWatch(client, sessionId, deviceId, rewardId, newWatchCount, isReady) {
        // 1. Insert into ad_watch_log
        await client.query(`
            INSERT INTO ad_watch_log (session_id, device_id, reward_id)
            VALUES ($1, $2, $3)
        `, [sessionId, deviceId, rewardId]);
        // 2. Update ad_sessions
        const newStatus = isReady ? 'ready' : 'pending';
        await client.query(`
            UPDATE ad_sessions
            SET ads_watched = $1, status = $2
            WHERE session_id = $3
        `, [newWatchCount, newStatus, sessionId]);
    },
    async logIntegrityAdWatch(client, sessionId, deviceId, rewardId, newWatchCount, isReady) {
        await client.query(`
            INSERT INTO ad_watch_log (session_id, device_id, reward_id)
            VALUES ($1, $2, $3)
        `, [sessionId, deviceId, rewardId]);
        const newStatus = isReady ? 'ready' : 'pending';
        await client.query(`
            UPDATE ad_sessions
            SET ads_watched = $1,
                status = $2
            WHERE session_id = $3
              AND device_id = $4
        `, [newWatchCount, newStatus, sessionId, deviceId]);
    },
};
