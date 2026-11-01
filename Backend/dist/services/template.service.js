"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateService = void 0;
const r2_1 = require("../lib/r2");
const template_repository_1 = require("../repositories/template.repository");
const types_1 = require("../types");
const types_2 = require("../types");
const logger_1 = require("../utils/logger");
const cache_1 = __importDefault(require("../utils/cache"));
const category_repository_1 = require("../repositories/category.repository");
const DEFAULT_TEMPLATE_RATIO = '9:16';
const DAILY_TEMPLATE_CATEGORY_SLUG = 'all';
function normalizeTemplateRatio(ratio) {
    const value = typeof ratio === 'string' ? ratio.trim() : '';
    if (!value)
        return DEFAULT_TEMPLATE_RATIO;
    if (value in types_2.FLUX_SCHNELL_RATIO_MAPPING) {
        return value;
    }
    throw new logger_1.AppError(400, 'INVALID_RATIO', `Unsupported template ratio: ${value}`);
}
exports.templateService = {
    getTemplateTypes: async () => {
        const cacheKey = 'template_types_all';
        const cached = cache_1.default.get(cacheKey);
        if (cached)
            return cached;
        const templateTypes = await template_repository_1.templateRepository.findTemplateTypes();
        cache_1.default.set(cacheKey, templateTypes);
        return templateTypes;
    },
    getSyncedAllCategoryTemplates: async (page = 1, limit = 20, country, onlyEnabled = true) => {
        const { inserted } = await template_repository_1.templateRepository.syncAllCategoryTemplates();
        if (inserted > 0) {
            cache_1.default.flushAll();
        }
        return exports.templateService.getTemplatesByCategory('all', page, limit, undefined, undefined, country, onlyEnabled);
    },
    getAllTemplates: async (page = 1, limit = 20, keyword, country, onlyEnabled = true, type_id) => {
        if (country && !types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
            throw new logger_1.AppError(400, 'INVALID_COUNTRY', 'Unsupported country');
        }
        const cacheKey = `templates_all_page_${page}_limit_${limit}_keyword_${keyword || 'none'}_country_${country || 'global'}_enabled_${onlyEnabled}_type_id_${type_id || 'none'}`;
        const cached = cache_1.default.get(cacheKey);
        if (cached)
            return cached;
        const offset = (page - 1) * limit;
        const { templates, total } = await template_repository_1.templateRepository.findAll(limit, offset, keyword, country, onlyEnabled, type_id);
        const totalPages = Math.ceil(total / limit) || 1;
        const result = {
            templates,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                limit: limit,
                total_items: total
            }
        };
        cache_1.default.set(cacheKey, result);
        return result;
    },
    getTemplatesByCategory: async (categorySlug, page = 1, limit = 20, keyword, type, country, onlyEnabled = true) => {
        if (country && !types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
            throw new logger_1.AppError(400, 'INVALID_COUNTRY', 'Unsupported country');
        }
        const cacheKey = `templates_category_${categorySlug}_page_${page}_limit_${limit}_keyword_${keyword || 'none'}_type_${type || 'none'}_country_${country || 'global'}_enabled_${onlyEnabled}`;
        const cached = cache_1.default.get(cacheKey);
        if (cached)
            return cached;
        const offset = (page - 1) * limit;
        const { templates, total } = await template_repository_1.templateRepository.findByCategorySlug(categorySlug, limit, offset, keyword, type, country, onlyEnabled);
        const totalPages = Math.ceil(total / limit) || 1;
        const result = {
            templates,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                limit: limit,
                total_items: total
            }
        };
        cache_1.default.set(cacheKey, result);
        return result;
    },
    getTemplatesByType: async (id, page = 1, limit = 20, country, onlyEnabled = true) => {
        if (country && !types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
            throw new logger_1.AppError(400, 'INVALID_COUNTRY', 'Unsupported country');
        }
        const cacheKey = `templates_type_${id}_page_${page}_limit_${limit}_country_${country || 'global'}_enabled_${onlyEnabled}`;
        const cached = cache_1.default.get(cacheKey);
        if (cached)
            return cached;
        const offset = (page - 1) * limit;
        const { templates, total } = await template_repository_1.templateRepository.findByType(id, limit, offset, country, onlyEnabled);
        const totalPages = Math.ceil(total / limit) || 1;
        const result = {
            templates,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                limit: limit,
                total_items: total
            }
        };
        cache_1.default.set(cacheKey, result);
        return result;
    },
    getTemplateById: async (id) => {
        const cacheKey = `template_id_${id}`;
        const cached = cache_1.default.get(cacheKey);
        if (cached !== undefined)
            return cached;
        const template = await template_repository_1.templateRepository.findById(id);
        cache_1.default.set(cacheKey, template);
        return template;
    },
    getDailyAllCategoryTemplate: async () => {
        const { inserted } = await template_repository_1.templateRepository.syncAllCategoryTemplates();
        if (inserted > 0) {
            cache_1.default.flushAll();
        }
        const template = await template_repository_1.templateRepository.findRandomTemplateByCategory(DAILY_TEMPLATE_CATEGORY_SLUG);
        if (!template) {
            throw new logger_1.AppError(404, 'DAILY_TEMPLATE_NOT_FOUND', "No template found in category 'all'");
        }
        return template;
    },
    createTemplate: async (data) => {
        let isAllCountries = data.is_all_countries;
        let countries = data.countries;
        if (isAllCountries === undefined) {
            const defaultCategorySlug = data.category_slugs.find((slug) => slug !== 'all') || data.category_slugs[0];
            const category = await category_repository_1.categoryRepository.getCategoryBySlug(defaultCategorySlug);
            if (!category) {
                throw new logger_1.AppError(400, 'INVALID_CATEGORY', 'Default category not found');
            }
            isAllCountries = category.is_all_countries;
            countries = category.countries || undefined;
        }
        if (!isAllCountries) {
            if (!countries || countries.length === 0) {
                throw new logger_1.AppError(400, 'INVALID_COUNTRIES', 'countries must contain at least one code when is_all_countries is false');
            }
            for (const country of countries) {
                if (!types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
                    throw new logger_1.AppError(400, 'INVALID_COUNTRIES', 'Unsupported country');
                }
            }
        }
        const newTemplate = await template_repository_1.templateRepository.createTemplate({
            ...data,
            ratio: normalizeTemplateRatio(data.ratio),
            is_all_countries: isAllCountries,
            countries: isAllCountries ? null : countries
        });
        cache_1.default.flushAll();
        return newTemplate;
    },
    addTemplateToCategory: async (template_ids, category_slug) => {
        const category = await category_repository_1.categoryRepository.getCategoryBySlug(category_slug);
        if (!category) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Target category not found');
        }
        const checkPromises = template_ids.map(async (id) => {
            const template = await template_repository_1.templateRepository.findById(id);
            if (!template) {
                throw new logger_1.AppError(404, 'NOT_FOUND', `Template with ID ${id} not found`);
            }
            const categorySlugs = template.category_slugs || [];
            return !categorySlugs.includes(category_slug) ? id : null;
        });
        const checkResults = await Promise.all(checkPromises);
        const validTemplateIds = checkResults.filter((id) => id !== null);
        if (validTemplateIds.length === 0) {
            throw new logger_1.AppError(400, 'ALREADY_EXISTS', `All template is already in this category`);
        }
        const updatedTemplates = await template_repository_1.templateRepository.addTemplatesToCategory(validTemplateIds, category_slug);
        cache_1.default.flushAll();
        return updatedTemplates;
    },
    updateTemplate: async (id, data) => {
        const existingTemplate = await template_repository_1.templateRepository.findById(id);
        if (!existingTemplate) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Template not found');
        }
        if (data.is_all_countries === false) {
            if (!data.countries || data.countries.length === 0) {
                throw new logger_1.AppError(400, 'INVALID_COUNTRIES', 'countries must contain at least one code when is_all_countries is false');
            }
            for (const country of data.countries) {
                if (!types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
                    throw new logger_1.AppError(400, 'INVALID_COUNTRIES', 'Unsupported country');
                }
            }
        }
        const updated = await template_repository_1.templateRepository.updateTemplate(id, {
            ...data,
            ratio: data.ratio !== undefined ? normalizeTemplateRatio(data.ratio) : undefined,
            countries: data.is_all_countries ? null : data.countries
        });
        cache_1.default.flushAll();
        return updated;
    },
    updateTemplateSortOrder: async (id, category_slug, sort_order) => {
        const updated = await template_repository_1.templateRepository.updateOrderTemplate(id, category_slug, sort_order);
        cache_1.default.flushAll();
        return updated;
    },
    updateTemplateCategoryVisibility: async (id, category_slug, is_enabled) => {
        const category = await category_repository_1.categoryRepository.getCategoryBySlug(category_slug);
        if (!category) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Category not found');
        }
        const updated = await template_repository_1.templateRepository.updateTemplateCategoryVisibility(id, category_slug, is_enabled);
        cache_1.default.flushAll();
        return updated;
    },
    bulkReorderTemplates: async (category_slug, items) => {
        const category = await category_repository_1.categoryRepository.getCategoryBySlug(category_slug);
        if (!category) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Category not found');
        }
        const normalizedItems = [];
        const templateIds = new Set();
        const sortOrders = new Set();
        for (const item of items) {
            if (!item.template_id || typeof item.template_id !== 'string') {
                throw new logger_1.AppError(400, 'INVALID_INPUT', 'Invalid template_id in items');
            }
            const sortOrder = Number(item.sort_order);
            if (!Number.isInteger(sortOrder) || sortOrder < 1) {
                throw new logger_1.AppError(400, 'INVALID_INPUT', 'Invalid sort_order in items');
            }
            if (templateIds.has(item.template_id)) {
                throw new logger_1.AppError(400, 'INVALID_INPUT', 'Duplicate template_id in items');
            }
            if (sortOrders.has(sortOrder)) {
                throw new logger_1.AppError(400, 'INVALID_INPUT', 'Duplicate sort_order in items');
            }
            templateIds.add(item.template_id);
            sortOrders.add(sortOrder);
            normalizedItems.push({
                template_id: item.template_id,
                sort_order: sortOrder
            });
        }
        const result = await template_repository_1.templateRepository.bulkReorderTemplates(category_slug, normalizedItems);
        cache_1.default.flushAll();
        return result;
    },
    removeTemplateFromCategory: async (id, category_slug) => {
        const existingTemplate = await template_repository_1.templateRepository.findById(id);
        if (!existingTemplate) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Template not found');
        }
        const updated = await template_repository_1.templateRepository.removeFromCategory(id, category_slug);
        cache_1.default.flushAll();
        return updated;
    },
    deleteTemplate: async (id) => {
        const existingTemplate = await template_repository_1.templateRepository.findById(id);
        if (!existingTemplate) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Template not found');
        }
        /// delete old image from R2
        if (existingTemplate.image_url) {
            const oldKey = existingTemplate.image_url.split('.r2.dev/')[1];
            if (oldKey)
                await (0, r2_1.deleteObject)(oldKey);
        }
        await template_repository_1.templateRepository.deleteTemplate(id);
        cache_1.default.flushAll();
    }
};
