'use strict';
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/', authMiddleware, cartController.getCart);
router.put('/', authMiddleware, cartController.updateCart);
router.delete('/', authMiddleware, cartController.clearCart);
module.exports = router;
