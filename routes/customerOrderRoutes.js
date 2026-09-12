'use strict';
const express = require('express');
const router = express.Router();
const customerOrderController = require('../controllers/customerOrderController');
const authMiddleware = require('../middleware/authMiddleware');
router.post('/', authMiddleware, customerOrderController.create);
router.get('/', authMiddleware, customerOrderController.getMine);
router.get('/:id', authMiddleware, customerOrderController.getById);
module.exports = router;
