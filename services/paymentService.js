'use strict';
const crypto = require('crypto');
const { Op } = require('sequelize');
const { SupplierOrder, CustomerOrder, Provider } = require('../models');

const DEFAULT_PHONEPE_BASE_URL =
    process.env.PHONEPE_STATUS_BASE_URL ||
    process.env.PHONEPE_BASE_URL ||
    'https://api-preprod.phonepe.com/apis/pg-sandbox';

const pick = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
};

// The admin Payment Providers form stores Standard-Checkout style
// credentials (client_id / client_secret / client_version), while
// legacy PhonePe PG v1 uses merchantId / saltKey / saltIndex. Pull
// out both shapes so the status call can pick the right flow.
const extractPhonePeCreds = (raw) => {
    if (!raw || typeof raw !== 'object') return {};
    const c =
        raw.phonepe ||
        raw.PhonePe ||
        raw.phone_pe ||
        raw.phonepe_config ||
        raw.credentials ||
        raw;

    const clientId = pick(c, ['client_id', 'clientId', 'CLIENT_ID']);
    const clientSecret = pick(c, ['client_secret', 'clientSecret', 'CLIENT_SECRET']);
    const clientVersion = pick(c, ['client_version', 'clientVersion', 'CLIENT_VERSION']);

    const merchantId = pick(c, [
        'merchantId', 'merchant_id', 'MERCHANT_ID', 'merchantID', 'merchant',
    ]);
    const saltKey = pick(c, [
        'saltKey', 'salt_key', 'SALT_KEY', 'salt',
    ]);
    const saltIndexRaw = pick(c, [
        'saltIndex', 'salt_index', 'SALT_INDEX', 'index',
    ]);
    const saltIndex =
        saltIndexRaw !== undefined && saltIndexRaw !== null
            ? String(saltIndexRaw)
            : undefined;

    const baseUrl = pick(c, [
        'statusBaseUrl', 'statusUrl', 'statusBaseURL', 'pgBaseUrl',
        'baseUrl', 'baseURL', 'apiUrl', 'host',
    ]);
    const environment = pick(c, ['environment', 'env', 'ENVIRONMENT']);

    return {
        clientId,
        clientSecret,
        clientVersion,
        merchantId,
        saltKey,
        saltIndex,
        baseUrl,
        environment,
    };
};

class PaymentService {
    async _findProviderForSupplier(supplierId) {
        const nameClauses = [
            { providerKey: 'phonepe' },
            { providerKey: 'PhonePe' },
            { providerKey: 'PHONEPE' },
            { providerKey: 'phone_pe' },
            { providerKey: { [Op.iLike]: '%phonepe%' } },
            { name: { [Op.iLike]: '%phonepe%' } },
        ];
        const typeFilter = { providerType: 'payment' };

        if (supplierId) {
            const byUser = await Provider.findOne({
                where: {
                    isEnabled: true,
                    ...typeFilter,
                    userId: supplierId,
                    [Op.or]: nameClauses,
                },
            });
            if (byUser) return byUser;
        }

        const bySupplierRole = await Provider.findOne({
            where: {
                isEnabled: true,
                ...typeFilter,
                targetType: 'role',
                targetRole: 'supplier',
                [Op.or]: nameClauses,
            },
        });
        if (bySupplierRole) return bySupplierRole;

        const byAnyRole = await Provider.findOne({
            where: {
                isEnabled: true,
                ...typeFilter,
                targetType: 'role',
                [Op.or]: nameClauses,
            },
        });
        if (byAnyRole) return byAnyRole;

        const byPlatform = await Provider.findOne({
            where: {
                isEnabled: true,
                ...typeFilter,
                userId: null,
                [Op.or]: nameClauses,
            },
        });
        if (byPlatform) return byPlatform;

        const anyEnabled = await Provider.findOne({
            where: {
                isEnabled: true,
                ...typeFilter,
                [Op.or]: nameClauses,
            },
            order: [['created_at', 'DESC']],
        });
        if (anyEnabled) return anyEnabled;

        // Last resort — a disabled row is still better than nothing,
        // since the payment link was generated using those creds.
        return await Provider.findOne({
            where: {
                ...typeFilter,
                [Op.or]: nameClauses,
            },
            order: [['created_at', 'DESC']],
        });
    }

    async _resolvePhonePeConfig(supplierId) {
        let baseUrl = DEFAULT_PHONEPE_BASE_URL;
        let merchantId = process.env.PHONEPE_MERCHANT_ID || '';
        let saltKey = process.env.PHONEPE_SALT_KEY || '';
        let saltIndex = String(process.env.PHONEPE_SALT_INDEX || '1');
        let clientId = process.env.PHONEPE_CLIENT_ID || '';
        let clientSecret = process.env.PHONEPE_CLIENT_SECRET || '';
        let clientVersion = String(process.env.PHONEPE_CLIENT_VERSION || '1');
        let environment = process.env.PHONEPE_ENVIRONMENT || 'sandbox';

        const appliedFrom = [];

        const provider = await this._findProviderForSupplier(supplierId);
        if (provider && provider.credentials) {
            const creds = extractPhonePeCreds(provider.credentials);
            if (creds.baseUrl) baseUrl = creds.baseUrl;
            if (creds.merchantId) merchantId = creds.merchantId;
            if (creds.saltKey) saltKey = creds.saltKey;
            if (creds.saltIndex !== undefined && creds.saltIndex !== null) {
                saltIndex = String(creds.saltIndex);
            }
            if (creds.clientId) clientId = creds.clientId;
            if (creds.clientSecret) clientSecret = creds.clientSecret;
            if (creds.clientVersion) clientVersion = String(creds.clientVersion);
            if (creds.environment) environment = String(creds.environment);
            appliedFrom.push(
                `provider(id=${provider.id}, key=${provider.providerKey || provider.name}, target=${provider.targetType}/${provider.targetRole || provider.userId || '-'})`
            );
        }

        return {
            baseUrl, merchantId, saltKey, saltIndex,
            clientId, clientSecret, clientVersion, environment,
            appliedFrom, provider,
        };
    }

    // ---- PG v1 (X-VERIFY) flow --------------------------------
    _buildStatusVerifyHash(path, saltKey, saltIndex) {
        const hash = crypto
            .createHash('sha256')
            .update(path + saltKey)
            .digest('hex');
        return `${hash}###${saltIndex}`;
    }

    async _callPhonePeStatusV1(merchantOrderId, cfg) {
        const path = `/pg/v1/status/${cfg.merchantId}/${merchantOrderId}`;
        const verifyHash = this._buildStatusVerifyHash(
            path, cfg.saltKey, cfg.saltIndex
        );
        const url = `${String(cfg.baseUrl).replace(/\/$/, '')}${path}`;

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': verifyHash,
                'X-MERCHANT-ID': cfg.merchantId,
            },
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) {
            const err = new Error(
                data?.message || `PhonePe v1 status API responded with ${res.status}`
            );
            err.status = 502;
            err.providerResponse = data;
            throw err;
        }
        return data;
    }

    // ---- Standard Checkout v2 (OAuth) flow --------------------
    // Used when the admin Payment Providers form was filled with
    // client_id / client_secret / client_version. The status
    // endpoint expects:
    //   GET /checkout/v2/order/{merchantOrderId}/status
    //   Authorization: O-Bearer <access_token>
    // (the "O-" prefix is PhonePe's OAuth bearer scheme — plain
    //  "Bearer" returns 401).
    _resolveOAuthEndpoints(environment) {
        const env = String(environment || '').toLowerCase();
        const isProd = env === 'production' || env === 'prod' || env === 'live';
        if (isProd) {
            return {
                isProd: true,
                authUrl: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
                apiBase: 'https://api.phonepe.com/apis/pg',
            };
        }
        return {
            isProd: false,
            authUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
            apiBase: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
        };
    }

    async _getOAuthToken(cfg) {
        const { authUrl } = this._resolveOAuthEndpoints(cfg.environment);
        const body = new URLSearchParams({
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            client_version: String(cfg.clientVersion || '1'),
            grant_type: 'client_credentials',
        });
        const res = await fetch(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok || !data || !data.access_token) {
            const err = new Error(
                data?.message || `PhonePe OAuth failed (HTTP ${res.status})`
            );
            err.status = 502;
            err.providerResponse = data;
            throw err;
        }
        return data.access_token;
    }

    async _callPhonePeStatusV2(merchantOrderId, cfg) {
        const accessToken = await this._getOAuthToken(cfg);
        const { apiBase } = this._resolveOAuthEndpoints(cfg.environment);
        const url = `${apiBase}/checkout/v2/order/${merchantOrderId}/status`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // PhonePe's OAuth scheme uses "O-Bearer", not "Bearer".
                'Authorization': `O-Bearer ${accessToken}`,
            },
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) {
            const err = new Error(
                data?.message || `PhonePe v2 status API responded with ${res.status}`
            );
            err.status = 502;
            err.providerResponse = data;
            throw err;
        }
        return data;
    }

    // Dispatch: if client_id/client_secret are present use the OAuth
    // flow (matches how the payment link was generated). Otherwise
    // fall back to the legacy PG v1 flow.
    async _callPhonePeStatus(merchantOrderId, supplierId) {
        const cfg = await this._resolvePhonePeConfig(supplierId);

        const hasOAuth = !!(cfg.clientId && cfg.clientSecret);
        const hasV1 = !!(cfg.merchantId && cfg.saltKey);

        if (!hasOAuth && !hasV1) {
            const dbgProvider = cfg.provider
                ? {
                      id: cfg.provider.id,
                      providerKey: cfg.provider.providerKey,
                      name: cfg.provider.name,
                      providerType: cfg.provider.providerType,
                      isEnabled: cfg.provider.isEnabled,
                      targetType: cfg.provider.targetType,
                      targetRole: cfg.provider.targetRole,
                      userId: cfg.provider.userId,
                      credentialKeys: cfg.provider.credentials
                          ? Object.keys(cfg.provider.credentials)
                          : [],
                  }
                : null;
            const err = new Error(
                'PhonePe credentials are not configured. ' +
                'Please configure a PhonePe payment provider in Admin → Payment Providers ' +
                'with client_id / client_secret / client_version and enable it.'
            );
            err.status = 500;
            err.details = {
                lookedUpSupplierId: supplierId || null,
                foundProvider: dbgProvider,
            };
            throw err;
        }

        if (hasOAuth) {
            return await this._callPhonePeStatusV2(merchantOrderId, cfg);
        }
        return await this._callPhonePeStatusV1(merchantOrderId, cfg);
    }

    async _persistOrderUpdate(targetSupplierOrder, targetIdx, targetOrder) {
        const orders = targetSupplierOrder.orders || [];
        orders[targetIdx] = targetOrder;
        targetSupplierOrder.orders = orders;
        targetSupplierOrder.changed('orders', true);
        await targetSupplierOrder.save();

        const customerOrders = await CustomerOrder.findAll();
        for (const co of customerOrders) {
            const subs = co.subOrders || [];
            const si = subs.findIndex(s => s.id === targetOrder.id);
            if (si !== -1) {
                subs[si] = {
                    ...subs[si],
                    paymentStatus: targetOrder.paymentStatus,
                    amountCollected: targetOrder.amountCollected,
                    paymentDetails: targetOrder.paymentDetails,
                    paymentAttempts: targetOrder.paymentAttempts,
                    statusHistory: targetOrder.statusHistory,
                    transactionId: targetOrder.transactionId,
                    paymentMode: targetOrder.paymentMode,
                    providerResponse: targetOrder.providerResponse,
                };
                co.subOrders = subs;
                co.changed('subOrders', true);
                await co.save();
                break;
            }
        }
    }

    async checkPaymentStatus(orderId) {
        const supplierOrders = await SupplierOrder.findAll();
        let targetSupplierOrder = null;
        let targetOrder = null;
        let targetIdx = -1;

        for (const so of supplierOrders) {
            const orders = so.orders || [];
            const idx = orders.findIndex(o => o.id === orderId);
            if (idx !== -1) {
                targetSupplierOrder = so;
                targetOrder = orders[idx];
                targetIdx = idx;
                break;
            }
        }

        if (!targetOrder) {
            const err = new Error('Order not found');
            err.status = 404;
            throw err;
        }

        const attempts = targetOrder.paymentAttempts || [];
        const lastWithRef = [...attempts].reverse().find(a => a && a.refId);
        const merchantOrderId =
            targetOrder.paymentMerchantOrderId ||
            (lastWithRef && lastWithRef.refId) ||
            null;

        if (!merchantOrderId) {
            const err = new Error('No PhonePe reference found for this order');
            err.status = 400;
            throw err;
        }

        const supplierId = targetSupplierOrder.userId || null;
        const data = await this._callPhonePeStatus(merchantOrderId, supplierId);

        // Both v1 and v2 responses nest the useful fields under .data,
        // but the shape differs slightly. Normalize.
        const providerData = data?.data || data || {};
        const rawState =
            providerData.state ||
            providerData.status ||
            providerData.orderStatus ||
            data?.code ||
            '';
        const providerState = String(rawState).toUpperCase();
        const successCode = String(data?.code || '').toUpperCase();
        const isPaid =
            providerState === 'COMPLETED' ||
            providerState === 'SUCCESS' ||
            providerState === 'PAYMENT_SUCCESS' ||
            successCode === 'PAYMENT_SUCCESS';
        const isFailed =
            providerState === 'FAILED' ||
            providerState === 'PAYMENT_ERROR' ||
            providerState === 'PAYMENT_DECLINED' ||
            providerState === 'PAYMENT_CANCELLED' ||
            successCode === 'PAYMENT_ERROR' ||
            successCode === 'PAYMENT_DECLINED' ||
            successCode === 'PAYMENT_CANCELLED';

        const nowTime = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
        const amountRaw =
            providerData.amount != null
                ? providerData.amount
                : (providerData.orderAmount != null ? providerData.orderAmount : null);
        const collectedAmount =
            amountRaw != null
                ? Number(amountRaw) / 100
                : targetOrder.total;

        const txnId =
            providerData.transactionId ||
            providerData.merchantTransactionId ||
            data?.transactionId ||
            null;
        const mode =
            providerData.paymentInstrument?.type ||
            providerData.paymentMode ||
            null;

        targetOrder.providerResponse = data;

        if (isPaid) {
            if (targetOrder.paymentStatus !== 'Paid') {
                targetOrder.paymentStatus = 'Paid';
                targetOrder.amountCollected = collectedAmount;
                targetOrder.paymentDetails = providerData;
                targetOrder.transactionId = txnId;
                targetOrder.paymentMode = mode;
                targetOrder.paymentAttempts = [
                    ...attempts,
                    {
                        status: 'COMPLETED',
                        amount: collectedAmount,
                        time: nowTime,
                        transactionId: txnId || 'N/A',
                        paymentMode: mode || 'N/A',
                        refId: txnId || merchantOrderId,
                        providerState,
                        rawResponse: data,
                    },
                ];
                targetOrder.statusHistory = [
                    ...(targetOrder.statusHistory || []),
                    {
                        status: 'Payment Confirmed (PhonePe Status API)',
                        time: nowTime,
                        by: 'PhonePe Status API',
                        reason: `Txn: ${txnId || 'N/A'}`,
                    },
                ];
            }
        } else if (isFailed) {
            if (targetOrder.paymentStatus !== 'Failed') {
                targetOrder.paymentStatus = 'Failed';
                targetOrder.paymentAttempts = [
                    ...attempts,
                    {
                        status: 'FAILED',
                        amount: collectedAmount,
                        time: nowTime,
                        transactionId: txnId || 'N/A',
                        paymentMode: mode || 'N/A',
                        refId: merchantOrderId,
                        providerState,
                        rawResponse: data,
                    },
                ];
                targetOrder.statusHistory = [
                    ...(targetOrder.statusHistory || []),
                    {
                        status: 'Payment Failed (PhonePe Status API)',
                        time: nowTime,
                        by: 'PhonePe Status API',
                        reason: data?.message || 'Payment failed at provider',
                    },
                ];
            }
        } else {
            const alreadyLogged = attempts.some(
                a =>
                    a &&
                    a.providerState === (providerState || 'PENDING') &&
                    a.refId === merchantOrderId
            );
            if (!alreadyLogged) {
                targetOrder.paymentAttempts = [
                    ...attempts,
                    {
                        status: 'PENDING',
                        amount: collectedAmount,
                        time: nowTime,
                        transactionId: txnId || 'N/A',
                        paymentMode: mode || 'N/A',
                        refId: merchantOrderId,
                        providerState: providerState || 'PENDING',
                        rawResponse: data,
                    },
                ];
            }
        }

        await this._persistOrderUpdate(
            targetSupplierOrder,
            targetIdx,
            targetOrder
        );

        return {
            orderId: targetOrder.id,
            paymentStatus: targetOrder.paymentStatus,
            providerState: providerState || 'PENDING',
            transactionId: targetOrder.transactionId || null,
            paymentMode: targetOrder.paymentMode || null,
            amountCollected: targetOrder.amountCollected || 0,
            paymentAttempts: targetOrder.paymentAttempts,
            providerResponse: data,
        };
    }

    async handlePhonepeWebhook(payload) {
        try {
            const responseString = payload.response;
            if (!responseString) return;
            const decodedString = Buffer.from(responseString, 'base64').toString(
                'ascii'
            );
            const data = JSON.parse(decodedString);
            const { merchantOrderId, state, amount, transactionId, paymentMode } =
                data;
            if (!merchantOrderId) return;
            const supplierOrders = await SupplierOrder.findAll();
            for (const so of supplierOrders) {
                const orders = so.orders || [];
                const orderIndex = orders.findIndex(
                    o => o.paymentMerchantOrderId === merchantOrderId
                );
                if (orderIndex !== -1) {
                    const order = orders[orderIndex];
                    const nowTime = new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    });
                    if (state === 'COMPLETED') {
                        order.paymentStatus = 'Paid';
                        order.amountCollected = amount ? amount / 100 : order.total;
                        order.paymentDetails = data;
                        order.transactionId = transactionId || null;
                        order.paymentMode = paymentMode || null;
                        order.paymentAttempts = [
                            ...(order.paymentAttempts || []),
                            {
                                status: 'COMPLETED',
                                amount: amount ? amount / 100 : order.total,
                                time: nowTime,
                                transactionId: transactionId,
                                paymentMode: paymentMode,
                                refId: data.orderId,
                            },
                        ];
                        order.statusHistory = [
                            ...(order.statusHistory || []),
                            {
                                status: 'Payment Completed (Webhook)',
                                time: nowTime,
                                by: 'PhonePe Webhook',
                                reason: `Txn ID: ${transactionId}, Mode: ${paymentMode}`,
                            },
                        ];
                    } else if (state === 'FAILED') {
                        order.paymentStatus = 'Failed';
                        order.paymentDetails = data;
                        order.paymentAttempts = [
                            ...(order.paymentAttempts || []),
                            {
                                status: 'FAILED',
                                amount: amount ? amount / 100 : order.total,
                                time: nowTime,
                                transactionId: transactionId || 'N/A',
                                paymentMode: paymentMode || 'N/A',
                                refId: data.orderId,
                            },
                        ];
                        order.statusHistory = [
                            ...(order.statusHistory || []),
                            {
                                status: 'Payment Failed (Webhook)',
                                time: nowTime,
                                by: 'PhonePe Webhook',
                                reason: `Txn ID: ${transactionId}`,
                            },
                        ];
                    }
                    orders[orderIndex] = order;
                    so.orders = orders;
                    so.changed('orders', true);
                    await so.save();
                    const customerOrders = await CustomerOrder.findAll();
                    for (const co of customerOrders) {
                        const coSubOrders = co.subOrders || [];
                        const coSubIdx = coSubOrders.findIndex(
                            s => s.id === order.id
                        );
                        if (coSubIdx !== -1) {
                            coSubOrders[coSubIdx] = {
                                ...coSubOrders[coSubIdx],
                                paymentStatus: order.paymentStatus,
                                amountCollected: order.amountCollected,
                                paymentDetails: order.paymentDetails,
                                paymentAttempts: order.paymentAttempts,
                                statusHistory: order.statusHistory,
                                transactionId: order.transactionId,
                                paymentMode: order.paymentMode,
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
