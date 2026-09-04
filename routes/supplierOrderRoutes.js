'use strict';
const express = require('express');
const router = express.Router();
const supplierOrderController = require('../controllers/supplierOrderController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/', authMiddleware, supplierOrderController.getAll);
router.put('/', authMiddleware, supplierOrderController.updateAll);
module.exports = router;
