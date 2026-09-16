'use strict';
const paymentService = require('../services/paymentService');
class PaymentController {
    async handleWebhook(req, res, next) {
        try {
            await paymentService.handlePhonepeWebhook(req.body);
            // Always return 200 OK to PhonePe to acknowledge receipt
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Webhook error:', error);
            res.status(200).json({ success: true }); // Still return 200 to prevent retries
        }
    }
}
module.exports = new PaymentController();
