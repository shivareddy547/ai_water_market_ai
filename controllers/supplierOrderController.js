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

    async updateStatus(req, res, next) {
        try {
            const { status, ...extra } = req.body;
            if (!status) {
                const err = new Error('Status is required');
                err.status = 400;
                throw err;
            }
            const order = await supplierOrderService.updateOrderStatus(
                req.user.id,
                req.params.id,
                status,
                extra
            );
            res.json({ success: true, data: order, message: 'Order status updated' });
        } catch (err) {
            next(err);
        }
    }

    async assign(req, res, next) {
        try {
            const { deliveryPersonId } = req.body;
            if (!deliveryPersonId) {
                const err = new Error('deliveryPersonId is required');
                err.status = 400;
                throw err;
            }
            const order = await supplierOrderService.assignDeliveryPerson(
                req.user.id,
                req.params.id,
                deliveryPersonId
            );
            res.json({ success: true, data: order, message: 'Delivery person assigned' });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new SupplierOrderController();
