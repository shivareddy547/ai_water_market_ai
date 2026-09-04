'use strict';
const { Category, Product } = require('../models');
class CategoryService {
    async getAllCategories() {
        const categories = await Category.findAll({
            order: [['position', 'ASC']]
        });
        const categoriesWithCounts = await Promise.all(
            categories.map(async (cat) => {
                const productCount = await Product.count({
                    where: {
                        categoryId: cat.id,
                        status: 'active'
                    }
                });
                return {
                    ...cat.toJSON(),
                    count: productCount
                };
            })
        );
        return categoriesWithCounts;
    }
    async createCategory(data) {
        const { name, icon, image, position } = data;
        if (!name) {
            const err = new Error('Category name is required');
            err.status = 400;
            throw err;
        }
        const existing = await Category.findOne({ where: { name: name.toLowerCase() } });
        if (existing) {
            const err = new Error('A category with this name already exists');
            err.status = 409;
            throw err;
        }
        return await Category.create({
            name,
            icon: icon || '💧',
            image: image || '',
            position: position || 1,
            count: 0
        });
    }
    async updateCategory(id, data) {
        const category = await Category.findByPk(id);
        if (!category) {
            const err = new Error('Category not found');
            err.status = 404;
            throw err;
        }
        const { name, icon, image, position } = data;
        if (name) {
            const existing = await Category.findOne({ 
                where: { name: name.toLowerCase() } 
            });
            if (existing && existing.id !== id) {
                const err = new Error('A category with this name already exists');
                err.status = 409;
                throw err;
            }
            category.name = name;
        }
        if (icon !== undefined) category.icon = icon;
        if (image !== undefined) category.image = image;
        if (position !== undefined) category.position = position;
        await category.save();
        return category;
    }
    async deleteCategory(id) {
        const category = await Category.findByPk(id);
        if (!category) {
            const err = new Error('Category not found');
            err.status = 404;
            throw err;
        }
        await category.destroy();
        return { message: 'Category deleted successfully' };
    }
}
module.exports = new CategoryService();
