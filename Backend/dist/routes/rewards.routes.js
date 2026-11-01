"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rateLimiter_1 = require("../middleware/rateLimiter");
const rewards_service_1 = require("../services/rewards.service");
const router = (0, express_1.Router)();
router.get('/admob/callback', rateLimiter_1.rewardsLimiter, async (req, res) => {
    // console.log('[api/rewards/admob/callback] Received AdMob callback:', req.query);
    let result;
    try {
        const rawQueryString = req.originalUrl.includes('?') ? req.originalUrl.substring(req.originalUrl.indexOf('?') + 1) : '';
        result = await rewards_service_1.rewardsService.processAdMobClaim(rawQueryString, req.query);
    }
    catch (err) {
        console.error('[Rewards] Error processing callback:', err.message);
        result = { success: false, reason: 'internal_error', httpStatus: 500 };
    }
    const message = result.success ? 'success' : result.reason;
    res.status(result.httpStatus).json({
        code: result.httpStatus,
        message,
        data: result.data ?? [],
    });
});
exports.default = router;
