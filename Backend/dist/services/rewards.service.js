"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewardsService = void 0;
const database_1 = require("../config/database");
const ads_repository_1 = require("../repositories/ads.repository");
const admob_1 = require("../lib/admob");
const admobRisk_service_1 = require("./admobRisk.service");
exports.rewardsService = {
    async processAdMobClaim(rawQueryString, queryParams) {
        const isValid = await (0, admob_1.verifyAdMobCallback)(rawQueryString, queryParams.signature, queryParams.key_id);
        if (!isValid) {
            console.warn('[Rewards] Invalid SSVC signature, ignoring callback');
            return { success: false, reason: 'invalid_signature', httpStatus: 403 };
        }
        const adUnit = queryParams.ad_unit;
        const VALID_AD_UNITS = [
            '7819456863',
            '6454404307',
            '4514068452',
            '4490354434',
            '4186765396',
            '9854025043',
            '6219161668',
            '4906079990',
            '1887905111',
            '7939437441',
            ///------ testing -------
            '1234567890',
        ];
        if (!VALID_AD_UNITS.includes(adUnit)) {
            console.warn(`[Rewards] Fake request detected! Invalid ad_unit: ${adUnit}`);
            return { success: false, reason: 'invalid_ad_unit', httpStatus: 403 };
        }
        const sessionId = queryParams.custom_data;
        const rewardId = queryParams.transaction_id;
        // console.warn(`[Rewards] Processing AdMob callback for session_id: ${sessionId}, transaction_id: ${rewardId}, ad_unit: ${adUnit}`);
        if (!sessionId || !rewardId) {
            // console.warn(`[Rewards] Processing AdMob callback for ${JSON.stringify(queryParams)}`);
            // console.warn('[Rewards] Missing custom_data (session_id) or transaction_id');
            if (!sessionId) {
                await admobRisk_service_1.admobRiskService.recordMissingCustomData(rawQueryString, queryParams);
            }
            // Using 200 so AdMob doesn't retry invalid requests unnecessarily if it's missing params
            return { success: false, reason: 'missing_params', httpStatus: 200, data: [] };
        }
        // Dedup: check if this exact reward_id was already processed
        const alreadyLogged = await ads_repository_1.adsRepository.checkRewardDuplicate(rewardId);
        if (alreadyLogged) {
            console.log(`[Rewards] Duplicate callback for reward_id: ${rewardId}, skipping`);
            return { success: false, reason: 'duplicate_or_invalid', httpStatus: 200, data: [] };
        }
        // Fetch session
        const session = await ads_repository_1.adsRepository.getSession(sessionId);
        if (!session) {
            console.warn(`[Rewards] Session not found: ${sessionId}`);
            return { success: false, reason: 'duplicate_or_invalid', httpStatus: 200, data: [] };
        }
        await admobRisk_service_1.admobRiskService.resetMissingCustomData(queryParams, {
            deviceId: session.device_id
        });
        if (session.status === 'used' || session.status === 'ready' || session.status === 'expired' || new Date() > new Date(session.expires_at)) {
            console.warn(`[Rewards] Session ${sessionId} is no longer active (status: ${session.status})`);
            return { success: false, reason: 'duplicate_or_invalid', httpStatus: 200, data: [] };
        }
        const client = await (0, database_1.connectWithRetry)();
        try {
            await client.query('BEGIN');
            // const newWatchCount = session.ads_watched + 1;
            // const isReady = newWatchCount >= session.ads_required;
            // await adsRepository.logAdWatch(client, sessionId, session.device_id, rewardId, newWatchCount, isReady);
            await client.query('COMMIT');
            return {
                success: true,
                reason: 'success',
                httpStatus: 200,
                data: {
                    session_id: sessionId,
                    ads_watched: 0,
                    ads_required: session.ads_required,
                    ready: false
                },
            };
        }
        catch (dbError) {
            await client.query('ROLLBACK');
            if (dbError.code === '23505') {
                console.log(`[Rewards] Race condition duplicate for reward_id: ${rewardId}, ignoring`);
                return { success: false, reason: 'duplicate_or_invalid', httpStatus: 200, data: [] };
            }
            throw dbError;
        }
        finally {
            client.release();
        }
    }
};
