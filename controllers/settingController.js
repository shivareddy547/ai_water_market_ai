'use strict';
const settingService = require('../services/settingService');
class SettingController {
    async getSetting(req, res, next) {
        try {
            const setting = await settingService.getSetting(req.params.key);
            res.json({ success: true, data: setting });
        } catch (err) {
            next(err);
        }
    }
    async updateSetting(req, res, next) {
        try {
            const { value } = req.body;
            if (!value) {
                const err = new Error('Value is required');
                err.status = 400;
                throw err;
            }
            const setting = await settingService.updateSetting(req.params.key, value);
            res.json({ success: true, data: setting, message: 'Setting updated successfully' });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new SettingController();
