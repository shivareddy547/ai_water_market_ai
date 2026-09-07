'use strict';
const subscriptionService = require('../services/subscriptionService');
class SubscriptionController {
  async getAll(req, res, next) {
    try {
      const subscriptions = await subscriptionService.getSubscriptions(req.user.id);
      res.json({ success: true, data: subscriptions });
    } catch (err) {
      next(err);
    }
  }
  async update(req, res, next) {
    try {
      const subscription = await subscriptionService.updateSubscription(req.params.id, req.user.id, req.body);
      res.json({ success: true, data: subscription, message: 'Subscription updated successfully' });
    } catch (err) {
      next(err);
    }
  }
  async pause(req, res, next) {
    try {
      const subscription = await subscriptionService.pauseSubscription(req.params.id, req.user.id);
      res.json({ success: true, data: subscription, message: 'Subscription paused' });
    } catch (err) {
      next(err);
    }
  }
  async resume(req, res, next) {
    try {
      const subscription = await subscriptionService.resumeSubscription(req.params.id, req.user.id);
      res.json({ success: true, data: subscription, message: 'Subscription resumed' });
    } catch (err) {
      next(err);
    }
  }
  async cancel(req, res, next) {
    try {
      const subscription = await subscriptionService.cancelSubscription(req.params.id, req.user.id);
      res.json({ success: true, data: subscription, message: 'Subscription cancelled' });
    } catch (err) {
      next(err);
    }
  }
  async deliverNow(req, res, next) {
    try {
      const subscription = await subscriptionService.deliverNow(req.params.id, req.user.id);
      res.json({ success: true, data: subscription, message: 'Delivery scheduled for today' });
    } catch (err) {
      next(err);
    }
  }
  async skipNext(req, res, next) {
    try {
      const subscription = await subscriptionService.skipNextDelivery(req.params.id, req.user.id);
      res.json({ success: true, data: subscription, message: 'Next delivery skipped' });
    } catch (err) {
      next(err);
    }
  }
}
module.exports = new SubscriptionController();
