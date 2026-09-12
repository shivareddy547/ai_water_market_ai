'use strict';
const { CustomerOrder, SupplierOrder, User } = require('../models');
const { v4: uuidv4 } = require('uuid');

class CustomerOrderService {
    async createOrder(userId, orderData) {
        const { subOrders, paymentMethod } = orderData;

        if (!subOrders || !Array.isArray(subOrders) || subOrders.length === 0) {
            const err = new Error('Sub-orders are required');
            err.status = 400;
            throw err;
        }

        let totalAmount = 0;
        const orderNumber = `ORD-${Date.now()}${Math.floor(Math.random() * 1000)}`;

        for (const subOrder of subOrders) {
            // Ensure financial fields have defaults if not provided
            subOrder.itemsTotal = Number(subOrder.itemsTotal || 0);
            subOrder.depositTotal = Number(subOrder.depositTotal || 0);
            subOrder.shipping = Number(subOrder.shipping || 0);
            subOrder.platformFee = Number(subOrder.platformFee || 0);
            subOrder.platformFeeEnabled = !!subOrder.platformFeeEnabled;
            subOrder.platformFeeType = subOrder.platformFeeType || 'percentage';
            subOrder.platformFeeValue = Number(subOrder.platformFeeValue || 0);
            
            const calculatedGrandTotal = subOrder.itemsTotal + subOrder.depositTotal + subOrder.shipping + subOrder.platformFee;
            subOrder.grandTotal = calculatedGrandTotal;

            totalAmount += calculatedGrandTotal;
        }

        const customerOrder = await CustomerOrder.create({
            userId,
            orderNumber,
            subOrders,
            totalAmount,
            paymentMethod,
            status: 'Placed'
        });

        const supplierOrdersByUser = {};
        for (const subOrder of subOrders) {
            if (!subOrder.supplierId) continue;
            if (!supplierOrdersByUser[subOrder.supplierId]) {
                supplierOrdersByUser[subOrder.supplierId] = [];
            }
            const supplierOrderEntry = {
                id: `${orderNumber}-${subOrder.supplierId.slice(-4)}`,
                parentOrderId: customerOrder.id,
                supplier: subOrder.supplier,
                supplierId: subOrder.supplierId,
                items: subOrder.lines,
                address: subOrder.address,
                paymentMode: paymentMethod,
                paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                slot: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                area: subOrder.address?.city || '',
                
                // Financial breakdown
                itemsTotal: subOrder.itemsTotal,
                depositTotal: subOrder.depositTotal,
                shippingAmount: subOrder.shipping,
                total: subOrder.grandTotal,
                
                // Platform fee fields (snapshot)
                platformFeeEnabled: subOrder.platformFeeEnabled,
                platformFeeType: subOrder.platformFeeType,
                platformFeeValue: subOrder.platformFeeValue,
                platformFee: subOrder.platformFee,

                // Default operational fields
                deliveryPersonId: null,
                statusHistory: [{ status: 'Pending', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), by: 'System' }],
                commissionPaid: false,
            };
            supplierOrdersByUser[subOrder.supplierId].push(supplierOrderEntry);
        }

        for (const supplierId in supplierOrdersByUser) {
            const newOrders = supplierOrdersByUser[supplierId];
            let supplierOrderRecord = await SupplierOrder.findOne({ where: { userId: supplierId } });
            
            if (supplierOrderRecord) {
                const existingOrders = supplierOrderRecord.orders || [];
                supplierOrderRecord.orders = [...newOrders, ...existingOrders];
                await supplierOrderRecord.save();
            } else {
                await SupplierOrder.create({
                    userId: supplierId,
                    orders: newOrders
                });
            }
        }

        return customerOrder;
    }
}

module.exports = new CustomerOrderService();
