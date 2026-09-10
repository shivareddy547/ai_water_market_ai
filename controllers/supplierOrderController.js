'use strict';
const { SupplierOrder, CustomerOrder, DeliveryTeam } = require('../models');
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
            // Find the delivery person's team ID (dp_...) from DeliveryTeam data
            const teamRecord = await DeliveryTeam.findOne({ where: { userId: supplierId } });
            if (!teamRecord || !teamRecord.data || !teamRecord.data.persons) {
                return res.json({ success: true, data: [] });
            }
            const deliveryPerson = teamRecord.data.persons.find(p => p.userId === req.user.id);
            if (!deliveryPerson) {
                return res.json({ success: true, data: [] });
            }
            const dpId = deliveryPerson.id;
            const orderRecord = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!orderRecord) {
                return res.json({ success: true, data: [] });
            }
            // Filter orders by the matched dpId
            const assignedOrders = orderRecord.orders.filter(o => o.deliveryPersonId === dpId);
            res.json({ success: true, data: assignedOrders });
        } catch (err) {
            next(err);
        }
    }
    async updateOrderStatus(req, res, next) {
        try {
            const { orderId } = req.params;
            const { status } = req.body;
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
                    o.status = status;
                    if (!o.statusHistory) o.statusHistory = [];
                    o.statusHistory.push({
                        status: status,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        by: req.user.firstName + ' ' + req.user.lastName
                    });
                    if (status === 'On The Way') o.startedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    if (status === 'Delivered') o.deliveredAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    updatedOrder = o;
                }
                return o;
            });
            orderRecord.orders = orders;
            await orderRecord.save();
            // Sync status to CustomerOrder
            if (updatedOrder && updatedOrder.customerOrderId) {
                const cOrder = await CustomerOrder.findByPk(updatedOrder.customerOrderId);
                if (cOrder) {
                    let subOrders = cOrder.subOrders;
                    let modified = false;
                    subOrders = subOrders.map(s => {
                        if (s.id === orderId) {
                            s.status = status;
                            if (!s.timeline) s.timeline = [];
                            s.timeline.push({
                                status: status,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            });
                            modified = true;
                        }
                        return s;
                    });
                    if (modified) {
                        cOrder.subOrders = subOrders;
                        await cOrder.save();
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
