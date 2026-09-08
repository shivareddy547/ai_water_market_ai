'use strict';
const { Setting } = require('../models');
class SettingService {
    async getSetting(key) {
        if (!key) {
            const err = new Error('Setting key is required');
            err.status = 400;
            throw err;
        }
        const setting = await Setting.findOne({ where: { key } });
        if (!setting) {
            return { value: {} };
        }
        return setting;
    }
    async updateSetting(key, value) {
        if (!key) {
            const err = new Error('Setting key is required');
            err.status = 400;
            throw err;
        }
        let setting = await Setting.findOne({ where: { key } });
        if (!setting) {
            setting = await Setting.create({ key, value: value || {} });
        } else {
            setting.value = value || {};
            await setting.save();
        }
        return setting;
    }
}
module.exports = new SettingService();
