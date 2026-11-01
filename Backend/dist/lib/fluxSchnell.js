"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitFluxSchnellTask = submitFluxSchnellTask;
exports.storeFluxSchnellResultToR2 = storeFluxSchnellResultToR2;
exports.submitAndStoreFluxSchnellTask = submitAndStoreFluxSchnellTask;
const config_1 = require("../config");
const r2_1 = require("./r2");
const types_1 = require("../types");
const crypto_1 = __importDefault(require("crypto"));
const buildSiliconFlowHeaders = () => ({
    'Authorization': `Bearer ${config_1.config.siliconFlow.apiKey}`,
    'Content-Type': 'application/json', //Báo cho server biết body bạn gửi là JSON, để nó parse đúng.
});
async function parseFluxSchnellResponse(response) {
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    }
    catch {
        data = { message: text };
    }
    if (!response.ok) {
        const message = data.message || text || 'Unknown error';
        throw new Error(`SiliconFlow FLUX.1-schnell failed (${response.status}): ${message}`);
    }
    return data;
}
async function submitFluxSchnellTask(payload) {
    const imageSize = payload.imageSize
        || types_1.FLUX_SCHNELL_RATIO_MAPPING[payload.ratio || '1:1'].size;
    const response = await fetch(`${config_1.config.siliconFlow.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: buildSiliconFlowHeaders(),
        body: JSON.stringify({
            model: config_1.config.siliconFlow.fluxSchnellModel,
            prompt: payload.prompt,
            image_size: imageSize,
            ...(payload.seed !== undefined ? { seed: payload.seed } : {}),
            ...(payload.outputFormat ? { output_format: payload.outputFormat } : {}),
        }),
    });
    return parseFluxSchnellResponse(response);
}
////
async function storeFluxSchnellResultToR2(deviceId, fileUrl) {
    const response = await fetch(fileUrl);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to download SiliconFlow result (${response.status}): ${text}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const responseContentType = response.headers.get('content-type') || '';
    const detectedContentType = detectImageContentType(buffer);
    const contentType = responseContentType.startsWith('image/')
        ? responseContentType
        : detectedContentType;
    if (!contentType) {
        throw new Error(`SiliconFlow result is not an image: ${responseContentType || 'unknown'}`);
    }
    const extension = getImageExtension(contentType, fileUrl);
    const key = `faceswap/${deviceId}/results/${crypto_1.default.randomUUID()}.${extension}`;
    return (0, r2_1.uploadBuffer)(key, buffer, contentType);
}
async function submitAndStoreFluxSchnellTask(deviceId, payload) {
    const result = await submitFluxSchnellTask(payload);
    if (!result.images?.length) {
        throw new Error('SiliconFlow response is missing images.');
    }
    const storedImages = await Promise.all(result.images.map(async (image) => ({
        provider_url: image.url,
        url: await storeFluxSchnellResultToR2(deviceId, image.url),
    })));
    return {
        ...result,
        images: storedImages,
    };
}
function getImageExtension(contentType, fileUrl) {
    const extensionByContentType = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
    };
    const normalizedContentType = contentType.split(';')[0].trim().toLowerCase();
    if (extensionByContentType[normalizedContentType]) {
        return extensionByContentType[normalizedContentType];
    }
    try {
        const pathname = new URL(fileUrl).pathname;
        const match = pathname.match(/\.([a-z0-9]+)$/i);
        if (match)
            return match[1].toLowerCase();
    }
    catch {
        // Fall back to PNG when the provider URL has no usable extension.
    }
    return 'png';
}
function detectImageContentType(buffer) {
    if (buffer.length >= 12
        && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return 'image/webp';
    }
    if (buffer.length >= 8
        && buffer[0] === 0x89
        && buffer.subarray(1, 4).toString('ascii') === 'PNG') {
        return 'image/png';
    }
    if (buffer.length >= 3
        && buffer[0] === 0xff
        && buffer[1] === 0xd8
        && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.length >= 6) {
        const signature = buffer.subarray(0, 6).toString('ascii');
        if (signature === 'GIF87a' || signature === 'GIF89a') {
            return 'image/gif';
        }
    }
    return null;
}
