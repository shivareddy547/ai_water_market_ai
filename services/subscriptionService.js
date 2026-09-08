'use strict';
const { Subscription } = require('../models');

class SubscriptionService {
    async createSubscription(data) {
        const { userId, orderId, supplierId, productId, productName, frequency, quantity, price } = data;
        
        if (!userId || !frequency) {
            const err = new Error('User ID and frequency are required');
            err.status = 400;
            throw err;
        }

        const nextDeliveryDate = new Date();
        if (frequency === 'Daily') nextDeliveryDate.setDate(nextDeliveryDate.getDate() + 1);
        else if (frequency === 'Alternate Days') nextDeliveryDate.setDate(nextDeliveryDate.getDate() + 2);
        else if (frequency === 'Weekly') nextDeliveryDate.setDate(nextDeliveryDate.getDate() + 7);
        else if (frequency === 'Monthly') nextDeliveryDate.setMonth(nextDeliveryDate.getMonth() + 1);
        else nextDeliveryDate.setDate(nextDeliveryDate.getDate() + 3); 

        const subscription = await Subscription.create({
            userId,
            orderId: orderId || null,
            supplierId: supplierId || null,
            productId: productId || null,
            productName: productName || null,
            frequency,
            quantity: quantity || 1,
            price: price || 0,
            status: 'Active',
            nextDeliveryDate
        });

        return subscription;
    }

    async getSubscriptionsByUser(userId) {
        return await Subscription.findAll({
            where: { userId },
            order: [['created_at', 'DESC']]
        });
    }

    async updateSubscriptionStatus(id, status) {
        const subscription = await Subscription.findByPk(id);
        if (!subscription) {
            const err = new Error('Subscription not found');
            err.status = 404;
            throw err;
        }
        subscription.status = status;
        await subscription.save();
        return subscription;
    }

    async deleteSubscription(id) {
        const subscription = await Subscription.findByPk(id);
        if (!subscription) {
            const err = new Error('Subscription not found');
            err.status = 404;
            throw err;
        }
        await subscription.destroy();
        return { message: 'Subscription deleted successfully' };
    }
}

module.exports = new SubscriptionService();
