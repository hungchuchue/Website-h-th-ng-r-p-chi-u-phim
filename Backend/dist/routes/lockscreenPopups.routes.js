"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lockscreenPopup_service_1 = require("../services/lockscreenPopup.service");
const requireAuth_1 = require("../middleware/requireAuth");
const router = (0, express_1.Router)();
router.get('/current', async (req, res, next) => {
    try {
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const popup = await lockscreenPopup_service_1.lockscreenPopupService.getCurrentPopup(country);
        res.status(200).json({
            code: 200,
            message: 'success',
            data: popup
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/admin', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const scheduledDate = typeof req.query.scheduled_date === 'string' ? req.query.scheduled_date : undefined;
        const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const { popups, pagination } = await lockscreenPopup_service_1.lockscreenPopupService.listPopups(page, limit, {
            scheduledDate,
            mode,
            status,
            country
        });
        res.status(200).json({
            code: 200,
            message: 'success',
            data: popups,
            pagination
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/admin', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const body = req.body;
        const popup = await lockscreenPopup_service_1.lockscreenPopupService.createPopup(body);
        res.status(201).json({
            code: 201,
            message: 'Lockscreen popup created',
            data: popup
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/admin/slots', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const slots = await lockscreenPopup_service_1.lockscreenPopupService.listSlots();
        res.status(200).json({
            code: 200,
            message: 'success',
            data: slots
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/admin/slots', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const body = req.body;
        const slot = await lockscreenPopup_service_1.lockscreenPopupService.createSlot(body);
        res.status(201).json({
            code: 201,
            message: 'Lockscreen popup slot created',
            data: slot
        });
    }
    catch (error) {
        next(error);
    }
});
router.put('/admin/slots/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const body = req.body;
        const slot = await lockscreenPopup_service_1.lockscreenPopupService.updateSlot(id, body);
        res.status(200).json({
            code: 200,
            message: 'Lockscreen popup slot updated',
            data: slot
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/admin/slots/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        await lockscreenPopup_service_1.lockscreenPopupService.deleteSlot(id);
        res.status(200).json({
            code: 200,
            message: 'Lockscreen popup slot deleted',
            data: null
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/admin/auto-texts', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const texts = await lockscreenPopup_service_1.lockscreenPopupService.listAutoTexts();
        res.status(200).json({
            code: 200,
            message: 'success',
            data: texts
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/admin/auto-texts', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const body = req.body;
        const text = await lockscreenPopup_service_1.lockscreenPopupService.createAutoText(body);
        res.status(201).json({
            code: 201,
            message: 'Lockscreen auto text created',
            data: text
        });
    }
    catch (error) {
        next(error);
    }
});
router.put('/admin/auto-texts/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const body = req.body;
        const text = await lockscreenPopup_service_1.lockscreenPopupService.updateAutoText(id, body);
        res.status(200).json({
            code: 200,
            message: 'Lockscreen auto text updated',
            data: text
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/admin/auto-texts/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        await lockscreenPopup_service_1.lockscreenPopupService.deleteAutoText(id);
        res.status(200).json({
            code: 200,
            message: 'Lockscreen auto text deleted',
            data: null
        });
    }
    catch (error) {
        next(error);
    }
});
router.put('/admin/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const body = req.body;
        const popup = await lockscreenPopup_service_1.lockscreenPopupService.updatePopup(id, body);
        res.status(200).json({
            code: 200,
            message: 'Lockscreen popup updated',
            data: popup
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/admin/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        await lockscreenPopup_service_1.lockscreenPopupService.deletePopup(id);
        res.status(200).json({
            code: 200,
            message: 'Lockscreen popup deleted',
            data: null
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
