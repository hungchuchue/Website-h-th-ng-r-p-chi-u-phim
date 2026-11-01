"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ads_service_1 = require("../services/ads.service");
const deviceAuth_1 = require("../middleware/deviceAuth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Endpoint: POST /sessions
router.post('/sessions', deviceAuth_1.deviceAuth, async (req, res) => {
    try {
        const uid = req.deviceId;
        if (!uid) {
            return res.status(400).json({ code: 400, message: 'missing device_id', data: [] });
        }
        const session = await ads_service_1.adsService.createAdSession(uid);
        res.status(200).json({
            code: 200,
            message: 'success',
            data: {
                session_id: session.session_id,
                ads_watched: session.ads_watched,
                ads_required: session.ads_required,
                status: session.status,
                expires_at: session.expires_at
            }
        });
    }
    catch (err) {
        console.error('[Ads] Error creating session:', err);
        if (err instanceof logger_1.AppError) {
            return res.status(err.statusCode).json({ code: err.statusCode, message: err.errorCode, data: [] });
        }
        res.status(500).json({ code: 500, message: 'internal error', data: [] });
    }
});
// Endpoint: GET /sessions/:session_id
router.get('/sessions/:session_id', deviceAuth_1.deviceAuth, async (req, res) => {
    try {
        const uid = req.deviceId;
        const sessionId = req.params.session_id;
        if (!uid) {
            return res.status(400).json({ code: 400, message: 'missing device_id', data: [] });
        }
        const session = await ads_service_1.adsService.getAdSession(sessionId, uid);
        if (!session) {
            return res.status(404).json({ code: 404, message: 'session not found', data: [] });
        }
        if (session.status === 'used' || session.status === 'expired') {
            return res.status(409).json({ code: 409, message: 'expired or used', data: [] });
        }
        const isReady = session.status === 'ready' || session.ads_watched >= session.ads_required;
        res.status(200).json({
            code: 200,
            message: 'success',
            data: {
                session_id: session.session_id,
                ads_watched: session.ads_watched,
                ads_required: session.ads_required,
                status: isReady ? 'ready' : 'pending',
                ready: isReady,
                expires_at: session.expires_at
            }
        });
    }
    catch (err) {
        console.error('[Ads] Error fetching session:', err);
        res.status(500).json({ code: 500, message: 'internal error', data: [] });
    }
});
// Endpoint: POST /integrity/verify
router.post('/integrity/verify', deviceAuth_1.deviceAuth, async (req, res) => {
    try {
        const uid = req.deviceId;
        const integrityToken = req.body?.integrity_token;
        if (!uid) {
            return res.status(400).json({ code: 400, message: 'missing device_id', data: { accepted: false } });
        }
        const result = await ads_service_1.adsService.verifyIntegrity({
            deviceId: uid,
            integrityToken
        });
        res.status(200).json({
            code: 200,
            data: result,
            message: 'Integrity token verified'
        });
    }
    catch (err) {
        console.error('[Ads] Error verifying integrity token:', err);
        if (err instanceof logger_1.AppError) {
            return res.status(err.statusCode).json({
                code: err.statusCode,
                data: {
                    accepted: false
                },
                message: err.errorCode
            });
        }
        res.status(500).json({
            code: 500,
            data: {
                accepted: false
            },
            message: 'internal error'
        });
    }
});
// Endpoint: POST /sessions/:session_id/reward
router.post('/sessions/:session_id/reward', deviceAuth_1.deviceAuth, async (req, res) => {
    try {
        const uid = req.deviceId;
        const sessionId = req.params.session_id;
        if (!uid) {
            return res.status(400).json({ code: 400, message: 'missing device_id', data: { accepted: false } });
        }
        const result = await ads_service_1.adsService.submitReward({
            sessionId,
            deviceId: uid
        });
        res.status(200).json({
            code: 200,
            data: result,
            message: 'Reward submitted'
        });
    }
    catch (err) {
        console.error('[Ads] Error submitting reward:', err);
        if (err instanceof logger_1.AppError) {
            return res.status(err.statusCode).json({
                code: err.statusCode,
                data: { accepted: false },
                message: err.errorCode
            });
        }
        res.status(500).json({ code: 500, data: { accepted: false }, message: 'internal error' });
    }
});
// Endpoint: POST /sessions/:session_id/integrity
router.post('/sessions/:session_id/integrity', deviceAuth_1.deviceAuth, async (req, res) => {
    try {
        const uid = req.deviceId;
        const sessionId = req.params.session_id;
        const integrityToken = req.body?.integrity_token;
        if (!uid) {
            return res.status(400).json({ code: 400, message: 'missing device_id', data: { accepted: false } });
        }
        const result = await ads_service_1.adsService.acceptSessionIntegrity({
            sessionId,
            deviceId: uid,
            integrityToken
        });
        res.status(200).json({
            code: 200,
            data: result,
            message: 'Integrity token accepted'
        });
    }
    catch (err) {
        console.error('[Ads] Error accepting integrity token:', err);
        if (err instanceof logger_1.AppError) {
            return res.status(err.statusCode).json({
                code: err.statusCode,
                data: { accepted: false },
                message: err.errorCode
            });
        }
        res.status(500).json({ code: 500, data: { accepted: false }, message: 'internal error' });
    }
});
exports.default = router;
