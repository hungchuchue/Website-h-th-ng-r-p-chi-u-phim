"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const google_translate_api_x_1 = __importDefault(require("google-translate-api-x"));
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.post('/', async (req, res, next) => {
    const { text } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text is required' });
    }
    const trimmedText = text.trim();
    const uniqueCodes = [...new Set(types_1.SUPPORTED_LANGUAGES.map((l) => l.code))];
    const translationMap = {};
    const errors = [];
    await Promise.all(uniqueCodes.map(async (code) => {
        try {
            const result = await (0, google_translate_api_x_1.default)(trimmedText, { from: 'en', to: code });
            // result có thể là single object { text, from, ... }
            const r = Array.isArray(result) ? result[0] : result;
            translationMap[code] = r?.text ?? trimmedText;
        }
        catch (err) {
            errors.push({ langCode: code, error: err.message });
            translationMap[code] = trimmedText; // fallback
        }
    }));
    const result = {};
    for (const lang of types_1.SUPPORTED_LANGUAGES) {
        const localeKey = lang.locale || lang.code;
        result[localeKey] = translationMap[lang.code] || trimmedText;
    }
    if (errors.length > 0) {
        console.warn('Some translations failed:', errors);
        return res.status(207).json({ code: 207, message: 'Partial success', data: result, errors });
    }
    res.status(200).json({ code: 200, message: 'success', data: result });
});
exports.default = router;
