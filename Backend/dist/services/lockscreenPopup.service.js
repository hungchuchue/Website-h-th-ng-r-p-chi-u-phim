"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockscreenPopupService = void 0;
const lockscreenPopup_repository_1 = require("../repositories/lockscreenPopup.repository");
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
exports.lockscreenPopupService = {
    normalizeSlotTime(slotTime) {
        const normalized = slotTime.length === 5 ? `${slotTime}:00` : slotTime;
        if (!/^\d{2}:\d{2}:\d{2}$/.test(normalized)) {
            throw new logger_1.AppError(400, 'INVALID_SLOT_TIME', 'slot_time must use HH:mm or HH:mm:ss format');
        }
        const [hours, minutes, seconds] = normalized.split(':').map(Number);
        if (!Number.isInteger(hours) || hours < 0 || hours > 23 ||
            !Number.isInteger(minutes) || minutes < 0 || minutes > 59 ||
            !Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
            throw new logger_1.AppError(400, 'INVALID_SLOT_TIME', 'slot_time must be a valid UTC time');
        }
        return normalized;
    },
    validateDate(scheduledDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
            throw new logger_1.AppError(400, 'INVALID_DATE', 'scheduled_date must use YYYY-MM-DD format');
        }
        return scheduledDate;
    },
    validateCountry(country) {
        if (country && !types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
            throw new logger_1.AppError(400, 'INVALID_COUNTRY', 'Unsupported country');
        }
    },
    normalizeLocalizedText(value, fieldName, required) {
        if (value === undefined || value === null) {
            if (required) {
                throw new logger_1.AppError(400, 'INVALID_INPUT', `${fieldName} is required`);
            }
            return {};
        }
        if (typeof value !== 'object' || Array.isArray(value)) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', `${fieldName} must be an object keyed by locale`);
        }
        const normalized = {};
        for (const [locale, text] of Object.entries(value)) {
            if (typeof text !== 'string') {
                throw new logger_1.AppError(400, 'INVALID_INPUT', `${fieldName}.${locale} must be string`);
            }
            const normalizedLocale = locale.trim();
            const normalizedText = text.trim();
            if (normalizedLocale && normalizedText) {
                normalized[normalizedLocale] = normalizedText;
            }
        }
        if (required && Object.keys(normalized).length === 0) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', `${fieldName} must contain at least one locale text`);
        }
        return normalized;
    },
    getSlotMinutes(slotTime) {
        const [hours, minutes, seconds] = this.normalizeSlotTime(slotTime).split(':').map(Number);
        return hours * 60 + minutes + Math.floor(seconds / 60);
    },
    getCurrentUtcSlot(slotTimes, now = new Date()) {
        if (slotTimes.length === 0) {
            return null;
        }
        const normalizedSlots = Array.from(new Set(slotTimes.map((slotTime) => this.normalizeSlotTime(slotTime)))).sort((a, b) => this.getSlotMinutes(a) - this.getSlotMinutes(b));
        const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
        const currentSlot = [...normalizedSlots]
            .reverse()
            .find((slotTime) => this.getSlotMinutes(slotTime) <= minutes);
        if (currentSlot) {
            return { scheduledDate: now.toISOString().slice(0, 10), slotTime: currentSlot };
        }
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        return { scheduledDate: yesterday.toISOString().slice(0, 10), slotTime: normalizedSlots[normalizedSlots.length - 1] };
    },
    async getCurrentPopup(country) {
        this.validateCountry(country);
        const slotTimes = await lockscreenPopup_repository_1.lockscreenPopupRepository.getConfiguredSlotTimes();
        const currentSlot = this.getCurrentUtcSlot(slotTimes);
        if (!currentSlot) {
            return null;
        }
        const { scheduledDate, slotTime } = currentSlot;
        const existingPopup = await lockscreenPopup_repository_1.lockscreenPopupRepository.getCurrentPopup(scheduledDate, slotTime, country);
        if (existingPopup) {
            return existingPopup;
        }
        const templateId = await lockscreenPopup_repository_1.lockscreenPopupRepository.pickRandomTemplateForAuto(scheduledDate, country);
        if (!templateId) {
            return null;
        }
        const autoText = await lockscreenPopup_repository_1.lockscreenPopupRepository.getRandomAutoText();
        try {
            await lockscreenPopup_repository_1.lockscreenPopupRepository.createPopup({
                mode: 'auto',
                status: 'active',
                scheduled_date: scheduledDate,
                slot_time: slotTime,
                country_code: country || null,
                template_id: templateId,
                title: autoText?.title || {},
                description: autoText?.description || {},
            });
        }
        catch (error) {
            if (error?.code !== '23505') {
                throw error;
            }
        }
        return lockscreenPopup_repository_1.lockscreenPopupRepository.getCurrentPopup(scheduledDate, slotTime, country);
    },
    async listPopups(page = 1, limit = 20, filters) {
        if (filters.scheduledDate) {
            this.validateDate(filters.scheduledDate);
        }
        if (filters.mode && !['auto', 'manual'].includes(filters.mode)) {
            throw new logger_1.AppError(400, 'INVALID_MODE', 'mode must be auto or manual');
        }
        if (filters.status && !['active', 'inactive', 'cancelled'].includes(filters.status)) {
            throw new logger_1.AppError(400, 'INVALID_STATUS', 'status must be active, inactive, or cancelled');
        }
        if (filters.country && !['all', 'global'].includes(filters.country)) {
            this.validateCountry(filters.country);
        }
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const offset = (safePage - 1) * safeLimit;
        const { popups, total } = await lockscreenPopup_repository_1.lockscreenPopupRepository.listPopups(safeLimit, offset, filters);
        return {
            popups,
            pagination: {
                current_page: safePage,
                total_pages: Math.ceil(total / safeLimit) || 1,
                limit: safeLimit,
                total_items: total
            }
        };
    },
    async listSlots() {
        return lockscreenPopup_repository_1.lockscreenPopupRepository.listSlots();
    },
    async createSlot(reqBody) {
        if (!reqBody.slot_time) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'slot_time is required');
        }
        const slotTime = this.normalizeSlotTime(reqBody.slot_time);
        const isEnabled = reqBody.is_enabled ?? true;
        if (typeof isEnabled !== 'boolean') {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'is_enabled must be boolean');
        }
        try {
            return await lockscreenPopup_repository_1.lockscreenPopupRepository.createSlot(slotTime, isEnabled);
        }
        catch (error) {
            if (error?.code === '23505') {
                throw new logger_1.AppError(400, 'LOCKSCREEN_SLOT_EXISTS', 'Slot already exists');
            }
            throw error;
        }
    },
    async updateSlot(id, reqBody) {
        const existingSlot = await lockscreenPopup_repository_1.lockscreenPopupRepository.getSlotById(id);
        if (!existingSlot) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen popup slot not found');
        }
        if (reqBody.slot_time !== undefined) {
            reqBody.slot_time = this.normalizeSlotTime(reqBody.slot_time);
        }
        if (reqBody.is_enabled !== undefined && typeof reqBody.is_enabled !== 'boolean') {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'is_enabled must be boolean');
        }
        try {
            const updated = await lockscreenPopup_repository_1.lockscreenPopupRepository.updateSlot(id, reqBody);
            if (!updated) {
                throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen popup slot not found');
            }
            return updated;
        }
        catch (error) {
            if (error?.code === '23505') {
                throw new logger_1.AppError(400, 'LOCKSCREEN_SLOT_EXISTS', 'Slot already exists');
            }
            throw error;
        }
    },
    async deleteSlot(id) {
        const deleted = await lockscreenPopup_repository_1.lockscreenPopupRepository.deleteSlot(id);
        if (!deleted) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen popup slot not found');
        }
    },
    async listAutoTexts() {
        return lockscreenPopup_repository_1.lockscreenPopupRepository.listAutoTexts();
    },
    async createAutoText(reqBody) {
        const title = this.normalizeLocalizedText(reqBody.title, 'title', true);
        const description = this.normalizeLocalizedText(reqBody.description, 'description', true);
        const isEnabled = reqBody.is_enabled ?? true;
        if (typeof isEnabled !== 'boolean') {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'is_enabled must be boolean');
        }
        return lockscreenPopup_repository_1.lockscreenPopupRepository.createAutoText(title, description, isEnabled);
    },
    async updateAutoText(id, reqBody) {
        const existingText = await lockscreenPopup_repository_1.lockscreenPopupRepository.getAutoTextById(id);
        if (!existingText) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen auto text not found');
        }
        const title = reqBody.title !== undefined
            ? this.normalizeLocalizedText(reqBody.title, 'title', true)
            : undefined;
        const description = reqBody.description !== undefined
            ? this.normalizeLocalizedText(reqBody.description, 'description', true)
            : undefined;
        if (reqBody.is_enabled !== undefined && typeof reqBody.is_enabled !== 'boolean') {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'is_enabled must be boolean');
        }
        const updated = await lockscreenPopup_repository_1.lockscreenPopupRepository.updateAutoText(id, {
            ...reqBody,
            title,
            description,
        });
        if (!updated) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen auto text not found');
        }
        return updated;
    },
    async deleteAutoText(id) {
        const deleted = await lockscreenPopup_repository_1.lockscreenPopupRepository.deleteAutoText(id);
        if (!deleted) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen auto text not found');
        }
    },
    async createPopup(reqBody) {
        if (!reqBody.template_id) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'template_id is required');
        }
        const scheduledDate = this.validateDate(reqBody.scheduled_date);
        const slotTime = this.normalizeSlotTime(reqBody.slot_time);
        const mode = reqBody.mode || 'manual';
        const status = reqBody.status || 'active';
        const countryCode = reqBody.country_code === 'all' ? null : reqBody.country_code || null;
        const title = this.normalizeLocalizedText(reqBody.title, 'title', mode === 'manual');
        const description = this.normalizeLocalizedText(reqBody.description, 'description', mode === 'manual');
        if (countryCode) {
            this.validateCountry(countryCode);
        }
        if (!['auto', 'manual'].includes(mode)) {
            throw new logger_1.AppError(400, 'INVALID_MODE', 'mode must be auto or manual');
        }
        if (!['active', 'inactive', 'cancelled'].includes(status)) {
            throw new logger_1.AppError(400, 'INVALID_STATUS', 'status must be active, inactive, or cancelled');
        }
        const exists = await lockscreenPopup_repository_1.lockscreenPopupRepository.templateExists(reqBody.template_id);
        if (!exists) {
            throw new logger_1.AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
        }
        try {
            return await lockscreenPopup_repository_1.lockscreenPopupRepository.createPopup({
                mode,
                status,
                scheduled_date: scheduledDate,
                slot_time: slotTime,
                country_code: countryCode,
                template_id: reqBody.template_id,
                title,
                description,
            });
        }
        catch (error) {
            if (error?.code === '23505') {
                throw new logger_1.AppError(400, 'LOCKSCREEN_POPUP_EXISTS', 'Active popup already exists for this date, slot, and mode');
            }
            throw error;
        }
    },
    async updatePopup(id, reqBody) {
        const existingPopup = await lockscreenPopup_repository_1.lockscreenPopupRepository.getPopupById(id);
        if (!existingPopup) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen popup not found');
        }
        if (reqBody.scheduled_date !== undefined) {
            reqBody.scheduled_date = this.validateDate(reqBody.scheduled_date);
        }
        if (reqBody.slot_time !== undefined) {
            reqBody.slot_time = this.normalizeSlotTime(reqBody.slot_time);
        }
        if (reqBody.country_code !== undefined) {
            reqBody.country_code = reqBody.country_code === 'all' ? null : reqBody.country_code;
            if (reqBody.country_code) {
                this.validateCountry(reqBody.country_code);
            }
        }
        if (reqBody.status !== undefined && !['active', 'inactive', 'cancelled'].includes(reqBody.status)) {
            throw new logger_1.AppError(400, 'INVALID_STATUS', 'status must be active, inactive, or cancelled');
        }
        if (reqBody.mode !== undefined && !['auto', 'manual'].includes(reqBody.mode)) {
            throw new logger_1.AppError(400, 'INVALID_MODE', 'mode must be auto or manual');
        }
        if (reqBody.template_id !== undefined) {
            const exists = await lockscreenPopup_repository_1.lockscreenPopupRepository.templateExists(reqBody.template_id);
            if (!exists) {
                throw new logger_1.AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
            }
        }
        const nextMode = reqBody.mode || existingPopup.mode;
        const title = reqBody.title !== undefined
            ? this.normalizeLocalizedText(reqBody.title, 'title', nextMode === 'manual')
            : undefined;
        const description = reqBody.description !== undefined
            ? this.normalizeLocalizedText(reqBody.description, 'description', nextMode === 'manual')
            : undefined;
        const nextTitle = title !== undefined ? title : existingPopup.title;
        const nextDescription = description !== undefined ? description : existingPopup.description;
        if (nextMode === 'manual' && (Object.keys(nextTitle).length === 0 || Object.keys(nextDescription).length === 0)) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'title and description are required for manual popup');
        }
        const updateBody = {
            ...reqBody,
            title,
            description,
        };
        try {
            const updated = await lockscreenPopup_repository_1.lockscreenPopupRepository.updatePopup(id, updateBody);
            if (!updated) {
                throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen popup not found');
            }
            return updated;
        }
        catch (error) {
            if (error?.code === '23505') {
                throw new logger_1.AppError(400, 'LOCKSCREEN_POPUP_EXISTS', 'Active popup already exists for this date, slot, and mode');
            }
            throw error;
        }
    },
    async deletePopup(id) {
        const deleted = await lockscreenPopup_repository_1.lockscreenPopupRepository.deletePopup(id);
        if (!deleted) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Lockscreen popup not found');
        }
    }
};
