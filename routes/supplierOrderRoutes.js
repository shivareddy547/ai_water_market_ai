'use strict';
const express = require('express');
const router = express.Router();
const supplierOrderController = require('../controllers/supplierOrderController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/', authMiddleware, (req, res, next) => supplierOrderController.getOrders(req, res, next));
router.put('/', authMiddleware, (req, res, next) => supplierOrderController.updateOrders(req, res, next));
module.exports = router;
