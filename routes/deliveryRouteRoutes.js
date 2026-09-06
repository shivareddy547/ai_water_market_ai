'use strict';
const express = require('express');
const router = express.Router();
const deliveryRouteController = require('../controllers/deliveryRouteController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/', authMiddleware, deliveryRouteController.getAssignedOrders);
module.exports = router;
