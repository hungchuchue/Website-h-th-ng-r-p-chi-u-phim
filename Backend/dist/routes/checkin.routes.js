"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const checkin_service_1 = require("../services/checkin.service");
const requireAuth_1 = require("../middleware/requireAuth");
const router = (0, express_1.Router)();
router.post('/', async (req, res, next) => {
    try {
        const body = req.body;
        const state = await checkin_service_1.checkinService.getState(body.device_id, body.country);
        res.status(200).json({
            code: 200,
            message: 'success',
            data: state
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/configs', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const configs = await checkin_service_1.checkinService.listCheckinTemplateConfigs(country);
        res.status(200).json({
            code: 200,
            message: 'success',
            data: configs
        });
    }
    catch (error) {
        next(error);
    }
});
router.put('/configs/:country_code/:day_slot', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const config = await checkin_service_1.checkinService.setCheckinTemplateConfig(req.params.country_code, Number(req.params.day_slot), req.body.template_id, req.body.is_enabled === undefined ? true : req.body.is_enabled === true);
        res.status(200).json({
            code: 200,
            message: 'Check-in template config updated',
            data: config
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/unlock', async (req, res, next) => {
    try {
        const body = req.body;
        const result = await checkin_service_1.checkinService.unlock(body.device_id, body.day_number, body.unlock_source);
        res.status(result.created ? 201 : 200).json({
            code: result.created ? 201 : 200,
            message: result.created ? 'Template unlocked successfully' : 'Template already unlocked',
            data: result
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
