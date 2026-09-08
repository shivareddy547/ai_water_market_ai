'use strict';
const subscriptionService = require('../services/subscriptionService');

class SubscriptionController {
    async createSubscription(req, res, next) {
        try {
            const subscription = await subscriptionService.createSubscription({
                ...req.body,
                userId: req.user.id
            });
            res.status(201).json({
                success: true,
                data: subscription,
                message: 'Subscription created successfully'
            });
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

    async update(req, res, next) {
        try {
            const subscription = await subscriptionService.updateSubscription(
                req.params.id,
                req.user.id,
                req.body
            );
            res.json({ success: true, data: subscription, message: 'Subscription updated' });
        } catch (err) {
            next(err);
        }
    }

    async updateStatus(req, res, next) {
        try {
            const { status } = req.body;
            const subscription = await subscriptionService.updateSubscriptionStatus(
                req.params.id,
                status,
                req.user.id
            );
            res.json({ success: true, data: subscription, message: 'Subscription status updated' });
        } catch (err) {
            next(err);
        }
    }

    async pause(req, res, next) {
        try {
            const subscription = await subscriptionService.pause(req.params.id, req.user.id);
            res.json({ success: true, data: subscription, message: 'Subscription paused' });
        } catch (err) {
            next(err);
        }
    }

    async resume(req, res, next) {
        try {
            const subscription = await subscriptionService.resume(req.params.id, req.user.id);
            res.json({ success: true, data: subscription, message: 'Subscription resumed' });
        } catch (err) {
            next(err);
        }
    }

    async cancel(req, res, next) {
        try {
            const subscription = await subscriptionService.cancel(req.params.id, req.user.id);
            res.json({ success: true, data: subscription, message: 'Subscription cancelled' });
        } catch (err) {
            next(err);
        }
    }

    async skipNext(req, res, next) {
        try {
            const subscription = await subscriptionService.skipNext(req.params.id, req.user.id);
            res.json({ success: true, data: subscription, message: 'Next delivery skipped' });
        } catch (err) {
            next(err);
        }
    }

    async deliverNow(req, res, next) {
        try {
            const subscription = await subscriptionService.deliverNow(req.params.id, req.user.id);
            res.json({ success: true, data: subscription, message: 'Delivery scheduled' });
        } catch (err) {
            next(err);
        }
    }

    async deleteSubscription(req, res, next) {
        try {
            const result = await subscriptionService.deleteSubscription(req.params.id, req.user.id);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new SubscriptionController();
