'use strict';
const { SupplierOrder, User, DeliveryTeam } = require('../models');
class SupplierOrderService {
    async getOrdersByUser(userId, role) {
        if (role === 'delivery') {
            // 1. Find the internal delivery person ID using the user ID
            let deliveryPersonId = null;
            const allTeams = await DeliveryTeam.findAll();
            for (const team of allTeams) {
                const teamData = team.data || { persons: [] };
                const person = teamData.persons.find(p => p.userId === userId);
                if (person) {
                    deliveryPersonId = person.id;
                    break;
                }
            }
            if (!deliveryPersonId) {
                return [];
            }
            // 2. Fetch all supplier orders and filter by the internal delivery person ID
            const supplierOrders = await SupplierOrder.findAll({
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'first_name', 'last_name', 'store_name']
                }]
            });
            const assignedOrders = [];
            supplierOrders.forEach(so => {
                const supplierId = so.userId;
                const u = so.user ? so.user.toJSON() : {};
                const supplierName = u.store_name || `${u.first_name} ${u.last_name}`.trim() || 'Supplier';
                so.orders.forEach(o => {
                    if (o.deliveryPersonId === deliveryPersonId) {
                        assignedOrders.push({ ...o, supplierId, supplierName });
                    }
                });
            });
            return assignedOrders;
        }
        let supplierOrder = await SupplierOrder.findOne({ where: { userId } });
        if (!supplierOrder) {
            supplierOrder = await SupplierOrder.create({ userId, orders: [] });
        }
        return supplierOrder.orders;
    }
    async updateOrderStatus(orderId, userId, role, status) {
        if (role === 'delivery') {
            // 1. Find the internal delivery person ID using the user ID
            let deliveryPersonId = null;
            const allTeams = await DeliveryTeam.findAll();
            for (const team of allTeams) {
                const teamData = team.data || { persons: [] };
                const person = teamData.persons.find(p => p.userId === userId);
                if (person) {
                    deliveryPersonId = person.id;
                    break;
                }
            }
            if (!deliveryPersonId) {
                const err = new Error('Delivery person profile not found');
                err.status = 404;
                throw err;
            }
            const supplierOrders = await SupplierOrder.findAll();
            for (const so of supplierOrders) {
                const orderIndex = so.orders.findIndex(o => o.id === orderId && o.deliveryPersonId === deliveryPersonId);
                if (orderIndex !== -1) {
                    so.orders[orderIndex].status = status;
                    await so.save();
                    return so.orders[orderIndex];
                }
            }
            const err = new Error('Order not found or not assigned to you');
            err.status = 404;
            throw err;
        }
        const supplierOrder = await SupplierOrder.findOne({ where: { userId } });
        if (!supplierOrder) {
            const err = new Error('Supplier order record not found');
            err.status = 404;
            throw err;
        }
        const orderIndex = supplierOrder.orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            const err = new Error('Order not found');
            err.status = 404;
            throw err;
        }
        supplierOrder.orders[orderIndex].status = status;
        await supplierOrder.save();
        return supplierOrder.orders[orderIndex];
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
