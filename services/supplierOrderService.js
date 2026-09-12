'use strict';
const { SupplierOrder } = require('../models');

const computePlatformFeeSnapshot = order => {
  const explicit = Number(order?.platformFee ?? order?.platform_fee);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  // Only recompute if the order explicitly carries the flag as true
  // — never fall back to the supplier's current settings.
  const enabled =
    order?.platformFeeEnabled === true ||
    order?.platform_fee_enabled === true;
  if (!enabled) return 0;
  const rawType = order?.platformFeeType ?? order?.platform_fee_type;
  const type = rawType === 'flat' ? 'flat' : 'percentage';
  const value = Number(order?.platformFeeValue ?? order?.platform_fee_value ?? 0);
  if (!value || value <= 0) return 0;
  const itemsTotal = Array.isArray(order?.items)
    ? order.items.reduce(
        (n, it) =>
          n + (Number(it.price) || 0) * (Number(it.qty) || 0),
        0
      )
    : Number(order?.itemsTotal) || 0;
  return type === 'percentage' ? (itemsTotal * value) / 100 : value;
};

class SupplierOrderService {
    async getOrders(userId) {
        const record = await SupplierOrder.findOne({ where: { userId } });
        return record ? record.orders || [] : [];
    }
    async saveOrders(userId, orders) {
        if (!Array.isArray(orders)) {
            const err = new Error('orders must be an array');
            err.status = 400;
            throw err;
        }
        const normalized = orders.map(o => {
            const platformFee = computePlatformFeeSnapshot(o);
            const platformFeeEnabled = platformFee > 0;
            const rawType = o.platformFeeType ?? o.platform_fee_type;
            const platformFeeType = rawType === 'flat' ? 'flat' : 'percentage';
            const platformFeeValue = Number(
                o.platformFeeValue ?? o.platform_fee_value ?? 0
            );
            const shippingAmount = Number(
                o.shippingAmount ?? o.shipping ?? o.shippingCost ?? 0
            );
            const canDeposit = Number(o.canDeposit) || 0;
            const itemsTotal = Array.isArray(o.items)
                ? o.items.reduce(
                      (n, it) =>
                        n + (Number(it.price) || 0) * (Number(it.qty) || 0),
                      0
                  )
                : Number(o.itemsTotal) || 0;
            const total =
                Number(o.total) ||
                itemsTotal + shippingAmount + canDeposit + platformFee;
            return {
                ...o,
                itemsTotal,
                shippingAmount,
                canDeposit,
                platformFeeEnabled,
                platformFeeType,
                platformFeeValue,
                platformFee,
                total,
            };
        });
        let record = await SupplierOrder.findOne({ where: { userId } });
        if (!record) {
            record = await SupplierOrder.create({ userId, orders: normalized });
        } else {
            record.orders = normalized;
            record.changed('orders', true);
            await record.save();
        }
        return normalized;
    }
}
module.exports = new SupplierOrderService();
