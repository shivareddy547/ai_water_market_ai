'use strict';
const settingService = require('../services/settingService');
class SettingController {
    async getSetting(req, res, next) {
        try {
            const { key } = req.params;
            if (!key) {
                const err = new Error('Setting key is required');
                err.status = 400;
                throw err;
            }
            const setting = await settingService.getSetting(key);
            res.json({
                success: true,
                data: setting
            });
        } catch (error) {
            next(error);
        }
    }
    async updateSetting(req, res, next) {
        try {
            const { key } = req.params;
            const { value } = req.body;
            if (!key) {
                const err = new Error('Setting key is required');
                err.status = 400;
                throw err;
            }
            if (value === undefined) {
                const err = new Error('Value is required');
                err.status = 400;
                throw err;
            }
            const setting = await settingService.upsertSetting(key, value);
            res.json({
                success: true,
                data: setting,
                message: 'Setting updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}
module.exports = new SettingController();
