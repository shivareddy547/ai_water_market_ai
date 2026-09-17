'use strict';
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
// Webhook endpoint for PhonePe
router.post('/phonepe/webhook', paymentController.handleWebhook);
// Live status check — connects to PhonePe status API, saves the response,
// and syncs it back to customer order data.
router.get('/phonepe/status/:orderId', paymentController.checkPhonepeStatus);
module.exports = router;
