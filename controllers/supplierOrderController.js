'use strict';
const { SupplierOrder, CustomerOrder, Notification, DeliveryTeam } = require('../models');
class SupplierOrderController {
    async getOrders(req, res, next) {
        try {
            let orderRecord = await SupplierOrder.findOne({ where: { userId: req.user.id } });
            if (!orderRecord) {
                orderRecord = await SupplierOrder.create({ userId: req.user.id, orders: [] });
            }
            res.json({ success: true, data: orderRecord.orders });
        } catch (err) {
            next(err);
        }
    }
    async updateOrders(req, res, next) {
        try {
            const { orders } = req.body;
            let orderRecord = await SupplierOrder.findOne({ where: { userId: req.user.id } });
            if (!orderRecord) {
                orderRecord = await SupplierOrder.create({ userId: req.user.id, orders: orders || [] });
            } else {
                orderRecord.orders = orders || [];
                await orderRecord.save();
            }
            res.json({ success: true, data: orderRecord.orders });
        } catch (err) {
            next(err);
        }
    }
    async getAssignedOrders(req, res, next) {
        try {
            const supplierId = req.user.supplierId;
            if (!supplierId) {
                return res.json({ success: true, data: [] });
            }
            const teamRecord = await DeliveryTeam.findOne({ where: { userId: supplierId } });
            if (!teamRecord || !teamRecord.data || !teamRecord.data.persons) {
                return res.json({ success: true, data: [] });
            }
            // Find all delivery person IDs linked to this user account
            const validPersonIds = teamRecord.data.persons
                .filter(p => p.userId === req.user.id || p.id === req.user.id)
                .map(p => p.id);
            if (validPersonIds.length === 0) {
                return res.json({ success: true, data: [] });
            }
            const orderRecord = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!orderRecord) {
                return res.json({ success: true, data: [] });
            }
            // Filter orders by the matched dpId
            const assignedOrders = orderRecord.orders.filter(o => validPersonIds.includes(o.deliveryPersonId));
            res.json({ success: true, data: assignedOrders });
        } catch (err) {
            next(err);
        }
    }
    async updateOrderStatus(req, res, next) {
        try {
            const { orderId } = req.params;
            const { status, proofImage, proofComment } = req.body;
            if (status === 'Delivered' && !proofImage && !proofComment) {
                const err = new Error('Proof image or comment is required for delivered orders.');
                err.status = 400;
                throw err;
            }
            const supplierId = req.user.supplierId || req.user.id;
            const orderRecord = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!orderRecord) {
                const err = new Error('Supplier order record not found');
                err.status = 404;
                throw err;
            }
            let updatedOrder = null;
            const orders = orderRecord.orders.map(o => {
                if (o.id === orderId) {
                    const newOrder = { ...o };
                    newOrder.status = status;
                    if (!newOrder.statusHistory) newOrder.statusHistory = [];
                    newOrder.statusHistory.push({
                        status: status,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        by: req.user.firstName + ' ' + req.user.lastName
                    });
                    if (status === 'On The Way') newOrder.startedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    if (status === 'Delivered') {
                        newOrder.deliveredAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        newOrder.proofImage = proofImage || null;
                        newOrder.proofComment = proofComment || null;
                    }
                    updatedOrder = newOrder;
                    return newOrder;
                }
                return o;
            });
            orderRecord.orders = orders;
            orderRecord.changed('orders', true); // Force Sequelize to recognize JSONB change
            await orderRecord.save();
            // Sync status to CustomerOrder and Send Notification
            if (updatedOrder && updatedOrder.customerOrderId) {
                const cOrder = await CustomerOrder.findByPk(updatedOrder.customerOrderId);
                if (cOrder) {
                    let modified = false;
                    const subOrders = cOrder.subOrders.map(s => {
                        if (s.id === orderId) {
                            const newSub = { ...s };
                            newSub.status = status;
                            if (!newSub.timeline) newSub.timeline = [];
                            newSub.timeline.push({
                                status: status,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            });
                            if (status === 'Delivered') {
                                newSub.proofImage = proofImage || null;
                                newSub.proofComment = proofComment || null;
                            }
                            modified = true;
                            return newSub;
                        }
                        return s;
                    });
                    if (modified) {
                        cOrder.subOrders = subOrders;
                        cOrder.changed('subOrders', true); // Force Sequelize to recognize JSONB change
                        await cOrder.save();
                        // Send Notification to Customer
                        await Notification.create({
                            userId: cOrder.userId,
                            type: 'order_status',
                            title: 'Order Status Updated',
                            message: `Your order #${orderId.substring(0, 8)} is now ${status}.`,
                            link: '/customer/orders',
                            isRead: false
                        });
                    }
                }
            }
            res.json({ success: true, data: updatedOrder });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new SupplierOrderController();
