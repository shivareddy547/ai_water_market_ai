'use strict';
const express = require('express');
const router = express.Router();
const deliveryOrderController = require('../controllers/deliveryOrderController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/assigned', authMiddleware, deliveryOrderController.getAssignedOrders);
router.put('/:orderId/status', authMiddleware, deliveryOrderController.updateOrderStatus);
module.exports = router;
