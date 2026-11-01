"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admobRiskService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importStar(require("../config/database"));
const config_1 = require("../config");
function getThreshold() {
    return config_1.config.rewards.adsPerGenerate * config_1.config.rewards.dailyAdCap;
}
function Value(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function hashRawQuery(rawQueryString) {
    return crypto_1.default.createHash('sha256').update(rawQueryString).digest('hex');
}
exports.admobRiskService = {
    getThreshold,
    async recordMissingCustomData(rawQueryString, queryParams, context = {}) {
        const deviceId = Value(context.deviceId) || Value(queryParams.device_id);
        if (!deviceId)
            return;
        const threshold = getThreshold();
        const client = await (0, database_1.connectWithRetry)();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`device:${deviceId}`]);
            const latestRes = await client.query(`
                SELECT consecutive_count
                FROM admob_callback_risk_logs
                WHERE device_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT 1
            `, [deviceId]);
            const lastCount = latestRes.rows[0]?.consecutive_count ?? 0;
            const nextCount = lastCount + 1;
            const blockedUntil = nextCount >= threshold
                ? new Date(Date.now() + config_1.config.admobMissingCustomDataBlockHours * 60 * 60 * 1000)
                : null;
            await client.query(`
                INSERT INTO admob_callback_risk_logs (
                    device_id,
                    session_id,
                    reason,
                    consecutive_count,
                    threshold_count,
                    blocked_until,
                    raw_query_hash,
                    ad_unit,
                    transaction_id,
                    user_agent
                )
                VALUES ($1, NULL, 'missing_custom_data', $2, $3, $4, $5, $6, $7, $8)
            `, [
                deviceId,
                nextCount,
                threshold,
                blockedUntil,
                hashRawQuery(rawQueryString),
                queryParams.ad_unit || null,
                queryParams.transaction_id || null,
                context.userAgent || null
            ]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    async resetMissingCustomData(queryParams, context = {}) {
        const deviceId = Value(context.deviceId) || Value(queryParams.device_id);
        if (!deviceId)
            return;
        await database_1.default.query(`
            INSERT INTO admob_callback_risk_logs (
                device_id,
                session_id,
                reason,
                consecutive_count,
                threshold_count,
                blocked_until,
                ad_unit,
                transaction_id,
                user_agent
            )
            VALUES ($1, $2, 'valid_custom_data', 0, $3, NULL, $4, $5, $6)
        `, [
            deviceId,
            Value(queryParams.custom_data),
            getThreshold(),
            queryParams.ad_unit || null,
            queryParams.transaction_id || null,
            context.userAgent || null
        ]);
    },
    async getBlockStatus(deviceId) {
        const res = await database_1.default.query(`
            SELECT blocked_until
            FROM admob_callback_risk_logs
            WHERE device_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        `, [deviceId]);
        const blockedUntil = res.rows[0]?.blocked_until;
        if (blockedUntil && new Date(blockedUntil) > new Date()) {
            return {
                blocked: true,
                reason: 'ADMOB_MISSING_CUSTOM_DATA_DEVICE',
                blockedUntil
            };
        }
        return { blocked: false };
    }
};
