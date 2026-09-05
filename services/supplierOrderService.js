'use strict';
const { SupplierOrder } = require('../models');
class SupplierOrderService {
    async getOrders(userId) {
        const supplierOrder = await SupplierOrder.findOne({ where: { userId } });
        if (!supplierOrder) {
            return [];
        }
        return supplierOrder.orders || [];
    }
    async updateOrders(userId, orders) {
        let supplierOrder = await SupplierOrder.findOne({ where: { userId } });
        if (!supplierOrder) {
            supplierOrder = await SupplierOrder.create({ userId, orders });
        } else {
            supplierOrder.orders = orders;
            await supplierOrder.save();
        }
        return supplierOrder.orders;
    }
}
module.exports = new SupplierOrderService();
