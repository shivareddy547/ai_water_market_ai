'use strict';
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authMiddleware');
// Public route to get published reviews for a product
router.get('/product/:productId', reviewController.getProductReviews);
// Authenticated routes
router.post('/', authMiddleware, reviewController.createReview);
// Admin routes (authMiddleware protects these, assuming admin role is checked or handled in UI)
router.get('/', authMiddleware, reviewController.getAllReviews);
router.put('/:id/status', authMiddleware, reviewController.updateReviewStatus);
router.delete('/:id', authMiddleware, reviewController.deleteReview);
module.exports = router;
