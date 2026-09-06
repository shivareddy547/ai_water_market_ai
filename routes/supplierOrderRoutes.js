'use strict';
const express = require('express');
const router = express.Router();
const supplierOrderController = require('../controllers/supplierOrderController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/', authMiddleware, supplierOrderController.getAll);
router.put('/status/:orderId', authMiddleware, supplierOrderController.updateStatus);
router.put('/', authMiddleware, supplierOrderController.updateOrders);
module.exports = router;
