'use strict';
const express = require('express');
const router = express.Router();
const customerOrderController = require('../controllers/customerOrderController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, customerOrderController.create);

module.exports = router;
