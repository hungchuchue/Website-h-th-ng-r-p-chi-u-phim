"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDirectImageUrl = resolveDirectImageUrl;
const logger_1 = require("./logger");
async function resolveDirectImageUrl(imageUrl) {
    let response;
    try {
        response = await fetch(imageUrl, {
            method: 'HEAD',
            redirect: 'follow',
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown network error';
        throw new logger_1.AppError(400, 'INVALID_SOURCE_IMAGE', `Unable to access source image: ${message}`);
    }
    if (!response.ok) {
        throw new logger_1.AppError(400, 'INVALID_SOURCE_IMAGE', `Unable to access source image (HTTP ${response.status}).`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
        throw new logger_1.AppError(400, 'INVALID_SOURCE_IMAGE', `Source URL must return an image content-type; received ${contentType || 'unknown'}.`);
    }
    return response.url;
}
