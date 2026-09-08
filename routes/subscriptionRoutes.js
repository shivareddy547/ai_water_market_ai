'use strict';
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, subscriptionController.createSubscription);
router.get('/', authMiddleware, subscriptionController.getMySubscriptions);
router.put('/:id/status', authMiddleware, subscriptionController.updateStatus);
router.delete('/:id', authMiddleware, subscriptionController.deleteSubscription);

module.exports = router;
