"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLowercaseSha256Hex = exports.hashToken = exports.hashPassword = exports.calculateTokensPerVideo = void 0;
exports.validateLoginBody = validateLoginBody;
exports.validateSlug = validateSlug;
const types_1 = require("../types");
const crypto_1 = __importDefault(require("crypto"));
const calculateTokensPerVideo = (ratio) => {
    const { width, height } = types_1.BYTEPLUS_RATIO_MAPPING[ratio].size.split('x').reduce((acc, val, idx) => {
        if (idx === 0)
            acc.width = parseInt(val, 10);
        else
            acc.height = parseInt(val, 10);
        return acc;
    }, { width: 0, height: 0 });
    return Math.floor(((width * height * 3) / 1024) * 1.3);
};
exports.calculateTokensPerVideo = calculateTokensPerVideo;
function validateLoginBody(body) {
    if (!body || typeof body !== 'object') {
        return 'Request body is required';
    }
    const { email, password } = body;
    if (!email || typeof email !== 'string' || !email.trim()) {
        return 'Email is required';
    }
    if (!password || typeof password !== 'string') {
        return 'Password is required';
    }
    if (password.length < 6) {
        return 'Password must be at least 6 characters';
    }
    return null;
}
function validateSlug(slug) {
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
        throw new Error('Slug is required');
    }
    return slug
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)+/g, '');
}
const hashPassword = (password) => {
    const SALT = 'iuBred7xZFNlaP6ygiTeB3kd2ATINGRo4R0byYCjHgG';
    return crypto_1.default.pbkdf2Sync(password, SALT, 1000, 64, 'sha256').toString('hex');
};
exports.hashPassword = hashPassword;
const hashToken = (token) => {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
};
exports.hashToken = hashToken;
const isLowercaseSha256Hex = (value) => {
    return /^[a-f0-9]{64}$/.test(value);
};
exports.isLowercaseSha256Hex = isLowercaseSha256Hex;
