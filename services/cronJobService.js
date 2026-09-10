'use strict';
const { Op } = require('sequelize');
const { Subscription, CustomerOrder, SupplierOrder, Setting, User, CronJobLog } = require('../models');
let cron;
try {
    cron = require('node-cron');
} catch (e) {
    cron = null;
}
let scheduledTask = null;
const DEFAULT_CONFIG = {
    scheduleType: 'interval',
    intervalHours: parseInt(process.env.CRON_INTERVAL_HOURS) || 2,
    runTime: process.env.CRON_RUN_TIME || '00:00',
    enabled: process.env.CRON_DISABLED ? false : true
};
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
async function getCronConfig() {
    try {
        const setting = await Setting.findOne({ where: { key: 'cron_job_config' } });
        if (setting && setting.value) {
            return { ...DEFAULT_CONFIG, ...setting.value };
        }
    } catch (err) {
        console.error('Failed to read cron config from DB:', err.message);
    }
    return { ...DEFAULT_CONFIG };
}
async function saveCronConfig(config) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const setting = await Setting.findOne({ where: { key: 'cron_job_config' } });
    if (setting) {
        setting.value = merged;
        await setting.save();
    } else {
        await Setting.create({ key: 'cron_job_config', value: merged });
    }
    await rescheduleJob();
    return merged;
}
function buildCronExpression(config) {
    if (config.scheduleType === 'specificTime') {
        const [hours, minutes] = (config.runTime || '00:00').split(':');
        return `${parseInt(minutes) || 0} ${parseInt(hours) || 0} * * *`;
    }
    const hours = Math.max(1, Number(config.intervalHours) || 2);
    return `0 */${hours} * * *`;
}
async function rescheduleJob() {
    if (scheduledTask) {
        scheduledTask.destroy();
        scheduledTask = null;
    }
    if (!cron) {
        console.warn('node-cron is not installed. Cron job scheduling is disabled.');
        return;
    }
    const config = await getCronConfig();
    if (!config.enabled) {
        console.log('Cron job is disabled by config.');
        return;
    }
    const expression = buildCronExpression(config);
    if (!cron.validate(expression)) {
        console.warn(`Invalid cron expression: ${expression}`);
        return;
    }
    scheduledTask = cron.schedule(expression, async () => {
        try {
            console.log('Cron job triggered:', new Date().toISOString());
            await runSubscriptionJob();
        } catch (err) {
            console.error('Cron job execution error:', err.message);
        }
    });
    console.log(`Cron job scheduled: "${expression}" (config: ${JSON.stringify(config)})`);
}
async function initCronJob() {
    await rescheduleJob();
}
async function runSubscriptionJob() {
    const startedAt = new Date();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors = [];
    const successes = [];
    const log = await CronJobLog.create({
        jobName: 'subscription_order_generator',
        status: 'running',
        processed: 0,
        succeeded: 0,
        failed: 0,
        startedAt,
        details: { errors: [], successes: [] }
    });
    try {
        const subscriptions = await Subscription.findAll({
            where: {
                status: 'active',
                nextDeliveryDate: { [Op.lte]: new Date() }
            },
            include: [{ model: User, as: 'user' }]
        });
        for (const sub of subscriptions) {
            processed++;
            try {
                await processSubscription(sub);
                succeeded++;
                successes.push({ subscriptionId: sub.id, status: 'success' });
            } catch (err) {
                failed++;
                errors.push({ subscriptionId: sub.id, error: err.message });
                console.error(`Failed to process subscription ${sub.id}:`, err.message);
            }
        }
        log.status = failed === 0 ? 'success' : (succeeded > 0 ? 'partial' : 'failed');
        log.processed = processed;
        log.succeeded = succeeded;
        log.failed = failed;
        log.completedAt = new Date();
        log.details = { errors, successes };
        log.changed('details', true);
        await log.save();
    } catch (err) {
        log.status = 'failed';
        log.processed = processed;
        log.succeeded = succeeded;
        log.failed = failed;
        log.completedAt = new Date();
        log.details = { errors: [{ subscriptionId: null, error: err.message }], successes };
        log.changed('details', true);
        await log.save();
        throw err;
    }
    console.log(`Cron job completed — Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}`);
    return log;
}
async function processSubscription(subscription) {
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
        const err = new Error('No source order found for subscription');
        err.status = 404;
        throw err;
    }
    const sourceSubs = sourceOrder.subOrders || [];
    if (sourceSubs.length === 0) {
        const err = new Error('Source order has no sub-orders');
        err.status = 404;
        throw err;
    }
    const newSubOrders = sourceSubs.map(s => ({
        ...s,
        id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        status: 'Placed',
        placedAt: new Date().toISOString(),
        timeline: [{ status: 'Placed', time: new Date().toISOString(), by: 'Subscription cron' }]
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
            statusHistory: [{ status: 'Pending', time: new Date().toISOString(), by: 'Subscription cron' }]
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
    }
    const details = { ...(subscription.details || {}) };
    const customDays = details.customDays || 0;
    subscription.nextDeliveryDate = calcNextDelivery(subscription.frequency, customDays);
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
    await subscription.save();
}
async function getLogs(limit = 50) {
    return await CronJobLog.findAll({
        order: [['created_at', 'DESC']],
        limit: Math.min(Math.max(1, Number(limit) || 50), 200)
    });
}
module.exports = {
    initCronJob,
    runSubscriptionJob,
    getCronConfig,
    saveCronConfig,
    getLogs,
    rescheduleJob
};
