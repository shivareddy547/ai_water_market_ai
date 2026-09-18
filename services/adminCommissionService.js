'use strict';
const { Op } = require('sequelize');
const { SupplierOrder, User, Provider, CustomerOrder } = require('../models');
const DEFAULT_PHONEPE_BASE_URL = process.env.PHONEPE_STATUS_BASE_URL || process.env.PHONEPE_BASE_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox';
const pick = (obj, keys) => { if (!obj || typeof obj !== 'object') return undefined; for (const k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]; } return undefined; };
const extractPhonePeCreds = (raw) => { if (!raw || typeof raw !== 'object') return {}; const c = raw.credentials || raw; return { clientId: pick(c, ['client_id', 'clientId', 'CLIENT_ID']), clientSecret: pick(c, ['client_secret', 'clientSecret', 'CLIENT_SECRET']), clientVersion: pick(c, ['client_version', 'clientVersion', 'CLIENT_VERSION']), merchantId: pick(c, ['merchantId', 'merchant_id', 'MERCHANT_ID', 'merchant', 'merchantID']), saltKey: pick(c, ['saltKey', 'salt_key', 'SALT_KEY', 'salt']), saltIndex: (() => { const v = pick(c, ['saltIndex', 'salt_index', 'SALT_INDEX', 'index']); return v !== undefined && v !== null ? String(v) : undefined; })(), baseUrl: pick(c, ['statusBaseUrl', 'statusUrl', 'statusBaseURL', 'pgBaseUrl', 'baseUrl', 'baseURL', 'apiUrl', 'host']), environment: pick(c, ['environment', 'env', 'ENVIRONMENT']) }; };
const normalizeState = (s) => String(s || '').toUpperCase().trim();
const COMPLETED_STATES = new Set(['COMPLETED', 'SUCCESS', 'PAYMENT_SUCCESS', 'PAID']);
const FAILED_STATES = new Set(['FAILED', 'PAYMENT_ERROR', 'PAYMENT_DECLINED', 'PAYMENT_CANCELLED', 'CANCELLED', 'EXPIRED', 'TIMED_OUT']);
const isCompletedState = (s) => COMPLETED_STATES.has(normalizeState(s));
const isFailedState = (s) => FAILED_STATES.has(normalizeState(s));

class AdminCommissionService {
    async _findAdminPhonePeProvider() {
        const nameClauses = [{ providerKey: 'phonepe' }, { providerKey: 'PhonePe' }, { providerKey: 'PHONEPE' }, { providerKey: 'phone_pe' }, { providerKey: { [Op.iLike]: '%phonepe%' } }, { name: { [Op.iLike]: '%phonepe%' } }];
        const typeFilter = { providerType: 'payment' };
        const adminProvider = await Provider.findOne({ where: { isEnabled: true, ...typeFilter, targetType: 'role', targetRole: 'admin', [Op.or]: nameClauses } });
        if (adminProvider) return adminProvider;
        const anyRoleProvider = await Provider.findOne({ where: { isEnabled: true, ...typeFilter, targetType: 'role', [Op.or]: nameClauses } });
        if (anyRoleProvider) return anyRoleProvider;
        return await Provider.findOne({ where: { ...typeFilter, isEnabled: true, [Op.or]: nameClauses }, order: [['created_at', 'DESC']] });
    }
    async _resolveAdminPhonePeConfig() {
        let baseUrl = DEFAULT_PHONEPE_BASE_URL, merchantId = process.env.PHONEPE_MERCHANT_ID || '', saltKey = process.env.PHONEPE_SALT_KEY || '', saltIndex = String(process.env.PHONEPE_SALT_INDEX || '1'), clientId = process.env.PHONEPE_CLIENT_ID || '', clientSecret = process.env.PHONEPE_CLIENT_SECRET || '', clientVersion = String(process.env.PHONEPE_CLIENT_VERSION || '1'), environment = process.env.PHONEPE_ENVIRONMENT || 'sandbox';
        const provider = await this._findAdminPhonePeProvider();
        if (provider && provider.credentials) { const creds = extractPhonePeCreds(provider.credentials); if (creds.baseUrl) baseUrl = creds.baseUrl; if (creds.merchantId) merchantId = creds.merchantId; if (creds.saltKey) saltKey = creds.saltKey; if (creds.saltIndex !== undefined && creds.saltIndex !== null) saltIndex = String(creds.saltIndex); if (creds.clientId) clientId = creds.clientId; if (creds.clientSecret) clientSecret = creds.clientSecret; if (creds.clientVersion) clientVersion = String(creds.clientVersion); if (creds.environment) environment = String(creds.environment); }
        return { baseUrl, merchantId, saltKey, saltIndex, clientId, clientSecret, clientVersion, environment, provider };
    }
    _resolveOAuthEndpoints(environment) {
        const env = String(environment || '').toLowerCase();
        if (env === 'production' || env === 'prod' || env === 'live') return { isProd: true, authUrl: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token', apiBase: 'https://api.phonepe.com/apis/pg' };
        return { isProd: false, authUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token', apiBase: 'https://api-preprod.phonepe.com/apis/pg-sandbox' };
    }
    async _getOAuthToken(cfg) {
        const { authUrl } = this._resolveOAuthEndpoints(cfg.environment);
        const body = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, client_version: String(cfg.clientVersion || '1'), grant_type: 'client_credentials' });
        const res = await fetch(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok || !data || !data.access_token) { const err = new Error(data?.message || `PhonePe OAuth failed (HTTP ${res.status})`); err.status = 502; err.providerResponse = data; throw err; }
        return data.access_token;
    }
    _interpretPhonePeResponse(data) {
        const providerData = data?.data || data || {};
        const topState = normalizeState(providerData.state || providerData.status || providerData.orderStatus || data?.code);
        const rawDetails = Array.isArray(providerData.paymentDetails) ? providerData.paymentDetails : [];
        const details = rawDetails.map(d => ({ ...d, normalizedState: normalizeState(d.state || d.status) }));
        const completedDetail = details.find(d => isCompletedState(d.normalizedState));
        const failedDetail = details.find(d => isFailedState(d.normalizedState));
        const pendingDetail = details.find(d => !isCompletedState(d.normalizedState) && !isFailedState(d.normalizedState));
        const topIsPaid = isCompletedState(topState); const topIsFailed = isFailedState(topState);
        let status = 'PENDING', providerState = topState || 'PENDING';
        if (topIsPaid || completedDetail) { status = 'PAID'; if (completedDetail) providerState = completedDetail.normalizedState; }
        else if (topIsFailed || (details.length > 0 && !pendingDetail && failedDetail)) { status = 'FAILED'; if (failedDetail) providerState = failedDetail.normalizedState; }
        const usableDetail = completedDetail || failedDetail || pendingDetail || null;
        const txnId = (usableDetail && usableDetail.transactionId) || providerData.transactionId || providerData.merchantTransactionId || data?.transactionId || null;
        const mode = (usableDetail && usableDetail.paymentMode) || providerData.paymentInstrument?.type || providerData.paymentMode || null;
        return { status, providerState, txnId, mode, rawData: data };
    }
    _adminDuesFor(order, commissionRate) {
        const itemsTotal = (order.items || order.lines || []).reduce((n, it) => n + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
        const base = itemsTotal > 0 ? itemsTotal : Number(order.total || order.grandTotal || 0) || 0;
        const commission = (base * (commissionRate || 10)) / 100;
        const platformFee = Number(order.platformFee ?? order.platform_fee ?? 0);
        return Math.round((commission + platformFee) * 100) / 100;
    }
    async _gatherUnpaidOrders(supplier, commissionRate) {
        const supplierId = supplier.id;
        const supplierStoreName = (supplier.storeName || `${supplier.firstName} ${supplier.lastName}`).toLowerCase();
        let unpaidOrders = []; let supplierOrderRecord = null;
        const allCustomerOrders = await CustomerOrder.findAll();
        supplierOrderRecord = await SupplierOrder.findOne({ where: { userId: supplierId } });
        if (supplierOrderRecord && Array.isArray(supplierOrderRecord.orders)) {
            const found = supplierOrderRecord.orders.filter(o => o.commissionPaid !== true);
            unpaidOrders = found.map(o => ({ ...o, _source: 'supplier_orders' }));
        }
        const seenIds = new Set(unpaidOrders.map(o => o.id));
        for (const co of allCustomerOrders) {
            const subKey = Array.isArray(co.subOrders) ? 'subOrders' : (Array.isArray(co.sub_orders) ? 'sub_orders' : null);
            if (!subKey) continue;
            const subs = co[subKey];
            for (let si = 0; si < subs.length; si++) {
                const sub = subs[si]; if (!sub || sub.commissionPaid === true) continue; if (seenIds.has(sub.id)) continue;
                const subSupplierName = String(sub.supplier || '').toLowerCase();
                const subSupplierId = sub.supplierId || sub.supplier_id || null;
                if (subSupplierId === supplierId || subSupplierName === supplierStoreName) {
                    const lines = sub.lines || [];
                    const itemsTotal = lines.reduce((n, l) => n + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
                    const grandTotal = Number(sub.grandTotal) || (itemsTotal + Number(sub.shipping || 0) + Number(sub.depositTotal || 0) + Number(sub.platformFee || 0));
                    unpaidOrders.push({ id: sub.id, customer: co.orderNumber || co.order_number || 'Customer', phone: sub.address?.phone || '', total: grandTotal, items: lines.map(l => ({ name: l.name, qty: l.qty, price: l.price })), platformFee: Number(sub.platformFee) || 0, commissionPaid: false, _source: 'customer_orders', _coRecord: co, _subIndex: si });
                    seenIds.add(sub.id);
                }
            }
        }
        return { unpaidOrders, supplierOrderRecord, allCustomerOrders };
    }
    async getAllPendingDues() {
        try {
            const suppliers = await User.findAll({ where: { role: 'supplier' } });
            const allSupplierOrders = await SupplierOrder.findAll();
            const allCustomerOrders = await CustomerOrder.findAll();
            const result = {};
            for (const supplier of suppliers) {
                const commissionRate = supplier.commission || 10;
                const supplierStoreName = (supplier.storeName || `${supplier.firstName} ${supplier.lastName}`).toLowerCase();
                let unpaidOrders = []; const seenIds = new Set();
                const so = allSupplierOrders.find(s => s.userId === supplier.id);
                if (so && Array.isArray(so.orders)) { const found = so.orders.filter(o => o.commissionPaid !== true); found.forEach(o => { unpaidOrders.push(o); seenIds.add(o.id); }); }
                for (const co of allCustomerOrders) {
                    const subKey = Array.isArray(co.subOrders) ? 'subOrders' : (Array.isArray(co.sub_orders) ? 'sub_orders' : null);
                    if (!subKey) continue; const subs = co[subKey];
                    for (const sub of subs) { if (!sub || sub.commissionPaid === true) continue; if (seenIds.has(sub.id)) continue;
                        const subSupplierName = String(sub.supplier || '').toLowerCase(); const subSupplierId = sub.supplierId || sub.supplier_id;
                        if (subSupplierId === supplier.id || subSupplierName === supplierStoreName) { const lines = sub.lines || []; const itemsTotal = lines.reduce((n, l) => n + (Number(l.price) || 0) * (Number(l.qty) || 0), 0); const grandTotal = Number(sub.grandTotal) || (itemsTotal + Number(sub.shipping || 0) + Number(sub.depositTotal || 0) + Number(sub.platformFee || 0)); unpaidOrders.push({ total: grandTotal, items: lines, platformFee: Number(sub.platformFee) || 0 }); seenIds.add(sub.id); } }
                }
                if (unpaidOrders.length > 0) { const totalDues = unpaidOrders.reduce((sum, o) => sum + this._adminDuesFor(o, commissionRate), 0); if (totalDues > 0) result[supplier.id] = { amount: totalDues, orderCount: unpaidOrders.length }; }
            }
            return result;
        } catch (error) { console.error('[AdminCommission] getAllPendingDues error:', error); const err = new Error(error.message || 'Failed to fetch pending dues'); err.status = 500; throw err; }
    }
    /* NEW: Supplier fetches their own dues + stored payment link */
    async getSupplierDues(user) {
        try {
            const { unpaidOrders } = await this._gatherUnpaidOrders(user, user.commission || 10);
            const totalDues = unpaidOrders.reduce((sum, o) => sum + this._adminDuesFor(o, user.commission || 10), 0);
            const orderWithLink = unpaidOrders.find(o => o.commissionPaymentLink);
            return { amount: totalDues, orderCount: unpaidOrders.length, paymentLink: orderWithLink?.commissionPaymentLink || null, merchantOrderId: orderWithLink?.commissionMerchantOrderId || null };
        } catch (error) { if (error.status) throw error; console.error('[AdminCommission] getSupplierDues error:', error); const err = new Error(error.message || 'Failed to fetch supplier dues'); err.status = 500; throw err; }
    }
    async createCommissionPaymentLink(adminUser, supplierId) {
        try {
            const cfg = await this._resolveAdminPhonePeConfig();
            if (!cfg.clientId || !cfg.clientSecret) { const err = new Error('Admin PhonePe credentials not configured. Configure a PhonePe provider with target "All Admins".'); err.status = 400; throw err; }
            const supplier = await User.findByPk(supplierId);
            if (!supplier) { const e = new Error('Supplier not found'); e.status = 404; throw e; }
            if (supplier.role !== 'supplier') { const e = new Error('Target user is not a supplier'); e.status = 400; throw e; }
            const commissionRate = supplier.commission || 10;
            const supplierName = supplier.storeName || `${supplier.firstName} ${supplier.lastName}`;
            const { unpaidOrders, supplierOrderRecord, allCustomerOrders } = await this._gatherUnpaidOrders(supplier, commissionRate);
            if (unpaidOrders.length === 0) { const err = new Error('No pending admin dues for this supplier.'); err.status = 400; throw err; }
            const totalDues = unpaidOrders.reduce((sum, o) => sum + this._adminDuesFor(o, commissionRate), 0);
            if (totalDues <= 0) { const err = new Error('Total pending amount is zero'); err.status = 400; throw err; }
            const accessToken = await this._getOAuthToken(cfg);
            const { apiBase } = this._resolveOAuthEndpoints(cfg.environment);
            const payUrl = `${apiBase}/paylinks/v1/pay`;
            const merchantOrderId = `COMM-${String(supplierId).substring(0, 8)}-${Date.now()}`;
            const amountInPaise = Math.round(totalDues * 100);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const description = `Commission ${unpaidOrders.length} orders - ${supplierName}`.substring(0, 149);
            /* FIX: redirectUrl points to SUPPLIER orders page (not admin) so supplier pays */
            const payRequestBody = {
                merchantOrderId, description, amount: amountInPaise,
                paymentFlow: { type: 'PAYLINK', customerDetails: { name: supplierName, phoneNumber: (supplier.phone || '').replace(/\D/g, '').slice(-10) }, notificationChannels: { SMS: true, EMAIL: false }, expireAt: Date.now() + 24 * 60 * 60 * 1000, redirectUrl: `${frontendUrl}/supplier/orders?comm_payment=return&moid=${encodeURIComponent(merchantOrderId)}` },
                metaInfo: { udf1: 'ADMIN_COMMISSION', udf2: supplierId, udf3: String(unpaidOrders.length), udf4: String(totalDues) }
            };
            const res = await fetch(payUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `O-Bearer ${accessToken}` }, body: JSON.stringify(payRequestBody) });
            const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok || !data || !data.paylinkUrl) { const errMsg = data?.message || `PhonePe link generation failed (HTTP ${res.status})`; const err = new Error(errMsg); err.status = 502; err.providerResponse = data; throw err; }
            const nowIso = new Date().toISOString();
            if (supplierOrderRecord && Array.isArray(supplierOrderRecord.orders)) {
                const updatedOrders = supplierOrderRecord.orders.map(o => { const isUnpaid = unpaidOrders.find(u => u.id === o.id && u._source === 'supplier_orders'); if (!isUnpaid) return o; return { ...o, commissionMerchantOrderId: merchantOrderId, commissionBatchId: merchantOrderId, commissionPaymentLink: data.paylinkUrl, commissionPaymentState: 'CREATED', commissionPaymentAmount: this._adminDuesFor(o, commissionRate), commissionPaymentCreatedAt: nowIso, commissionPaymentFailureReason: null }; });
                supplierOrderRecord.orders = updatedOrders; supplierOrderRecord.changed('orders', true); await supplierOrderRecord.save();
            }
            for (const co of allCustomerOrders) {
                const subKey = Array.isArray(co.subOrders) ? 'subOrders' : (Array.isArray(co.sub_orders) ? 'sub_orders' : null);
                if (!subKey) continue; const subs = [...co[subKey]]; let modified = false;
                for (let si = 0; si < subs.length; si++) { const sub = subs[si]; if (!sub) continue; const matchingOrder = unpaidOrders.find(u => u.id === sub.id && u._source === 'customer_orders'); if (matchingOrder) { subs[si] = { ...sub, commissionMerchantOrderId: merchantOrderId, commissionBatchId: merchantOrderId, commissionPaymentLink: data.paylinkUrl, commissionPaymentState: 'CREATED', commissionPaymentAmount: this._adminDuesFor(matchingOrder, commissionRate), commissionPaymentCreatedAt: nowIso, commissionPaymentFailureReason: null }; modified = true; } }
                if (modified) { co[subKey] = subs; co.changed(subKey, true); await co.save(); }
            }
            return { redirectUrl: data.paylinkUrl, merchantOrderId, amount: totalDues, orderCount: unpaidOrders.length, orderIds: unpaidOrders.map(o => o.id), supplierName, supplierId, phonepeOrderId: data.orderId || null };
        } catch (error) { if (error.status) throw error; console.error('[AdminCommission] createCommissionPaymentLink error:', error); const err = new Error(error.message || 'Failed to create commission payment link'); err.status = 500; throw err; }
    }
    async verifyCommissionPayment(user, merchantOrderId) {
        try {
            if (!merchantOrderId) { const err = new Error('merchantOrderId is required'); err.status = 400; throw err; }
            let totalLinkedCount = 0, supplierId = null;
            const allSupplierOrders = await SupplierOrder.findAll();
            let linkedSupplierOrder = null;
            for (const so of allSupplierOrders) { const orders = so.orders || []; const found = orders.filter(o => o.commissionMerchantOrderId === merchantOrderId || o.commissionBatchId === merchantOrderId); if (found.length > 0) { linkedSupplierOrder = so; totalLinkedCount += found.length; supplierId = so.userId; break; } }
            const allCustomerOrders = await CustomerOrder.findAll();
            const linkedCustomerOrders = [];
            for (const co of allCustomerOrders) { const subKey = Array.isArray(co.subOrders) ? 'subOrders' : (Array.isArray(co.sub_orders) ? 'sub_orders' : null); if (!subKey) continue; const subs = co[subKey]; const indices = []; for (let si = 0; si < subs.length; si++) { if (subs[si] && (subs[si].commissionMerchantOrderId === merchantOrderId || subs[si].commissionBatchId === merchantOrderId)) indices.push(si); } if (indices.length > 0) { linkedCustomerOrders.push({ record: co, subKey, indices }); totalLinkedCount += indices.length; } }
            if (totalLinkedCount === 0) { const err = new Error('No orders linked to this payment'); err.status = 404; throw err; }
            const cfg = await this._resolveAdminPhonePeConfig();
            const accessToken = await this._getOAuthToken(cfg);
            const { apiBase } = this._resolveOAuthEndpoints(cfg.environment);
            const statusUrl = `${apiBase}/paylinks/v1/${encodeURIComponent(merchantOrderId)}/status?details=true`;
            const res = await fetch(statusUrl, { method: 'GET', headers: { 'Content-Type': 'application/json', 'Authorization': `O-Bearer ${accessToken}` } });
            const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
            const interpreted = this._interpretPhonePeResponse(data);
            const { status, providerState } = interpreted;
            let commissionPaid = false, failureReason = null;
            if (status === 'PAID') commissionPaid = true;
            else if (status === 'FAILED') failureReason = 'Payment failed';
            if (linkedSupplierOrder) { const orders = linkedSupplierOrder.orders || []; const updated = orders.map(o => { if (o.commissionMerchantOrderId !== merchantOrderId && o.commissionBatchId !== merchantOrderId) return o; return { ...o, commissionPaymentState: providerState, commissionPaid, commissionPaymentFailureReason: failureReason }; }); linkedSupplierOrder.orders = updated; linkedSupplierOrder.changed('orders', true); await linkedSupplierOrder.save(); }
            for (const { record, subKey, indices } of linkedCustomerOrders) { const subs = [...record[subKey]]; for (const si of indices) { subs[si] = { ...subs[si], commissionPaymentState: providerState, commissionPaid, commissionPaymentFailureReason: failureReason }; } record[subKey] = subs; record.changed(subKey, true); await record.save(); }
            return { merchantOrderId, state: providerState, commissionPaid, failureReason, paidCount: commissionPaid ? totalLinkedCount : 0, orderCount: totalLinkedCount, supplierId };
        } catch (error) { if (error.status) throw error; console.error('[AdminCommission] verifyCommissionPayment error:', error); const err = new Error(error.message || 'Failed to verify commission payment'); err.status = 500; throw err; }
    }
}
module.exports = new AdminCommissionService();
