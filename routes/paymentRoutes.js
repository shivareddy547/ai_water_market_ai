'use strict';
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
// Webhook endpoint for PhonePe
router.post('/phonepe/webhook', paymentController.handleWebhook);
module.exports = router;
