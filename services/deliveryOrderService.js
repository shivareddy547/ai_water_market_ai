'use strict';
const { SupplierOrder, User, DeliveryTeam, Provider } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
class DeliveryOrderService {
    async getAssignedOrders(userId) {
        try {
            const deliveryUser = await User.findByPk(userId);
            if (!deliveryUser || deliveryUser.role !== 'delivery') {
                const err = new Error('Delivery user not found');
                err.status = 404;
                throw err;
            }
            const supplierId = deliveryUser.supplierId;
            if (!supplierId) {
                return [];
            }
            const supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!supplierOrder || !supplierOrder.orders) {
                return [];
            }
            let personId = userId;
            const personName = `${deliveryUser.firstName} ${deliveryUser.lastName}`.trim();
            const supplierTeam = await DeliveryTeam.findOne({ where: { userId: supplierId } });
            if (supplierTeam && supplierTeam.data && Array.isArray(supplierTeam.data.persons)) {
                const person = supplierTeam.data.persons.find(p => {
                    return p.userId === userId || 
                           p.id === userId || 
                           (p.mobile && p.mobile === deliveryUser.phone) ||
                           (p.fullName && p.fullName === personName);
                });
                if (person) {
                    personId = person.id;
                }
            }
            const assignedOrders = supplierOrder.orders.filter(
                order => order.deliveryPersonId === personId || order.deliveryPersonId === userId
            );
            return assignedOrders;
        } catch (error) {
            console.error('Error fetching assigned orders:', error);
            const err = new Error('Failed to fetch assigned orders');
            err.status = 500;
            throw err;
        }
    }
    async updateOrderStatus(userId, orderId, newStatus, reason = null, proofImage = null) {
        try {
            const deliveryUser = await User.findByPk(userId);
            if (!deliveryUser || deliveryUser.role !== 'delivery' || !deliveryUser.supplierId) {
                const err = new Error('Unauthorized or not linked to a supplier');
                err.status = 403;
                throw err;
            }
            const supplierId = deliveryUser.supplierId;
            const supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!supplierOrder || !supplierOrder.orders) {
                const err = new Error('No orders found for this supplier');
                err.status = 404;
                throw err;
            }
            let personId = userId;
            const personName = `${deliveryUser.firstName} ${deliveryUser.lastName}`.trim();
            const supplierTeam = await DeliveryTeam.findOne({ where: { userId: supplierId } });
            if (supplierTeam && supplierTeam.data && Array.isArray(supplierTeam.data.persons)) {
                const person = supplierTeam.data.persons.find(p => {
                    return p.userId === userId || p.id === userId || (p.mobile && p.mobile === deliveryUser.phone) || (p.fullName && p.fullName === personName);
                });
                if (person) personId = person.id;
            }
            const orders = supplierOrder.orders;
            const orderIndex = orders.findIndex(o => o.id === orderId && (o.deliveryPersonId === personId || o.deliveryPersonId === userId));
            if (orderIndex === -1) {
                const err = new Error('Order not found or not assigned to you');
                err.status = 404;
                throw err;
            }
            const order = orders[orderIndex];
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const by = personName || deliveryUser.firstName;
            const requiresProof = ['Delivered', 'Cancelled', 'Returned'].includes(newStatus);
            if (requiresProof && !proofImage && !reason) {
                const err = new Error('Proof image or reason is required for this status change');
                err.status = 400;
                throw err;
            }
            order.status = newStatus;
            const historyEntry = { status: newStatus, time: nowTime, by };
            if (reason) historyEntry.reason = reason;
            if (proofImage) historyEntry.proofImage = proofImage;
            order.statusHistory = [...(order.statusHistory || []), historyEntry];
            if (newStatus === 'Accepted') order.acceptedAt = nowTime;
            if (newStatus === 'On The Way') order.startedAt = nowTime;
            if (newStatus === 'Reached') order.reachedAt = nowTime;
            if (newStatus === 'Delivered') {
                order.deliveredAt = nowTime;
                order.proofImage = proofImage || null;
                order.proofComment = reason || null;
            } else if (['Customer Not Available', 'Returned', 'Cancelled'].includes(newStatus)) {
                order.failedReason = reason || null;
            }
            orders[orderIndex] = order;
            supplierOrder.orders = orders;
            supplierOrder.changed('orders', true);
            await supplierOrder.save();
            return order;
        } catch (error) {
            console.error('Error updating order status:', error);
            const err = new Error(error.message || 'Failed to update order status');
            err.status = error.status || 500;
            throw err;
        }
    }
    async updateOrderPayment(userId, orderId, paymentStatus, amountCollected = 0, proofImage = null, reason = null) {
        try {
            const deliveryUser = await User.findByPk(userId);
            if (!deliveryUser || deliveryUser.role !== 'delivery' || !deliveryUser.supplierId) {
                const err = new Error('Unauthorized or not linked to a supplier');
                err.status = 403;
                throw err;
            }
            const supplierId = deliveryUser.supplierId;
            const supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!supplierOrder || !supplierOrder.orders) {
                const err = new Error('No orders found for this supplier');
                err.status = 404;
                throw err;
            }
            const orders = supplierOrder.orders;
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) {
                const err = new Error('Order not found');
                err.status = 404;
                throw err;
            }
            const order = orders[orderIndex];
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const by = `${deliveryUser.firstName} ${deliveryUser.lastName}`.trim();
            order.paymentStatus = paymentStatus;
            order.amountCollected = paymentStatus === 'Paid' ? amountCollected : 0;
            order.paymentProofImage = proofImage;
            order.paymentReason = reason;
            // Add to payment attempts
            order.paymentAttempts = [...(order.paymentAttempts || []), {
                status: paymentStatus,
                amount: amountCollected,
                time: nowTime,
                mode: 'Manual Update',
                reason: reason || 'Cash/UPI Collected'
            }];
            const historyEntry = { 
                status: `Payment ${paymentStatus}`, 
                time: nowTime, 
                by,
                reason: `Amount: ${amountCollected}. ${reason || ''}`
            };
            if (proofImage) historyEntry.proofImage = proofImage;
            order.statusHistory = [...(order.statusHistory || []), historyEntry];
            orders[orderIndex] = order;
            supplierOrder.orders = orders;
            supplierOrder.changed('orders', true);
            await supplierOrder.save();
            return order;
        } catch (error) {
            console.error('Error updating order payment:', error);
            const err = new Error(error.message || 'Failed to update payment');
            err.status = error.status || 500;
            throw err;
        }
    }
    async generatePaymentLink(userId, orderId) {
        try {
            const deliveryUser = await User.findByPk(userId);
            if (!deliveryUser || deliveryUser.role !== 'delivery' || !deliveryUser.supplierId) {
                const err = new Error('Unauthorized or not linked to a supplier');
                err.status = 403;
                throw err;
            }
            const supplierId = deliveryUser.supplierId;
            const supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!supplierOrder || !supplierOrder.orders) {
                const err = new Error('No orders found for this supplier');
                err.status = 404;
                throw err;
            }
            const orders = supplierOrder.orders;
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) {
                const err = new Error('Order not found');
                err.status = 404;
                throw err;
            }
            const order = orders[orderIndex];
            const provider = await Provider.findOne({
                where: {
                    providerType: 'payment',
                    isEnabled: true,
                    providerKey: 'phonepe',
                    [Op.or]: [
                        { userId: supplierId },
                        { targetType: 'role', targetRole: 'supplier' }
                    ]
                },
                order: [['created_at', 'DESC']]
            });
            if (!provider) {
                const err = new Error('No active PhonePe payment provider configured for this supplier.');
                err.status = 400;
                throw err;
            }
            const creds = provider.credentials || {};
            const clientId = creds.client_id;
            const clientSecret = creds.client_secret;
            const clientVersion = creds.client_version;
            const environment = creds.environment || 'production';
            if (!clientId || !clientSecret || !clientVersion) {
                const err = new Error('PhonePe credentials (client_id, client_secret, client_version) are incomplete in admin settings.');
                err.status = 400;
                throw err;
            }
            const isSandbox = environment === 'sandbox';
            const tokenUrl = isSandbox 
                ? 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token' 
                : 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
            const payUrl = isSandbox 
                ? 'https://api-preprod.phonepe.com/apis/pg-sandbox/paylinks/v1/pay' 
                : 'https://api.phonepe.com/apis/pg/paylinks/v1/pay';
            const tokenParams = new URLSearchParams();
            tokenParams.append('client_id', clientId);
            tokenParams.append('client_version', clientVersion);
            tokenParams.append('client_secret', clientSecret);
            tokenParams.append('grant_type', 'client_credentials');
            let accessToken;
            try {
                const tokenResponse = await axios.post(tokenUrl, tokenParams.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                accessToken = tokenResponse.data.access_token;
            } catch (err) {
                console.error('PhonePe Token Error:', err.response?.data || err.message);
                throw new Error('Failed to authenticate with PhonePe.');
            }
            if (!accessToken) throw new Error('Failed to retrieve access token from PhonePe.');
            const amountInPaise = Math.round(Number(order.total || 0) * 100);
            const merchantOrderId = `${order.id}-${Date.now()}`;
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const payRequestBody = {
                merchantOrderId: merchantOrderId,
                description: `Payment for Order ${order.id}`,
                amount: amountInPaise,
                paymentFlow: {
                    type: 'PAYLINK',
                    customerDetails: {
                        name: order.customer || 'Customer',
                        phoneNumber: (order.phone || '').replace(/\D/g, '').slice(-10)
                    },
                    notificationChannels: {
                        SMS: true,
                        EMAIL: false
                    },
                    expireAt: Date.now() + 24 * 60 * 60 * 1000,
                    redirectUrl: `${frontendUrl}/customer/orders`
                },
                metaInfo: {
                    udf1: 'AI_WATER_MARKET',
                    udf2: order.id,
                    udf3: supplierId
                }
            };
            let paymentLink;
            let phonepeOrderId;
            try {
                const payResponse = await axios.post(payUrl, payRequestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `O-Bearer ${accessToken}`
                    }
                });
                paymentLink = payResponse.data.paylinkUrl;
                phonepeOrderId = payResponse.data.orderId;
            } catch (err) {
                console.error('PhonePe Link Creation Error:', err.response?.data || err.message);
                throw new Error('Failed to create PhonePe payment link.');
            }
            if (!paymentLink) throw new Error('PhonePe did not return a payment URL.');
            order.paymentLink = paymentLink;
            order.paymentStatus = 'Link Generated';
            order.paymentRefId = phonepeOrderId;
            order.paymentMerchantOrderId = merchantOrderId;
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const by = `${deliveryUser.firstName} ${deliveryUser.lastName}`.trim();
            // Add to payment attempts
            order.paymentAttempts = [...(order.paymentAttempts || []), {
                status: 'Link Generated',
                amount: order.total,
                time: nowTime,
                refId: phonepeOrderId,
                merchantOrderId: merchantOrderId,
                paymentLink: paymentLink
            }];
            order.statusHistory = [...(order.statusHistory || []), { status: 'Payment Link Generated', time: nowTime, by, reason: paymentLink }];
            orders[orderIndex] = order;
            supplierOrder.orders = orders;
            supplierOrder.changed('orders', true);
            await supplierOrder.save();
            return paymentLink;
        } catch (error) {
            console.error('Error generating payment link:', error);
            const err = new Error(error.message || 'Failed to generate payment link');
            err.status = error.status || 500;
            throw err;
        }
    }
    async checkPaymentStatus(userId, orderId) {
        try {
            const deliveryUser = await User.findByPk(userId);
            if (!deliveryUser || deliveryUser.role !== 'delivery' || !deliveryUser.supplierId) {
                throw new Error('Unauthorized');
            }
            const supplierId = deliveryUser.supplierId;
            const supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (!supplierOrder || !supplierOrder.orders) return;
            const orders = supplierOrder.orders;
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) return;
            const order = orders[orderIndex];
            if (!order.paymentMerchantOrderId) {
                throw new Error('No payment initiated for this order.');
            }
            const provider = await Provider.findOne({
                where: {
                    providerType: 'payment',
                    isEnabled: true,
                    providerKey: 'phonepe',
                    [Op.or]: [
                        { userId: supplierId },
                        { targetType: 'role', targetRole: 'supplier' }
                    ]
                },
                order: [['created_at', 'DESC']]
            });
            if (!provider) throw new Error('PhonePe provider not configured.');
            const creds = provider.credentials || {};
            const environment = creds.environment || 'production';
            const isSandbox = environment === 'sandbox';
            const tokenUrl = isSandbox 
                ? 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token' 
                : 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
            const statusUrl = isSandbox
                ? `https://api-preprod.phonepe.com/apis/pg-sandbox/paylinks/v1/status/${order.paymentMerchantOrderId}`
                : `https://api.phonepe.com/apis/pg/paylinks/v1/status/${order.paymentMerchantOrderId}`;
            const tokenParams = new URLSearchParams();
            tokenParams.append('client_id', creds.client_id);
            tokenParams.append('client_version', creds.client_version);
            tokenParams.append('client_secret', creds.client_secret);
            tokenParams.append('grant_type', 'client_credentials');
            const tokenResponse = await axios.post(tokenUrl, tokenParams.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const accessToken = tokenResponse.data.access_token;
            const statusResponse = await axios.get(statusUrl, {
                headers: { 'Authorization': `O-Bearer ${accessToken}` }
            });
            const phonepeData = statusResponse.data;
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (phonepeData.state === 'COMPLETED') {
                order.paymentStatus = 'Paid';
                order.amountCollected = order.total;
                order.paymentDetails = phonepeData;
                order.paymentAttempts = [...(order.paymentAttempts || []), {
                    status: 'COMPLETED',
                    amount: phonepeData.amount ? phonepeData.amount / 100 : order.total,
                    time: nowTime,
                    transactionId: phonepeData.transactionId,
                    paymentMode: phonepeData.paymentMode,
                    refId: phonepeData.orderId
                }];
                order.statusHistory = [...(order.statusHistory || []), { 
                    status: 'Payment Verified', 
                    time: nowTime, 
                    by: 'System', 
                    reason: `Amount: ${order.total}` 
                }];
                orders[orderIndex] = order;
                supplierOrder.orders = orders;
                supplierOrder.changed('orders', true);
                await supplierOrder.save();
                return order;
            } else if (phonepeData.state === 'FAILED') {
                order.paymentStatus = 'Failed';
                order.paymentDetails = phonepeData;
                order.paymentAttempts = [...(order.paymentAttempts || []), {
                    status: 'FAILED',
                    amount: phonepeData.amount ? phonepeData.amount / 100 : order.total,
                    time: nowTime,
                    transactionId: phonepeData.transactionId || 'N/A',
                    paymentMode: phonepeData.paymentMode || 'N/A',
                    refId: phonepeData.orderId
                }];
                orders[orderIndex] = order;
                supplierOrder.orders = orders;
                supplierOrder.changed('orders', true);
                await supplierOrder.save();
                return order;
            } else {
                return order;
            }
        } catch (error) {
            console.error('Error checking payment status:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to verify payment status.');
        }
    }
}
module.exports = new DeliveryOrderService();
