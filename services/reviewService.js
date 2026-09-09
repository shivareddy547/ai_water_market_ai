'use strict';
const { Review, Product, Setting } = require('../models');
class ReviewService {
    async createReview(userId, data) {
        const { productId, supplierId, orderId, rating, title, comment } = data;
        if (!rating || !comment) {
            const err = new Error('Rating and comment are required');
            err.status = 400;
            throw err;
        }
        let finalSupplierId = supplierId;
        if (!finalSupplierId && productId) {
            const product = await Product.findByPk(productId);
            if (product) {
                finalSupplierId = product.userId;
            }
        }
        const autoApproveSetting = await Setting.findOne({ where: { key: 'reviews_auto_approve' } });
        const isAutoApprove = autoApproveSetting && autoApproveSetting.value && autoApproveSetting.value.enabled === true;
        const status = isAutoApprove ? 'published' : 'pending';
        const review = await Review.create({
            userId,
            productId: productId || null,
            supplierId: finalSupplierId || null,
            orderId: orderId || null,
            rating,
            title: title || null,
            comment,
            status
        });
        if (status === 'published' && review.productId) {
            const reviews = await Review.findAll({ 
                where: { productId: review.productId, status: 'published' } 
            });
            const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
            const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;
            await Product.update({ 
                rating: parseFloat(avgRating.toFixed(1)), 
                reviewCount: reviews.length 
            }, { 
                where: { id: review.productId } 
            });
        }
        return review;
    }
    async getAutoApproveSetting() {
        let setting = await Setting.findOne({ where: { key: 'reviews_auto_approve' } });
        if (!setting) {
            setting = await Setting.create({ key: 'reviews_auto_approve', value: { enabled: false } });
        }
        return setting;
    }
    async updateAutoApproveSetting(enabled) {
        let setting = await Setting.findOne({ where: { key: 'reviews_auto_approve' } });
        if (!setting) {
            setting = await Setting.create({ key: 'reviews_auto_approve', value: { enabled: enabled } });
        } else {
            setting.value = { enabled: enabled };
            await setting.save();
        }
        return setting;
    }
    async getReviewsByProductId(productId) {
        return await Review.findAll({
            where: { productId, status: 'published' },
            include: [{ 
                model: require('../models').User, 
                as: 'user', 
                attributes: ['id', 'first_name', 'last_name'] 
            }],
            order: [['created_at', 'DESC']]
        });
    }
    async getAllReviews(filter = {}) {
        const where = {};
        if (filter.status && filter.status !== '') {
            where.status = filter.status;
        }
        if (filter.supplierId) {
            where.supplierId = filter.supplierId;
        }
        return await Review.findAll({
            where,
            include: [
                { model: require('../models').User, as: 'user', attributes: ['id', 'first_name', 'last_name'] },
                { model: Product, as: 'product', attributes: ['id', 'name', 'images'] }
            ],
            order: [['created_at', 'DESC']]
        });
    }
    async updateReviewStatus(id, status) {
        const review = await Review.findByPk(id);
        if (!review) {
            const err = new Error('Review not found');
            err.status = 404;
            throw err;
        }
        const oldStatus = review.status;
        review.status = status;
        await review.save();
        if (review.productId && (status === 'published' || oldStatus === 'published')) {
            const reviews = await Review.findAll({ 
                where: { productId: review.productId, status: 'published' } 
            });
            const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
            const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;
            await Product.update({ 
                rating: parseFloat(avgRating.toFixed(1)), 
                reviewCount: reviews.length 
            }, { 
                where: { id: review.productId } 
            });
        }
        return review;
    }
    async deleteReview(id) {
        const review = await Review.findByPk(id);
        if (!review) {
            const err = new Error('Review not found');
            err.status = 404;
            throw err;
        }
        const productId = review.productId;
        const oldStatus = review.status;
        await review.destroy();
        if (productId && oldStatus === 'published') {
            const reviews = await Review.findAll({ 
                where: { productId, status: 'published' } 
            });
            const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
            const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;
            await Product.update({ 
                rating: parseFloat(avgRating.toFixed(1)), 
                reviewCount: reviews.length 
            }, { 
                where: { id: productId } 
            });
        }
        return { message: 'Review deleted successfully' };
    }
}
module.exports = new ReviewService();
