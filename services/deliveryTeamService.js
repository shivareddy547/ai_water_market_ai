'use strict';
const { DeliveryTeam } = require('../models');
class DeliveryTeamService {
    async getTeamByUserId(userId) {
        let team = await DeliveryTeam.findOne({ where: { userId } });
        if (!team) {
            team = await DeliveryTeam.create({
                userId,
                data: {
                    persons: [],
                    vehicles: [],
                    routes: [],
                    notifications: [],
                    reports: []
                }
            });
        }
        return team;
    }
    async updateTeamData(userId, data) {
        let team = await DeliveryTeam.findOne({ where: { userId } });
        if (!team) {
            team = await DeliveryTeam.create({ userId, data });
        } else {
            team.data = data;
            await team.save();
        }
        return team;
    }
}
module.exports = new DeliveryTeamService();
