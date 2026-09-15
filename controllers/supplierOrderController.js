'use strict';
const supplierOrderService = require('../services/supplierOrderService');
class SupplierOrderController {
    async getOrders(req, res, next) {
        try {
            const orders = await supplierOrderService.getOrders(req.user.id);
            res.status(200).json({
                success: true,
                data: orders,
                message: 'Orders fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async updateOrders(req, res, next) {
        try {
            const { orders } = req.body;
            if (!Array.isArray(orders)) {
                const err = new Error('Orders must be an array');
                err.status = 400;
                throw err;
            }
            const updatedOrders = await supplierOrderService.updateOrders(req.user.id, orders);
            res.status(200).json({
                success: true,
                data: updatedOrders,
                message: 'Orders saved successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}
module.exports = new SupplierOrderController();
