'use strict';
const service = require('../services/adminCommissionService');
class AdminCommissionController {
    async getAllDues(req, res, next) { try { if (req.user.role !== 'admin') { const e = new Error('Admin only'); e.status = 403; throw e; } const r = await service.getAllPendingDues(); res.json({ success: true, data: r, message: 'Dues fetched' }); } catch (e) { next(e); } }
    async getMyDues(req, res, next) { try { if (req.user.role !== 'supplier') { const e = new Error('Supplier only'); e.status = 403; throw e; } const r = await service.getSupplierDues(req.user); res.json({ success: true, data: r, message: 'Dues fetched' }); } catch (e) { next(e); } }
    /* NEW: Get payment history for a specific supplier */
    async getHistory(req, res, next) { try { if (req.user.role !== 'admin') { const e = new Error('Admin only'); e.status = 403; throw e; } const { supplierId } = req.params; if (!supplierId) { const e = new Error('supplierId required'); e.status = 400; throw e; } const r = await service.getSupplierPaymentHistory(supplierId); res.json({ success: true, data: r, message: 'Payment history fetched' }); } catch (e) { next(e); } }
    async createLink(req, res, next) { try { let { supplierId } = req.body; if (req.user.role === 'supplier') supplierId = req.user.id; else if (req.user.role !== 'admin') { const e = new Error('Unauthorized'); e.status = 403; throw e; } if (!supplierId) { const e = new Error('supplierId required'); e.status = 400; throw e; } const r = await service.createCommissionPaymentLink(req.user, supplierId); res.json({ success: true, data: r, message: 'Link generated' }); } catch (e) { next(e); } }
    async verifyPayment(req, res, next) { try { if (req.user.role !== 'admin' && req.user.role !== 'supplier') { const e = new Error('Unauthorized'); e.status = 403; throw e; } const r = await service.verifyCommissionPayment(req.user, req.params.merchantOrderId); res.json({ success: true, data: r, message: 'Verified' }); } catch (e) { next(e); } }
}
module.exports = new AdminCommissionController();
