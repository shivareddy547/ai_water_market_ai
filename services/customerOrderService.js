'use strict';
const { CustomerOrder, SupplierOrder, User } = require('../models');

const nowIso = () => new Date().toISOString();

const buildSupplierOrderEntry = (so, order, customerName) => {
  const items = Array.isArray(so.lines)
    ? so.lines.map(l => ({
        name: l.name,
        qty: Number(l.qty) || 0,
        price: Number(l.price) || 0,
        image: l.image || null,
        sku: l.sku || null,
        categoryIcon: l.categoryIcon || '💧',
        isSubscription: !!l.isSubscription,
        frequency: l.frequency || null,
      }))
    : [];
  const platformFee = Number(so.platformFee) || 0;
  const platformFeeEnabled = !!so.platformFeeEnabled && platformFee > 0;
  const platformFeeType = so.platformFeeType === 'flat' ? 'flat' : 'percentage';
  const platformFeeValue = Number(so.platformFeeValue) || 0;
  const address = so.address || {};
  const addressLine =
    `${address.line || ''}` +
    `${address.landmark ? `, ${address.landmark}` : ''}` +
    `, ${address.city || ''} - ${address.pincode || ''}`;
  return {
    id: so.id || `ORD-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    customer: customerName,
    phone: address.phone || '',
    address: addressLine,
    area: address.city || '',
    items,
    itemsTotal: Number(so.itemsTotal) || 0,
    shippingAmount: Number(so.shipping) || 0,
    canDeposit: Number(so.depositTotal) || 0,
    platformFeeEnabled,
    platformFeeType,
    platformFeeValue,
    platformFee,
    total: Number(so.grandTotal) || 0,
    paymentMode:
      order.paymentMethod === 'Card'
        ? 'UPI'
        : order.paymentMethod || 'COD',
    paymentStatus: order.paymentMethod === 'COD' ? 'Pending' : 'Paid',
    isSubscription: items.some(i => i.isSubscription),
    collectEmptyCan: (Number(so.depositTotal) || 0) > 0,
    slot: 'Today',
    priority: 'normal',
    status: 'Pending',
    deliveryPersonId: null,
    assignedAt: '',
    acceptedAt: '',
    startedAt: '',
    deliveredAt: '',
    createdAt: nowIso(),
    statusHistory: [{ status: 'Pending', time: nowIso(), by: 'Customer order' }],
  };
};

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
            const platformFeeEnabled = so.platformFeeEnabled === true;
            const platformFeeType = so.platformFeeType === 'flat' ? 'flat' : 'percentage';
            const platformFeeValue = Number(so.platformFeeValue) || 0;
            const computedFee =
                platformFeeEnabled && platformFeeValue > 0
                    ? platformFeeType === 'percentage'
                        ? (itemsTotal * platformFeeValue) / 100
                        : platformFeeValue
                    : 0;
            const incomingFee = Number(so.platformFee);
            const platformFee =
                Number.isFinite(incomingFee) && incomingFee > 0
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
        const order = await CustomerOrder.create({
            userId,
            orderNumber,
            subOrders: normalizedSubOrders,
            totalAmount,
            paymentMethod: paymentMethod || 'COD',
            status: 'Placed',
        });

        // Sync each sub-order into the respective supplier's order list
        // so the supplier page reads the *snapshot* — including the
        // platform fee as it was at the time of the order.
        try {
            const customer = await User.findByPk(userId);
            const customerName = customer
                ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
                  'Customer'
                : 'Customer';
            for (const so of normalizedSubOrders) {
                if (!so.supplierId) continue;
                const entry = buildSupplierOrderEntry(so, order, customerName);
                const record = await SupplierOrder.findOne({
                    where: { userId: so.supplierId },
                });
                if (record) {
                    const existing = Array.isArray(record.orders) ? record.orders : [];
                    record.orders = [...existing, entry];
                    record.changed('orders', true);
                    await record.save();
                } else {
                    await SupplierOrder.create({
                        userId: so.supplierId,
                        orders: [entry],
                    });
                }
            }
        } catch (syncErr) {
            console.error('Failed to sync sub-orders to suppliers', syncErr.message);
        }

        return order;
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
