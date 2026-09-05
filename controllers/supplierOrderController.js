'use strict';
const supplierOrderService = require('../services/supplierOrderService');
class SupplierOrderController {
    async getOrders(req, res, next) {
        try {
            const orders = await supplierOrderService.getOrders(req.user.id);
            res.json({ success: true, data: orders });
        } catch (err) {
            next(err);
        }
    }
    async updateOrders(req, res, next) {
        try {
            const orders = req.body.orders || [];
            const updatedOrders = await supplierOrderService.updateOrders(req.user.id, orders);
            res.json({ success: true, data: updatedOrders, message: 'Orders updated successfully' });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new SupplierOrderController();
