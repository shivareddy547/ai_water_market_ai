const { Setting } = require('../models');
const getSetting = async (key) => {
    try {
        const setting = await Setting.findOne({ where: { key } });
        return setting;
    } catch (error) {
        const err = new Error('Failed to fetch setting');
        err.status = 500;
        throw err;
    }
};
const upsertSetting = async (key, value) => {
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
};
module.exports = {
    getSetting,
    upsertSetting
};
