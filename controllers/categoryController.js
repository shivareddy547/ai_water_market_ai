'use strict';
const categoryService = require('../services/categoryService');
class CategoryController {
    async getAll(req, res, next) {
        try {
            const categories = await categoryService.getAllCategories();
            res.json({ success: true, data: categories });
        } catch (err) {
            next(err);
        }
    }
    async create(req, res, next) {
        try {
            const category = await categoryService.createCategory(req.body);
            res.status(201).json({ success: true, data: category, message: 'Category created successfully' });
        } catch (err) {
            next(err);
        }
    }
    async update(req, res, next) {
        try {
            const category = await categoryService.updateCategory(req.params.id, req.body);
            res.json({ success: true, data: category, message: 'Category updated successfully' });
        } catch (err) {
            next(err);
        }
    }
    async delete(req, res, next) {
        try {
            const result = await categoryService.deleteCategory(req.params.id);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new CategoryController();
