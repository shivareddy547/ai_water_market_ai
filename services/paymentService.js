'use strict';
const { SupplierOrder, CustomerOrder } = require('../models');
const { Op } = require('sequelize');
class PaymentService {
    async handlePhonepeWebhook(payload) {
        try {
            const responseString = payload.response;
            if (!responseString) return;
            const decodedString = Buffer.from(responseString, 'base64').toString('ascii');
            const data = JSON.parse(decodedString);
            const { merchantOrderId, state, amount, transactionId, paymentMode } = data;
            if (!merchantOrderId) return;
            const supplierOrders = await SupplierOrder.findAll();
            for (const so of supplierOrders) {
                let orders = so.orders || [];
                const orderIndex = orders.findIndex(o => o.paymentMerchantOrderId === merchantOrderId);
                if (orderIndex !== -1) {
                    const order = orders[orderIndex];
                    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    if (state === 'COMPLETED') {
                        order.paymentStatus = 'Paid';
                        order.amountCollected = amount ? amount / 100 : order.total;
                        order.paymentDetails = data;
                        order.paymentAttempts = [...(order.paymentAttempts || []), {
                            status: 'COMPLETED',
                            amount: amount ? amount / 100 : order.total,
                            time: nowTime,
                            transactionId: transactionId,
                            paymentMode: paymentMode,
                            refId: data.orderId
                        }];
                        order.statusHistory = [...(order.statusHistory || []), { 
                            status: 'Payment Completed (Webhook)', 
                            time: nowTime, 
                            by: 'PhonePe Webhook', 
                            reason: `Txn ID: ${transactionId}, Mode: ${paymentMode}` 
                        }];
                    } else if (state === 'FAILED') {
                        order.paymentStatus = 'Failed';
                        order.paymentDetails = data;
                        order.paymentAttempts = [...(order.paymentAttempts || []), {
                            status: 'FAILED',
                            amount: amount ? amount / 100 : order.total,
                            time: nowTime,
                            transactionId: transactionId || 'N/A',
                            paymentMode: paymentMode || 'N/A',
                            refId: data.orderId
                        }];
                        order.statusHistory = [...(order.statusHistory || []), { 
                            status: 'Payment Failed (Webhook)', 
                            time: nowTime, 
                            by: 'PhonePe Webhook', 
                            reason: `Txn ID: ${transactionId}` 
                        }];
                    }
                    orders[orderIndex] = order;
                    so.orders = orders;
                    so.changed('orders', true);
                    await so.save();
                    // Sync to Customer Order
                    const customerOrders = await CustomerOrder.findAll();
                    for (const co of customerOrders) {
                        let coSubOrders = co.subOrders || [];
                        const coSubIdx = coSubOrders.findIndex(s => s.id === order.id);
                        if (coSubIdx !== -1) {
                            coSubOrders[coSubIdx] = {
                                ...coSubOrders[coSubIdx],
                                paymentStatus: order.paymentStatus,
                                amountCollected: order.amountCollected,
                                paymentDetails: order.paymentDetails,
                                paymentAttempts: order.paymentAttempts,
                                statusHistory: order.statusHistory
                            };
                            co.subOrders = coSubOrders;
                            co.changed('subOrders', true);
                            await co.save();
                            break;
                        }
                    }
                    break; 
                }
            }
        } catch (error) {
            console.error('Error handling PhonePe webhook:', error);
        }
    }
}
module.exports = new PaymentService();
