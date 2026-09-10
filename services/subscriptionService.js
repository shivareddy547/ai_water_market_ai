'use strict';
const { Op } = require('sequelize');
const { Subscription, User, CustomerOrder, SupplierOrder, Notification } = require('../models');
function calcNextDelivery(frequency, customDays) {
    const d = new Date();
    const f = (frequency || '').toLowerCase();
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
function toIsoDate(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().split('T')[0];
}
function mapSubscription(row) {
    const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const details = j.details || {};
    const statusRaw = (j.status || 'active').toString().toLowerCase();
    const status =
        statusRaw === 'active' || statusRaw === 'paused' || statusRaw === 'cancelled'
            ? statusRaw
            : 'active';
    const variantName =
        j.variantName ||
        j.variant_name ||
        details.variantName ||
        j.productName ||
        j.product_name ||
        '';
    const supplier = j.supplier || details.supplier || '';
    const image = j.image || details.image || null;
    const categoryIcon =
        j.categoryIcon || j.category_icon || details.categoryIcon || '💧';
    const timeSlot = j.timeSlot || j.time_slot || details.timeSlot || '';
    const addressId = j.addressId || j.address_id || details.addressId || '';
    const paymentMethod =
        j.paymentMethod || j.payment_method || details.paymentMethod || 'COD';
    const depositPerDelivery = Number(
        j.depositPerDelivery != null
            ? j.depositPerDelivery
            : j.deposit_per_delivery != null
            ? j.deposit_per_delivery
            : details.depositPerDelivery || 0
    );
    const deliveriesDone = Number(
        j.deliveriesDone != null
            ? j.deliveriesDone
            : j.deliveries_done != null
            ? j.deliveries_done
            : details.deliveriesDone || 0
    );
    const startedOn =
        toIsoDate(j.startedOn || j.started_on) ||
        details.startedOn ||
        toIsoDate(j.createdAt) ||
        toIsoDate(new Date());
    const history = Array.isArray(j.history)
        ? j.history
        : Array.isArray(details.history)
        ? details.history
        : [];
    return {
        id: j.id,
        orderId: j.orderId || j.order_id || null,
        supplierId: j.supplierId || j.supplier_id || null,
        productId: j.productId || j.product_id || null,
        productName: j.productName || j.product_name || variantName || '',
        variantName,
        supplier,
        image,
        categoryIcon,
        frequency: j.frequency,
        customDays: Number(details.customDays) || 0,
        qty: Number(j.quantity) || 1,
        price: Number(j.price) || 0,
        status,
        nextDeliveryOn:
            toIsoDate(j.nextDeliveryDate || j.next_delivery_date) ||
            startedOn ||
            toIsoDate(new Date()),
        startedOn,
        addressId: addressId ? String(addressId) : '',
        paymentMethod,
        timeSlot,
        depositPerDelivery,
        deliveriesDone,
        history,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt
    };
}
class SubscriptionService {
    async createSubscription(data) {
        const {
            userId,
            orderId,
            supplierId,
            productId,
            productName,
            frequency,
            quantity,
            price,
            variantName,
            supplier,
            image,
            categoryIcon,
            addressId,
            paymentMethod,
            timeSlot,
            depositPerDelivery,
            customDays
        } = data;
        if (!userId || !frequency) {
            const err = new Error('User ID and frequency are required');
            err.status = 400;
            throw err;
        }
        const nextDeliveryDate = calcNextDelivery(frequency, customDays);
        const startedOn = new Date().toISOString().split('T')[0];
        const name = productName || variantName || null;
        const subscription = await Subscription.create({
            userId,
            orderId: orderId || null,
            supplierId: supplierId || null,
            productId: productId || null,
            productName: name,
            frequency,
            quantity: quantity || 1,
            price: price != null ? price : 0,
            status: 'active',
            nextDeliveryDate,
            details: {
                variantName: variantName || productName || '',
                supplier: supplier || '',
                image: image || null,
                categoryIcon: categoryIcon || '💧',
                addressId: addressId || '',
                paymentMethod: paymentMethod || 'COD',
                timeSlot: timeSlot || '',
                depositPerDelivery: Number(depositPerDelivery) || 0,
                deliveriesDone: 0,
                customDays: Number(customDays) || 0,
                startedOn,
                history: []
            }
        });
        return mapSubscription(subscription);
    }
    async getSubscriptionsByUser(userId) {
        const rows = await Subscription.findAll({
            where: { userId },
            order: [['created_at', 'DESC']]
        });
        return rows.map(mapSubscription);
    }
    async getAllSubscriptionsForAdmin(filters = {}) {
        const where = {};
        const include = [];
        if (filters.status && filters.status !== 'all') {
            where.status = filters.status;
        }
        if (filters.subscriptionId) {
            where.id = filters.subscriptionId;
        }
        if (filters.subscriptionName) {
            where.productName = { [Op.iLike]: `%${filters.subscriptionName}%` };
        }
        if (filters.startDate && filters.endDate) {
            where.createdAt = {
                [Op.between]: [
                    new Date(filters.startDate + 'T00:00:00'),
                    new Date(filters.endDate + 'T23:59:59')
                ]
            };
        } else if (filters.startDate) {
            where.createdAt = { [Op.gte]: new Date(filters.startDate + 'T00:00:00') };
        } else if (filters.endDate) {
            where.createdAt = { [Op.lte]: new Date(filters.endDate + 'T23:59:59') };
        }
        const userInclude = {
            model: User,
            as: 'user',
            required: false
        };
        if (filters.customer) {
            userInclude.where = {
                [Op.or]: [
                    { first_name: { [Op.iLike]: `%${filters.customer}%` } },
                    { last_name: { [Op.iLike]: `%${filters.customer}%` } }
                ]
            };
            userInclude.required = true;
        }
        include.push(userInclude);
        const supplierInclude = {
            model: User,
            as: 'supplier',
            required: false
        };
        if (filters.supplier) {
            supplierInclude.where = {
                [Op.or]: [
                    { first_name: { [Op.iLike]: `%${filters.supplier}%` } },
                    { last_name: { [Op.iLike]: `%${filters.supplier}%` } },
                    { store_name: { [Op.iLike]: `%${filters.supplier}%` } }
                ]
            };
            supplierInclude.required = true;
        }
        include.push(supplierInclude);
        const rows = await Subscription.findAll({
            where,
            include,
            order: [['created_at', 'DESC']]
        });
        return rows.map(row => {
            const mapped = mapSubscription(row);
            const userData = row.user;
            const supplierData = row.supplier;
            const userFirst = userData ? (userData.firstName || userData.first_name || '') : '';
            const userLast = userData ? (userData.lastName || userData.last_name || '') : '';
            const supplierStore = supplierData ? (supplierData.storeName || supplierData.store_name || '') : '';
            const supplierFirst = supplierData ? (supplierData.firstName || supplierData.first_name || '') : '';
            const supplierLast = supplierData ? (supplierData.lastName || supplierData.last_name || '') : '';
            mapped.customerName = `${userFirst} ${userLast}`.trim() || 'Unknown';
            mapped.customerEmail = userData ? (userData.email || '') : '';
            mapped.customerPhone = userData ? (userData.phone || '') : '';
            mapped.supplierName = supplierStore || `${supplierFirst} ${supplierLast}`.trim() || mapped.supplier || 'Unknown';
            return mapped;
        });
    }
    async updateSubscriptionStatus(id, status, userId) {
        const where = userId ? { id, userId } : { id };
        const subscription = await Subscription.findOne({ where });
        if (!subscription) {
            const err = new Error('Subscription not found');
            err.status = 404;
            throw err;
        }
        subscription.status = String(status || '').toLowerCase();
        await subscription.save();
        return mapSubscription(subscription);
    }
    async updateSubscription(id, userId, patch) {
        const subscription = await Subscription.findOne({ where: { id, userId } });
        if (!subscription) {
            const err = new Error('Subscription not found');
            err.status = 404;
            throw err;
        }
        const details = { ...(subscription.details || {}) };
        if (patch.frequency !== undefined) subscription.frequency = patch.frequency;
        if (patch.qty !== undefined) subscription.quantity = patch.qty;
        if (patch.quantity !== undefined) subscription.quantity = patch.quantity;
        if (patch.price !== undefined) subscription.price = patch.price;
        if (patch.customDays !== undefined)
            details.customDays = Number(patch.customDays) || 0;
        if (patch.timeSlot !== undefined) details.timeSlot = patch.timeSlot;
        if (patch.addressId !== undefined) details.addressId = patch.addressId;
        if (patch.paymentMethod !== undefined)
            details.paymentMethod = patch.paymentMethod;
        subscription.details = details;
        subscription.changed('details', true);
        if (patch.frequency !== undefined || patch.customDays !== undefined) {
            subscription.nextDeliveryDate = calcNextDelivery(
                subscription.frequency,
                details.customDays
            );
        }
        await subscription.save();
        return mapSubscription(subscription);
    }
    async deleteSubscription(id, userId) {
        const where = userId ? { id, userId } : { id };
        const subscription = await Subscription.findOne({ where });
        if (!subscription) {
            const err = new Error('Subscription not found');
            err.status = 404;
            throw err;
        }
        await subscription.destroy();
        return { message: 'Subscription deleted successfully' };
    }
    async pause(id, userId) {
        return this.updateSubscriptionStatus(id, 'paused', userId);
    }
    async resume(id, userId) {
        return this.updateSubscriptionStatus(id, 'active', userId);
    }
    async cancel(id, userId) {
        return this.updateSubscriptionStatus(id, 'cancelled', userId);
    }
    async skipNext(id, userId) {
        const subscription = await Subscription.findOne({ where: { id, userId } });
        if (!subscription) {
            const err = new Error('Subscription not found');
            err.status = 404;
            throw err;
        }
        const details = { ...(subscription.details || {}) };
        const customDays = details.customDays || 0;
        const base = subscription.nextDeliveryDate
            ? new Date(subscription.nextDeliveryDate)
            : new Date();
        const f = (subscription.frequency || '').toLowerCase();
        let days = 1;
        if (f === 'alternate days') days = 2;
        else if (f === 'weekly') days = 7;
        else if (f === 'monthly') days = 30;
        else if (f === 'custom days') days = Math.max(1, Number(customDays) || 3);
        base.setDate(base.getDate() + days);
        subscription.nextDeliveryDate = base;
        details.history = [
            {
                date: toIsoDate(new Date()),
                qty: subscription.quantity,
                amount: 0,
                status: 'Skipped'
            },
            ...(Array.isArray(details.history) ? details.history : [])
        ];
        subscription.details = details;
        subscription.changed('details', true);
        await subscription.save();
        return mapSubscription(subscription);
    }
    async deliverNow(id, userId) {
        const subscription = await Subscription.findOne({
            where: { id, userId },
            include: [{ model: User, as: 'user' }]
        });
        if (!subscription) {
            const err = new Error('Subscription not found');
            err.status = 404;
            throw err;
        }
        let sourceOrder = null;
        if (subscription.orderId) {
            sourceOrder = await CustomerOrder.findByPk(subscription.orderId);
        }
        if (!sourceOrder) {
            sourceOrder = await CustomerOrder.findOne({
                where: { userId: subscription.userId },
                order: [['created_at', 'DESC']]
            });
        }
        if (!sourceOrder) {
            const err = new Error('No source order found for subscription to create delivery');
            err.status = 404;
            throw err;
        }
        const sourceSubs = sourceOrder.subOrders || [];
        if (sourceSubs.length === 0) {
            const err = new Error('Source order has no sub-orders to create delivery');
            err.status = 404;
            throw err;
        }
        const newSubOrders = sourceSubs.map(s => ({
            ...s,
            id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            status: 'Placed',
            placedAt: new Date().toISOString(),
            timeline: [{ status: 'Placed', time: new Date().toISOString(), by: 'Manual Delivery' }]
        }));
        const totalAmount = newSubOrders.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
        const orderCount = await CustomerOrder.count();
        const orderNumber = `SUB-${Date.now()}-${orderCount + 1}`;
        const newOrder = await CustomerOrder.create({
            userId: subscription.userId,
            orderNumber,
            subOrders: newSubOrders,
            totalAmount,
            paymentMethod: sourceOrder.paymentMethod,
            status: 'Placed'
        });
        const user = subscription.user;
        const userFirst = user ? (user.firstName || user.first_name || '') : '';
        const userLast = user ? (user.lastName || user.last_name || '') : '';
        const customerName = `${userFirst} ${userLast}`.trim() || 'Customer';
        const notifiedSuppliers = new Set();
        for (const subOrder of newSubOrders) {
            const supplierId = subOrder.supplierId || subscription.supplierId;
            if (!supplierId) continue;
            const supplierEntry = {
                id: subOrder.id,
                customer: customerName,
                phone: subOrder.address?.phone || '',
                address: subOrder.address
                    ? `${subOrder.address.line || ''}${subOrder.address.landmark ? ', ' + subOrder.address.landmark : ''}, ${subOrder.address.city || ''} - ${subOrder.address.pincode || ''}`
                    : '',
                area: subOrder.address?.city || '',
                items: (subOrder.lines || []).map(l => ({ name: l.name, qty: l.qty, price: l.price })),
                total: subOrder.grandTotal || 0,
                paymentMode: subOrder.paymentMethod || sourceOrder.paymentMethod,
                paymentStatus: (subOrder.paymentMethod || sourceOrder.paymentMethod) === 'COD' ? 'Pending' : 'Paid',
                isSubscription: true,
                subscriptionId: subscription.id,
                collectEmptyCan: Number(subOrder.depositTotal || 0) > 0,
                canDeposit: subOrder.depositTotal || 0,
                slot: 'Today',
                priority: 'normal',
                status: 'Pending',
                deliveryPersonId: null,
                assignedAt: '',
                acceptedAt: '',
                startedAt: '',
                deliveredAt: '',
                createdAt: new Date().toISOString(),
                statusHistory: [{ status: 'Pending', time: new Date().toISOString(), by: 'Manual Delivery' }]
            };
            let supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (supplierOrder) {
                const orders = supplierOrder.orders || [];
                orders.unshift(supplierEntry);
                supplierOrder.orders = orders;
                supplierOrder.changed('orders', true);
                await supplierOrder.save();
            } else {
                await SupplierOrder.create({
                    userId: supplierId,
                    orders: [supplierEntry]
                });
            }
            if (!notifiedSuppliers.has(supplierId)) {
                notifiedSuppliers.add(supplierId);
                await Notification.create({
                    userId: supplierId,
                    type: 'subscription_order',
                    title: 'New Subscription Order',
                    message: `A new order #${orderNumber} has been generated from a subscription by ${customerName}.`,
                    link: '/supplier/orders',
                    isRead: false
                });
            }
        }
        // Self notification to customer
        await Notification.create({
            userId: subscription.userId,
            type: 'subscription_delivery',
            title: 'Subscription Delivery Scheduled',
            message: `Your subscription order #${orderNumber} has been processed and will be delivered according to the supplier's availability.`,
            link: '/customer/orders',
            isRead: false
        });
        const details = { ...(subscription.details || {}) };
        details.deliveriesDone = (Number(details.deliveriesDone) || 0) + 1;
        details.history = [
            {
                date: toIsoDate(new Date()),
                qty: subscription.quantity,
                amount: Number(subscription.price) * Number(subscription.quantity),
                status: 'Order Created',
                orderId: newOrder.id
            },
            ...(Array.isArray(details.history) ? details.history : [])
        ];
        subscription.details = details;
        subscription.changed('details', true);
        subscription.nextDeliveryDate = calcNextDelivery(
            subscription.frequency,
            details.customDays
        );
        await subscription.save();
        return mapSubscription(subscription);
    }
}
module.exports = new SubscriptionService();
