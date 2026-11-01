"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const validation_1 = require("../utils/validation");
const auth_services_1 = require("../services/auth.services");
const cache_1 = __importDefault(require("../utils/cache"));
const router = (0, express_1.Router)();
// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const err = (0, validation_1.validateLoginBody)(req.body);
        if (err)
            throw new logger_1.AppError(400, 'VALIDATION_ERROR', err);
        const data = await auth_services_1.authService.login(req.body);
        res.status(200).json({ code: 200, message: 'Login successful', data });
    }
    catch (err) {
        next(err);
    }
});
router.get('/cache', (req, res) => {
    // Thư viện node-cache hỗ trợ hàm .keys() để lấy tất cả các key đang lưu
    const allKeys = cache_1.default.keys();
    // Hàm .getStats() trả về số lần Hit/Miss từ lúc chạy server
    const stats = cache_1.default.getStats();
    return res.json({
        keys_in_cache: allKeys,
        stats: stats // Xem tỉ lệ hit/miss để biết hiệu quả
    });
});
exports.default = router;
