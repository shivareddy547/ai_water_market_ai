'use strict';
const { CustomerOrder, User } = require('../models');

class CustomerOrderService {
    async getAllOrders(userId, userRole) {
        const where = userRole === 'admin' ? {} : { userId };

        const orders = await CustomerOrder.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        return orders;
    }

    async getOrderById(id, userId, userRole) {
        const where = userRole === 'admin' ? { id } : { id, userId };

        const order = await CustomerOrder.findOne({
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
                }
            ]
        });

        if (!order) {
            const err = new Error('Order not found');
            err.status = 404;
            throw err;
        }

        return order;
    }

    async createOrder(userId, data) {
        const { subOrders, paymentMethod } = data;

        if (!subOrders || !Array.isArray(subOrders) || subOrders.length === 0) {
            const err = new Error('Sub-orders are required');
            err.status = 400;
            throw err;
        }

        let totalAmount = 0;
        for (const subOrder of subOrders) {
            const itemsTotal = Number(subOrder.itemsTotal || 0);
            const depositTotal = Number(subOrder.depositTotal || 0);
            const shipping = Number(subOrder.shipping || 0);
            const platformFee = Number(subOrder.platformFee || 0);
            totalAmount += itemsTotal + depositTotal + shipping + platformFee;
        }

        const orderNumber = `ORD-${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const order = await CustomerOrder.create({
            userId,
            orderNumber,
            subOrders,
            totalAmount,
            paymentMethod: paymentMethod || 'COD',
            status: 'Placed'
        });

        return order;
    }
}

module.exports = new CustomerOrderService();
