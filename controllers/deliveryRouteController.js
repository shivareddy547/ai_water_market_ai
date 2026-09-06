'use strict';
const deliveryRouteService = require('../services/deliveryRouteService');
class DeliveryRouteController {
    async getAssignedOrders(req, res, next) {
        try {
            const result = await deliveryRouteService.getAssignedOrders(req.user);
            res.json({
                success: true,
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new DeliveryRouteController();
