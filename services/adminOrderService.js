'use strict';
const { SupplierOrder, User } = require('../models');
class AdminOrderService {
    async getAllSupplierOrders() {
        const supplierOrders = await SupplierOrder.findAll({
            include: [{
                model: User,
                as: 'user',
                attributes: [
                    'id', 'firstName', 'lastName', 'storeName', 'email', 'phone',
                    'commission', 'platformFeeEnabled', 'platformFeeType', 'platformFeeValue'
                ]
            }]
        });
        const allOrders = [];
        supplierOrders.forEach(so => {
            const orders = Array.isArray(so.orders) ? so.orders : [];
            const supplier = so.user;
            const supplierName = (supplier && supplier.storeName) ||
                `${(supplier && supplier.firstName) || ''} ${(supplier && supplier.lastName) || ''}`.trim() ||
                'Unknown Supplier';
            const commissionRate = (supplier && supplier.commission != null) ? supplier.commission : 10;
            const platformFeeEnabled = !!(supplier && supplier.platformFeeEnabled);
            const platformFeeType = (supplier && supplier.platformFeeType) || 'percentage';
            const platformFeeValue = Number((supplier && supplier.platformFeeValue) || 0);
            orders.forEach(order => {
                if (!order) return;
                const safeOrder = { ...order };
                safeOrder.supplierId = supplier ? supplier.id : null;
                safeOrder.supplierName = supplierName;
                safeOrder.commissionRate = order.commissionRate != null ? order.commissionRate : commissionRate;
                safeOrder.platformFeeEnabled = order.platformFeeEnabled != null ? order.platformFeeEnabled : platformFeeEnabled;
                safeOrder.platformFeeType = order.platformFeeType || platformFeeType;
                safeOrder.platformFeeValue = order.platformFeeValue != null ? order.platformFeeValue : platformFeeValue;
                allOrders.push(safeOrder);
            });
        });
        return allOrders;
    }
    async updateCommissionStatus(orderId, supplierId, commissionPaid) {
        if (!orderId || !supplierId) {
            const err = new Error('orderId and supplierId are required');
            err.status = 400;
            throw err;
        }
        const supplierOrder = await SupplierOrder.findOne({
            where: { user_id: supplierId }
        });
        if (!supplierOrder) {
            const err = new Error('Supplier order record not found');
            err.status = 404;
            throw err;
        }
        const orders = Array.isArray(supplierOrder.orders) ? supplierOrder.orders : [];
        const idx = orders.findIndex(o => o && o.id === orderId);
        if (idx === -1) {
            const err = new Error('Order not found for this supplier');
            err.status = 404;
            throw err;
        }
        orders[idx] = { ...orders[idx], commissionPaid: commissionPaid === true };
        supplierOrder.orders = orders;
        await supplierOrder.save();
        return orders[idx];
    }
}
module.exports = new AdminOrderService();
