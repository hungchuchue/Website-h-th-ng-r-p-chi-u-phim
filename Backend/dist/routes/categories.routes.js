"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const category_service_1 = require("../services/category.service");
const requireAuth_1 = require("../middleware/requireAuth");
const checkin_service_1 = require("../services/checkin.service");
const router = (0, express_1.Router)();
router.get('/list', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const { categories, pagination } = await category_service_1.categoryService.getAllCategories(page, limit, true, country);
        return res.status(200).json({
            code: 200,
            message: 'success',
            data: categories,
            pagination: pagination
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/list/admin', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const country = typeof req.query.country === 'string' ? req.query.country : undefined;
        const { categories, pagination } = await category_service_1.categoryService.getAllCategories(page, limit, false, country);
        return res.status(200).json({
            code: 200,
            message: 'success',
            data: categories,
            pagination: pagination
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const body = req.body;
        if (typeof body.is_enabled !== 'boolean' ||
            typeof body.is_all_countries !== 'boolean' ||
            (body.countries !== undefined && !Array.isArray(body.countries))) {
            return res.status(400).json({ code: 400, message: 'Missing or invalid category fields', data: null });
        }
        const newCategory = await category_service_1.categoryService.createCategory(body);
        if (!newCategory) {
            return res.status(500).json({ code: 500, message: 'Failed to create category', data: null });
        }
        res.status(201).json({ code: 201, message: 'Category created', data: newCategory });
    }
    catch (error) {
        next(error);
    }
});
router.put('/update/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const body = req.body;
        if (typeof body.is_enabled !== 'boolean' ||
            typeof body.is_all_countries !== 'boolean' ||
            (body.countries !== undefined && !Array.isArray(body.countries))) {
            return res.status(400).json({ code: 400, message: 'Missing or invalid category fields', data: null });
        }
        const updatedCategory = await category_service_1.categoryService.updateCategory(id, body);
        if (!updatedCategory) {
            return res.status(500).json({ code: 500, message: 'Failed to update category', data: null });
        }
        res.status(200).json({ code: 200, message: 'Category updated', data: updatedCategory });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/apply-countries/:id/templates', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await category_service_1.categoryService.applyCategoryCountriesToTemplates(id);
        res.status(200).json({
            code: 200,
            message: 'Category country settings applied to templates',
            data: result
        });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id/set-checkin-special', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const category = await checkin_service_1.checkinService.setCheckinSpecialCategory(id);
        res.status(200).json({
            code: 200,
            message: 'Check-in category updated',
            data: category
        });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/sort/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { sort_order } = req.body;
        const updatedCategory = await category_service_1.categoryService.updateCategorySortOrder(id, sort_order);
        if (!updatedCategory) {
            return res.status(500).json({ code: 500, message: 'Failed to update category sort order', data: null });
        }
        res.status(200).json({ code: 200, message: 'Category sort order updated', data: updatedCategory });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/delete/:id', requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        await category_service_1.categoryService.deleteCategory(id);
        res.status(200).json({ code: 200, message: 'Category deleted', data: null });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
