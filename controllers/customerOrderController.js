'use strict';
const customerOrderService = require('../services/customerOrderService');
class CustomerOrderController {
    async createOrder(req, res, next) {
        try {
            const order = await customerOrderService.createOrder(req.user.id, req.body);
            res.status(201).json({
                success: true,
                data: order,
                message: 'Order placed successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async getMyOrders(req, res, next) {
        try {
            const orders = await customerOrderService.getOrders(req.user.id);
            res.status(200).json({
                success: true,
                data: orders,
                message: 'Orders fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}
module.exports = new CustomerOrderController();
