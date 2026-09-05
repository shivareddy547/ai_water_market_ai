'use strict';
const { CustomerAddress } = require('../models');
class AddressService {
    async getByUser(userId) {
        return await CustomerAddress.findAll({
            where: { userId },
            order: [['is_default', 'DESC'], ['created_at', 'DESC']]
        });
    }
    async create(userId, data) {
        const { label, fullName, phone, line, landmark, city, state, pincode, isDefault } = data;
        if (!fullName || !String(fullName).trim()) {
            const err = new Error('Full name is required');
            err.status = 400;
            throw err;
        }
        if (!line || !String(line).trim()) {
            const err = new Error('Street address is required');
            err.status = 400;
            throw err;
        }
        if (!city || !String(city).trim()) {
            const err = new Error('City is required');
            err.status = 400;
            throw err;
        }
        if (!pincode || !/^\d{6}$/.test(String(pincode).trim())) {
            const err = new Error('Pincode must be exactly 6 digits');
            err.status = 400;
            throw err;
        }
        if (isDefault) {
            await CustomerAddress.update(
                { isDefault: false },
                { where: { userId } }
            );
        }
        return await CustomerAddress.create({
            userId,
            label: label || 'Home',
            fullName: String(fullName).trim(),
            phone: phone ? String(phone).trim() : '',
            line: String(line).trim(),
            landmark: landmark ? String(landmark).trim() : '',
            city: String(city).trim(),
            state: state ? String(state).trim() : '',
            pincode: String(pincode).trim(),
            isDefault: !!isDefault
        });
    }
    async update(id, userId, data) {
        const address = await CustomerAddress.findOne({ where: { id, userId } });
        if (!address) {
            const err = new Error('Address not found');
            err.status = 404;
            throw err;
        }
        const { label, fullName, phone, line, landmark, city, state, pincode, isDefault } = data;
        if (pincode !== undefined && !/^\d{6}$/.test(String(pincode).trim())) {
            const err = new Error('Pincode must be exactly 6 digits');
            err.status = 400;
            throw err;
        }
        if (isDefault === true) {
            await CustomerAddress.update(
                { isDefault: false },
                { where: { userId } }
            );
        }
        if (label !== undefined) address.label = label;
        if (fullName !== undefined) address.fullName = String(fullName).trim();
        if (phone !== undefined) address.phone = phone;
        if (line !== undefined) address.line = String(line).trim();
        if (landmark !== undefined) address.landmark = landmark;
        if (city !== undefined) address.city = String(city).trim();
        if (state !== undefined) address.state = state;
        if (pincode !== undefined) address.pincode = String(pincode).trim();
        if (isDefault !== undefined) address.isDefault = isDefault;
        await address.save();
        return address;
    }
    async delete(id, userId) {
        const address = await CustomerAddress.findOne({ where: { id, userId } });
        if (!address) {
            const err = new Error('Address not found');
            err.status = 404;
            throw err;
        }
        await address.destroy();
        return { message: 'Address deleted successfully' };
    }
}
module.exports = new AddressService();
