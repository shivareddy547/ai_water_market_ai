'use strict';
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, subscriptionController.createSubscription);
router.get('/', authMiddleware, subscriptionController.getMySubscriptions);
router.put('/:id', authMiddleware, subscriptionController.update);
router.put('/:id/status', authMiddleware, subscriptionController.updateStatus);
router.post('/:id/pause', authMiddleware, subscriptionController.pause);
router.post('/:id/resume', authMiddleware, subscriptionController.resume);
router.post('/:id/cancel', authMiddleware, subscriptionController.cancel);
router.post('/:id/skip-next', authMiddleware, subscriptionController.skipNext);
router.post('/:id/deliver-now', authMiddleware, subscriptionController.deliverNow);
router.delete('/:id', authMiddleware, subscriptionController.deleteSubscription);

module.exports = router;
