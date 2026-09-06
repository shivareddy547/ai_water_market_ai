'use strict';
const supplierOrderService = require('../services/supplierOrderService');
class SupplierOrderController {
    async getAll(req, res, next) {
        try {
            const orders = await supplierOrderService.getOrdersByUser(req.user.id, req.user.role);
            res.json({ success: true, data: orders });
        } catch (err) {
            next(err);
        }
    }
    async updateStatus(req, res, next) {
        try {
            const { orderId } = req.params;
            const { status } = req.body;
            if (!status) {
                const err = new Error('Status is required');
                err.status = 400;
                throw err;
            }
            const updatedOrder = await supplierOrderService.updateOrderStatus(orderId, req.user, status);
            res.json({ success: true, data: updatedOrder, message: 'Order status updated successfully' });
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
}
module.exports = new SupplierOrderController();
