'use strict';
const providerService = require('../services/providerService');
class ProviderController {
    async getPublicPayments(req, res, next) {
        try {
            const providers = await providerService.getPublicPaymentProviders();
            res.status(200).json({
                success: true,
                data: providers,
                message: 'Payment providers fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async getAll(req, res, next) {
        try {
            const providers = await providerService.getAllProviders(req.user);
            res.status(200).json({
                success: true,
                data: providers,
                message: 'Providers fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async getById(req, res, next) {
        try {
            const provider = await providerService.getProviderById(req.params.id, req.user);
            res.status(200).json({
                success: true,
                data: provider,
                message: 'Provider fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async create(req, res, next) {
        try {
            const provider = await providerService.createProvider(req.body, req.user);
            res.status(201).json({
                success: true,
                data: provider,
                message: 'Provider created successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async update(req, res, next) {
        try {
            const provider = await providerService.updateProvider(req.params.id, req.body, req.user);
            res.status(200).json({
                success: true,
                data: provider,
                message: 'Provider updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async toggle(req, res, next) {
        try {
            const provider = await providerService.toggleProvider(req.params.id, req.user);
            res.status(200).json({
                success: true,
                data: provider,
                message: `Provider ${provider.is_enabled ? 'enabled' : 'disabled'} successfully`
            });
        } catch (error) {
            next(error);
        }
    }
    async remove(req, res, next) {
        try {
            await providerService.deleteProvider(req.params.id, req.user);
            res.status(200).json({
                success: true,
                message: 'Provider deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async getActiveSmtp(req, res, next) {
        try {
            const provider = await providerService.getActiveSmtpProvider(req.user);
            res.status(200).json({
                success: true,
                data: provider,
                message: 'Active SMTP provider fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async getActiveSms(req, res, next) {
        try {
            const provider = await providerService.getActiveSmsProvider(req.user);
            res.status(200).json({
                success: true,
                data: provider,
                message: 'Active SMS provider fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
    async getActiveSetupProviders(req, res, next) {
        try {
            const result = await providerService.getActiveSetupProviders(req.user);
            res.status(200).json({
                success: true,
                data: result,
                message: 'Active setup providers fetched successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}
module.exports = new ProviderController();
