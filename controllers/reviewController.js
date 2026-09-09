'use strict';
const reviewService = require('../services/reviewService');
class ReviewController {
    async createReview(req, res, next) {
        try {
            const review = await reviewService.createReview(req.user.id, req.body);
            res.status(201).json({ success: true, data: review, message: 'Review submitted successfully' });
        } catch (err) {
            next(err);
        }
    }
    async getProductReviews(req, res, next) {
        try {
            const reviews = await reviewService.getReviewsByProductId(req.params.productId);
            res.json({ success: true, data: reviews });
        } catch (err) {
            next(err);
        }
    }
    async getAllReviews(req, res, next) {
        try {
            const filter = { ...req.query };
            if (req.user.role === 'supplier') {
                filter.supplierId = req.user.id;
            }
            const reviews = await reviewService.getAllReviews(filter);
            res.json({ success: true, data: reviews });
        } catch (err) {
            next(err);
        }
    }
    async updateReviewStatus(req, res, next) {
        try {
            const { status } = req.body;
            const review = await reviewService.updateReviewStatus(req.params.id, status);
            res.json({ success: true, data: review, message: 'Review status updated' });
        } catch (err) {
            next(err);
        }
    }
    async deleteReview(req, res, next) {
        try {
            const result = await reviewService.deleteReview(req.params.id);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
    async getAutoApproveSetting(req, res, next) {
        try {
            const setting = await reviewService.getAutoApproveSetting();
            res.json({ success: true, data: setting });
        } catch (err) {
            next(err);
        }
    }
    async updateAutoApproveSetting(req, res, next) {
        try {
            const { enabled } = req.body;
            const setting = await reviewService.updateAutoApproveSetting(enabled);
            res.json({ success: true, data: setting, message: 'Auto-approve setting updated' });
        } catch (err) {
            next(err);
        }
    }
    async getTestimonials(req, res, next) {
        try {
            const reviews = await reviewService.getTestimonials();
            res.json({ success: true, data: reviews });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new ReviewController();
