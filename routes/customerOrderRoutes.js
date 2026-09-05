'use strict';
const express = require('express');
const router = express.Router();
const customerOrderController = require('../controllers/customerOrderController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/', authMiddleware, customerOrderController.getAll);
router.get('/:id', authMiddleware, customerOrderController.getById);
router.post('/', authMiddleware, customerOrderController.placeOrder);
module.exports = router;
