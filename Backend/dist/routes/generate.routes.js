"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rateLimiter_1 = require("../middleware/rateLimiter");
const generate_service_1 = require("../services/generate.service");
const deviceAuth_1 = require("../middleware/deviceAuth");
const upload_service_1 = require("../services/upload.service");
const router = (0, express_1.Router)();
router.post('/upload/presign', rateLimiter_1.uidLimiter, deviceAuth_1.deviceAuth, async (req, res, next) => {
    try {
        const uid = req.deviceId;
        const body = req.body;
        const result = await upload_service_1.uploadService.getPresignedUrl(uid, body);
        res.status(200).json({ code: 200, message: 'success', data: result });
    }
    catch (err) {
        next(err);
    }
});
router.post('/submit', rateLimiter_1.uidLimiter, deviceAuth_1.deviceAuth, async (req, res, next) => {
    try {
        const uid = req.deviceId;
        const body = req.body;
        const result = await generate_service_1.generateService.submitTasks(uid, body);
        res.status(200).json({ code: 200, message: 'success', data: result });
    }
    catch (err) {
        next(err);
    }
});
router.post('/verify/gift-code', rateLimiter_1.uidLimiter, deviceAuth_1.deviceAuth, async (req, res, next) => {
    try {
        const uid = req.deviceId;
        const { gift_code } = req.body;
        const isValid = await generate_service_1.generateService.verifyGiftCode(uid, gift_code);
        if (!isValid) {
            return res.status(404).json({ code: 404, message: 'Gift code not found or expired', data: { valid: false } });
        }
        res.status(200).json({ code: 200, message: 'success', data: { valid: isValid } });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
