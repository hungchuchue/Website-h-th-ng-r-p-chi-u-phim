"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpscaleQuotaExceededError = void 0;
//lỗi riêng cho trường hợp vượt giới hạn upscale
class UpscaleQuotaExceededError extends Error {
    statusCode = 429;
    constructor(message) {
        super(message);
        this.name = 'UpscaleQuotaExceededError';
    }
}
exports.UpscaleQuotaExceededError = UpscaleQuotaExceededError;
