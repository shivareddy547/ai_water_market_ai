'use strict';
const { CustomerOrder, SupplierOrder, Subscription, User } = require('../models');

function nowStamp() {
    return new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function makeOrderNumber(prefix) {
    return `${prefix}-${Date.now()}${Math.floor(Math.random() * 100)}`;
}

function calcNextDelivery(frequency, customDays) {
    const d = new Date();
    const f = String(frequency || '').toLowerCase();
    if (f === 'daily') d.setDate(d.getDate() + 1);
    else if (f === 'alternate days') d.setDate(d.getDate() + 2);
    else if (f === 'weekly') d.setDate(d.getDate() + 7);
    else if (f === 'monthly') d.setMonth(d.getMonth() + 1);
    else {
        const days = Math.max(1, Number(customDays) || 3);
        d.setDate(d.getDate() + days);
    }
    return d;
}

/** Always persist isSubscription + frequency on every line */
function normalizeLine(l) {
    const isSub =
        l.isSubscription === true ||
        l.isSubscription === 'true' ||
        l.isSubscription === 1 ||
        String(l.isSubscription || '').toLowerCase() === 'yes';

    const frequency = isSub ? (l.frequency || 'Monthly') : null;

    const unitPrice =
        isSub && l.subscriptionPrice != null && l.subscriptionPrice !== ''
            ? Number(l.subscriptionPrice)
            : Number(l.price || 0);

    return {
        productId: l.productId || null,
        variantId: l.variantId || l.variantKey || null,
        variantKey: l.variantKey || null,
        name: l.name || l.variantName || l.productName || 'Item',
        qty: Number(l.qty) || 1,
        price: unitPrice,
        subscriptionPrice:
            l.subscriptionPrice != null ? Number(l.subscriptionPrice) : null,
        deposit: Number(l.deposit) || 0,
        warehouseId: l.warehouseId || '',
        warehouseName: l.warehouseName || '',
        isSubscription: isSub,
        frequency,
        image: l.image || null,
        sku: l.sku || null,
        categoryIcon: l.categoryIcon || '💧'
    };
}

class CustomerOrderService {
    async createOrder(userId, payload) {
        const { subOrders, paymentMethod } = payload || {};

        if (!Array.isArray(subOrders) || subOrders.length === 0) {
            const err = new Error('At least one sub-order is required');
            err.status = 400;
            throw err;
        }

        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }

        const customerName =
            `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
        const placedAt = nowStamp();
        const parentOrderNumber = makeOrderNumber('PO');

        const builtSubOrders = [];
        const subscriptionCreates = [];
        const supplierPushes = [];

        for (const so of subOrders) {
            const subId = makeOrderNumber('ORD');
            const lines = (so.lines || []).map(normalizeLine);

            const itemsTotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
            const depositTotal = lines.reduce(
                (n, l) => n + (Number(l.deposit) || 0),
                0
            );
            const shipping = Number(so.shipping) || 0;
            const grandTotal = itemsTotal + depositTotal + shipping;

            const address = so.address || null;
            const supplierId = so.supplierId || null;
            const supplierName = so.supplier || 'Supplier';

            const subOrder = {
                id: subId,
                supplier: supplierName,
                supplierId,
                lines,
                addressId: so.addressId || (address && address.id) || null,
                address: address
                    ? {
                          id: address.id,
                          label: address.label,
                          fullName: address.fullName || address.full_name,
                          phone: address.phone,
                          line: address.line,
                          landmark: address.landmark,
                          city: address.city,
                          state: address.state,
                          pincode: address.pincode
                      }
                    : null,
                paymentMethod: paymentMethod || 'COD',
                itemsTotal,
                depositTotal,
                shipping,
                grandTotal,
                status: 'Placed',
                placedAt,
                timeline: [{ status: 'Placed', time: placedAt }],
                hasSubscription: lines.some((l) => l.isSubscription === true)
            };
            builtSubOrders.push(subOrder);

            for (const line of lines) {
                if (!line.isSubscription) continue;
                subscriptionCreates.push({
                    userId,
                    orderId: null,
                    supplierId,
                    productId: line.productId || null,
                    productName: line.name,
                    frequency: line.frequency || 'Monthly',
                    quantity: line.qty,
                    price: line.price,
                    status: 'active',
                    nextDeliveryDate: calcNextDelivery(
                        line.frequency,
                        so.customDays
                    ),
                    details: {
                        variantName: line.name,
                        supplier: supplierName,
                        image: line.image || null,
                        categoryIcon: line.categoryIcon || '💧',
                        addressId: subOrder.addressId,
                        paymentMethod: paymentMethod || 'COD',
                        timeSlot: so.timeSlot || '',
                        depositPerDelivery: line.deposit || 0,
                        deliveriesDone: 0,
                        customDays: Number(so.customDays) || 0,
                        startedOn: new Date().toISOString().split('T')[0],
                        history: [],
                        subOrderId: subId
                    }
                });
            }

            if (supplierId) {
                supplierPushes.push({
                    supplierId,
                    orderObj: {
                        id: subId,
                        parentOrderNumber,
                        customerOrderId: null,
                        customer: customerName,
                        customerId: userId,
                        phone: (address && address.phone) || user.phone || '',
                        address: address
                            ? `${address.line}${
                                  address.landmark
                                      ? ', ' + address.landmark
                                      : ''
                              }, ${address.city} - ${address.pincode}`
                            : '',
                        area: (address && address.city) || '',
                        pincode: (address && address.pincode) || '',
                        items: lines.map((l) => ({
                            name: l.name,
                            qty: l.qty,
                            price: l.price,
                            productId: l.productId,
                            isSubscription: l.isSubscription === true,
                            frequency: l.frequency || null,
                            image: l.image || null,
                            sku: l.sku || null
                        })),
                        total: grandTotal,
                        itemsTotal,
                        depositTotal,
                        shipping,
                        paymentMode:
                            paymentMethod === 'Card'
                                ? 'UPI'
                                : paymentMethod || 'COD',
                        paymentStatus:
                            paymentMethod === 'COD' ? 'Pending' : 'Paid',
                        isSubscription: lines.some(
                            (l) => l.isSubscription === true
                        ),
                        collectEmptyCan: depositTotal > 0,
                        canDeposit: depositTotal,
                        slot: 'Today',
                        priority: 'normal',
                        status: 'Pending',
                        deliveryPersonId: null,
                        assignedAt: '',
                        acceptedAt: '',
                        startedAt: '',
                        deliveredAt: '',
                        createdAt: placedAt,
                        statusHistory: [
                            {
                                status: 'Pending',
                                time: placedAt,
                                by: 'Customer order'
                            }
                        ]
                    }
                });
            } else {
                console.error(
                    '[createOrder] Missing supplierId — supplier order NOT created. supplier=',
                    supplierName
                );
            }
        }

        const totalAmount = builtSubOrders.reduce(
            (n, s) => n + Number(s.grandTotal || 0),
            0
        );

        const parent = await CustomerOrder.create({
            userId,
            orderNumber: parentOrderNumber,
            subOrders: builtSubOrders,
            totalAmount,
            paymentMethod: paymentMethod || 'COD',
            status: 'Placed'
        });

        for (const sub of subscriptionCreates) {
            sub.orderId = parent.id;
            try {
                await Subscription.create(sub);
            } catch (subErr) {
                console.error('Subscription create failed:', subErr.message);
            }
        }

        for (const { supplierId, orderObj } of supplierPushes) {
            orderObj.customerOrderId = parent.id;
            try {
                await this.pushSupplierOrder(supplierId, orderObj);
                console.log(
                    '[createOrder] Supplier order pushed for',
                    supplierId,
                    'order',
                    orderObj.id
                );
            } catch (supErr) {
                console.error(
                    '[createOrder] Supplier order push FAILED for',
                    supplierId,
                    supErr.message
                );
            }
        }

        return {
            id: parent.id,
            orderNumber: parent.orderNumber,
            placedAt,
            paymentMethod: parent.paymentMethod,
            status: parent.status,
            totalAmount: Number(parent.totalAmount),
            subOrders: builtSubOrders
        };
    }

    async pushSupplierOrder(supplierUserId, orderObj) {
        if (!supplierUserId) {
            throw new Error('supplierUserId is required');
        }

        let row = await SupplierOrder.findOne({
            where: { userId: supplierUserId }
        });

        if (!row) {
            row = await SupplierOrder.create({
                userId: supplierUserId,
                orders: [orderObj]
            });
            return row;
        }

        const existing = Array.isArray(row.orders) ? [...row.orders] : [];
        const next = [orderObj, ...existing];
        row.set('orders', next);
        row.changed('orders', true);
        await row.save();
        return row;
    }

    async getOrdersByUser(userId) {
        const rows = await CustomerOrder.findAll({
            where: { userId },
            order: [['created_at', 'DESC']]
        });
        return rows.map((r) => {
            const j = r.toJSON();
            return {
                id: j.id,
                orderNumber: j.orderNumber,
                placedAt: j.createdAt
                    ? new Date(j.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                      })
                    : '',
                paymentMethod: j.paymentMethod,
                status: j.status,
                totalAmount: Number(j.totalAmount),
                subOrders: j.subOrders || []
            };
        });
    }

    async getOrderById(id, userId) {
        const row = await CustomerOrder.findOne({ where: { id, userId } });
        if (!row) {
            const err = new Error('Order not found');
            err.status = 404;
            throw err;
        }
        const j = row.toJSON();
        return {
            id: j.id,
            orderNumber: j.orderNumber,
            placedAt: j.createdAt,
            paymentMethod: j.paymentMethod,
            status: j.status,
            totalAmount: Number(j.totalAmount),
            subOrders: j.subOrders || []
        };
    }
}

module.exports = new CustomerOrderService();
