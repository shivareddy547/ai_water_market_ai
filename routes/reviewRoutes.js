'use strict';
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authMiddleware');
// Settings routes
router.get('/settings/auto-approve', authMiddleware, reviewController.getAutoApproveSetting);
router.put('/settings/auto-approve', authMiddleware, reviewController.updateAutoApproveSetting);
// Public route to get published reviews for a product
router.get('/product/:productId', reviewController.getProductReviews);
// Public route to get recent testimonials
router.get('/testimonials', reviewController.getTestimonials);
// Authenticated routes
router.post('/', authMiddleware, reviewController.createReview);
// Admin routes (authMiddleware protects these, assuming admin role is checked or handled in UI)
router.get('/', authMiddleware, reviewController.getAllReviews);
router.put('/:id/status', authMiddleware, reviewController.updateReviewStatus);
router.delete('/:id', authMiddleware, reviewController.deleteReview);
module.exports = router;
