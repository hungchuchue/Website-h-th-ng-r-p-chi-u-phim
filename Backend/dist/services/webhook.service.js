"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processByteplusCallback = void 0;
const imageTask_repository_1 = require("../repositories/imageTask.repository");
const logger_1 = require("../utils/logger");
// --- BYTEPLUS WEBHOOK ---
const processByteplusCallback = async (byteplusTaskId) => {
    const task = await imageTask_repository_1.imageTaskRepository.findByByteplusTaskId(byteplusTaskId);
    if (!task) {
        logger_1.logger.error('[BytePlus Webhook] Unknown task', { byteplusTaskId });
        return;
    }
    if (['succeeded', 'failed', 'cancelled', 'expired'].includes(task.status)) {
        logger_1.logger.info('[BytePlus Webhook] Task already in terminal state', { taskId: task.id, status: task.status });
        return;
    }
    // try {
    //     const verified = await getByteplusTaskStatus(byteplusTaskId);
    //     const status = verified.status;
    //     if (status === 'succeeded') {
    //         const videoUrl = verified.content?.video_url || null;
    //         const actualTokens = verified.usage?.total_tokens || null;
    //         const expiresSec = verified.execution_expires_after || 172800;
    //         const createdAtMs = (verified.created_at || Math.floor(Date.now() / 1000)) * 1000;
    //         const expiresAt = new Date(createdAtMs + expiresSec * 1000);
    //         try {
    //             await imageTaskRepository.updateTaskSucceeded(task.id, videoUrl, expiresAt, actualTokens);
    //             logger.info('[BytePlus Webhook] Task succeeded (verified)', { taskId: task.id, tokens: actualTokens });
    //         } catch (err: any) {
    //             logger.error('[BytePlus Webhook] DB Error on success update', { taskId: task.id, error: err.message });
    //         }
    //     } else if (status === 'failed' || status === 'cancelled') {
    //         const client = await pool.connect();
    //         try {
    //             await client.query('BEGIN');
    //             await imageTaskRepository.updateTaskFailed(client, task.id, status as TaskStatus, verified.error?.code || null, verified.error?.message || null);
    //             await client.query('COMMIT');
    //             logger.info('[BytePlus Webhook] Task failed/cancelled - refunded (verified)', { taskId: task.id, status });
    //         } catch (err: any) {
    //             await client.query('ROLLBACK');
    //             logger.error('[BytePlus Webhook] DB error on refund update', { taskId: task.id, error: err.message });
    //         } finally {
    //             client.release();
    //         }
    //     } else if (status === 'running') {
    //         await imageTaskRepository.updateTaskStatus(task.id, TaskStatus.RUNNING);
    //     }
    // } catch (err: any) {
    //     logger.error('[BytePlus Webhook] Verification failed', { taskId: task.id, error: err.message });
    // }
};
exports.processByteplusCallback = processByteplusCallback;
