'use strict';
const express = require('express');
const router = express.Router();
const sitemapController = require('../controllers/sitemapController');
// Public sitemap endpoint
router.get('/', sitemapController.getSitemap);
module.exports = router;
