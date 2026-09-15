'use strict';
const { SupplierOrder } = require('../models');
class DeliveryOrderService {
    async getAssignedOrders(userId) {
        try {
            const supplierOrders = await SupplierOrder.findAll();
            const assignedOrders = [];
            supplierOrders.forEach(so => {
                const orders = so.orders || [];
                orders.forEach(order => {
                    if (order.assignedTo === userId || order.deliveryPersonId === userId) {
                        assignedOrders.push({
                            ...order,
                            id: order.id || order.orderId,
                            supplierId: so.userId
                        });
                    }
                });
            });
            return assignedOrders;
        } catch (error) {
            console.error('Error fetching assigned orders:', error);
            const err = new Error('Failed to fetch assigned orders');
            err.status = 500;
            throw err;
        }
    }
    async updateOrderStatus(orderId, userId, statusData) {
        try {
            const { status, proofImage, proofComment } = statusData;
            const supplierOrders = await SupplierOrder.findAll();
            let updatedOrder = null;
            for (const so of supplierOrders) {
                let orders = so.orders || [];
                let found = false;
                orders = orders.map(order => {
                    if ((order.id === orderId || order.orderId === orderId) && (order.assignedTo === userId || order.deliveryPersonId === userId)) {
                        found = true;
                        updatedOrder = {
                            ...order,
                            status,
                            proofImage: proofImage || order.proofImage,
                            proofComment: proofComment || order.proofComment
                        };
                        return updatedOrder;
                    }
                    return order;
                });
                if (found) {
                    so.orders = orders;
                    await so.save();
                    break;
                }
            }
            if (!updatedOrder) {
                const err = new Error('Order not found or not assigned to you');
                err.status = 404;
                throw err;
            }
            return updatedOrder;
        } catch (error) {
            if (error.status) throw error;
            console.error('Error updating order status:', error);
            const err = new Error('Failed to update order status');
            err.status = 500;
            throw err;
        }
    }
}
module.exports = new DeliveryOrderService();
