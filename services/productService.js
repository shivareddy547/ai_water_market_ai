'use strict';
const { Product, User } = require('../models');
const SUPPLIER_ATTRS = [
  'id',
  'first_name',
  'last_name',
  'store_name',
  'warehouseAddresses',
  'platform_fee_enabled',
  'platform_fee_type',
  'platform_fee_value'
];
const decorateSupplier = (item) => {
  const u = item.user || {};
  const storeName = u.store_name || u.storeName || '';
  const firstName = u.first_name || u.firstName || '';
  const lastName = u.last_name || u.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  item.supplierId = u.id || item.userId;
  item.supplierName =
    storeName || fullName || `Supplier #${(item.supplierId || '').slice(-6).toUpperCase()}`;
  const feeEnabled = u.platform_fee_enabled ?? u.platformFeeEnabled;
  const feeType = u.platform_fee_type ?? u.platformFeeType;
  const feeValue = u.platform_fee_value ?? u.platformFeeValue;
  item.supplierPlatformFeeEnabled = !!feeEnabled;
  item.supplierPlatformFeeType = feeType === 'flat' ? 'flat' : 'percentage';
  item.supplierPlatformFeeValue = Number(feeValue || 0);
  return item;
};
class ProductService {
    async getAllActiveProducts(query = {}) {
        const where = { status: 'active' };
        if (query.categoryId && query.categoryId !== 'all') {
            where.categoryId = query.categoryId;
        }
        const products = await Product.findAll({
            where,
            include: [{
                model: User,
                as: 'user',
                attributes: SUPPLIER_ATTRS
            }],
            order: [['created_at', 'DESC']]
        });
        return products.map(p => decorateSupplier(p.toJSON()));
    }
    async getPopularProducts() {
        const where = {
            status: 'active',
            isPopular: true
        };
        const products = await Product.findAll({
            where,
            include: [{
                model: User,
                as: 'user',
                attributes: SUPPLIER_ATTRS
            }],
            order: [['created_at', 'DESC']]
        });
        return products.map(p => decorateSupplier(p.toJSON()));
    }
    async getAllProducts() {
        const products = await Product.findAll({
            include: [{
                model: User,
                as: 'user',
                attributes: SUPPLIER_ATTRS
            }],
            order: [['created_at', 'DESC']]
        });
        return products.map(p => decorateSupplier(p.toJSON()));
    }
    async getProductsByUser(userId) {
        return await Product.findAll({
            where: { userId },
            order: [['created_at', 'DESC']]
        });
    }
    async getProductById(id, userId, userRole) {
        const where = userRole === 'admin' ? { id } : { id, userId };
        const product = await Product.findOne({ where });
        if (!product) {
            const err = new Error('Product not found');
            err.status = 404;
            throw err;
        }
        return product;
    }
    async createProduct(userId, data) {
        const { name, brand, categoryId, description, images, videos, status, isPopular, warehouseIds, variants } = data;
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
            isPopular: isPopular === true,
            warehouseIds: warehouseIds || [],
            variants: variants || []
        });
    }
    async updateProduct(id, userId, data, userRole) {
        const where = userRole === 'admin' ? { id } : { id, userId };
        const product = await Product.findOne({ where });
        if (!product) {
            const err = new Error('Product not found or you do not have permission to update it');
            err.status = 404;
            throw err;
        }
        const { name, brand, categoryId, description, images, videos, status, isPopular, warehouseIds, variants } = data;
        if (name !== undefined) product.name = name;
        if (brand !== undefined) product.brand = brand;
        if (categoryId !== undefined) product.categoryId = categoryId;
        if (description !== undefined) product.description = description;
        if (images !== undefined) product.images = images;
        if (videos !== undefined) product.videos = videos;
        if (status !== undefined) product.status = status;
        if (isPopular !== undefined) product.isPopular = isPopular === true;
        if (warehouseIds !== undefined) product.warehouseIds = warehouseIds;
        if (variants !== undefined) product.variants = variants;
        await product.save();
        return product;
    }
    async deleteProduct(id, userId, userRole) {
        const where = userRole === 'admin' ? { id } : { id, userId };
        const product = await Product.findOne({ where });
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
