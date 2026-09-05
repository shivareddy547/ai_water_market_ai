'use strict';
const customerOrderService = require('../services/customerOrderService');
class CustomerOrderController {
    async getAll(req, res, next) {
        try {
            const orders = await customerOrderService.getByUser(req.user.id);
            res.json({ success: true, data: orders });
        } catch (err) {
            next(err);
        }
    }
    async getById(req, res, next) {
        try {
            const order = await customerOrderService.getById(req.params.id, req.user.id);
            res.json({ success: true, data: order });
        } catch (err) {
            next(err);
        }
    }
    async placeOrder(req, res, next) {
        try {
            const order = await customerOrderService.placeOrder(req.user.id, req.body);
            res.status(201).json({
                success: true,
                data: order,
                message: 'Order placed successfully'
            });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new CustomerOrderController();
