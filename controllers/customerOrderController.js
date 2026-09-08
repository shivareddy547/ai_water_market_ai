'use strict';
const customerOrderService = require('../services/customerOrderService');

class CustomerOrderController {
    async create(req, res, next) {
        try {
            const order = await customerOrderService.createOrder(req.user.id, req.body);
            res.status(201).json({
                success: true,
                data: order,
                message: 'Order placed successfully'
            });
        } catch (err) {
            next(err);
        }
    }

    async getMyOrders(req, res, next) {
        try {
            const orders = await customerOrderService.getOrdersByUser(req.user.id);
            res.json({ success: true, data: orders });
        } catch (err) {
            next(err);
        }
    }

    async getById(req, res, next) {
        try {
            const order = await customerOrderService.getOrderById(req.params.id, req.user.id);
            res.json({ success: true, data: order });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new CustomerOrderController();
