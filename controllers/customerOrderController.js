'use strict';
const customerOrderService = require('../services/customerOrderService');

class CustomerOrderController {
    async getAll(req, res, next) {
        try {
            const orders = await customerOrderService.getAllOrders(req.user.id, req.user.role);
            res.json({ success: true, data: orders });
        } catch (err) {
            next(err);
        }
    }

    async getById(req, res, next) {
        try {
            const order = await customerOrderService.getOrderById(
                req.params.id,
                req.user.id,
                req.user.role
            );
            res.json({ success: true, data: order });
        } catch (err) {
            next(err);
        }
    }

    async create(req, res, next) {
        try {
            const order = await customerOrderService.createOrder(req.user.id, req.body);
            res.status(201).json({
                success: true,
                message: 'Order placed successfully',
                data: order
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new CustomerOrderController();
