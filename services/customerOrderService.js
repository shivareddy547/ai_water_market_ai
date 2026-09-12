'use strict';
const { CustomerOrder } = require('../models');
class CustomerOrderService {
    async createOrder(userId, data) {
        const { subOrders = [], paymentMethod } = data || {};
        if (!Array.isArray(subOrders) || subOrders.length === 0) {
            const err = new Error('At least one sub-order is required');
            err.status = 400;
            throw err;
        }
        const normalizedSubOrders = subOrders.map(so => {
            const itemsTotal = Number(so.itemsTotal) || 0;
            const depositTotal = Number(so.depositTotal) || 0;
            const shipping = Number(so.shipping) || 0;
            const platformFeeEnabled = !!so.platformFeeEnabled;
            const platformFeeType = so.platformFeeType === 'flat' ? 'flat' : 'percentage';
            const platformFeeValue = Number(so.platformFeeValue) || 0;
            const computedFee = platformFeeEnabled && platformFeeValue > 0
                ? (platformFeeType === 'percentage'
                    ? (itemsTotal * platformFeeValue) / 100
                    : platformFeeValue)
                : 0;
            const incomingFee = Number(so.platformFee);
            const platformFee = Number.isFinite(incomingFee) && incomingFee > 0
                ? incomingFee
                : computedFee;
            const grandTotal = itemsTotal + depositTotal + shipping + platformFee;
            return {
                ...so,
                itemsTotal,
                depositTotal,
                shipping,
                platformFeeEnabled: platformFeeEnabled && platformFee > 0,
                platformFeeType,
                platformFeeValue,
                platformFee,
                grandTotal,
            };
        });
        const totalAmount = normalizedSubOrders.reduce(
            (n, so) => n + (Number(so.grandTotal) || 0),
            0
        );
        const orderNumber = `ORD-${Date.now().toString().slice(-8)}${Math.floor(
            Math.random() * 90 + 10
        )}`;
        return await CustomerOrder.create({
            userId,
            orderNumber,
            subOrders: normalizedSubOrders,
            totalAmount,
            paymentMethod: paymentMethod || 'COD',
            status: 'Placed',
        });
    }
    async getUserOrders(userId) {
        return await CustomerOrder.findAll({
            where: { userId },
            order: [['created_at', 'DESC']],
        });
    }
    async getOrderById(id, userId) {
        const order = await CustomerOrder.findOne({ where: { id, userId } });
        if (!order) {
            const err = new Error('Order not found');
            err.status = 404;
            throw err;
        }
        return order;
    }
}
module.exports = new CustomerOrderService();
