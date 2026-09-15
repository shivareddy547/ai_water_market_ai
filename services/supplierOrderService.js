'use strict';
const { SupplierOrder } = require('../models');
class SupplierOrderService {
    async getOrders(userId) {
        try {
            let order = await SupplierOrder.findOne({ where: { userId } });
            if (!order) {
                order = await SupplierOrder.create({ userId, orders: [] });
            }
            return order.orders || [];
        } catch (error) {
            console.error('Error fetching supplier orders:', error);
            const err = new Error('Failed to fetch orders');
            err.status = 500;
            throw err;
        }
    }
    async updateOrders(userId, ordersData) {
        try {
            let order = await SupplierOrder.findOne({ where: { userId } });
            if (!order) {
                order = await SupplierOrder.create({ userId, orders: ordersData });
            } else {
                order.orders = ordersData;
                await order.save();
            }
            return order.orders || [];
        } catch (error) {
            console.error('Error updating supplier orders:', error);
            const err = new Error('Failed to save orders');
            err.status = 500;
            throw err;
        }
    }
}
module.exports = new SupplierOrderService();
