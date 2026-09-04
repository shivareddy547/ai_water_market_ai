'use strict';
const userService = require('../services/userService');
class UserController {
    async getUsers(req, res, next) {
        try {
            const role = req.query.role || 'user';
            const users = await userService.getUsersByRole(role);
            res.json({ success: true, data: users });
        } catch (err) {
            next(err);
        }
    }
    async getSuppliers(req, res, next) {
        try {
            const users = await userService.getSuppliers();
            res.json({ success: true, data: users });
        } catch (err) {
            next(err);
        }
    }
    async updateUserActive(req, res, next) {
        try {
            const { isActive } = req.body;
            if (typeof isActive !== 'boolean') {
                const err = new Error('Invalid active status');
                err.status = 400;
                throw err;
            }
            const user = await userService.updateUserActive(req.params.id, isActive);
            res.json({ success: true, data: user, message: 'User status updated successfully' });
        } catch (err) {
            next(err);
        }
    }
    async updateStatus(req, res, next) {
        try {
            const { status, rejectReason } = req.body;
            if (!['pending', 'verified', 'rejected'].includes(status)) {
                const err = new Error('Invalid status');
                err.status = 400;
                throw err;
            }
            const user = await userService.updateSupplierStatus(req.params.id, status, rejectReason);
            res.json({ success: true, data: user, message: 'Status updated successfully' });
        } catch (err) {
            next(err);
        }
    }
    async updateUser(req, res, next) {
        try {
            const user = await userService.updateSupplier(req.params.id, req.body);
            res.json({ success: true, data: user, message: 'Supplier updated successfully' });
        } catch (err) {
            next(err);
        }
    }
    async deleteUser(req, res, next) {
        try {
            const result = await userService.deleteUser(req.params.id);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new UserController();
