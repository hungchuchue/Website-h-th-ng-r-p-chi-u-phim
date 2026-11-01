"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHeaders = void 0;
exports.parseUpscaleResponse = parseUpscaleResponse;
exports.submitUpscaleTask = submitUpscaleTask;
exports.extractTaskId = extractTaskId;
exports.pollUpscaleTask = pollUpscaleTask;
exports.extractResultImageRef = extractResultImageRef;
exports.storeUpscaleResultToR2 = storeUpscaleResultToR2;
exports.submitAndStoreUpscaleTask = submitAndStoreUpscaleTask;
const config_1 = require("../config");
const r2_1 = require("./r2");
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = require("timers/promises");
const responses_1 = require("../types/responses");
const resultImageFields = ['output_url', 'result', 'image', 'url', 'result_url', 'base64']; // Provider returns the result image in the base64 field.
const pollingPath = '/status.php'; // TODO: Replace with the actual documented polling path before relying on asynchronous results.
const buildHeaders = () => ({
    'x-rapidapi-key': config_1.config.upscaleApi.key,
    'x-rapidapi-host': config_1.config.upscaleApi.upscalerHost,
    'Content-Type': 'application/x-www-form-urlencoded',
});
exports.buildHeaders = buildHeaders;
function providerError(message, statusCode = 502) {
    return Object.assign(new Error(`RapidAPI Upscaler failed (${statusCode}): ${message}`), { statusCode });
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function getProviderMessage(result) {
    for (const value of [result.message, result.error]) {
        if (typeof value === 'string' && value.trim())
            return value;
        if (typeof value === 'object' && value !== null
            && isRecord(value) && typeof value.message === 'string')
            return value.message;
    }
    return '';
}
function getStatus(result) {
    const status = result.status ?? result.data?.status;
    return typeof status === 'string' ? status.trim().toLowerCase() : '';
}
async function parseUpscaleResponse(response) {
    const text = await response.text();
    let parsed = {};
    let hasParsedObject = false;
    try {
        if (text) {
            parsed = JSON.parse(text);
            hasParsedObject = isRecord(parsed);
        }
    }
    catch {
        hasParsedObject = false;
    }
    const data = hasParsedObject ? parsed : undefined;
    const message = (data && getProviderMessage(data)) || text || 'Unknown error';
    const failed = !response.ok || data?.success === false
        || (data !== undefined && ['failed', 'error'].includes(getStatus(data)));
    if (failed) {
        if (response.status === 429 || /quota|limit|exceeded/i.test(message)) {
            throw new responses_1.UpscaleQuotaExceededError(`RapidAPI Upscaler quota exceeded (${response.status}): ${message}`);
        }
        throw providerError(message, response.status);
    }
    if (!data) {
        throw providerError(`Expected a JSON object; received HTTP ${response.status}.`);
    }
    return data;
}
async function submitUpscaleTask(payload) {
    if (!config_1.config.upscaleApi.key)
        throw providerError('UPSCALER_KEY is not configured.');
    const response = await fetch(`https://${config_1.config.upscaleApi.upscalerHost}${config_1.config.upscaleApi.upscalerPath}`, {
        method: 'POST',
        headers: (0, exports.buildHeaders)(),
        body: new URLSearchParams({ url: payload.imageUrl }),
    });
    return parseUpscaleResponse(response);
}
function extractTaskId(result) {
    for (const source of [result, result.data]) {
        if (!source || !isRecord(source))
            continue;
        for (const field of ['task_id', 'id', 'job_id']) {
            const value = source[field];
            if (typeof value === 'string' && value.trim())
                return value.trim();
            if (typeof value === 'number' && Number.isFinite(value))
                return String(value);
        }
    }
    return undefined;
}
async function pollUpscaleTask(taskId) {
    const url = new URL(pollingPath, `https://${config_1.config.upscaleApi.upscalerHost}`);
    url.searchParams.set('task_id', taskId);
    for (let attempt = 0; attempt < 10; attempt++) {
        if (attempt > 0)
            await (0, promises_1.setTimeout)(3_000);
        const response = await fetch(url, {
            method: 'GET',
            headers: (0, exports.buildHeaders)(),
        });
        // The parser also terminates polling on failed/error or quota responses.
        const result = await parseUpscaleResponse(response);
        if (['completed', 'done', 'success'].includes(getStatus(result)))
            return result;
    }
    throw providerError('Polling timed out after 10 attempts.');
}
function extractResultImageRef(result) {
    for (const source of [result, result.data]) {
        if (!source || !isRecord(source))
            continue;
        for (const field of resultImageFields) {
            const value = source[field];
            if (typeof value !== 'string' || !value.trim())
                continue;
            const ref = value.trim();
            if (/^https?:\/\//i.test(ref) || /^data:image\//i.test(ref)
                || detectImageContentType(Buffer.from(ref, 'base64')))
                return ref;
        }
    }
    throw providerError('Response is missing a supported result image reference.');
}
async function storeUpscaleResultToR2(deviceId, imageRef) {
    let buffer;
    if (/^https?:\/\//i.test(imageRef)) {
        const response = await fetch(imageRef);
        if (!response.ok) {
            throw providerError(`Failed to download result: ${await response.text()}`, response.status);
        }
        buffer = Buffer.from(await response.arrayBuffer());
    }
    else {
        const dataUrl = imageRef.match(/^data:image\/(?:png|jpe?g|webp|gif);base64,([\s\S]+)$/i);
        const base64 = (dataUrl ? dataUrl[1] : imageRef).replace(/\s/g, '');
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) {
            throw providerError('Result is not an HTTP(S) URL or valid image base64.');
        }
        buffer = Buffer.from(base64, 'base64');
        if (buffer.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
            throw providerError('Result contains invalid base64 encoding.');
        }
    }
    // Verify the bytes rather than trusting a provider's MIME header or data URL.
    const contentType = detectImageContentType(buffer);
    if (!contentType)
        throw providerError('Result is not a PNG, JPEG, WEBP, or GIF image.');
    const extension = getImageExtension(contentType, imageRef);
    const fileKey = `faceswap/${deviceId}/results/${crypto_1.default.randomUUID()}.${extension}`;
    try {
        return await (0, r2_1.uploadBuffer)(fileKey, buffer, contentType);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw providerError(`Failed to store result in R2: ${message}`);
    }
}
async function submitAndStoreUpscaleTask(deviceId, payload) {
    let result = await submitUpscaleTask(payload);
    const taskId = extractTaskId(result);
    if (taskId !== undefined)
        result = await pollUpscaleTask(taskId);
    const imageRef = extractResultImageRef(result);
    const url = await storeUpscaleResultToR2(deviceId, imageRef);
    return {
        provider_url: payload.imageUrl,
        url,
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
    if (extensionByContentType[normalizedContentType])
        return extensionByContentType[normalizedContentType];
    try {
        const match = new URL(fileUrl).pathname.match(/\.([a-z0-9]+)$/i);
        if (match)
            return match[1].toLowerCase();
    }
    catch {
        // Base64 references have no URL extension; fall back to PNG.
    }
    return 'png';
}
function detectImageContentType(buffer) {
    if (buffer.length >= 12
        && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP')
        return 'image/webp';
    if (buffer.length >= 8
        && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.length >= 6) {
        const signature = buffer.subarray(0, 6).toString('ascii');
        if (signature === 'GIF87a' || signature === 'GIF89a')
            return 'image/gif';
    }
    return null;
}
