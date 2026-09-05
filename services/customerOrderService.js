'use strict';
const { CustomerOrder, SupplierOrder, User } = require('../models');
class CustomerOrderService {
    async getByUser(userId) {
        return await CustomerOrder.findAll({
            where: { userId },
            order: [['created_at', 'DESC']]
        });
    }
    async getById(id, userId) {
        const order = await CustomerOrder.findOne({ where: { id, userId } });
        if (!order) {
            const err = new Error('Order not found');
            err.status = 404;
            throw err;
        }
        return order;
    }
    async placeOrder(userId, payload) {
        const { subOrders, paymentMethod } = payload;
        if (!subOrders || !Array.isArray(subOrders) || subOrders.length === 0) {
            const err = new Error('subOrders array is required and must not be empty');
            err.status = 400;
            throw err;
        }
        if (!paymentMethod || !['UPI', 'Card', 'Wallet', 'COD'].includes(paymentMethod)) {
            const err = new Error('Valid paymentMethod is required (UPI, Card, Wallet, COD)');
            err.status = 400;
            throw err;
        }
        const customer = await User.findByPk(userId);
        if (!customer) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        const customerName = `${customer.firstName} ${customer.lastName}`.trim();
        const now = Date.now();
        const parentOrderNumber = `ORD-${now}`;
        const nowStamp = new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const totalAmount = subOrders.reduce(
            (sum, so) => sum + Number(so.grandTotal || 0),
            0
        );
        const builtSubOrders = [];
        const supplierPushPromises = [];
        for (let i = 0; i < subOrders.length; i++) {
            const so = subOrders[i];
            const subOrderNumber = `${parentOrderNumber}-${i + 1}`;
            const addr = so.address || {};
            const subOrderRecord = {
                id: subOrderNumber,
                supplier: so.supplier,
                lines: (so.lines || []).map(l => ({
                    name: l.name,
                    qty: Number(l.qty),
                    price: Number(l.price),
                    deposit: Number(l.deposit || 0)
                })),
                addressId: so.addressId || null,
                address: addr,
                paymentMethod,
                itemsTotal: Number(so.itemsTotal || 0),
                depositTotal: Number(so.depositTotal || 0),
                shipping: Number(so.shipping || 0),
                grandTotal: Number(so.grandTotal || 0),
                status: 'Placed',
                placedAt: nowStamp,
                timeline: [{ status: 'Placed', time: nowStamp }]
            };
            builtSubOrders.push(subOrderRecord);
            const supplierOrderEntry = {
                id: subOrderNumber,
                customer: customerName,
                area: addr.city || addr.pincode || '',
                address: `${addr.line || ''}${addr.landmark ? ', ' + addr.landmark : ''}, ${addr.city || ''} - ${addr.pincode || ''}`.trim(),
                phone: addr.phone || customer.phone || '',
                items: (so.lines || []).map(l => ({
                    name: l.name,
                    qty: Number(l.qty),
                    price: Number(l.price)
                })),
                total: Number(so.grandTotal || 0),
                canDeposit: Number(so.depositTotal || 0),
                slot: nowStamp,
                paymentMode: paymentMethod,
                paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
                status: 'Pending',
                priority: 'normal',
                isSubscription: false,
                collectEmptyCan: false,
                deliveryPersonId: null,
                assignedAt: '',
                acceptedAt: '',
                startedAt: '',
                deliveredAt: '',
                statusHistory: [{ status: 'Pending', time: nowStamp, by: customerName }],
                commissionPaid: false
            };
            const supplierUser = await User.findOne({
                where: { role: 'supplier', storeName: so.supplier }
            });
            if (supplierUser) {
                supplierPushPromises.push(
                    (async () => {
                        let supplierOrderRec = await SupplierOrder.findOne({
                            where: { userId: supplierUser.id }
                        });
                        if (supplierOrderRec) {
                            const existingOrders = Array.isArray(supplierOrderRec.orders)
                                ? supplierOrderRec.orders
                                : [];
                            supplierOrderRec.orders = [...existingOrders, supplierOrderEntry];
                            await supplierOrderRec.save();
                        } else {
                            await SupplierOrder.create({
                                userId: supplierUser.id,
                                orders: [supplierOrderEntry]
                            });
                        }
                    })()
                );
            }
        }
        await Promise.all(supplierPushPromises);
        const parentOrder = await CustomerOrder.create({
            userId,
            orderNumber: parentOrderNumber,
            subOrders: builtSubOrders,
            totalAmount,
            paymentMethod,
            status: 'Placed'
        });
        return parentOrder;
    }
}
module.exports = new CustomerOrderService();
