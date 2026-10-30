"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_LANGUAGES = exports.MODULE_TYPES = exports.ModuleType = void 0;
var ModuleType;
(function (ModuleType) {
    ModuleType["VOICE_PRACTICE"] = "VOICE_PRACTICE";
    ModuleType["READING"] = "READING";
    ModuleType["WORD_MASTERY"] = "WORD_MASTERY";
    ModuleType["ROADMAP"] = "ROADMAP";
})(ModuleType || (exports.ModuleType = ModuleType = {}));
exports.MODULE_TYPES = Object.values(ModuleType);
// --- Supported languages for localization ---
// --- Supported languages for localization ---
exports.SUPPORTED_LANGUAGES = [
    { code: 'hi', label: 'Hindi (हिंद)' },
    { code: 'ar', label: 'Saudi Arabia (عربي)', locale: 'ar-rSA' },
    { code: 'en', label: 'English (UK)', locale: 'en-rGB' },
    { code: 'en', label: 'English (US)', locale: 'en-rUS' },
    { code: 'bn', label: 'Bangla (বাংলা)' },
    { code: 'pt', label: 'Portuguese (brasileiro)', locale: 'pt-rBR' },
    { code: 'ar', label: 'Tunisia (عربي)', locale: 'ar-rTN' },
    { code: 'ar', label: 'Oman (عربي)', locale: 'ar-rOM' },
    { code: 'id', label: 'Indonesian (bahasa Indo)', locale: 'in' },
    { code: 'pt', label: 'Portuguese (português)', locale: 'pt-rPT' },
    { code: 'es', label: 'Spanish (español)' },
    { code: 'mr', label: 'Marathi (मराठी)' },
    { code: 'te', label: 'Telugu (తెలుగు)' },
    { code: 'ta', label: 'Tamil (தமிழ்)' },
    { code: 'ru', label: 'Russian (русский)' },
    { code: 'fr', label: 'French (français)' },
    { code: 'vi', label: 'Vietnamese (Tiếng Việt)' },
    { code: 'de', label: 'German (Deutsch)', locale: 'de-rDE' },
    { code: 'ko', label: 'Korean (한국인)' },
    { code: 'ja', label: 'Japanese (日本語)' },
    { code: 'tr', label: 'Turkish (Türkçe)', locale: 'tr-rTR' },
    { code: 'zh-CN', label: 'Chinese (中国人)', locale: 'zh' },
    { code: 'it', label: 'Italian (italiano)', locale: 'it-rIT' },
    { code: 'th', label: 'Thai (คนไทย)' },
    { code: 'nl', label: 'Dutch (Nederlands)', locale: 'nl-rNL' },
    { code: 'da', label: 'Danish (dansk)', locale: 'da-rDK' },
    { code: 'ga', label: 'Irish (Gaeilge)' },
    { code: 'pl', label: 'Polish (polski)' },
    { code: 'zu', label: 'Zulu' },
];
//# sourceMappingURL=index.js.map