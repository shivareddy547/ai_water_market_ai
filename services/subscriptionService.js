'use strict';
const { Subscription, CustomerAddress } = require('../models');
const { Op } = require('sequelize');
// Helper date functions (matching frontend)
const toIso = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return toIso(d);
};
const intervalDays = (sub) => {
  if (sub.frequency === 'Daily') return 1;
  if (sub.frequency === 'Alternate Days') return 2;
  if (sub.frequency === 'Weekly') return 7;
  if (sub.frequency === 'Monthly') return 30;
  if (sub.frequency === 'Custom Days') return Math.max(1, Number(sub.customDays) || 3);
  return 1;
};
class SubscriptionService {
  async getSubscriptions(userId) {
    const subscriptions = await Subscription.findAll({
      where: { userId },
      order: [['created_at', 'DESC']]
    });
    return subscriptions.map(s => s.toJSON());
  }
  async getSubscriptionById(id, userId) {
    const subscription = await Subscription.findOne({ where: { id, userId } });
    if (!subscription) {
      const err = new Error('Subscription not found');
      err.status = 404;
      throw err;
    }
    return subscription;
  }
  async updateSubscription(id, userId, updates) {
    const subscription = await this.getSubscriptionById(id, userId);
    // Allowed fields to update
    const allowed = ['frequency', 'customDays', 'qty', 'timeSlot', 'addressId', 'paymentMethod'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        subscription[key] = updates[key];
      }
    }
    // If frequency or customDays changed, recalc nextDeliveryOn
    if (updates.frequency !== undefined || updates.customDays !== undefined) {
      const interval = intervalDays(subscription);
      subscription.nextDeliveryOn = addDays(subscription.nextDeliveryOn, interval);
    }
    await subscription.save();
    return subscription.toJSON();
  }
  async pauseSubscription(id, userId) {
    const subscription = await this.getSubscriptionById(id, userId);
    if (subscription.status === 'paused') {
      const err = new Error('Subscription is already paused');
      err.status = 400;
      throw err;
    }
    if (subscription.status === 'cancelled') {
      const err = new Error('Cannot pause a cancelled subscription');
      err.status = 400;
      throw err;
    }
    subscription.status = 'paused';
    await subscription.save();
    return subscription.toJSON();
  }
  async resumeSubscription(id, userId) {
    const subscription = await this.getSubscriptionById(id, userId);
    if (subscription.status !== 'paused') {
      const err = new Error('Subscription is not paused');
      err.status = 400;
      throw err;
    }
    subscription.status = 'active';
    await subscription.save();
    return subscription.toJSON();
  }
  async cancelSubscription(id, userId) {
    const subscription = await this.getSubscriptionById(id, userId);
    if (subscription.status === 'cancelled') {
      const err = new Error('Subscription is already cancelled');
      err.status = 400;
      throw err;
    }
    subscription.status = 'cancelled';
    await subscription.save();
    return subscription.toJSON();
  }
  async deliverNow(id, userId) {
    const subscription = await this.getSubscriptionById(id, userId);
    if (subscription.status !== 'active') {
      const err = new Error('Only active subscriptions can be delivered');
      err.status = 400;
      throw err;
    }
    const today = toIso(new Date());
    // Add to history
    const history = subscription.history || [];
    history.push({
      date: today,
      qty: subscription.qty,
      status: 'Delivered',
      amount: subscription.price * subscription.qty
    });
    subscription.history = history;
    subscription.deliveriesDone = subscription.deliveriesDone + 1;
    // Schedule next delivery (add interval)
    const interval = intervalDays(subscription);
    subscription.nextDeliveryOn = addDays(today, interval);
    await subscription.save();
    return subscription.toJSON();
  }
  async skipNextDelivery(id, userId) {
    const subscription = await this.getSubscriptionById(id, userId);
    if (subscription.status !== 'active') {
      const err = new Error('Only active subscriptions can be skipped');
      err.status = 400;
      throw err;
    }
    const interval = intervalDays(subscription);
    const currentNext = subscription.nextDeliveryOn;
    // Add skip to history
    const history = subscription.history || [];
    history.push({
      date: currentNext,
      qty: subscription.qty,
      status: 'Skipped',
      amount: 0
    });
    subscription.history = history;
    // Move next delivery by interval
    subscription.nextDeliveryOn = addDays(currentNext, interval);
    await subscription.save();
    return subscription.toJSON();
  }
}
module.exports = new SubscriptionService();
