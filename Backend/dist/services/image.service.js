"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageService = void 0;
const imageTask_repository_1 = require("../repositories/imageTask.repository");
const responses_1 = require("../types/responses");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const imageUpscaler_1 = require("../lib/imageUpscaler");
const database_1 = require("../config/database");
const r2_1 = require("../lib/r2");
function getFluxRatioSize(ratio) {
    return types_1.FLUX_SCHNELL_RATIO_MAPPING[ratio]?.size || null;
}
function toTaskStatusResponse(task) {
    return {
        task_id: task.id,
        status: task.status,
        image_url: task.byteplus_image_url,
        error_message: task.error_message,
        prompt: task.prompt,
        source_image_url: task.source_image_url,
        ratio: task.ratio,
        ratio_size: getFluxRatioSize(task.ratio),
        quantity: task.quantity,
        estimated_tokens: task.estimated_tokens,
        actual_tokens: task.actual_tokens,
        created_at: task.created_at,
        completed_at: task.completed_at
    };
}
exports.imageService = {
    toTaskStatusResponse,
    async runImageUpscale(deviceId, input) {
        if (typeof input !== 'object' || input === null || Array.isArray(input)) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'Request body must be a JSON object.');
        }
        for (const field of ['imageUrl', 'imageBase64', 'scale', 'outputFormat']) {
            if (Object.prototype.hasOwnProperty.call(input, field)) {
                throw new logger_1.AppError(400, 'INVALID_INPUT', 'This field is not supported; please use image_key from upload/presign.');
            }
        }
        const sourceUrl = input.image_key ? (0, r2_1.getPublicUrl)(input.image_key) : null;
        if (!sourceUrl) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'image_key is required for this action.');
        }
        let generatedImageUrl;
        try {
            const result = await (0, imageUpscaler_1.submitAndStoreUpscaleTask)(deviceId, { imageUrl: sourceUrl });
            generatedImageUrl = result.url;
        }
        catch (error) {
            if (error instanceof responses_1.UpscaleQuotaExceededError) {
                throw new logger_1.AppError(429, 'UPSCALE_QUOTA_EXCEEDED', error.message);
            }
            if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
                const statusCode = error.statusCode;
                if (statusCode === 400) {
                    throw new logger_1.AppError(400, 'INVALID_SOURCE_IMAGE', error.message);
                }
                if (statusCode === 403) {
                    throw new logger_1.AppError(403, 'UPSCALE_SUBSCRIPTION_REQUIRED', error.message);
                }
                if (statusCode === 429) {
                    throw new logger_1.AppError(429, 'UPSCALE_QUOTA_EXCEEDED', error.message);
                }
                throw new logger_1.AppError(statusCode, 'PROVIDER_REJECTED', error.message);
            }
            const message = error instanceof Error ? error.message : 'Image upscaling failed.';
            throw new logger_1.AppError(502, 'PROVIDER_UNREACHABLE', message);
        }
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        let taskClient;
        try {
            taskClient = await (0, database_1.connectWithRetry)();
        }
        catch {
            throw new logger_1.AppError(500, 'DATABASE_ERROR', 'Failed to save the upscaled image.');
        }
        let taskId;
        try {
            await taskClient.query('BEGIN');
            taskId = await imageTask_repository_1.imageTaskRepository.createTaskWithStatus(taskClient, deviceId, null, null, null, sourceUrl, input.image_key, '9:16', types_1.TaskStatus.SUCCEEDED, generatedImageUrl, expiresAt, 0, null, null, null);
            await taskClient.query('COMMIT');
        }
        catch {
            try {
                await taskClient.query('ROLLBACK');
            }
            catch {
                // Preserve the original database failure.
            }
            throw new logger_1.AppError(500, 'DATABASE_ERROR', 'Failed to save the upscaled image.');
        }
        finally {
            taskClient.release();
        }
        let savedTask;
        try {
            savedTask = await imageTask_repository_1.imageTaskRepository.findByIdAndDevice(taskId, deviceId);
        }
        catch {
            throw new logger_1.AppError(500, 'DATABASE_ERROR', 'Failed to load the saved image task.');
        }
        if (!savedTask) {
            throw new logger_1.AppError(500, 'DATABASE_ERROR', 'Saved image task was not found.');
        }
        return toTaskStatusResponse(savedTask);
    },
    async getHistory(uid, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        // 1. Mark expired correctly first
        await imageTask_repository_1.imageTaskRepository.markExpiredForDevice(uid);
        // 2. Fetch pending tasks
        const pending = await imageTask_repository_1.imageTaskRepository.getHistoryPending(uid);
        // 3. Fetch completed
        const completed = await imageTask_repository_1.imageTaskRepository.getHistoryCompleted(uid, limit, offset);
        // 4. Count total active completed
        const total_completed = await imageTask_repository_1.imageTaskRepository.countHistoryCompleted(uid);
        // 5. Calculate pagination
        const total_pages = Math.max(1, Math.ceil(total_completed / limit));
        const current_page = Math.min(page, Math.max(1, total_pages));
        return {
            pending,
            completed,
            total_completed,
            pagination: {
                current_page,
                total_pages,
                limit,
                total_items: total_completed
            }
        };
    },
    async getImageDetail(uid, taskId) {
        let task = await imageTask_repository_1.imageTaskRepository.findByIdAndDevice(taskId, uid);
        if (!task) {
            throw new logger_1.AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
        }
        const isExpired = task.byteplus_image_url
            && task.image_expires_at
            && (new Date(task.image_expires_at).getTime() < Date.now());
        if (isExpired && task.status === 'succeeded') {
            await imageTask_repository_1.imageTaskRepository.updateTaskStatus(taskId, 'expired');
            throw new logger_1.AppError(409, 'IMAGE_EXPIRED', 'Image has expired.');
        }
        if (['expired', 'failed', 'cancelled'].includes(task.status)) {
            throw new logger_1.AppError(404, 'TASK_NOT_FOUND', 'Task not found or expired.');
        }
        return toTaskStatusResponse(task);
    }
};
