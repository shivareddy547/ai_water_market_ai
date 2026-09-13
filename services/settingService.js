'use strict';
const { Setting } = require('../models');
class SettingService {
    async getSetting(key) {
        try {
            const setting = await Setting.findOne({ where: { key } });
            return setting;
        } catch (error) {
            const err = new Error('Failed to fetch setting');
            err.status = 500;
            throw err;
        }
    }
    async upsertSetting(key, value) {
        try {
            let setting = await Setting.findOne({ where: { key } });
            if (setting) {
                setting.value = value;
                await setting.save();
                return setting;
            }
            setting = await Setting.create({ key, value });
            return setting;
        } catch (error) {
            const err = new Error('Failed to save setting');
            err.status = 500;
            throw err;
        }
    }
}
module.exports = new SettingService();
