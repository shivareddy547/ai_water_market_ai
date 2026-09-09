'use strict';
const { SupplierOrder, DeliveryTeam, User } = require('../models');
class SupplierOrderService {
    async getOrdersByUserId(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        let supplierUserId = userId;
        if (user.role === 'delivery') {
            if (!user.supplierId) {
                return [];
            }
            supplierUserId = user.supplierId;
        } else if (user.role !== 'supplier') {
            const err = new Error('Unauthorized to view orders');
            err.status = 403;
            throw err;
        }
        const supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierUserId } });
        if (!supplierOrder) {
            return [];
        }
        return supplierOrder.orders || [];
    }
    async updateOrders(userId, orders) {
        if (!Array.isArray(orders)) {
            const err = new Error('Orders must be an array');
            err.status = 400;
            throw err;
        }
        const user = await User.findByPk(userId);
        if (!user || user.role !== 'supplier') {
            const err = new Error('Only suppliers can update orders');
            err.status = 403;
            throw err;
        }
        let supplierOrder = await SupplierOrder.findOne({ where: { userId: userId } });
        if (!supplierOrder) {
            supplierOrder = await SupplierOrder.create({ userId: userId, orders: orders });
        } else {
            supplierOrder.orders = orders;
            await supplierOrder.save();
        }
        return supplierOrder.orders;
    }
    async getAssignedOrdersForDelivery(deliveryUserId) {
        const user = await User.findByPk(deliveryUserId);
        if (!user || user.role !== 'delivery') {
            const err = new Error('Delivery user not found');
            err.status = 404;
            throw err;
        }
        if (!user.supplierId) {
            return [];
        }
        const deliveryTeam = await DeliveryTeam.findOne({ where: { userId: user.supplierId } });
        if (!deliveryTeam || !deliveryTeam.data) {
            return [];
        }
        const teamData = deliveryTeam.data;
        const persons = teamData.persons || [];
        const deliveryPerson = persons.find(p => p.userId === deliveryUserId);
        if (!deliveryPerson) {
            return [];
        }
        const supplierOrder = await SupplierOrder.findOne({ where: { userId: user.supplierId } });
        if (!supplierOrder || !supplierOrder.orders) {
            return [];
        }
        const assignedOrders = supplierOrder.orders.filter(
            o => o.deliveryPersonId === deliveryPerson.id
        );
        return assignedOrders;
    }
}
module.exports = new SupplierOrderService();
