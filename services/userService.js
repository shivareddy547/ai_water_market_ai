'use strict';
const { User } = require('../models');
class UserService {
    async getUsersByRole(role) {
        return await User.findAll({
            where: { role: role },
            order: [['created_at', 'DESC']]
        });
    }
    async getSuppliers() {
        return await User.findAll({
            where: { role: 'supplier' },
            order: [['created_at', 'DESC']]
        });
    }
    async updateUserActive(id, isActive) {
        const user = await User.findByPk(id);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        user.isActive = isActive;
        await user.save();
        return user;
    }
    async updateSupplierStatus(id, status, rejectReason = null) {
        const user = await User.findByPk(id);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        user.verificationStatus = status;
        if (status === 'rejected' && rejectReason) {
            user.rejectReason = rejectReason;
        } else {
            user.rejectReason = null;
        }
        if (status === 'verified') {
            user.isActive = true;
        }
        await user.save();
        return user;
    }
    async updateSupplier(id, data) {
        const user = await User.findByPk(id);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        const { storeName, firstName, lastName, businessType, description, commission, categories, address, city, stateName, pincode, gst } = data;
        if (storeName !== undefined) user.storeName = storeName;
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (businessType !== undefined) user.businessType = businessType;
        if (description !== undefined) user.description = description;
        if (commission !== undefined) user.commission = commission;
        if (categories !== undefined) user.categories = categories;
        if (address !== undefined) user.address = address;
        if (city !== undefined) user.city = city;
        if (stateName !== undefined) user.stateName = stateName;
        if (pincode !== undefined) user.pincode = pincode;
        if (gst !== undefined) user.gst = gst;
        await user.save();
        return user;
    }
    async deleteUser(id) {
        const user = await User.findByPk(id);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        await user.destroy();
        return { message: 'User deleted successfully' };
    }
}
module.exports = new UserService();
