"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOrphanedImages = cleanupOrphanedImages;
const database_1 = __importDefault(require("../config/database"));
const r2_1 = require("../lib/r2");
async function cleanupOrphanedImages() {
    // Distributed lock
    const lockResult = await database_1.default.query('SELECT pg_try_advisory_lock(43) AS acquired');
    if (!lockResult.rows[0].acquired) {
        return;
    }
    try {
        console.log('[ImageCleanup] Starting daily orphaned image cleanup...');
        let objects = [];
        try {
            // Note: R2 ListObjectsV2 might paginate, but we assume small scale initially.
            // A robust long-term approach would use pagination and parallel processing.
            objects = await (0, r2_1.listObjects)('users/');
        }
        catch (err) {
            console.error('[ImageCleanup] Failed to list R2 objects:', err.message);
            return;
        }
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let deletedCount = 0;
        for (const obj of objects) {
            if (!obj.Key || !obj.LastModified)
                continue;
            const isOld = new Date(obj.LastModified) < yesterday;
            if (!isOld)
                continue; // Skip files uploaded recently
            // Verify if it's used in any active task
            const res = await database_1.default.query(`SELECT 1 FROM image_tasks 
                 WHERE source_image_path = $1 
                 AND status IN ('pending', 'queued', 'running', 'succeeded') 
                 LIMIT 1`, [obj.Key]);
            const isOrphan = res.rows.length === 0;
            if (isOrphan) {
                try {
                    await (0, r2_1.deleteObject)(obj.Key);
                    deletedCount++;
                }
                catch (delErr) {
                    console.error(`[ImageCleanup] Failed to delete ${obj.Key}`);
                }
            }
        }
        await database_1.default.query(`
            UPDATE ad_sessions
            SET status = 'expired'
            WHERE expires_at < NOW() AND (status = 'pending'  OR status = 'ready')
        `);
        console.log(`[ImageCleanup] Complete. Deleted ${deletedCount} orphaned images.`);
    }
    finally {
        await database_1.default.query('SELECT pg_advisory_unlock(43)');
    }
}
