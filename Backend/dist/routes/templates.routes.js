"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const template_service_1 = require("../services/template.service");
const requireAuth_1 = require("../middleware/requireAuth");
const r2_1 = require("../lib/r2");
const category_service_1 = require("../services/category.service");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const router = (0, express_1.Router)();
const parseTypeIds = (rawBody) => {
    const rawTypeIds = rawBody.type_ids;
    const RawValues = (value) => {
        if (value === undefined || value === null || value === '')
            return [];
        if (Array.isArray(value))
            return value.flatMap(RawValues);
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed)
                return [];
            if (trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return RawValues(parsed);
                }
                catch {
                    return [trimmed];
                }
            }
            return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
        }
        return [value];
    };
    const values = RawValues(rawTypeIds);
    if (values.length === 0)
        return undefined;
    const typeIds = Array.from(new Set(values.map((value) => Number(value))));
    if (typeIds.some((typeId) => !Number.isInteger(typeId) || typeId <= 0)) {
        return [];
    }
    return typeIds;
};
router.get('/', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit === 'ALL' ? 999999 : (Number(req.query.limit) || 20);
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const includeDisabled = req.query.include_disabled === 'true';
        const { templates, pagination } = await template_service_1.templateService.getSyncedAllCategoryTemplates(page, limit, country, !includeDisabled);
        return res.status(200).json({
            code: 200,
            message: 'success',
            data: templates,
            pagination: pagination
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/all', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit === 'ALL' ? 999999 : (Number(req.query.limit) || 20);
        const keyword = String(req.query.keyword || '').trim();
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const includeDisabled = req.query.include_disabled === 'true';
        const type_id = req.query.type_id ? String(req.query.type_id).trim() : "";
        const { templates, pagination } = await template_service_1.templateService.getAllTemplates(page, limit, keyword, country, !includeDisabled, type_id);
        return res.status(200).json({
            code: 200,
            message: 'success',
            data: templates,
            pagination: pagination
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/categories/:slug', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit === 'ALL' ? 999999 : (Number(req.query.limit) || 20);
        const keyword = String(req.query.keyword || '').trim();
        const type = String(req.query.type || '').trim();
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const includeDisabled = req.query.include_disabled === 'true';
        const category = await category_service_1.categoryService.getCategoryBySlug(slug);
        if (!category) {
            return res.status(404).json({
                code: 404,
                message: `Category '${slug}' not found`,
                data: []
            });
        }
        const { templates, pagination } = await template_service_1.templateService.getTemplatesByCategory(slug, page, limit, keyword, type, country, !includeDisabled);
        return res.status(200).json({
            code: 200,
            message: 'success',
            data: templates,
            pagination: pagination
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/type', async (req, res, next) => {
    try {
        const templateTypes = await template_service_1.templateService.getTemplateTypes();
        res.status(200).json({ code: 200, message: 'success', data: templateTypes });
    }
    catch (error) {
        next(error);
    }
});
router.get('/type/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit === 'ALL' ? 999999 : (Number(req.query.limit) || 20);
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const includeDisabled = req.query.include_disabled === 'true';
        const { templates, pagination } = await template_service_1.templateService.getTemplatesByType(id, page, limit, country, !includeDisabled);
        return res.status(200).json({
            code: 200,
            message: 'success',
            data: templates,
            pagination: pagination
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/daily', async (req, res, next) => {
    try {
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const template = await template_service_1.templateService.getDailyAllCategoryTemplate();
        return res.status(200).json({
            code: 200,
            message: 'success',
            data: template
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({ code: 400, message: 'Invalid template id format', data: null });
        }
        const template = await template_service_1.templateService.getTemplateById(id);
        if (!template) {
            return res.status(404).json({ code: 404, message: 'Template not found', data: null });
        }
        res.status(200).json({ code: 200, message: 'success', data: template });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', requireAuth_1.requireAuth, upload.single('image'), async (req, res, next) => {
    try {
        const rawBody = req.body;
        const body = {
            category_slugs: Array.isArray(rawBody.category_slugs)
                ? rawBody.category_slugs
                : rawBody.category_slugs ? [rawBody.category_slugs] : undefined,
            is_all_countries: rawBody.is_all_countries === undefined ? undefined : rawBody.is_all_countries === true || rawBody.is_all_countries === 'true',
            countries: rawBody.countries === undefined
                ? undefined
                : Array.isArray(rawBody.countries) ? rawBody.countries : [rawBody.countries],
            prompt: rawBody.prompt,
            ratio: rawBody.ratio,
            type_ids: parseTypeIds(rawBody),
        };
        const file = req.file;
        if (!Array.isArray(body.category_slugs) ||
            body.category_slugs.length === 0 ||
            (body.is_all_countries !== undefined && typeof body.is_all_countries !== 'boolean') ||
            (body.countries !== undefined && !Array.isArray(body.countries)) ||
            !Array.isArray(body.type_ids) ||
            body.type_ids.length === 0 ||
            !body.prompt ||
            !file) {
            return res.status(400).json({ code: 400, message: 'Missing required fields or image file', data: null });
        }
        // Check if all categories exist
        for (const slug of body.category_slugs) {
            const category = await category_service_1.categoryService.getCategoryBySlug(slug);
            if (!category) {
                return res.status(400).json({ code: 400, message: `Category ${slug} not found`, data: null });
            }
        }
        const extension = file.originalname.split('.').pop() || 'png';
        const fileId = (0, uuid_1.v4)();
        // Just use the first category name for the path folder
        const firstCategoryName = (await category_service_1.categoryService.getCategoryBySlug(body.category_slugs[0]))?.name || 'Uncategorized';
        const key = `Templates/${firstCategoryName}/${fileId}.${extension}`;
        const imageUrl = await (0, r2_1.uploadBuffer)(key, file.buffer, file.mimetype);
        const newTemplate = await template_service_1.templateService.createTemplate({
            category_slugs: body.category_slugs,
            image_url: imageUrl,
            prompt: body.prompt,
            ratio: body.ratio,
            type_ids: body.type_ids,
            is_all_countries: body.is_all_countries,
            countries: body.countries,
        });
        if (!newTemplate) {
            (0, r2_1.deleteObject)(key);
            return res.status(500).json({ code: 500, message: 'Failed to create template', data: null });
        }
        res.status(201).json({ code: 201, message: 'Template created', data: newTemplate });
    }
    catch (error) {
        next(error);
    }
});
router.post('/add', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { template_ids, category_slug } = req.body;
        if (!Array.isArray(template_ids) || template_ids.length === 0 || !category_slug) {
            return res.status(400).json({
                code: 400,
                message: 'Missing or invalid template_ids (Array) or category_slug in request body',
                data: null
            });
        }
        const addTemplate = await template_service_1.templateService.addTemplateToCategory(template_ids, category_slug);
        if (!addTemplate) {
            return res.status(500).json({ code: 500, message: 'Failed to add template to category', data: null });
        }
        res.status(200).json({ code: 200, message: 'Template added to category', data: addTemplate });
    }
    catch (error) {
        next(error);
    }
});
router.put('/update/:id', requireAuth_1.requireAuth, upload.single('image'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const rawBody = req.body;
        const body = {
            category_slugs: Array.isArray(rawBody.category_slugs)
                ? rawBody.category_slugs
                : rawBody.category_slugs ? [rawBody.category_slugs] : undefined,
            is_all_countries: rawBody.is_all_countries === undefined ? undefined : rawBody.is_all_countries === true || rawBody.is_all_countries === 'true',
            countries: rawBody.countries === undefined
                ? undefined
                : Array.isArray(rawBody.countries) ? rawBody.countries : [rawBody.countries],
            prompt: rawBody.prompt,
            ratio: rawBody.ratio,
            type_ids: parseTypeIds(rawBody),
        };
        const file = req.file;
        if (!Array.isArray(body.category_slugs) ||
            body.category_slugs.length === 0 ||
            typeof body.is_all_countries !== 'boolean' ||
            (body.countries !== undefined && !Array.isArray(body.countries)) ||
            !Array.isArray(body.type_ids) ||
            body.type_ids.length === 0 ||
            !body.prompt) {
            return res.status(400).json({ code: 400, message: 'Missing required fields', data: null });
        }
        for (const slug of body.category_slugs) {
            const category = await category_service_1.categoryService.getCategoryBySlug(slug);
            if (!category) {
                return res.status(400).json({ code: 400, message: `Category ${slug} not found`, data: null });
            }
        }
        let imageUrl;
        const existingTemplate = await template_service_1.templateService.getTemplateById(id);
        if (!existingTemplate) {
            return res.status(404).json({ code: 404, message: 'Template not found', data: null });
        }
        if (file) {
            if (existingTemplate.image_url) {
                const oldKey = existingTemplate.image_url.split('.r2.dev/')[1];
                if (oldKey)
                    await (0, r2_1.deleteObject)(oldKey);
            }
            const extension = file.originalname.split('.').pop() || 'png';
            const fileId = (0, uuid_1.v4)();
            const firstCategoryName = (await category_service_1.categoryService.getCategoryBySlug(body.category_slugs[0]))?.name || 'Uncategorized';
            const key = `Templates/${firstCategoryName}/${fileId}.${extension}`;
            imageUrl = await (0, r2_1.uploadBuffer)(key, file.buffer, file.mimetype);
        }
        const updateData = {
            category_slugs: body.category_slugs,
            prompt: body.prompt,
            ratio: body.ratio,
            type_ids: body.type_ids,
            is_all_countries: body.is_all_countries,
            countries: body.countries,
            image_url: imageUrl || existingTemplate.image_url,
        };
        const updatedTemplate = await template_service_1.templateService.updateTemplate(id, updateData);
        if (!updatedTemplate) {
            if (imageUrl) {
                const newKey = imageUrl.split('.r2.dev/')[1];
                await (0, r2_1.deleteObject)(newKey);
            }
            return res.status(500).json({ code: 500, message: 'Failed to update template', data: null });
        }
        res.status(200).json({ code: 200, message: 'Template updated', data: updatedTemplate });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/visibility/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { category_slug } = req.body;
        const isEnabled = req.body.is_enabled === true || req.body.is_enabled === 'true';
        if (!category_slug || (req.body.is_enabled !== true && req.body.is_enabled !== false && req.body.is_enabled !== 'true' && req.body.is_enabled !== 'false')) {
            return res.status(400).json({ code: 400, message: 'Missing or invalid category_slug or is_enabled', data: null });
        }
        const updatedTemplate = await template_service_1.templateService.updateTemplateCategoryVisibility(id, category_slug, isEnabled);
        res.status(200).json({ code: 200, message: 'Template visibility updated', data: updatedTemplate });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/sort/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { sort_order, category_slug } = req.body;
        if (sort_order === undefined || !category_slug) {
            return res.status(400).json({ code: 400, message: 'Missing sort_order or category_slug in request body', data: null });
        }
        const nextSortOrder = Number(sort_order);
        if (!Number.isFinite(nextSortOrder) || nextSortOrder < 1) {
            return res.status(400).json({ code: 400, message: 'Invalid sort_order', data: null });
        }
        const updatedTemplate = await template_service_1.templateService.updateTemplateSortOrder(id, category_slug, nextSortOrder);
        if (!updatedTemplate) {
            return res.status(500).json({ code: 500, message: 'Failed to update template sort order', data: null });
        }
        res.status(200).json({ code: 200, message: 'Template sort order updated', data: updatedTemplate });
    }
    catch (error) {
        next(error);
    }
});
router.put('/reorder', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { category_slug, items } = req.body;
        if (!category_slug || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                code: 400,
                message: 'Missing or invalid category_slug or items in request body',
                data: null
            });
        }
        const result = await template_service_1.templateService.bulkReorderTemplates(category_slug, items);
        res.status(200).json({
            code: 200,
            message: 'Templates reordered successfully',
            data: result
        });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/remove/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { category_slug } = req.body;
        if (!category_slug) {
            return res.status(400).json({ code: 400, message: 'Missing category_slug in request body', data: null });
        }
        const updatedTemplate = await template_service_1.templateService.removeTemplateFromCategory(id, category_slug);
        if (!updatedTemplate) {
            return res.status(500).json({ code: 500, message: 'Failed to remove template from category', data: null });
        }
        res.status(200).json({ code: 200, message: 'Template removed from category', data: updatedTemplate });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/delete/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        await template_service_1.templateService.deleteTemplate(id);
        res.status(200).json({ code: 200, message: 'Template deleted', data: null });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
