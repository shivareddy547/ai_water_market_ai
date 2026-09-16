'use strict';
const deliveryOrderService = require('../services/deliveryOrderService');
class DeliveryOrderController {
    async getAssignedOrders(req, res, next) {
        try {
            const orders = await deliveryOrderService.getAssignedOrders(req.user.id);
            res.status(200).json({
                success: true,
                data: orders,
                message: 'Assigned orders fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async updateOrderStatus(req, res, next) {
        try {
            const { orderId } = req.params;
            const { status, reason, proofImage } = req.body;
            if (!status) {
                const err = new Error('Status is required');
                err.status = 400;
                throw err;
            }
            const updatedOrder = await deliveryOrderService.updateOrderStatus(
                req.user.id, 
                orderId, 
                status, 
                reason, 
                proofImage
            );
            res.status(200).json({
                success: true,
                data: updatedOrder,
                message: 'Order status updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async updateOrderPayment(req, res, next) {
        try {
            const { orderId } = req.params;
            const { paymentStatus, amountCollected, proofImage, reason } = req.body;
            if (!paymentStatus) {
                const err = new Error('Payment status is required');
                err.status = 400;
                throw err;
            }
            const updatedOrder = await deliveryOrderService.updateOrderPayment(
                req.user.id, 
                orderId, 
                paymentStatus, 
                amountCollected, 
                proofImage, 
                reason
            );
            res.status(200).json({
                success: true,
                data: updatedOrder,
                message: 'Payment status updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async generatePaymentLink(req, res, next) {
        try {
            const { orderId } = req.params;
            // In a real app, integrate with Razorpay/Stripe here
            // For now, we return a dummy link
            const paymentLink = `https://pay.example.com/order/${orderId}?amount=${req.body.amount || 0}`;
            res.status(200).json({
                success: true,
                data: { paymentLink },
                message: 'Payment link generated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}
module.exports = new DeliveryOrderController();
