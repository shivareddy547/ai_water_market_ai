'use strict';
const cronJobService = require('../services/cronJobService');
function requireAdmin(req) {
    if (req.user.role !== 'admin') {
        const err = new Error('Not authorized');
        err.status = 403;
        throw err;
    }
}
class CronJobController {
    async getSettings(req, res, next) {
        try {
            requireAdmin(req);
            const config = await cronJobService.getCronConfig();
            res.json({ success: true, data: config });
        } catch (err) {
            next(err);
        }
    }
    async updateSettings(req, res, next) {
        try {
            requireAdmin(req);
            const { scheduleType, intervalHours, runTime, enabled } = req.body;
            const config = await cronJobService.saveCronConfig({
                scheduleType: scheduleType || 'interval',
                intervalHours: Math.max(1, Number(intervalHours) || 2),
                runTime: runTime || '00:00',
                enabled: enabled !== false
            });
            res.json({ success: true, data: config, message: 'Cron job settings updated' });
        } catch (err) {
            next(err);
        }
    }
    async getLogs(req, res, next) {
        try {
            requireAdmin(req);
            const limit = req.query.limit || 50;
            const logs = await cronJobService.getLogs(limit);
            res.json({ success: true, data: logs });
        } catch (err) {
            next(err);
        }
    }
    async runNow(req, res, next) {
        try {
            requireAdmin(req);
            const log = await cronJobService.runSubscriptionJob();
            res.json({ success: true, data: log, message: 'Cron job executed' });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new CronJobController();
