"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceError = void 0;
exports.validateInput = validateInput;
exports.runImageUpscale = runImageUpscale;
const imageUpscaler_1 = require("../lib/imageUpscaler");
class ServiceError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ServiceError';
    }
}
exports.ServiceError = ServiceError;
function validateInput(input) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new ServiceError(400, 'Request body must be a JSON object.');
    }
    const body = input;
    for (const field of ['imageBase64', 'scale', 'outputFormat']) {
        // Reject field presence, including null, false, or empty values.
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            throw new ServiceError(400, 'This field is not publicly supported by the provider; please use imageUrl.');
        }
    }
    if (typeof body.deviceId !== 'string' || !body.deviceId.trim()) {
        throw new ServiceError(400, 'deviceId is required and must be a non-empty string.');
    }
    if (typeof body.imageUrl !== 'string' || !body.imageUrl.trim()) {
        throw new ServiceError(400, 'imageUrl is required and must be a non-empty string.');
    }
    const imageUrl = body.imageUrl.trim();
    try {
        const url = new URL(imageUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
            throw new Error('Invalid URL');
        }
    }
    catch {
        throw new ServiceError(400, 'imageUrl must be a valid HTTP(S) URL without embedded credentials.');
    }
    return { deviceId: body.deviceId.trim(), imageUrl };
}
async function runImageUpscale(input) {
    // Validate outside the provider catch so input errors retain their 400 status.
    const { deviceId, imageUrl } = validateInput(input);
    try {
        const result = await (0, imageUpscaler_1.submitAndStoreUpscaleTask)(deviceId, { imageUrl });
        return { url: result.url, providerUrl: result.provider_url };
    }
    catch (error) {
        if (error instanceof imageUpscaler_1.UpscaleQuotaExceededError) {
            throw new ServiceError(429, error.message);
        }
        const message = error instanceof Error ? error.message : 'Image upscaling failed.';
        throw new ServiceError(502, message);
    }
}
