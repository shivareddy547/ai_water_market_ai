'use strict';
const addressService = require('../services/addressService');
class AddressController {
    async getAll(req, res, next) {
        try {
            const addresses = await addressService.getByUser(req.user.id);
            res.json({ success: true, data: addresses });
        } catch (err) {
            next(err);
        }
    }
    async create(req, res, next) {
        try {
            const address = await addressService.create(req.user.id, req.body);
            res.status(201).json({
                success: true,
                data: address,
                message: 'Address created successfully'
            });
        } catch (err) {
            next(err);
        }
    }
    async update(req, res, next) {
        try {
            const address = await addressService.update(
                req.params.id,
                req.user.id,
                req.body
            );
            res.json({
                success: true,
                data: address,
                message: 'Address updated successfully'
            });
        } catch (err) {
            next(err);
        }
    }
    async delete(req, res, next) {
        try {
            const result = await addressService.delete(req.params.id, req.user.id);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new AddressController();
