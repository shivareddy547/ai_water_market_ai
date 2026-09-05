'use strict';
const { SupplierOrder } = require('../models');

class SupplierOrderService {
    async getOrdersByUser(userId) {
        // Fetch all records to be safe against duplicate entries
        const orders = await SupplierOrder.findAll({ where: { userId } });
        let allOrders = [];
        orders.forEach(order => {
            if (Array.isArray(order.orders)) {
                allOrders = allOrders.concat(order.orders);
            }
        });
        return allOrders;
    }

    async updateOrders(userId, orders) {
        // Find the primary record for the user
        let record = await SupplierOrder.findOne({ 
            where: { userId }, 
            order: [['created_at', 'DESC']] 
        });
        
        if (record) {
            record.orders = orders;
            await record.save();
            return record;
        } else {
            return await SupplierOrder.create({ userId, orders });
        }
    }
}

module.exports = new SupplierOrderService();
