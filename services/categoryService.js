'use strict';
const { Category, Product } = require('../models');
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}
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
        const { name, icon, image, position, permalink } = data;
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
        let basePermalink = permalink ? slugify(permalink) : slugify(name);
        if (!basePermalink) {
            basePermalink = 'category';
        }
        let uniquePermalink = basePermalink;
        let count = 0;
        while (await Category.findOne({ where: { permalink: uniquePermalink } })) {
            count++;
            uniquePermalink = `${basePermalink}-${count}`;
        }
        return await Category.create({
            name,
            permalink: uniquePermalink,
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
        const { name, icon, image, position, permalink } = data;
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
        if (permalink !== undefined) {
            let basePermalink = slugify(permalink);
            if (!basePermalink) basePermalink = 'category';
            let uniquePermalink = basePermalink;
            let count = 0;
            while (await Category.findOne({ where: { permalink: uniquePermalink } })) {
                count++;
                uniquePermalink = `${basePermalink}-${count}`;
            }
            category.permalink = uniquePermalink;
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
