'use strict';
const supplierOrderService = require('../services/supplierOrderService');
class SupplierOrderController {
    async getOrders(req, res, next) {
        try {
            const orders = await supplierOrderService.getOrdersByUserId(req.user.id);
            res.json({ success: true, data: orders });
        } catch (err) {
            next(err);
        }
    }
    async updateOrders(req, res, next) {
        try {
            const { orders } = req.body;
            const updatedOrders = await supplierOrderService.updateOrders(req.user.id, orders);
            res.json({ success: true, data: updatedOrders, message: 'Orders updated successfully' });
        } catch (err) {
            next(err);
        }
    }
    async getAssignedOrders(req, res, next) {
        try {
            const orders = await supplierOrderService.getAssignedOrdersForDelivery(req.user.id);
            res.json({ success: true, data: orders });
        } catch (err) {
            next(err);
        }
    }
    async updateOrderStatus(req, res, next) {
        try {
            const { orderId } = req.params;
            const { status } = req.body;
            if (!orderId || !status) {
                const err = new Error('Order ID and status are required');
                err.status = 400;
                throw err;
            }
            const updatedOrder = await supplierOrderService.updateOrderStatus(req.user.id, orderId, status);
            res.json({ success: true, data: updatedOrder, message: 'Order status updated successfully' });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new SupplierOrderController();
