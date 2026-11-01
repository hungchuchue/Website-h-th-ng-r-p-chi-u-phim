"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryService = void 0;
const category_repository_1 = require("../repositories/category.repository");
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const validation_1 = require("../utils/validation");
const cache_1 = __importDefault(require("../utils/cache"));
exports.categoryService = {
    async getAllCategories(page = 1, limit = 20, onlyEnabled, country) {
        if (country && !types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
            throw new logger_1.AppError(400, 'INVALID_COUNTRY', 'Unsupported country');
        }
        const cacheKey = `categories_page_${page}_limit_${limit}_enabled_${onlyEnabled}_country_${country || 'global'}`;
        const cached = cache_1.default.get(cacheKey);
        if (cached)
            return cached;
        const offset = (page - 1) * limit;
        const { categories, total } = await category_repository_1.categoryRepository.getAllCategories(limit, offset, onlyEnabled, country);
        const totalPages = Math.ceil(total / limit) || 1;
        const result = {
            categories,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                limit: limit,
                total_items: total
            }
        };
        cache_1.default.set(cacheKey, result, 3600); // 1 hour
        return result;
    },
    async getCategoryBySlug(slug) {
        const cacheKey = `category_slug_${slug}`;
        const cached = cache_1.default.get(cacheKey);
        if (cached !== undefined)
            return cached; // có thể là null
        const category = await category_repository_1.categoryRepository.getCategoryBySlug(slug);
        cache_1.default.set(cacheKey, category, 3600);
        return category;
    },
    async createCategory(reqBody) {
        if (!reqBody.name || !reqBody.name.trim()) {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'Name is required.');
        }
        if (typeof reqBody.is_all_countries !== 'boolean') {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'is_all_countries is required.');
        }
        if (!reqBody.is_all_countries) {
            if (!reqBody.countries || reqBody.countries.length === 0) {
                throw new logger_1.AppError(400, 'INVALID_COUNTRIES', 'countries must contain at least one code when is_all_countries is false');
            }
            for (const country of reqBody.countries) {
                if (!types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
                    throw new logger_1.AppError(400, 'INVALID_COUNTRIES', 'Unsupported country');
                }
            }
        }
        const slug = (0, validation_1.validateSlug)(reqBody.name);
        const category = await category_repository_1.categoryRepository.getCategoryBySlug(slug);
        if (category) {
            throw new logger_1.AppError(400, 'ALREADY_EXISTS', 'Category with this name/slug already exists');
        }
        const newCategory = await category_repository_1.categoryRepository.createCategory(reqBody, slug);
        cache_1.default.flushAll();
        return newCategory;
    },
    async updateCategory(id, reqBody) {
        const existingCategory = await category_repository_1.categoryRepository.getCategoryById(id);
        if (!existingCategory) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Category not found');
        }
        if (typeof reqBody.is_all_countries !== 'boolean') {
            throw new logger_1.AppError(400, 'INVALID_INPUT', 'is_all_countries is required.');
        }
        if (!reqBody.is_all_countries) {
            if (!reqBody.countries || reqBody.countries.length === 0) {
                throw new logger_1.AppError(400, 'INVALID_COUNTRIES', 'countries must contain at least one code when is_all_countries is false');
            }
            for (const country of reqBody.countries) {
                if (!types_1.SUPPORTED_COUNTRIES.some((supportedCountry) => supportedCountry.code === country)) {
                    throw new logger_1.AppError(400, 'INVALID_COUNTRIES', 'Unsupported country');
                }
            }
        }
        const slug = (0, validation_1.validateSlug)(reqBody.name);
        const category = await category_repository_1.categoryRepository.getCategoryBySlug(slug);
        if (category && category.id !== id) {
            throw new logger_1.AppError(400, 'ALREADY_EXISTS', 'Another category with this name/slug already exists');
        }
        if (!reqBody.localized_names && existingCategory.localized_names) {
            reqBody.localized_names = existingCategory.localized_names;
        }
        const updated = await category_repository_1.categoryRepository.updateCategory(id, reqBody, slug, existingCategory.sort_order);
        cache_1.default.flushAll();
        return updated;
    },
    async applyCategoryCountriesToTemplates(id) {
        const existingCategory = await category_repository_1.categoryRepository.getCategoryById(id);
        if (!existingCategory) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Category not found');
        }
        const result = await category_repository_1.categoryRepository.applyCategoryCountriesToTemplates(id);
        cache_1.default.flushAll();
        return result;
    },
    updateCategorySortOrder: async (id, sort_order) => {
        const existingCategory = await category_repository_1.categoryRepository.getCategoryById(id);
        if (!existingCategory) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Category not found');
        }
        const updated = await category_repository_1.categoryRepository.updateOrderCategory(id, sort_order);
        cache_1.default.flushAll();
        return updated;
    },
    async deleteCategory(id) {
        const existingCategory = await category_repository_1.categoryRepository.getCategoryById(id);
        if (!existingCategory) {
            throw new logger_1.AppError(404, 'NOT_FOUND', 'Category not found');
        }
        await category_repository_1.categoryRepository.deleteCategory(id);
        cache_1.default.flushAll();
    }
};
