'use strict';
const { SupplierOrder } = require('../models');

class SupplierOrderService {
    async getOrders(userId) {
        const row = await SupplierOrder.findOne({ where: { userId } });
        if (!row) return [];
        return Array.isArray(row.orders) ? row.orders : [];
    }

    async updateOrderStatus(userId, orderId, status, extra = {}) {
        const row = await SupplierOrder.findOne({ where: { userId } });
        if (!row) {
            const err = new Error('No orders found');
            err.status = 404;
            throw err;
        }
        const orders = Array.isArray(row.orders) ? [...row.orders] : [];
        const idx = orders.findIndex((o) => o.id === orderId);
        if (idx < 0) {
            const err = new Error('Order not found');
            err.status = 404;
            throw err;
        }
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const updated = {
            ...orders[idx],
            status,
            ...extra,
            statusHistory: [
                ...(orders[idx].statusHistory || []),
                { status, time: now, by: extra.by || 'Supplier' }
            ]
        };
        orders[idx] = updated;
        row.orders = orders;
        row.changed('orders', true);
        await row.save();
        return updated;
    }

    async assignDeliveryPerson(userId, orderId, deliveryPersonId) {
        return this.updateOrderStatus(userId, orderId, 'Assigned', {
            deliveryPersonId,
            assignedAt: new Date().toLocaleString('en-IN')
        });
    }
}

module.exports = new SupplierOrderService();
