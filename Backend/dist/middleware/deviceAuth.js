"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceAuth = void 0;
const logger_1 = require("../utils/logger");
const deviceAuth = async (req, res, next) => {
    try {
        const deviceId = req.headers['x-device-id'];
        if (!deviceId || deviceId.trim() === '') {
            throw new logger_1.AppError(400, 'MISSING_DEVICE_ID', 'Header X-Device-ID is required');
        }
        req.deviceId = deviceId.trim();
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.deviceAuth = deviceAuth;
