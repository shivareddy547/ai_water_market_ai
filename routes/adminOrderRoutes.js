'use strict';
const express = require('express');
const router = express.Router();
const adminOrderController = require('../controllers/adminOrderController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/', authMiddleware, adminOrderController.getAllOrders);
router.put('/commission', authMiddleware, adminOrderController.updateCommissionStatus);
module.exports = router;
