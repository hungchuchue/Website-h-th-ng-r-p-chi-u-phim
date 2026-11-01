"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const webhook_service_1 = require("../services/webhook.service");
const router = (0, express_1.Router)();
router.post('/byteplus', async (req, res) => {
    const querySecret = req.query.secret;
    if (!querySecret || querySecret !== config_1.config.byteplus.webhookSecret) {
        return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Missing or invalid secret',
        });
    }
    // Always 200 early to BytePlus to prevent retries
    res.status(200).json({ success: true });
    const byteplusTaskId = req.body?.id;
    if (byteplusTaskId) {
        (0, webhook_service_1.processByteplusCallback)(byteplusTaskId).catch((err) => {
            console.error('[BytePlus Webhook] Error:', err.message);
        });
    }
});
exports.default = router;
