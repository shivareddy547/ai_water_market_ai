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
        if (env === 'production' || env === 'prod' || env === 'live') return { authUrl: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token', apiBase: 'https://api.phonepe.com/apis/pg' };
        return { authUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token', apiBase: 'https://api-preprod.phonepe.com/apis/pg-sandbox' };
    }
    async _getOAuthToken(cfg) {
        const { authUrl } = this._resolveOAuthEndpoints(cfg.environment);
        const body = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, client_version: String(cfg.clientVersion || '1'), grant_type: 'client_credentials' });
        const res = await fetch(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok || !data || !data.access_token) { const err = new Error(data?.message || `OAuth failed (${res.status})`); err.status = 502; throw err; }
        return data.access_token;
    }
    _interpretPhonePeResponse(data) {
        const pd = data?.data || data || {};
        const topState = normalizeState(pd.state || pd.status || pd.orderStatus || data?.code);
        const rawDetails = Array.isArray(pd.paymentDetails) ? pd.paymentDetails : [];
        const details = rawDetails.map(d => ({ ...d, ns: normalizeState(d.state || d.status) }));
        const cd = details.find(d => isCompletedState(d.ns));
        const fd = details.find(d => isFailedState(d.ns));
        const pnd = details.find(d => !isCompletedState(d.ns) && !isFailedState(d.ns));
        const tPaid = isCompletedState(topState); const tFailed = isFailedState(topState);
        let status = 'PENDING', ps = topState || 'PENDING';
        if (tPaid || cd) { status = 'PAID'; if (cd) ps = cd.ns; }
        else if (tFailed || (details.length > 0 && !pnd && fd)) { status = 'FAILED'; if (fd) ps = fd.ns; }
        return { status, providerState: ps, rawData: data };
    }
    _adminDuesFor(order, commissionRate) {
        const itemsTotal = (order.items || order.lines || []).reduce((n, it) => n + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
        const base = itemsTotal > 0 ? itemsTotal : Number(order.total || order.grandTotal || 0) || 0;
        return Math.round(((base * (commissionRate || 10)) / 100 + Number(order.platformFee ?? order.platform_fee ?? 0)) * 100) / 100;
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
            if (!subKey) continue; const subs = co[subKey];
            for (let si = 0; si < subs.length; si++) {
                const sub = subs[si]; if (!sub || sub.commissionPaid === true) continue; if (seenIds.has(sub.id)) continue;
                const subName = String(sub.supplier || '').toLowerCase(); const subId = sub.supplierId || sub.supplier_id || null;
                if (subId === supplierId || subName === supplierStoreName) {
                    const lines = sub.lines || []; const it = lines.reduce((n, l) => n + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
                    const gt = Number(sub.grandTotal) || (it + Number(sub.shipping || 0) + Number(sub.depositTotal || 0) + Number(sub.platformFee || 0));
                    unpaidOrders.push({ id: sub.id, customer: co.orderNumber || co.order_number || 'Customer', phone: sub.address?.phone || '', total: gt, items: lines.map(l => ({ name: l.name, qty: l.qty, price: l.price })), platformFee: Number(sub.platformFee) || 0, commissionPaid: false, _source: 'customer_orders', _coRecord: co, _subIndex: si });
                    seenIds.add(sub.id);
                }
            }
        }
        return { unpaidOrders, supplierOrderRecord, allCustomerOrders };
    }
    async getAllPendingDues() {
        try {
            const suppliers = await User.findAll({ where: { role: 'supplier' } });
            const allSO = await SupplierOrder.findAll(); const allCO = await CustomerOrder.findAll();
            const result = {};
            for (const supplier of suppliers) {
                const cr = supplier.commission || 10; const sName = (supplier.storeName || `${supplier.firstName} ${supplier.lastName}`).toLowerCase();
                let unpaid = []; const seen = new Set();
                const so = allSO.find(s => s.userId === supplier.id);
                if (so && Array.isArray(so.orders)) { so.orders.filter(o => o.commissionPaid !== true).forEach(o => { unpaid.push(o); seen.add(o.id); }); }
                for (const co of allCO) { const sk = Array.isArray(co.subOrders) ? 'subOrders' : (Array.isArray(co.sub_orders) ? 'sub_orders' : null); if (!sk) continue; for (const sub of co[sk]) { if (!sub || sub.commissionPaid === true) continue; if (seen.has(sub.id)) continue; const sn = String(sub.supplier || '').toLowerCase(); const si = sub.supplierId || sub.supplier_id; if (si === supplier.id || sn === sName) { const l = sub.lines || []; const it = l.reduce((n, x) => n + (Number(x.price) || 0) * (Number(x.qty) || 0), 0); unpaid.push({ total: Number(sub.grandTotal) || (it + Number(sub.shipping || 0) + Number(sub.depositTotal || 0) + Number(sub.platformFee || 0)), items: l, platformFee: Number(sub.platformFee) || 0 }); seen.add(sub.id); } } }
                if (unpaid.length > 0) { const td = unpaid.reduce((s, o) => s + this._adminDuesFor(o, cr), 0); if (td > 0) result[supplier.id] = { amount: td, orderCount: unpaid.length }; }
            }
            return result;
        } catch (error) { console.error('[AdminCommission] getAllPendingDues:', error); const err = new Error(error.message || 'Failed'); err.status = 500; throw err; }
    }
    async getSupplierDues(user) {
        try {
            const { unpaidOrders } = await this._gatherUnpaidOrders(user, user.commission || 10);
            const td = unpaidOrders.reduce((s, o) => s + this._adminDuesFor(o, user.commission || 10), 0);
            const owl = unpaidOrders.find(o => o.commissionPaymentLink);
            return { amount: td, orderCount: unpaidOrders.length, paymentLink: owl?.commissionPaymentLink || null, merchantOrderId: owl?.commissionMerchantOrderId || null };
        } catch (error) { if (error.status) throw error; console.error('[AdminCommission] getSupplierDues:', error); const err = new Error(error.message || 'Failed'); err.status = 500; throw err; }
    }
    /* NEW: Get full payment history for a supplier — all batches (paid + pending) + unbilled orders */
    async getSupplierPaymentHistory(supplierId) {
        try {
            const supplier = await User.findByPk(supplierId);
            if (!supplier) { const e = new Error('Supplier not found'); e.status = 404; throw e; }
            const supplierStoreName = (supplier.storeName || `${supplier.firstName} ${supplier.lastName}`).toLowerCase();
            const cr = supplier.commission || 10;
            const supplierOrderRecord = await SupplierOrder.findOne({ where: { userId: supplierId } });
            const allCustomerOrders = await CustomerOrder.findAll();
            let allOrders = [];
            /* From supplier_orders — ALL orders (paid + unpaid) */
            if (supplierOrderRecord && Array.isArray(supplierOrderRecord.orders)) {
                allOrders = supplierOrderRecord.orders.map(o => ({
                    id: o.id, customer: o.customer || '', total: o.total || 0, items: o.items || [],
                    platformFee: Number(o.platformFee) || 0, commissionPaid: o.commissionPaid,
                    commissionMerchantOrderId: o.commissionMerchantOrderId, commissionBatchId: o.commissionBatchId,
                    commissionPaymentLink: o.commissionPaymentLink, commissionPaymentState: o.commissionPaymentState,
                    commissionPaymentAmount: o.commissionPaymentAmount, commissionPaymentCreatedAt: o.commissionPaymentCreatedAt,
                    commissionPaymentFailureReason: o.commissionPaymentFailureReason,
                }));
            }
            /* From customer_orders — match by store name or supplierId */
            const seenIds = new Set(allOrders.map(o => o.id));
            for (const co of allCustomerOrders) {
                const sk = Array.isArray(co.subOrders) ? 'subOrders' : (Array.isArray(co.sub_orders) ? 'sub_orders' : null);
                if (!sk) continue;
                for (const sub of co[sk]) {
                    if (!sub || seenIds.has(sub.id)) continue;
                    const sn = String(sub.supplier || '').toLowerCase();
                    const si = sub.supplierId || sub.supplier_id;
                    if (si === supplierId || sn === supplierStoreName) {
                        const l = sub.lines || [];
                        const it = l.reduce((n, x) => n + (Number(x.price) || 0) * (Number(x.qty) || 0), 0);
                        const gt = Number(sub.grandTotal) || (it + Number(sub.shipping || 0) + Number(sub.depositTotal || 0) + Number(sub.platformFee || 0));
                        allOrders.push({
                            id: sub.id, customer: co.orderNumber || co.order_number || 'Customer', total: gt, items: l,
                            platformFee: Number(sub.platformFee) || 0, commissionPaid: sub.commissionPaid,
                            commissionMerchantOrderId: sub.commissionMerchantOrderId, commissionBatchId: sub.commissionBatchId,
                            commissionPaymentLink: sub.commissionPaymentLink, commissionPaymentState: sub.commissionPaymentState,
                            commissionPaymentAmount: sub.commissionPaymentAmount, commissionPaymentCreatedAt: sub.commissionPaymentCreatedAt,
                            commissionPaymentFailureReason: sub.commissionPaymentFailureReason,
                        });
                        seenIds.add(sub.id);
                    }
                }
            }
            /* Group orders by commissionMerchantOrderId into payment batches */
            const batches = {};
            const unbilledOrders = [];
            for (const order of allOrders) {
                const moid = order.commissionMerchantOrderId || order.commissionBatchId;
                const dues = this._adminDuesFor(order, cr);
                if (moid) {
                    if (!batches[moid]) {
                        batches[moid] = {
                            merchantOrderId: moid, orders: [], totalAmount: 0,
                            state: order.commissionPaymentState || 'UNKNOWN',
                            commissionPaid: order.commissionPaid === true,
                            paymentLink: order.commissionPaymentLink || null,
                            createdAt: order.commissionPaymentCreatedAt || null,
                            failureReason: order.commissionPaymentFailureReason || null,
                        };
                    }
                    batches[moid].orders.push({ orderId: order.id, customer: order.customer || '', total: order.total || 0, commissionAmount: dues, commissionPaid: order.commissionPaid === true });
                    batches[moid].totalAmount += dues;
                    if (order.commissionPaymentState) batches[moid].state = order.commissionPaymentState;
                } else {
                    if (dues > 0 && order.commissionPaid !== true) {
                        unbilledOrders.push({ orderId: order.id, customer: order.customer || '', total: order.total || 0, commissionAmount: dues });
                    }
                }
            }
            const batchList = Object.values(batches).map(b => ({ ...b, totalAmount: Math.round(b.totalAmount * 100) / 100 }))
                .sort((a, b) => { const at = a.createdAt ? new Date(a.createdAt).getTime() : 0; const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0; return bt - at; });
            const totalPaid = batchList.filter(b => b.commissionPaid).reduce((s, b) => s + b.totalAmount, 0);
            const totalPendingUnbilled = unbilledOrders.reduce((s, o) => s + o.commissionAmount, 0);
            const totalPendingBilled = batchList.filter(b => !b.commissionPaid && b.state !== 'FAILED').reduce((s, b) => s + b.totalAmount, 0);
            return {
                supplierId, supplierName: supplier.storeName || `${supplier.firstName} ${supplier.lastName}`, commissionRate: cr,
                totalPaid: Math.round(totalPaid * 100) / 100,
                totalPending: Math.round((totalPendingUnbilled + totalPendingBilled) * 100) / 100,
                totalOrders: allOrders.length, paymentBatches: batchList, unbilledOrders,
            };
        } catch (error) { if (error.status) throw error; console.error('[AdminCommission] getSupplierPaymentHistory:', error); const err = new Error(error.message || 'Failed'); err.status = 500; throw err; }
    }
    async createCommissionPaymentLink(adminUser, supplierId) {
        try {
            const cfg = await this._resolveAdminPhonePeConfig();
            if (!cfg.clientId || !cfg.clientSecret) { const err = new Error('Admin PhonePe credentials not configured.'); err.status = 400; throw err; }
            const supplier = await User.findByPk(supplierId);
            if (!supplier) { const e = new Error('Supplier not found'); e.status = 404; throw e; }
            if (supplier.role !== 'supplier') { const e = new Error('Not a supplier'); e.status = 400; throw e; }
            const cr = supplier.commission || 10; const sName = supplier.storeName || `${supplier.firstName} ${supplier.lastName}`;
            const { unpaidOrders, supplierOrderRecord, allCustomerOrders } = await this._gatherUnpaidOrders(supplier, cr);
            if (!unpaidOrders.length) { const e = new Error('No pending dues'); e.status = 400; throw e; }
            const td = unpaidOrders.reduce((s, o) => s + this._adminDuesFor(o, cr), 0);
            if (td <= 0) { const e = new Error('Zero amount'); e.status = 400; throw e; }
            const at = await this._getOAuthToken(cfg); const { apiBase } = this._resolveOAuthEndpoints(cfg.environment);
            const moid = `COMM-${String(supplierId).substring(0, 8)}-${Date.now()}`;
            const desc = `Commission ${unpaidOrders.length} orders - ${sName}`.substring(0, 149);
            const fu = process.env.FRONTEND_URL || 'http://localhost:3000';
            const res = await fetch(`${apiBase}/paylinks/v1/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `O-Bearer ${at}` }, body: JSON.stringify({ merchantOrderId: moid, description: desc, amount: Math.round(td * 100), paymentFlow: { type: 'PAYLINK', customerDetails: { name: sName, phoneNumber: (supplier.phone || '').replace(/\D/g, '').slice(-10) }, notificationChannels: { SMS: true, EMAIL: false }, expireAt: Date.now() + 86400000, redirectUrl: `${fu}/supplier/orders?comm_payment=return&moid=${encodeURIComponent(moid)}` }, metaInfo: { udf1: 'ADMIN_COMMISSION', udf2: supplierId, udf3: String(unpaidOrders.length), udf4: String(td) } }) });
            const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok || !data || !data.paylinkUrl) { const e = new Error(data?.message || `Link failed (${res.status})`); e.status = 502; throw e; }
            const now = new Date().toISOString();
            if (supplierOrderRecord && Array.isArray(supplierOrderRecord.orders)) {
                supplierOrderRecord.orders = supplierOrderRecord.orders.map(o => { const u = unpaidOrders.find(x => x.id === o.id && x._source === 'supplier_orders'); return u ? { ...o, commissionMerchantOrderId: moid, commissionBatchId: moid, commissionPaymentLink: data.paylinkUrl, commissionPaymentState: 'CREATED', commissionPaymentAmount: this._adminDuesFor(o, cr), commissionPaymentCreatedAt: now } : o; });
                supplierOrderRecord.changed('orders', true); await supplierOrderRecord.save();
            }
            for (const co of allCustomerOrders) { const sk = Array.isArray(co.subOrders) ? 'subOrders' : (Array.isArray(co.sub_orders) ? 'sub_orders' : null); if (!sk) continue; const subs = [...co[sk]]; let mod = false; for (let si = 0; si < subs.length; si++) { const sub = subs[si]; if (!sub) continue; const m = unpaidOrders.find(u => u.id === sub.id && u._source === 'customer_orders'); if (m) { subs[si] = { ...sub, commissionMerchantOrderId: moid, commissionBatchId: moid, commissionPaymentLink: data.paylinkUrl, commissionPaymentState: 'CREATED', commissionPaymentAmount: this._adminDuesFor(m, cr), commissionPaymentCreatedAt: now }; mod = true; } } if (mod) { co[sk] = subs; co.changed(sk, true); await co.save(); } }
            return { redirectUrl: data.paylinkUrl, merchantOrderId: moid, amount: td, orderCount: unpaidOrders.length, orderIds: unpaidOrders.map(o => o.id), supplierName: sName, supplierId, phonepeOrderId: data.orderId || null };
        } catch (error) { if (error.status) throw error; console.error('[AdminCommission] createLink:', error); const err = new Error(error.message || 'Failed'); err.status = 500; throw err; }
    }
    async verifyCommissionPayment(user, moid) {
        try {
            if (!moid) { const e = new Error('moid required'); e.status = 400; throw e; }
            let count = 0, sid = null; let lso = null;
            const allSO = await SupplierOrder.findAll();
            for (const so of allSO) { const f = (so.orders || []).filter(o => o.commissionMerchantOrderId === moid || o.commissionBatchId === moid); if (f.length) { lso = so; count += f.length; sid = so.userId; break; } }
            const allCO = await CustomerOrder.findAll(); const lco = [];
            for (const co of allCO) { const sk = Array.isArray(co.subOrders) ? 'subOrders' : (Array.isArray(co.sub_orders) ? 'sub_orders' : null); if (!sk) continue; const idx = []; for (let si = 0; si < co[sk].length; si++) { if (co[sk][si] && (co[sk][si].commissionMerchantOrderId === moid || co[sk][si].commissionBatchId === moid)) idx.push(si); } if (idx.length) { lco.push({ r: co, sk, idx }); count += idx.length; } }
            if (!count) { const e = new Error('Not found'); e.status = 404; throw e; }
            const cfg = await this._resolveAdminPhonePeConfig(); const at = await this._getOAuthToken(cfg); const { apiBase } = this._resolveOAuthEndpoints(cfg.environment);
            const res = await fetch(`${apiBase}/paylinks/v1/${encodeURIComponent(moid)}/status?details=true`, { method: 'GET', headers: { 'Content-Type': 'application/json', 'Authorization': `O-Bearer ${at}` } });
            const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
            const { status, providerState } = this._interpretPhonePeResponse(data);
            let paid = false, fr = null; if (status === 'PAID') paid = true; else if (status === 'FAILED') fr = 'Failed';
            if (lso) { lso.orders = (lso.orders || []).map(o => (o.commissionMerchantOrderId === moid || o.commissionBatchId === moid) ? { ...o, commissionPaymentState: providerState, commissionPaid: paid, commissionPaymentFailureReason: fr } : o); lso.changed('orders', true); await lso.save(); }
            for (const { r, sk, idx } of lco) { const subs = [...r[sk]]; for (const si of idx) { subs[si] = { ...subs[si], commissionPaymentState: providerState, commissionPaid: paid, commissionPaymentFailureReason: fr }; } r[sk] = subs; r.changed(sk, true); await r.save(); }
            return { merchantOrderId: moid, state: providerState, commissionPaid: paid, failureReason: fr, paidCount: paid ? count : 0, orderCount: count, supplierId: sid };
        } catch (error) { if (error.status) throw error; console.error('[AdminCommission] verify:', error); const err = new Error(error.message || 'Failed'); err.status = 500; throw err; }
    }
}
module.exports = new AdminCommissionService();
