'use strict';
const supplierOrderService = require('../services/supplierOrderService');
class SupplierOrderController {
    async getAll(req, res, next) {
        try {
            const orders = await supplierOrderService.getOrdersByUserId(req.user.id);
            res.json({ success: true, data: orders });
        } catch (err) {
            next(err);
        }
    }
    async updateAll(req, res, next) {
        try {
            const { orders } = req.body;
            if (!Array.isArray(orders)) {
                const err = new Error('Orders array is required');
                err.status = 400;
                throw err;
            }
            const updatedOrders = await supplierOrderService.updateOrders(req.user.id, orders);
            res.json({ success: true, data: updatedOrders, message: 'Orders updated successfully' });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new SupplierOrderController();
