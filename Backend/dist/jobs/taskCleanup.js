"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupTasks = cleanupTasks;
const database_1 = require("../config/database");
async function cleanupTasks() {
    let client;
    try {
        client = await (0, database_1.connectWithRetry)(); // connect to the database
    }
    catch (err) {
        console.error('[Cron Job] Could not connect to DB for cleanupTasks:', err.message);
        return;
    }
    try {
        // 1. Distributed lock (tạo khoá trông chạy trùngg) 
        const lockResult = await client.query('SELECT pg_try_advisory_lock(42) AS acquired');
        if (!lockResult.rows[0].acquired) {
            return;
        }
        // 2. Xử lý các Task bị kẹt trạng thái 'pending' (> 10 phút)
        const stuckPending = await client.query(`
            SELECT id 
            FROM image_tasks
            WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes'
        `);
        if (stuckPending.rows.length > 0) {
            console.log(`[Cron Job] Phát hiện ${stuckPending.rows.length} task pending bị kẹt. Đang dọn dẹp...`);
            try {
                await client.query('BEGIN');
                // Chuyển toàn bộ các task kẹt thành 'failed' thay vì 'cancelled' 
                await client.query(`
                    UPDATE image_tasks
                    SET status = 'failed', 
                        completed_at = NOW(), 
                        error_code = 'SYSTEM_TIMEOUT',
                        error_message = 'Hệ thống phản hồi lâu hoặc máy chủ mất kết nối'
                    WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes'
                `);
                await client.query('COMMIT');
            }
            catch (e) {
                await client.query('ROLLBACK');
                console.error('[Cron Job] Lỗi cập nhật stuck tasks:', e.message);
            }
        }
        // 3. Đánh dấu hết hạn ảnh khi R2 lifecycle 1 ngày đã xoá object
        const expireResult = await client.query(`
            UPDATE image_tasks
            SET status = 'expired',
                completed_at = COALESCE(completed_at, NOW())
            WHERE status = 'succeeded' 
              AND byteplus_image_url IS NOT NULL
              AND (
                  (image_expires_at IS NOT NULL AND image_expires_at < NOW())
                  OR (image_expires_at IS NULL AND completed_at < NOW() - INTERVAL '24 hours')
              )
        `);
        if ((expireResult.rowCount ?? 0) > 0) {
            console.log(`[Cron Job] Đã chuyển ${expireResult.rowCount} task ảnh sang trạng thái expired.`);
        }
    }
    catch (globalError) {
        console.error('[Cron Job] Lỗi nghiêm trọng tại cleanupTasks:', globalError.message);
    }
    finally {
        // Giải phóng lock và connection
        try {
            await client.query('SELECT pg_advisory_unlock(42)');
        }
        catch (unlockError) {
            console.error('[Cron Job] Lỗi khi unlock advisory lock:', unlockError.message);
        }
        finally {
            client.release();
        }
    }
}
