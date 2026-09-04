'use strict';
const { Product } = require('../models');
class ProductService {
    async getAllActiveProducts(query = {}) {
        const where = { status: 'active' };
        if (query.categoryId && query.categoryId !== 'all') {
            where.categoryId = query.categoryId;
        }
        return await Product.findAll({
            where,
            order: [['created_at', 'DESC']]
        });
    }
    async getProductsByUser(userId) {
        return await Product.findAll({
            where: { userId },
            order: [['created_at', 'DESC']]
        });
    }
    async getProductById(id, userId) {
        const product = await Product.findOne({ where: { id, userId } });
        if (!product) {
            const err = new Error('Product not found');
            err.status = 404;
            throw err;
        }
        return product;
    }
    async createProduct(userId, data) {
        const { name, brand, categoryId, description, images, videos, status, warehouseIds, variants } = data;
        if (!name) {
            const err = new Error('Product name is required');
            err.status = 400;
            throw err;
        }
        return await Product.create({
            userId,
            name,
            brand: brand || '',
            categoryId: categoryId || null,
            description: description || '',
            images: images || [],
            videos: videos || [],
            status: status || 'draft',
            warehouseIds: warehouseIds || [],
            variants: variants || []
        });
    }
    async updateProduct(id, userId, data) {
        const product = await Product.findOne({ where: { id, userId } });
        if (!product) {
            const err = new Error('Product not found or you do not have permission to update it');
            err.status = 404;
            throw err;
        }
        const { name, brand, categoryId, description, images, videos, status, warehouseIds, variants } = data;
        if (name !== undefined) product.name = name;
        if (brand !== undefined) product.brand = brand;
        if (categoryId !== undefined) product.categoryId = categoryId;
        if (description !== undefined) product.description = description;
        if (images !== undefined) product.images = images;
        if (videos !== undefined) product.videos = videos;
        if (status !== undefined) product.status = status;
        if (warehouseIds !== undefined) product.warehouseIds = warehouseIds;
        if (variants !== undefined) product.variants = variants;
        await product.save();
        return product;
    }
    async deleteProduct(id, userId) {
        const product = await Product.findOne({ where: { id, userId } });
        if (!product) {
            const err = new Error('Product not found or you do not have permission to delete it');
            err.status = 404;
            throw err;
        }
        await product.destroy();
        return { message: 'Product deleted successfully' };
    }
}
module.exports = new ProductService();
