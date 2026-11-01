"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageTaskRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const sanitizeDbText = (value) => {
    if (value === null)
        return null;
    return value.replace(/\u0000/g, '').slice(0, 2000);
};
exports.imageTaskRepository = {
    async createTaskWithStatus(client, deviceId, templateId, giftCode, prompt, sourceImageUrl, sourceImagePath, ratio, status, byteplusImageUrl, imageExpiresAt, estimatedTokens, actualTokens, errorCode, errorMessage) {
        const result = await client.query(`INSERT INTO image_tasks 
            (device_id, template_id, gift_code, prompt, source_image_url, source_image_path, ratio, quantity, 
             status, byteplus_image_url, image_expires_at, estimated_tokens, actual_tokens, error_code, error_message, submitted_at, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
            RETURNING id`, [
            sanitizeDbText(deviceId), templateId, sanitizeDbText(giftCode), sanitizeDbText(prompt),
            sanitizeDbText(sourceImageUrl), sanitizeDbText(sourceImagePath), sanitizeDbText(ratio),
            status, sanitizeDbText(byteplusImageUrl), imageExpiresAt, estimatedTokens, actualTokens,
            sanitizeDbText(errorCode), sanitizeDbText(errorMessage)
        ]);
        return result.rows[0].id;
    },
    async updateTaskSucceeded(id, imageUrl, expiresAt, actualTokens) {
        await database_1.default.query(`UPDATE image_tasks
             SET status = 'succeeded', byteplus_image_url = $1,
                 image_expires_at = $2, actual_tokens = $3, completed_at = NOW()
             WHERE id = $4`, [imageUrl, expiresAt, actualTokens, id]);
    },
    async updateTaskFailed(client, id, status, errorCode, errorMessage) {
        await client.query(`UPDATE image_tasks
             SET status = $1, completed_at = NOW(), error_code = $2, error_message = $3
             WHERE id = $4`, [status, sanitizeDbText(errorCode), sanitizeDbText(errorMessage), id]);
    },
    async findByIdAndDevice(id, deviceId) {
        const result = await database_1.default.query('SELECT * FROM image_tasks WHERE id = $1 AND device_id = $2', [id, deviceId]);
        return result.rows[0] || null;
    },
    async findByIdsAndDevice(ids, deviceId) {
        const result = await database_1.default.query('SELECT * FROM image_tasks WHERE id = ANY($1) AND device_id = $2', [ids, deviceId]);
        return result.rows;
    },
    async findByByteplusTaskId(bpTaskId) {
        const result = await database_1.default.query('SELECT * FROM image_tasks WHERE byteplus_task_id = $1', [bpTaskId]);
        return result.rows[0] || null;
    },
    async updateTaskStatus(id, status) {
        await database_1.default.query('UPDATE image_tasks SET status = $1 WHERE id = $2', [status, id]);
    },
    async markExpiredForDevice(deviceId) {
        await database_1.default.query(`
            UPDATE image_tasks SET status = 'expired'
            WHERE device_id = $1 AND status = 'succeeded'
              AND image_expires_at IS NOT NULL AND image_expires_at < NOW()
        `, [deviceId]);
    },
    async getHistoryPending(deviceId) {
        const result = await database_1.default.query(`
            SELECT * FROM image_tasks
            WHERE device_id = $1 AND status IN ('pending', 'queued', 'running')
            ORDER BY created_at DESC
        `, [deviceId]);
        return result.rows;
    },
    async getHistoryCompleted(deviceId, limit, offset) {
        const result = await database_1.default.query(`
            SELECT * FROM image_tasks
            WHERE device_id = $1
              AND status = 'succeeded'
              AND byteplus_image_url IS NOT NULL
              AND (image_expires_at IS NULL OR image_expires_at > NOW())
            ORDER BY completed_at DESC
            LIMIT $2 OFFSET $3
        `, [deviceId, limit, offset]);
        return result.rows;
    },
    async countHistoryCompleted(deviceId) {
        const result = await database_1.default.query(`
            SELECT COUNT(*) AS total FROM image_tasks
            WHERE device_id = $1 AND status = 'succeeded'
              AND byteplus_image_url IS NOT NULL
              AND (image_expires_at IS NULL OR image_expires_at > NOW())
        `, [deviceId]);
        return parseInt(result.rows[0].total, 10);
    },
    async countHistoryGiftCode(deviceId, giftCode) {
        const result = await database_1.default.query(`
            SELECT COUNT(*) AS total FROM image_tasks
            WHERE device_id = $1 AND gift_code = $2
        `, [deviceId, giftCode]);
        return parseInt(result.rows[0].total, 10);
    },
    async countDailySucceeded(device_id) {
        const result = await database_1.default.query(`
            SELECT COUNT(*) AS total
            FROM image_tasks
            WHERE device_id = $1
              AND status = 'succeeded'
              AND completed_at >= CURRENT_DATE
              AND completed_at < CURRENT_DATE + INTERVAL '1 day'
        `, [device_id]);
        return parseInt(result.rows[0].total, 10);
    }
};
