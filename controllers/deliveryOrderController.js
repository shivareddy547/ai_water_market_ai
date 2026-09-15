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
    async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, proofImage, proofComment } = req.body;
            if (!status) {
                const err = new Error('Status is required');
                err.status = 400;
                throw err;
            }
            const order = await deliveryOrderService.updateOrderStatus(id, req.user.id, { 
                status, 
                proofImage, 
                proofComment 
            });
            res.status(200).json({
                success: true,
                data: order,
                message: 'Order status updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}
module.exports = new DeliveryOrderController();
