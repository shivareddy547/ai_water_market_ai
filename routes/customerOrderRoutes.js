'use strict';
const express = require('express');
const router = express.Router();
const customerOrderController = require('../controllers/customerOrderController');
const authMiddleware = require('../middleware/authMiddleware');
router.post('/', authMiddleware, customerOrderController.createOrder);
router.get('/', authMiddleware, customerOrderController.getMyOrders);
module.exports = router;
