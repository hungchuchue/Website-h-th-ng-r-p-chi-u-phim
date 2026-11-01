"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkinService = void 0;
const checkin_repository_1 = require("../repositories/checkin.repository");
const logger_1 = require("../utils/logger");
const cache_1 = __importDefault(require("../utils/cache"));
const types_1 = require("../types");
const template_repository_1 = require("../repositories/template.repository");
const CHECKIN_WINDOW_DAYS = 7;
const CHECKIN_DEFAULT_COUNTRY = 'all';
const toDisplayDay = (rawDay) => ((rawDay - 1) % CHECKIN_WINDOW_DAYS) + 1;
const getWindowStart = (rawDay) => Math.floor((rawDay - 1) / CHECKIN_WINDOW_DAYS) * CHECKIN_WINDOW_DAYS + 1;
const resolveRequestedDay = (requestedDay, currentRawDay) => {
    if (requestedDay > CHECKIN_WINDOW_DAYS)
        return requestedDay;
    return getWindowStart(currentRawDay) + requestedDay - 1;
};
const normalizeCheckinCountry = (country) => {
    const countryCode = typeof country === 'string' && country.trim()
        ? country.trim().toLowerCase()
        : CHECKIN_DEFAULT_COUNTRY;
    if (countryCode === CHECKIN_DEFAULT_COUNTRY)
        return countryCode;
    if (!types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === countryCode)) {
        throw new logger_1.AppError(400, 'INVALID_COUNTRY', 'Unsupported country');
    }
    return countryCode;
};
const getOrCreateUser = async (deviceId, countryCode, shouldUpdateCountry) => {
    const existingUser = await checkin_repository_1.checkinRepository.findUserByDevice(deviceId);
    if (existingUser) {
        const currentCountryCode = existingUser.country_code || CHECKIN_DEFAULT_COUNTRY;
        if (shouldUpdateCountry && currentCountryCode !== countryCode) {
            return checkin_repository_1.checkinRepository.updateUserCountry(deviceId, countryCode);
        }
        return {
            ...existingUser,
            country_code: currentCountryCode
        };
    }
    return checkin_repository_1.checkinRepository.createUser(deviceId, countryCode);
};
const getExistingUser = async (deviceId) => {
    const user = await checkin_repository_1.checkinRepository.findUserByDevice(deviceId);
    if (!user) {
        throw new logger_1.AppError(404, 'CHECKIN_USER_NOT_FOUND', 'Check-in user not found; initialize check-in first');
    }
    return {
        ...user,
        country_code: user.country_code || CHECKIN_DEFAULT_COUNTRY
    };
};
const toTemplateResponse = (row) => {
    if (!row || !row.id)
        return null;
    return {
        id: row.id,
        image_url: row.image_url,
        prompt: row.prompt,
        ratio: row.ratio,
        type_ids: row.type_ids || [],
        types: row.types || [],
        is_enabled: row.is_enabled === true,
        is_all_countries: row.is_all_countries,
        countries: row.countries,
        sort_order: row.sort_order,
        created_at: row.created_at
    };
};
const toDayResponse = (row) => {
    return {
        day_number: Number(row.day_number),
        template: toTemplateResponse(row),
        is_unlocked: row.unlocked === true,
        unlock_source: row.unlock_source || null,
        unlocked_at: row.unlocked_at || null,
        config_country_code: row.config_country_code || null
    };
};
const buildProgress = async (userId, currentRawDay) => {
    const windowStart = getWindowStart(currentRawDay);
    const unlockedDays = await checkin_repository_1.checkinRepository.countUnlockedInWindow(userId, windowStart, windowStart + CHECKIN_WINDOW_DAYS - 1);
    return {
        current_day: toDisplayDay(currentRawDay),
        unlocked_days: unlockedDays,
        total_days: CHECKIN_WINDOW_DAYS
    };
};
const buildUnlockResponse = async (countryCode, userId, rawDay, log, created, currentRawDay) => {
    const template = toTemplateResponse(await checkin_repository_1.checkinRepository.getTemplateForRawDay(countryCode, userId, rawDay));
    if (!template) {
        throw new logger_1.AppError(404, 'CHECKIN_TEMPLATE_NOT_FOUND', 'No daily check-in template exists for this day');
    }
    return {
        created,
        log: {
            id: log.id,
            user_id: log.user_id,
            day_number: log.day_number,
            calendar_date: log.calendar_date,
            unlock_source: log.unlock_source,
            unlocked_at: log.unlocked_at
        },
        template,
        progress: await buildProgress(userId, currentRawDay)
    };
};
exports.checkinService = {
    getState: async (deviceId, country) => {
        if (!deviceId || typeof deviceId !== 'string') {
            throw new logger_1.AppError(400, 'INVALID_DEVICE_ID', 'device_id is required');
        }
        const shouldUpdateCountry = typeof country === 'string' && Boolean(country.trim());
        const countryCode = normalizeCheckinCountry(country);
        const user = await getOrCreateUser(deviceId, countryCode, shouldUpdateCountry);
        const rawDay = await checkin_repository_1.checkinRepository.getCurrentRawDay(user.id);
        const windowStart = getWindowStart(rawDay);
        const rows = await checkin_repository_1.checkinRepository.getWindowTemplates(user.country_code, user.id, windowStart);
        const templates = rows.map(toDayResponse);
        if (templates.some((day) => !day.template)) {
            throw new logger_1.AppError(503, 'CHECKIN_TEMPLATE_NOT_CONFIGURED', 'Daily check-in template is not configured');
        }
        const progress = await buildProgress(user.id, rawDay);
        return {
            user: {
                id: user.id,
                device_id: user.device_id,
                country_code: user.country_code,
                start_date: user.start_date
            },
            progress,
            templates
        };
    },
    unlock: async (deviceId, dayNumber, unlockSource) => {
        /// checking device id
        if (!deviceId || typeof deviceId !== 'string') {
            throw new logger_1.AppError(400, 'INVALID_DEVICE_ID', 'device_id is required');
        }
        /// checking day number
        const parsedDayNumber = Number(dayNumber);
        if (!Number.isInteger(parsedDayNumber) || parsedDayNumber < 1 || parsedDayNumber > 7) {
            throw new logger_1.AppError(400, 'INVALID_DAY_NUMBER', 'day_number must be a positive integer between 1 and 7');
        }
        /// checking unlock source
        if (unlockSource !== 'checkin' && unlockSource !== 'ads') {
            throw new logger_1.AppError(400, 'INVALID_UNLOCK_SOURCE', 'unlock_source must be checkin or ads');
        }
        const user = await getExistingUser(deviceId);
        const currentRawDay = await checkin_repository_1.checkinRepository.getCurrentRawDay(user.id);
        const rawDay = resolveRequestedDay(parsedDayNumber, currentRawDay);
        const existingLog = await checkin_repository_1.checkinRepository.findLogByDay(user.id, rawDay);
        if (existingLog) {
            return buildUnlockResponse(user.country_code, user.id, rawDay, existingLog, false, currentRawDay);
        }
        if (rawDay > currentRawDay) {
            throw new logger_1.AppError(409, 'CHECKIN_FUTURE_DAY', 'Future check-in day cannot be unlocked');
        }
        if (unlockSource === 'checkin' && rawDay !== currentRawDay) {
            throw new logger_1.AppError(409, 'CHECKIN_DAY_NOT_CURRENT', 'Check-in can only unlock the current day');
        }
        if (unlockSource === 'ads' && rawDay >= currentRawDay) {
            throw new logger_1.AppError(409, 'CHECKIN_ADS_DAY_NOT_MISSED', 'Ads can only unlock missed past days');
        }
        const calendarDate = await checkin_repository_1.checkinRepository.getCalendarDateForRawDay(user.id, rawDay);
        const insertedLog = await checkin_repository_1.checkinRepository.insertLog(user.id, rawDay, calendarDate, unlockSource);
        const log = insertedLog || await checkin_repository_1.checkinRepository.findLogByDay(user.id, rawDay);
        if (!log) {
            throw new logger_1.AppError(500, 'CHECKIN_UNLOCK_FAILED', 'Failed to unlock check-in template');
        }
        return buildUnlockResponse(user.country_code, user.id, rawDay, log, Boolean(insertedLog), currentRawDay);
    },
    setCheckinSpecialCategory: async (categoryId) => {
        const category = await checkin_repository_1.checkinRepository.setCheckinSpecialCategory(categoryId);
        cache_1.default.flushAll();
        return category;
    },
    setCheckinTemplateConfig: async (country, daySlot, templateId, isEnabled = true) => {
        const countryCode = normalizeCheckinCountry(country);
        if (!Number.isInteger(daySlot) || daySlot < 1 || daySlot > 14) {
            throw new logger_1.AppError(400, 'INVALID_DAY_SLOT', 'day_slot must be an integer between 1 and 14');
        }
        if (!templateId || typeof templateId !== 'string') {
            throw new logger_1.AppError(400, 'INVALID_TEMPLATE_ID', 'template_id is required');
        }
        const template = await template_repository_1.templateRepository.findById(templateId);
        if (!template) {
            throw new logger_1.AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
        }
        const config = await checkin_repository_1.checkinRepository.setCheckinTemplateConfig(countryCode, daySlot, templateId, isEnabled);
        cache_1.default.flushAll();
        return config;
    },
    listCheckinTemplateConfigs: async (country) => {
        const countryCode = country ? normalizeCheckinCountry(country) : undefined;
        return checkin_repository_1.checkinRepository.listCheckinTemplateConfigs(countryCode);
    }
};
