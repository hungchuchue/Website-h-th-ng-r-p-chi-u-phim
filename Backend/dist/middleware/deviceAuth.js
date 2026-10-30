"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceAuth = void 0;
const logger_1 = require("../utils/logger");
const deviceAuth = async (req, res, next) => {
    try {
        const headerDeviceId = req.headers['x-device-id'];
        const deviceId = typeof headerDeviceId === 'string' ? headerDeviceId : '';
        if (!deviceId || deviceId.trim() === '' || deviceId.trim().length < 8 || deviceId.length > 128) {
            throw new logger_1.AppError(400, 'MISSING_DEVICE_ID', 'A valid X-Device-ID header is required');
        }
        req.deviceId = deviceId.trim();
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.deviceAuth = deviceAuth;
//# sourceMappingURL=deviceAuth.js.map