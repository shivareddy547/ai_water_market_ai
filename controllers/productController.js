'use strict';
const productService = require('../services/productService');
class ProductController {
    async getAllPublic(req, res, next) {
        try {
            const products = await productService.getAllActiveProducts(req.query);
            res.json({ success: true, data: products });
        } catch (err) {
            next(err);
        }
    }
    async getPopularProducts(req, res, next) {
        try {
            const products = await productService.getPopularProducts();
            res.json({ success: true, data: products });
        } catch (err) {
            next(err);
        }
    }
    async getAll(req, res, next) {
        try {
            if (req.user.role === 'admin') {
                const products = await productService.getAllProducts();
                return res.json({ success: true, data: products });
            }
            const products = await productService.getProductsByUser(req.user.id);
            res.json({ success: true, data: products });
        } catch (err) {
            next(err);
        }
    }
    async getById(req, res, next) {
        try {
            const product = await productService.getProductById(req.params.id, req.user.id, req.user.role);
            res.json({ success: true, data: product });
        } catch (err) {
            next(err);
        }
    }
    async create(req, res, next) {
        try {
            const product = await productService.createProduct(req.user.id, req.body);
            res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
        } catch (err) {
            next(err);
        }
    }
    async update(req, res, next) {
        try {
            const product = await productService.updateProduct(req.params.id, req.user.id, req.body, req.user.role);
            res.json({ success: true, data: product, message: 'Product updated successfully' });
        } catch (err) {
            next(err);
        }
    }
    async delete(req, res, next) {
        try {
            const result = await productService.deleteProduct(req.params.id, req.user.id, req.user.role);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new ProductController();
