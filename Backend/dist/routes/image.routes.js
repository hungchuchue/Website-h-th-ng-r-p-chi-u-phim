"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deviceAuth_1 = require("../middleware/deviceAuth");
const image_service_1 = require("../services/image.service");
const imageTask_repository_1 = require("../repositories/imageTask.repository");
const router = (0, express_1.Router)();
router.get('/history', deviceAuth_1.deviceAuth, async (req, res, next) => {
    try {
        const uid = req.deviceId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const history = await image_service_1.imageService.getHistory(uid, page, limit);
        const result = {
            pending: history.pending,
            completed: history.completed,
            total_completed: history.total_completed
        };
        res.status(200).json({ code: 200, message: 'success', data: result, pagination: history.pagination });
    }
    catch (err) {
        next(err);
    }
});
router.post('/status/batch', deviceAuth_1.deviceAuth, async (req, res, next) => {
    try {
        const uid = req.deviceId;
        const taskIds = req.body.task_ids;
        if (!taskIds || !Array.isArray(taskIds)) {
            return res.status(400).json({ code: 400, message: 'Missing task_ids.', data: null });
        }
        const tasks = await imageTask_repository_1.imageTaskRepository.findByIdsAndDevice(taskIds, uid);
        const responseTasks = tasks.map(image_service_1.imageService.toTaskStatusResponse);
        const allDone = responseTasks.every(t => ['succeeded', 'failed', 'cancelled', 'expired'].includes(t.status));
        res.status(200).json({ code: 200, message: 'success', data: { tasks: responseTasks, all_done: allDone } });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:taskId', deviceAuth_1.deviceAuth, async (req, res, next) => {
    try {
        const uid = req.deviceId;
        const taskId = parseInt(req.params.taskId, 10);
        if (isNaN(taskId)) {
            return res.status(400).json({ code: 400, message: 'Invalid ID.', data: null });
        }
        const result = await image_service_1.imageService.getImageDetail(uid, taskId);
        res.status(200).json({ code: 200, message: 'success', data: result });
    }
    catch (err) {
        next(err);
    }
});
router.post('/upscale', deviceAuth_1.deviceAuth, async (req, res, next) => {
    try {
        const uid = req.deviceId;
        const body = req.body;
        const result = await image_service_1.imageService.runImageUpscale(uid, body);
        res.status(200).json({ code: 200, message: 'success', data: result });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
