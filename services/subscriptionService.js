'use strict';
const { Subscription } = require('../models');

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

    return {
        id: j.id,
        orderId: j.orderId || null,
        supplierId: j.supplierId || null,
        productId: j.productId || null,
        productName: j.productName || details.variantName || '',
        variantName: details.variantName || j.productName || '',
        supplier: details.supplier || '',
        image: details.image || null,
        categoryIcon: details.categoryIcon || '💧',
        frequency: j.frequency,
        customDays: details.customDays || 0,
        qty: j.quantity,
        price: Number(j.price) || 0,
        status,
        nextDeliveryOn: toIsoDate(j.nextDeliveryDate) || details.startedOn || toIsoDate(new Date()),
        startedOn: details.startedOn || toIsoDate(j.createdAt) || toIsoDate(new Date()),
        addressId: details.addressId || '',
        paymentMethod: details.paymentMethod || 'COD',
        timeSlot: details.timeSlot || '',
        depositPerDelivery: Number(details.depositPerDelivery) || 0,
        deliveriesDone: Number(details.deliveriesDone) || 0,
        history: Array.isArray(details.history) ? details.history : [],
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

        const subscription = await Subscription.create({
            userId,
            orderId: orderId || null,
            supplierId: supplierId || null,
            productId: productId || null,
            productName: productName || variantName || null,
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
        if (patch.customDays !== undefined) details.customDays = Number(patch.customDays) || 0;
        if (patch.timeSlot !== undefined) details.timeSlot = patch.timeSlot;
        if (patch.addressId !== undefined) details.addressId = patch.addressId;
        if (patch.paymentMethod !== undefined) details.paymentMethod = patch.paymentMethod;

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
        const subscription = await Subscription.findOne({ where: { id, userId } });
        if (!subscription) {
            const err = new Error('Subscription not found');
            err.status = 404;
            throw err;
        }
        const details = { ...(subscription.details || {}) };
        details.deliveriesDone = (Number(details.deliveriesDone) || 0) + 1;
        details.history = [
            {
                date: toIsoDate(new Date()),
                qty: subscription.quantity,
                amount: Number(subscription.price) * Number(subscription.quantity),
                status: 'Delivered'
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
