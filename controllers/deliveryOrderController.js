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
}
module.exports = new DeliveryOrderController();
