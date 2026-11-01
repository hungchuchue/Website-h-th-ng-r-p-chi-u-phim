"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadService = void 0;
const r2_1 = require("../lib/r2");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOW_TYPE = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic'];
exports.uploadService = {
    async getPresignedUrl(uid, config) {
        if (!config.fileType || typeof config.fileType !== 'string') {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'fileType is required and must be a valid string.');
        }
        if (!ALLOW_TYPE.includes(config.fileType)) {
            throw new logger_1.AppError(400, 'INVALID_FILE_TYPE', `File type ${config.fileType} is not allowed.`);
        }
        const fileSize = config.fileSize;
        if (typeof fileSize !== 'number' || fileSize <= 0 || fileSize > MAX_SIZE || isNaN(fileSize)) {
            throw new logger_1.AppError(400, 'INVALID_FILE_SIZE', `File size must be a valid number between 1 byte and ${MAX_SIZE / 1024 / 1024}MB.`);
        }
        // Generate R2 presigned URL
        const fileId = crypto_1.default.randomUUID();
        const extension = config.fileType.split('/')[1];
        const objectKey = `users/${uid}/sources/${fileId}.${extension}`;
        const result = await (0, r2_1.generatePresignedUploadUrl)(objectKey, config.fileType, fileSize);
        return {
            expires_in_sec: 5 * 60,
            ...result,
        };
    }
};
