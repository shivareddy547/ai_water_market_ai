'use strict';
const { Provider, User } = require('../models');
const { Op } = require('sequelize');
class ProviderService {
    async getPublicPaymentProviders() {
        try {
            const providers = await Provider.findAll({
                where: {
                    providerType: 'payment',
                    isEnabled: true
                },
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['id', 'first_name', 'last_name', 'store_name', 'role']
                    }
                ],
                order: [['created_at', 'DESC']]
            });
            return providers.map(p => {
                const data = p.toJSON();
                const creds = data.credentials || {};
                return {
                    id: data.id,
                    name: data.name,
                    providerKey: data.providerKey,
                    providerType: data.providerType,
                    isEnabled: data.isEnabled,
                    targetType: data.targetType,
                    targetRole: data.targetRole,
                    userId: data.userId,
                    targetUser: data.user ? {
                        id: data.user.id,
                        firstName: data.user.first_name || data.user.firstName,
                        lastName: data.user.last_name || data.user.lastName,
                        storeName: data.user.store_name || data.user.storeName,
                        role: data.user.role
                    } : null,
                    displayLabel: creds.display_label || data.name,
                    instructions: creds.instructions || '',
                    minOrderAmount: creds.min_order_amount ? Number(creds.min_order_amount) : 0,
                    maxOrderAmount: creds.max_order_amount ? Number(creds.max_order_amount) : 0,
                    extraCharge: creds.extra_charge ? Number(creds.extra_charge) : 0,
                    environment: creds.environment || 'production'
                };
            });
        } catch (error) {
            console.error('Error fetching public payment providers:', error);
            const err = new Error('Failed to fetch payment providers');
            err.status = 500;
            throw err;
        }
    }
    async getAllProviders(user) {
        try {
            const where = {};
            if (user.role !== 'admin') {
                where[Op.or] = [
                    { userId: user.id },
                    { targetType: 'role', targetRole: user.role }
                ];
            }
            return await Provider.findAll({
                where,
                order: [['created_at', 'DESC']]
            });
        } catch (error) {
            console.error('Error fetching providers:', error);
            const err = new Error('Failed to fetch providers');
            err.status = 500;
            throw err;
        }
    }
    async getProviderById(id, user) {
        try {
            const where = { id };
            if (user.role !== 'admin') {
                where[Op.or] = [
                    { userId: user.id },
                    { targetType: 'role', targetRole: user.role }
                ];
            }
            const provider = await Provider.findOne({ where });
            if (!provider) {
                const err = new Error('Provider not found');
                err.status = 404;
                throw err;
            }
            return provider;
        } catch (error) {
            if (error.status) throw error;
            console.error('Error fetching provider:', error);
            const err = new Error('Failed to fetch provider');
            err.status = 500;
            throw err;
        }
    }
    async createProvider(data, user) {
        try {
            if (user.role !== 'admin') {
                const err = new Error('Not authorized to create provider');
                err.status = 403;
                throw err;
            }
            if (!data.provider_type || !['smtp', 'sms', 'social', 'payment', 'shipment'].includes(data.provider_type)) {
                const err = new Error('provider_type must be smtp, sms, social, payment, or shipment');
                err.status = 400;
                throw err;
            }
            if (!data.name || !data.name.trim()) {
                const err = new Error('Name is required');
                err.status = 400;
                throw err;
            }
            if (!data.credentials || typeof data.credentials !== 'object') {
                const err = new Error('Credentials must be a valid object');
                err.status = 400;
                throw err;
            }
            let userId = null;
            let targetType = 'user';
            let targetRole = null;
            if (data.targetType === 'role') {
                targetType = 'role';
                targetRole = data.targetRole;
                if (!targetRole) {
                    const err = new Error('targetRole is required for role target');
                    err.status = 400;
                    throw err;
                }
            } else {
                userId = data.userId;
                if (!userId) {
                    const err = new Error('userId is required for user target');
                    err.status = 400;
                    throw err;
                }
                const targetUser = await User.findByPk(userId);
                if (!targetUser) {
                    const err = new Error('Target user not found');
                    err.status = 404;
                    throw err;
                }
            }
            return await Provider.create({
                userId,
                targetType,
                targetRole,
                providerType: data.provider_type,
                name: data.name.trim(),
                providerKey: data.provider_key || null,
                isEnabled: data.is_enabled === true,
                credentials: data.credentials
            });
        } catch (error) {
            console.error('Error creating provider:', error);
            if (error.status) throw error;
            const err = new Error(error.message || 'Failed to create provider');
            err.status = 500;
            throw err;
        }
    }
    async updateProvider(id, data, user) {
        try {
            const where = { id };
            if (user.role !== 'admin') {
                where.userId = user.id;
            }
            const provider = await Provider.findOne({ where });
            if (!provider) {
                const err = new Error('Provider not found');
                err.status = 404;
                throw err;
            }
            if (data.name !== undefined) {
                if (!data.name || !data.name.trim()) {
                    const err = new Error('Name cannot be empty');
                    err.status = 400;
                    throw err;
                }
                provider.name = data.name.trim();
            }
            if (data.provider_key !== undefined) {
                provider.providerKey = data.provider_key || null;
            }
            if (data.provider_type !== undefined) {
                provider.providerType = data.provider_type;
            }
            if (data.credentials !== undefined) {
                if (typeof data.credentials !== 'object') {
                    const err = new Error('Credentials must be a valid object');
                    err.status = 400;
                    throw err;
                }
                provider.credentials = data.credentials;
            }
            if (data.is_enabled !== undefined) {
                provider.isEnabled = data.is_enabled === true;
            }
            if (data.targetType !== undefined) {
                if (data.targetType === 'role') {
                    provider.targetType = 'role';
                    provider.targetRole = data.targetRole;
                    provider.userId = null;
                } else {
                    provider.targetType = 'user';
                    provider.userId = data.userId;
                    provider.targetRole = null;
                }
            }
            await provider.save();
            return provider;
        } catch (error) {
            console.error('Error updating provider:', error);
            if (error.status) throw error;
            const err = new Error(error.message || 'Failed to update provider');
            err.status = 500;
            throw err;
        }
    }
    async toggleProvider(id, user) {
        try {
            const where = { id };
            if (user.role !== 'admin') {
                where.userId = user.id;
            }
            const provider = await Provider.findOne({ where });
            if (!provider) {
                const err = new Error('Provider not found');
                err.status = 404;
                throw err;
            }
            provider.isEnabled = !provider.isEnabled;
            await provider.save();
            return provider;
        } catch (error) {
            console.error('Error toggling provider:', error);
            if (error.status) throw error;
            const err = new Error(error.message || 'Failed to toggle provider');
            err.status = 500;
            throw err;
        }
    }
    async deleteProvider(id, user) {
        try {
            const where = { id };
            if (user.role !== 'admin') {
                where.userId = user.id;
            }
            const provider = await Provider.findOne({ where });
            if (!provider) {
                const err = new Error('Provider not found');
                err.status = 404;
                throw err;
            }
            await provider.destroy();
            return true;
        } catch (error) {
            console.error('Error deleting provider:', error);
            if (error.status) throw error;
            const err = new Error(error.message || 'Failed to delete provider');
            err.status = 500;
            throw err;
        }
    }
}
module.exports = new ProviderService();
