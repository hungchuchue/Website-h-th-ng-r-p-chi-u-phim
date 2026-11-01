"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitFaceSwapTask = submitFaceSwapTask;
exports.storeFaceSwapResultToR2 = storeFaceSwapResultToR2;
exports.submitAndStoreFaceSwapTask = submitAndStoreFaceSwapTask;
const config_1 = require("../config");
const r2_1 = require("./r2");
const crypto_1 = __importDefault(require("crypto"));
const buildRapidApiHeaders = (contentType) => {
    const headers = {
        'x-rapidapi-host': config_1.config.rapidApi.faceSwapHost,
    };
    if (config_1.config.rapidApi.key) {
        headers['x-rapidapi-key'] = config_1.config.rapidApi.key;
    }
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    return headers;
};
async function parseFaceSwapResponse(response) {
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    }
    catch {
        data = { error: text };
    }
    if (!response.ok) {
        const message = data.error || data.message || text || 'Unknown error';
        throw new Error(`AI Face Swap failed (${response.status}): ${message}`);
    }
    return data;
}
async function submitFaceSwapTask(payload) {
    const body = new URLSearchParams({
        source_url: payload.sourceUrl,
        target_url: payload.targetUrl,
    });
    const response = await fetch(`${config_1.config.rapidApi.faceSwapBaseUrl}/public/process/urls`, {
        method: 'POST',
        headers: buildRapidApiHeaders('application/x-www-form-urlencoded'),
        body
    });
    return parseFaceSwapResponse(response);
}
async function storeFaceSwapResultToR2(deviceId, fileUrl) {
    const downloaded = await downloadFaceSwapImage(fileUrl);
    const extension = getImageExtension(downloaded.contentType, downloaded.finalUrl);
    const key = `faceswap/${deviceId}/sources/${crypto_1.default.randomUUID()}.${extension}`;
    return (0, r2_1.uploadBuffer)(key, downloaded.buffer, downloaded.contentType);
}
async function downloadFaceSwapImage(fileUrl, redirectCount = 0) {
    if (redirectCount > 2) {
        throw new Error('AI Face Swap result could not be resolved to an image.');
    }
    const response = await fetch(fileUrl);
    if (!response.ok) {
        const text = sanitizeErrorText(await response.text());
        throw new Error(`Failed to download AI Face Swap result (${response.status}): ${text}`);
    }
    const contentType = response.headers.get('content-type') || 'image/webp';
    const buffer = Buffer.from(await response.arrayBuffer());
    const detectedContentType = detectImageContentType(buffer);
    if (contentType.startsWith('image/') || detectedContentType) {
        return {
            buffer,
            contentType: contentType.startsWith('image/') ? contentType : detectedContentType,
            finalUrl: response.url || fileUrl,
        };
    }
    const text = sanitizeErrorText(buffer.toString('utf8')).trim();
    if (isHttpUrl(text)) {
        return downloadFaceSwapImage(text, redirectCount + 1);
    }
    throw new Error(`AI Face Swap result is not an image: ${contentType}. Body: ${text.slice(0, 200)}`);
}
async function submitAndStoreFaceSwapTask(deviceId, payload) {
    const result = await submitFaceSwapTask(payload);
    if (!result.file_url) {
        throw new Error('AI Face Swap response is missing file_url.');
    }
    const r2Url = await storeFaceSwapResultToR2(deviceId, result.file_url);
    return {
        ...result,
        provider_file_url: result.file_url,
        file_url: r2Url,
    };
}
function getImageExtension(contentType, fileUrl) {
    const extensionByContentType = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
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
        // Fall back to WEBP for provider responses without a usable URL extension.
    }
    return 'webp';
}
function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function sanitizeErrorText(value) {
    return value.replace(/\u0000/g, '').replace(/[^\S\r\n]+/g, ' ').slice(0, 500);
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
