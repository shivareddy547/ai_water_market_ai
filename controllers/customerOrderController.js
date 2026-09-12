'use strict';
const customerOrderService = require('../services/customerOrderService');

class CustomerOrderController {
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
