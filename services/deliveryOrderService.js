'use strict';
const { SupplierOrder, User, DeliveryTeam } = require('../models');
class DeliveryOrderService {
    async getAssignedOrders(userId) {
        try {
            const deliveryUser = await User.findByPk(userId);
            if (!deliveryUser || deliveryUser.role !== 'delivery') {
                const err = new Error('Delivery user not found');
                err.status = 404;
                throw err;
            }
            const supplierId = deliveryUser.supplierId;
            if (!supplierId) {
                return [];
            }
            const supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!supplierOrder || !supplierOrder.orders) {
                return [];
            }
            let personId = userId; // Default to user ID
            const personName = `${deliveryUser.firstName} ${deliveryUser.lastName}`.trim();
            // Find the matching delivery person in the supplier's team to get their local person ID
            const supplierTeam = await DeliveryTeam.findOne({ where: { userId: supplierId } });
            if (supplierTeam && supplierTeam.data && Array.isArray(supplierTeam.data.persons)) {
                const person = supplierTeam.data.persons.find(p => {
                    return p.userId === userId || 
                           p.id === userId || 
                           (p.mobile && p.mobile === deliveryUser.phone) ||
                           (p.fullName && p.fullName === personName);
                });
                if (person) {
                    personId = person.id;
                }
            }
            // Filter orders matching the resolved personId
            const assignedOrders = supplierOrder.orders.filter(
                order => order.deliveryPersonId === personId || order.deliveryPersonId === userId
            );
            return assignedOrders;
        } catch (error) {
            console.error('Error fetching assigned orders:', error);
            const err = new Error('Failed to fetch assigned orders');
            err.status = 500;
            throw err;
        }
    }
    async updateOrderStatus(userId, orderId, newStatus, reason = null, proofImage = null) {
        try {
            const deliveryUser = await User.findByPk(userId);
            if (!deliveryUser || deliveryUser.role !== 'delivery' || !deliveryUser.supplierId) {
                const err = new Error('Unauthorized or not linked to a supplier');
                err.status = 403;
                throw err;
            }
            const supplierId = deliveryUser.supplierId;
            const supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!supplierOrder || !supplierOrder.orders) {
                const err = new Error('No orders found for this supplier');
                err.status = 404;
                throw err;
            }
            let personId = userId;
            const personName = `${deliveryUser.firstName} ${deliveryUser.lastName}`.trim();
            const supplierTeam = await DeliveryTeam.findOne({ where: { userId: supplierId } });
            if (supplierTeam && supplierTeam.data && Array.isArray(supplierTeam.data.persons)) {
                const person = supplierTeam.data.persons.find(p => {
                    return p.userId === userId || p.id === userId || (p.mobile && p.mobile === deliveryUser.phone) || (p.fullName && p.fullName === personName);
                });
                if (person) personId = person.id;
            }
            const orders = supplierOrder.orders;
            const orderIndex = orders.findIndex(o => o.id === orderId && (o.deliveryPersonId === personId || o.deliveryPersonId === userId));
            if (orderIndex === -1) {
                const err = new Error('Order not found or not assigned to you');
                err.status = 404;
                throw err;
            }
            const order = orders[orderIndex];
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const by = personName || deliveryUser.firstName;
            // Validate requirement ONLY for specific statuses
            const requiresProof = ['Delivered', 'Cancelled', 'Returned'].includes(newStatus);
            if (requiresProof && !proofImage && !reason) {
                const err = new Error('Proof image or reason is required for this status change');
                err.status = 400;
                throw err;
            }
            order.status = newStatus;
            const historyEntry = { status: newStatus, time: nowTime, by };
            if (reason) historyEntry.reason = reason;
            if (proofImage) historyEntry.proofImage = proofImage;
            order.statusHistory = [...(order.statusHistory || []), historyEntry];
            if (newStatus === 'Accepted') order.acceptedAt = nowTime;
            if (newStatus === 'On The Way') order.startedAt = nowTime;
            if (newStatus === 'Reached') order.reachedAt = nowTime;
            if (newStatus === 'Delivered') {
                order.deliveredAt = nowTime;
                order.proofImage = proofImage || null;
                order.proofComment = reason || null;
                if (order.paymentMode === 'COD') order.paymentStatus = 'Paid';
            } else if (['Customer Not Available', 'Returned', 'Cancelled'].includes(newStatus)) {
                order.failedReason = reason || null;
            }
            orders[orderIndex] = order;
            supplierOrder.orders = orders;
            supplierOrder.changed('orders', true);
            await supplierOrder.save();
            return order;
        } catch (error) {
            console.error('Error updating order status:', error);
            const err = new Error(error.message || 'Failed to update order status');
            err.status = error.status || 500;
            throw err;
        }
    }
}
module.exports = new DeliveryOrderService();
