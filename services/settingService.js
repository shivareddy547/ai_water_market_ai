'use strict';
const { Setting } = require('../models');
class SettingService {
    async getSetting(key) {
        const setting = await Setting.findOne({ where: { key } });
        return setting || { key, value: {} };
    }
    async updateSetting(key, value) {
        const setting = await Setting.findOne({ where: { key } });
        if (setting) {
            setting.value = value;
            await setting.save();
            return setting;
        }
        return await Setting.create({ key, value });
    }
}
module.exports = new SettingService();
