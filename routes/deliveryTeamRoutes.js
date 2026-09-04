'use strict';
const express = require('express');
const router = express.Router();
const deliveryTeamController = require('../controllers/deliveryTeamController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/', authMiddleware, deliveryTeamController.getTeam);
router.put('/', authMiddleware, deliveryTeamController.updateTeam);
module.exports = router;
