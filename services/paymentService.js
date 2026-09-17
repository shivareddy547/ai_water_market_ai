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
        clientId, clientSecret, clientVersion,
        merchantId, saltKey, saltIndex,
        baseUrl, environment,
    };
};
// PhonePe returns multiple state dialects. Normalize them all so we
// don't miss a success/fail because the string changed casing.
const normalizeState = (s) => String(s || '').toUpperCase().trim();
const COMPLETED_STATES = new Set(['COMPLETED', 'SUCCESS', 'PAYMENT_SUCCESS', 'PAID']);
const FAILED_STATES = new Set([
    'FAILED', 'PAYMENT_ERROR', 'PAYMENT_DECLINED',
    'PAYMENT_CANCELLED', 'CANCELLED', 'EXPIRED', 'TIMED_OUT',
]);
const isCompletedState = (s) => COMPLETED_STATES.has(normalizeState(s));
const isFailedState = (s) => FAILED_STATES.has(normalizeState(s));
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
                    isEnabled: true, ...typeFilter,
                    userId: supplierId,
                    [Op.or]: nameClauses,
                },
            });
            if (byUser) return byUser;
        }
        const bySupplierRole = await Provider.findOne({
            where: {
                isEnabled: true, ...typeFilter,
                targetType: 'role', targetRole: 'supplier',
                [Op.or]: nameClauses,
            },
        });
        if (bySupplierRole) return bySupplierRole;
        const byAnyRole = await Provider.findOne({
            where: {
                isEnabled: true, ...typeFilter,
                targetType: 'role',
                [Op.or]: nameClauses,
            },
        });
        if (byAnyRole) return byAnyRole;
        const byPlatform = await Provider.findOne({
            where: {
                isEnabled: true, ...typeFilter,
                userId: null,
                [Op.or]: nameClauses,
            },
        });
        if (byPlatform) return byPlatform;
        return await Provider.findOne({
            where: { ...typeFilter, [Op.or]: nameClauses },
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
        // FIX: Use the correct PhonePe Payment Link Status API endpoint.
        // The previous code used `/checkout/v2/order/...` which is for Standard Checkout.
        // Since the payment link was created using `/paylinks/v1/pay`,
        // we must use `/paylinks/v1/{merchantOrderId}/status?details=true`.
        const url = `${apiBase}/paylinks/v1/${encodeURIComponent(merchantOrderId)}/status?details=true`;
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
    // NEW: Auto-generate a fresh PhonePe payment link for an order
    // when the previous attempt has FAILED. This reuses the same
    // OAuth/credential resolution as the status API so no new
    // provider configuration is needed.
    async _generatePhonePePaymentLink(order, supplierId, cfg, reasonLabel) {
        const accessToken = await this._getOAuthToken(cfg);
        const { apiBase } = this._resolveOAuthEndpoints(cfg.environment);
        const payUrl = `${apiBase}/paylinks/v1/pay`;
        const amountInPaise = Math.round(Number(order.total || 0) * 100);
        const merchantOrderId = `${order.id}-${Date.now()}`;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const itemSummary = (order.items || [])
            .map(i => `${i.name} x${i.qty}`)
            .join(', ');
        const description = `Order ${order.id}: ${itemSummary}`.substring(0, 255);
        const payRequestBody = {
            merchantOrderId: merchantOrderId,
            description: description,
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
                udf3: supplierId,
                udf4: itemSummary
            }
        };
        const res = await fetch(payUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `O-Bearer ${accessToken}`
            },
            body: JSON.stringify(payRequestBody)
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok || !data || !data.paylinkUrl) {
            const err = new Error(
                data?.message || `PhonePe link generation failed (HTTP ${res.status})`
            );
            err.status = 502;
            err.providerResponse = data;
            throw err;
        }
        return {
            paymentLink: data.paylinkUrl,
            phonepeOrderId: data.orderId || null,
            merchantOrderId,
            reasonLabel: reasonLabel || 'Auto-regenerated after payment failure',
            rawResponse: data,
        };
    }
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
                    paymentLink: targetOrder.paymentLink,
                    paymentRefId: targetOrder.paymentRefId,
                    paymentMerchantOrderId: targetOrder.paymentMerchantOrderId,
                };
                co.subOrders = subs;
                co.changed('subOrders', true);
                await co.save();
                break;
            }
        }
    }
    // Interpret PhonePe's response regardless of which dialect is returned.
    // Some tenants return a flat { code, data }, others return the newer
    // { orderId, state, paymentDetails[] } shape. Crucially, the top-level
    // `state` on Standard Checkout v2 can LAG behind the actual transaction
    // state — the `paymentDetails[]` array is often fresher. So we scan
    // BOTH and treat the order as PAID if either place shows a completed
    // transaction.
    _interpretPhonePeResponse(data) {
        const providerData = data?.data || data || {};
        const topState = normalizeState(
            providerData.state ||
            providerData.status ||
            providerData.orderStatus ||
            data?.code
        );
        const rawDetails = Array.isArray(providerData.paymentDetails)
            ? providerData.paymentDetails
            : [];
        const details = rawDetails.map(d => ({
            ...d,
            normalizedState: normalizeState(d.state || d.status),
        }));
        const completedDetail = details.find(d => isCompletedState(d.normalizedState));
        const failedDetail = details.find(d => isFailedState(d.normalizedState));
        const pendingDetail = details.find(
            d => !isCompletedState(d.normalizedState) && !isFailedState(d.normalizedState)
        );
        const topIsPaid = isCompletedState(topState);
        const topIsFailed = isFailedState(topState);
        // Priority: any COMPLETED anywhere -> PAID.
        // Otherwise: top-level FAILED, or ALL details FAILED and none pending -> FAILED.
        // Otherwise: PENDING.
        let status = 'PENDING';
        let providerState = topState || 'PENDING';
        if (topIsPaid || completedDetail) {
            status = 'PAID';
            if (completedDetail) providerState = completedDetail.normalizedState;
        } else if (topIsFailed || (details.length > 0 && !pendingDetail && failedDetail)) {
            status = 'FAILED';
            if (failedDetail) providerState = failedDetail.normalizedState;
        }
        const usableDetail = completedDetail || failedDetail || pendingDetail || null;
        const txnId =
            (usableDetail && usableDetail.transactionId) ||
            providerData.transactionId ||
            providerData.merchantTransactionId ||
            data?.transactionId ||
            null;
        const mode =
            (usableDetail && usableDetail.paymentMode) ||
            providerData.paymentInstrument?.type ||
            providerData.paymentMode ||
            null;
        const amountRaw = (() => {
            if (usableDetail && usableDetail.amount != null) return usableDetail.amount;
            if (providerData.amount != null) return providerData.amount;
            if (providerData.orderAmount != null) return providerData.orderAmount;
            return null;
        })();
        return {
            status,
            providerState,
            txnId,
            mode,
            amountPaise: amountRaw,
            details,
            rawData: data,
        };
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
        // FIX: Explicitly look for `merchantOrderId` in paymentAttempts.
        // The top-level `paymentMerchantOrderId` might be missing or incorrect,
        // but the attempt log will have the exact ID used when creating the link.
        const lastWithMerchantId = [...attempts].reverse().find(a => a && a.merchantOrderId);
        const lastWithRef = [...attempts].reverse().find(a => a && a.refId);
        const merchantOrderId =
            targetOrder.paymentMerchantOrderId ||
            (lastWithMerchantId && lastWithMerchantId.merchantOrderId) ||
            (lastWithRef && lastWithRef.refId) ||
            null;
        if (!merchantOrderId) {
            const err = new Error('No PhonePe reference found for this order');
            err.status = 400;
            throw err;
        }
        const supplierId = targetSupplierOrder.userId || null;
        const data = await this._callPhonePeStatus(merchantOrderId, supplierId);
        const interpreted = this._interpretPhonePeResponse(data);
        const {
            status, providerState, txnId, mode, amountPaise, rawData,
        } = interpreted;
        const nowTime = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
        const collectedAmount =
            amountPaise != null
                ? Number(amountPaise) / 100
                : targetOrder.total;
        targetOrder.providerResponse = rawData;
        if (status === 'PAID') {
            // Even if PhonePe's top-level state is still PENDING, we
            // trust the transaction detail — flip the order to Paid.
            if (targetOrder.paymentStatus !== 'Paid') {
                targetOrder.paymentStatus = 'Paid';
                targetOrder.amountCollected = collectedAmount;
                targetOrder.paymentDetails = data?.data || data;
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
                        rawResponse: rawData,
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
        } else if (status === 'FAILED') {
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
                        rawResponse: rawData,
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
            // NEW: Auto-generate a fresh payment link after a
            // failed payment so the customer / delivery person can
            // retry immediately without leaving the page.
            try {
                const cfg = await this._resolvePhonePeConfig(supplierId);
                const hasOAuth = !!(cfg.clientId && cfg.clientSecret);
                if (hasOAuth) {
                    const regenerated = await this._generatePhonePePaymentLink(
                        targetOrder,
                        supplierId,
                        cfg,
                        'Auto-regenerated after payment failure'
                    );
                    targetOrder.paymentLink = regenerated.paymentLink;
                    targetOrder.paymentStatus = 'Link Generated';
                    targetOrder.paymentRefId = regenerated.phonepeOrderId;
                    targetOrder.paymentMerchantOrderId = regenerated.merchantOrderId;
                    targetOrder.paymentAttempts = [
                        ...(targetOrder.paymentAttempts || []),
                        {
                            status: 'Link Generated',
                            amount: targetOrder.total,
                            time: nowTime,
                            refId: regenerated.phonepeOrderId,
                            merchantOrderId: regenerated.merchantOrderId,
                            paymentLink: regenerated.paymentLink,
                            reason: regenerated.reasonLabel,
                        },
                    ];
                    targetOrder.statusHistory = [
                        ...(targetOrder.statusHistory || []),
                        {
                            status: 'Payment Link Auto-Regenerated',
                            time: nowTime,
                            by: 'PhonePe Status API',
                            reason: `New link after failure: ${regenerated.paymentLink}`,
                        },
                    ];
                }
            } catch (regenErr) {
                console.error(
                    'Failed to auto-generate PhonePe payment link after failure:',
                    regenErr.message
                );
            }
        } else {
            // Still PENDING — do not spam the attempt log with every poll.
            const alreadyLogged = attempts.some(
                a => a && a.status === 'PENDING' && a.refId === merchantOrderId
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
                        rawResponse: rawData,
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
            providerResponse: rawData,
            paymentLink: targetOrder.paymentLink || null,
            paymentRefId: targetOrder.paymentRefId || null,
            paymentMerchantOrderId: targetOrder.paymentMerchantOrderId || null,
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
                                merchantOrderId: merchantOrderId,
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
                                merchantOrderId: merchantOrderId,
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
                                paymentLink: order.paymentLink,
                                paymentRefId: order.paymentRefId,
                                paymentMerchantOrderId: order.paymentMerchantOrderId,
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
