'use strict';
const { SupplierOrder } = require('../models');
class SupplierOrderService {
    async getOrdersByUserId(userId) {
        let orderDoc = await SupplierOrder.findOne({ where: { userId } });
        if (!orderDoc) {
            orderDoc = await SupplierOrder.create({ userId, orders: [] });
        }
        return orderDoc.orders;
    }
    async updateOrders(userId, orders) {
        let orderDoc = await SupplierOrder.findOne({ where: { userId } });
        if (!orderDoc) {
            orderDoc = await SupplierOrder.create({ userId, orders });
        } else {
            orderDoc.orders = orders;
            await orderDoc.save();
        }
        return orderDoc.orders;
    }
}
module.exports = new SupplierOrderService();
