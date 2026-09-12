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
    async saveOrders(req, res, next) {
        try {
            const orders = await supplierOrderService.saveOrders(
                req.user.id,
                req.body.orders
            );
            res.json({
                success: true,
                message: 'Orders saved successfully',
                data: orders,
            });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new SupplierOrderController();
