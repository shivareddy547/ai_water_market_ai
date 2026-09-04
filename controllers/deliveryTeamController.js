'use strict';
const deliveryTeamService = require('../services/deliveryTeamService');
class DeliveryTeamController {
    async getTeam(req, res, next) {
        try {
            const team = await deliveryTeamService.getTeamByUserId(req.user.id);
            res.json({ success: true, data: team.data });
        } catch (err) {
            next(err);
        }
    }
    async updateTeam(req, res, next) {
        try {
            const team = await deliveryTeamService.updateTeamData(req.user.id, req.body);
            res.json({ success: true, data: team.data, message: 'Team data updated successfully' });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new DeliveryTeamController();
