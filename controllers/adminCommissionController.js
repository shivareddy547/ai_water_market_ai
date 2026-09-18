'use strict';
const service = require('../services/adminCommissionService');
class AdminCommissionController {
    async getAllDues(req, res, next) {
        try {
            if (req.user.role !== 'admin') { const err = new Error('Only admin can view all dues'); err.status = 403; throw err; }
            const result = await service.getAllPendingDues();
            res.status(200).json({ success: true, data: result, message: 'Pending dues fetched successfully' });
        } catch (err) { next(err); }
    }
    /* NEW: Supplier fetches their own dues + stored payment link */
    async getMyDues(req, res, next) {
        try {
            if (req.user.role !== 'supplier') { const err = new Error('Only supplier can fetch their own dues'); err.status = 403; throw err; }
            const result = await service.getSupplierDues(req.user);
            res.status(200).json({ success: true, data: result, message: 'Supplier dues fetched' });
        } catch (err) { next(err); }
    }
    async createLink(req, res, next) {
        try {
            let { supplierId } = req.body;
            /* Admin can specify any supplierId; supplier can only create for themselves */
            if (req.user.role === 'supplier') { supplierId = req.user.id; }
            else if (req.user.role !== 'admin') { const err = new Error('Only admin or supplier can create commission links'); err.status = 403; throw err; }
            if (!supplierId) { const err = new Error('supplierId is required'); err.status = 400; throw err; }
            const result = await service.createCommissionPaymentLink(req.user, supplierId);
            res.status(200).json({ success: true, data: result, message: 'Commission payment link generated successfully' });
        } catch (err) { next(err); }
    }
    async verifyPayment(req, res, next) {
        try {
            /* Allow both admin and supplier to verify */
            if (req.user.role !== 'admin' && req.user.role !== 'supplier') { const err = new Error('Only admin or supplier can verify'); err.status = 403; throw err; }
            const { merchantOrderId } = req.params;
            const result = await service.verifyCommissionPayment(req.user, merchantOrderId);
            res.status(200).json({ success: true, data: result, message: 'Payment status verified' });
        } catch (err) { next(err); }
    }
}
module.exports = new AdminCommissionController();
