"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateService = void 0;
const database_1 = require("../config/database");
const imageTask_repository_1 = require("../repositories/imageTask.repository");
const aiFaceSwap_1 = require("../lib/aiFaceSwap");
const fluxSchnell_1 = require("../lib/fluxSchnell");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const r2_1 = require("../lib/r2");
const ads_service_1 = require("./ads.service");
const giftCode_repository_1 = require("../repositories/giftCode.repository");
const template_service_1 = require("./template.service");
const admobRisk_service_1 = require("./admobRisk.service");
const remoteConfig_service_1 = require("./remoteConfig.service");
const DEFAULT_FLUX_SCHNELL_RATIO = '9:16';
function isFluxSchnellRatio(ratio) {
    return ratio in types_1.FLUX_SCHNELL_RATIO_MAPPING;
}
async function assertDailyGenerationLimit(uid, requestedQuantity) {
    const settings = await remoteConfig_service_1.remoteConfigService.getGenerationSettings();
    const generatedToday = await imageTask_repository_1.imageTaskRepository.countDailySucceeded(uid);
    if (generatedToday + requestedQuantity > settings.generationLimit) {
        throw new logger_1.AppError(403, 'Generation limit reached for today', `Generation limit reached for today`);
    }
}
exports.generateService = {
    async submitTasks(uid, reqBody) {
        const blockStatus = await admobRisk_service_1.admobRiskService.getBlockStatus(uid);
        if (blockStatus.blocked) {
            throw new logger_1.AppError(409, 'DEVICE_UNDER_REVIEW', 'Device is temporarily blocked due to suspicious ad callback activity.');
        }
        let hasValidGiftCode = false;
        const imageSettings = await remoteConfig_service_1.remoteConfigService.getGenerationSettings();
        if (reqBody.gift_code) {
            const giftCodeRecord = await giftCode_repository_1.giftCodeRepository.getGiftCode(reqBody.gift_code);
            if (!giftCodeRecord) {
                throw new logger_1.AppError(400, 'INVALID_GIFT_CODE', 'The provided gift code is invalid or expired.');
            }
            hasValidGiftCode = true;
        }
        else {
            await assertDailyGenerationLimit(uid, 1);
            if (!reqBody.session_id) {
                throw new logger_1.AppError(400, 'INVALID_INPUT', 'session_id is required.');
            }
            // Verify Ad session
            try {
                await ads_service_1.adsService.verifySessionReady(reqBody.session_id, uid);
            }
            catch (e) {
                if (e.message === 'AD_QUOTA_NOT_MET') {
                    throw new logger_1.AppError(403, 'AD_QUOTA_NOT_MET', 'Not enough ads watched for this session.');
                }
                if (['AD_SESSION_NOT_FOUND', 'AD_SESSION_ALREADY_USED', 'AD_SESSION_EXPIRED'].includes(e.message)) {
                    throw new logger_1.AppError(409, e.message, 'Invalid or expired ad session.');
                }
                throw e;
            }
        }
        /// ======== check templates ========
        if (!reqBody.template_id || typeof reqBody.template_id !== 'string') {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'Valid template is required.');
        }
        let promptTemplates;
        let templateImageUrl;
        let templateTypeName;
        let templateRatio;
        try {
            const templateRes = await template_service_1.templateService.getTemplateById(reqBody.template_id);
            if (!templateRes) {
                throw new logger_1.AppError(400, 'INVALID_INPUT', 'Template not found.');
            }
            promptTemplates = templateRes.prompt;
            templateImageUrl = templateRes.image_url;
            templateTypeName = templateRes.types?.[0]?.type_name;
            templateRatio = templateRes.ratio;
        }
        catch (dbErr) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'Invalid template ID format or not found.');
        }
        /// ======== validate request ========
        const qty = Math.floor(reqBody.quantity || 1);
        if (qty <= 0 || qty > 15) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'Quantity must be between 1 and 15.');
        }
        const requestedRatio = templateRatio;
        const normalizedRatio = isFluxSchnellRatio(requestedRatio)
            ? requestedRatio
            : DEFAULT_FLUX_SCHNELL_RATIO;
        if (normalizedRatio !== requestedRatio) {
            console.warn(`[Generate Submit] Invalid ratio '${requestedRatio}', fallback to '${DEFAULT_FLUX_SCHNELL_RATIO}'.`);
        }
        const tasksResponse = [];
        const sourceUrl = reqBody.image_key ? (0, r2_1.getPublicUrl)(reqBody.image_key) : null;
        const estimatedTokens = 0;
        const templateTypeNames = (await template_service_1.templateService.getTemplateTypes()).map((item) => item.type_name);
        if (!templateTypeName || !templateTypeNames.includes(templateTypeName)) {
            throw new logger_1.AppError(400, 'INVALID_TEMPLATE_TYPE', `Unsupported template type: ${templateTypeName || 'unknown'}.`);
        }
        const requiresSourceImage = templateTypeName === 'swap_face' || templateTypeName === 'try_on_outfit';
        if (requiresSourceImage && qty !== 1) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'Quantity must be 1 for this action.');
        }
        if (requiresSourceImage && !sourceUrl) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'image_key is required for this action.');
        }
        if (requiresSourceImage && !templateImageUrl) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'Template image is required for this action.');
        }
        // --- 3. DATABASE RECORD & PROVIDER SUBMISSION ---
        const taskClient = await (0, database_1.connectWithRetry)();
        try {
            let hasSucceeded = false;
            const providerResults = [];
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            for (let i = 0; i < qty; i++) {
                try {
                    let imageUrl;
                    if (templateTypeName === 'swap_face' || templateTypeName === 'try_on_outfit') {
                        const result = await (0, aiFaceSwap_1.submitAndStoreFaceSwapTask)(uid, {
                            sourceUrl: sourceUrl,
                            targetUrl: templateImageUrl,
                        });
                        imageUrl = result.file_url;
                    }
                    else {
                        const result = await (0, fluxSchnell_1.submitAndStoreFluxSchnellTask)(uid, {
                            prompt: promptTemplates,
                            ratio: normalizedRatio,
                            outputFormat: 'png',
                        });
                        imageUrl = result.images[0]?.url;
                    }
                    providerResults.push({ imageUrl, error: null });
                }
                catch (err) {
                    providerResults.push({ imageUrl: null, error: err });
                }
            }
            await taskClient.query('BEGIN');
            for (const item of providerResults) {
                if (item.error || !item.imageUrl) {
                    const failedId = await imageTask_repository_1.imageTaskRepository.createTaskWithStatus(taskClient, uid, reqBody.template_id, reqBody.gift_code || null, promptTemplates || null, sourceUrl, reqBody.image_key || null, normalizedRatio, types_1.TaskStatus.FAILED, null, null, estimatedTokens, null, 'PROVIDER_ERROR', item.error?.message || 'Image generation failed');
                    tasksResponse.push({ task_id: failedId, status: types_1.TaskStatus.FAILED });
                }
                else {
                    hasSucceeded = true;
                    const successId = await imageTask_repository_1.imageTaskRepository.createTaskWithStatus(taskClient, uid, reqBody.template_id, reqBody.gift_code || null, promptTemplates || null, sourceUrl, reqBody.image_key || null, normalizedRatio, types_1.TaskStatus.SUCCEEDED, item.imageUrl, expiresAt, estimatedTokens, null, null, null);
                    if (reqBody.gift_code) {
                        await giftCode_repository_1.giftCodeRepository.incrementUses(reqBody.gift_code);
                    }
                    tasksResponse.push({ task_id: successId, status: types_1.TaskStatus.SUCCEEDED });
                }
            }
            // Mark session as used since generation request was submitted successfully
            if (hasSucceeded && !hasValidGiftCode && reqBody.session_id) {
                const usedSessionResult = await taskClient.query(`
                    UPDATE ad_sessions
                    SET status = 'used',
                        used_at = NOW()
                    WHERE session_id = $1
                      AND device_id = $2
                      AND status = 'ready'
                    RETURNING session_id
                `, [reqBody.session_id, uid]);
                if (usedSessionResult.rowCount === 0) {
                    throw new logger_1.AppError(409, 'AD_SESSION_NOT_READY', 'Ad session was not marked as used.');
                }
            }
            await taskClient.query('COMMIT');
        }
        catch (err) {
            console.error(`[Generate Submit] Failed:`, err.message);
            await taskClient.query('ROLLBACK');
            try {
                await taskClient.query('BEGIN');
                for (let i = 0; i < qty; i++) {
                    const failedId = await imageTask_repository_1.imageTaskRepository.createTaskWithStatus(taskClient, uid, reqBody.template_id, reqBody.gift_code || null, promptTemplates || null, sourceUrl, reqBody.image_key || null, normalizedRatio, types_1.TaskStatus.FAILED, null, null, estimatedTokens, null, 'SUBMIT_ERROR', err.message);
                    tasksResponse.push({ task_id: failedId, status: types_1.TaskStatus.FAILED });
                }
                await taskClient.query('COMMIT');
            }
            catch (fallbackErr) {
                await taskClient.query('ROLLBACK');
                console.error(`[Generate Submit] Fallback save failed:`, fallbackErr.message);
                throw new logger_1.AppError(500, 'DATABASE_ERROR', 'Failed to process generation request.');
            }
        }
        finally {
            taskClient.release();
        }
        return {
            tasks: tasksResponse
        };
    },
    async verifyGiftCode(uid, gift_code) {
        if (!gift_code) {
            return false;
        }
        const giftCode = await giftCode_repository_1.giftCodeRepository.getGiftCode(gift_code);
        // 1. Kiểm tra xem code có tồn tại không
        if (!giftCode) {
            return false;
        }
        // 2. Kiểm tra trạng thái hoạt động (is_active)
        if (!giftCode.is_active) {
            return false;
        }
        // 3. Kiểm tra mức sử dụng của thiết bị
        const usageCount = await imageTask_repository_1.imageTaskRepository.countHistoryGiftCode(uid, gift_code);
        if (usageCount >= giftCode.reward_value) {
            return false;
        }
        return true;
    }
};
