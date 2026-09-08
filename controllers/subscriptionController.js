'use strict';
const subscriptionService = require('../services/subscriptionService');

class SubscriptionController {
    async createSubscription(req, res, next) {
        try {
            const subscription = await subscriptionService.createSubscription({
                ...req.body,
                userId: req.user.id
            });
            res.status(201).json({ success: true, data: subscription, message: 'Subscription created successfully' });
        } catch (err) {
            next(err);
        }
    }

    async getMySubscriptions(req, res, next) {
        try {
            const subscriptions = await subscriptionService.getSubscriptionsByUser(req.user.id);
            res.json({ success: true, data: subscriptions });
        } catch (err) {
            next(err);
        }
    }

    async updateStatus(req, res, next) {
        try {
            const { status } = req.body;
            const subscription = await subscriptionService.updateSubscriptionStatus(req.params.id, status);
            res.json({ success: true, data: subscription, message: 'Subscription status updated' });
        } catch (err) {
            next(err);
        }
    }

    async deleteSubscription(req, res, next) {
        try {
            const result = await subscriptionService.deleteSubscription(req.params.id);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new SubscriptionController();
