'use strict';
const sitemapService = require('../services/sitemapService');
class SitemapController {
  /**
   * Serve the sitemap.xml
   */
  async getSitemap(req, res, next) {
    try {
      const baseUrl = process.env.BASE_URL || 'https://watermarket.com';
      const xml = await sitemapService.generateSitemap(baseUrl);
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }
}
module.exports = new SitemapController();
