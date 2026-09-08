'use strict';
const express = require('express');
const router = express.Router();
const supplierOrderController = require('../controllers/supplierOrderController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, supplierOrderController.getOrders);
router.put('/:id/status', authMiddleware, supplierOrderController.updateStatus);
router.post('/:id/assign', authMiddleware, supplierOrderController.assign);

module.exports = router;
