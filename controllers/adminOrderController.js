'use strict';
const adminOrderService = require('../services/adminOrderService');
class AdminOrderController {
    async getAllOrders(req, res, next) {
        try {
            if (req.user.role !== 'admin') {
                const err = new Error('Admin access required');
                err.status = 403;
                throw err;
            }
            const orders = await adminOrderService.getAllSupplierOrders();
            res.json({
                success: true,
                data: orders
            });
        } catch (err) {
            next(err);
        }
    }
    async updateCommissionStatus(req, res, next) {
        try {
            if (req.user.role !== 'admin') {
                const err = new Error('Admin access required');
                err.status = 403;
                throw err;
            }
            const { orderId, supplierId, commissionPaid } = req.body;
            if (!orderId || !supplierId) {
                const err = new Error('orderId and supplierId are required');
                err.status = 400;
                throw err;
            }
            const updated = await adminOrderService.updateCommissionStatus(
                orderId, supplierId, commissionPaid === true
            );
            res.json({
                success: true,
                message: 'Commission status updated successfully',
                data: updated
            });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new AdminOrderController();
