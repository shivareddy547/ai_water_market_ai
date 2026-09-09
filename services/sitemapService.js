'use strict';
const { Product, Category, User } = require('../models');
const { Op } = require('sequelize');
class SitemapService {
  /**
   * Generate sitemap XML for the entire site
   * @param {string} baseUrl - The base URL of the site (e.g., https://watermarket.com)
   * @param {Object} options - Optional configuration
   * @param {number} options.limit - Max number of items per sitemap (default: 1000)
   * @returns {Promise<string>} - XML string
   */
  async generateSitemap(baseUrl, options = {}) {
    const limit = options.limit || 1000;
    const now = new Date().toISOString();
    // Get all active products
    const products = await Product.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name', 'updatedAt'],
      limit: limit,
      order: [['updatedAt', 'DESC']]
    });
    // Get all categories
    const categories = await Category.findAll({
      attributes: ['id', 'permalink', 'updatedAt'],
      limit: limit
    });
    // Get all verified suppliers
    const suppliers = await User.findAll({
      where: {
        role: 'supplier',
        verificationStatus: 'verified',
        isActive: true
      },
      attributes: ['id', 'storeName', 'updatedAt'],
      limit: limit
    });
    // Static pages
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/products', priority: '0.9', changefreq: 'daily' },
      { url: '/suppliers', priority: '0.8', changefreq: 'daily' },
      { url: '/tanker-booking', priority: '0.8', changefreq: 'weekly' },
      { url: '/rentals', priority: '0.7', changefreq: 'weekly' },
      { url: '/about', priority: '0.6', changefreq: 'monthly' },
      { url: '/contact', priority: '0.6', changefreq: 'monthly' },
      { url: '/faq', priority: '0.5', changefreq: 'monthly' },
      { url: '/privacy', priority: '0.4', changefreq: 'yearly' },
      { url: '/terms', priority: '0.4', changefreq: 'yearly' },
      { url: '/shipping', priority: '0.4', changefreq: 'yearly' },
      { url: '/returns', priority: '0.4', changefreq: 'yearly' },
    ];
    // Build XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n';
    xml += '  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';
    // Add static pages
    for (const page of staticPages) {
      xml += this._urlElement(baseUrl + page.url, now, page.changefreq, page.priority);
    }
    // Add product pages
    for (const product of products) {
      const url = `${baseUrl}/products?product=${product.id}`;
      const lastmod = product.updatedAt ? product.updatedAt.toISOString() : now;
      xml += this._urlElement(url, lastmod, 'weekly', '0.7');
    }
    // Add category pages
    for (const category of categories) {
      const url = `${baseUrl}/products?category=${category.id}`;
      const lastmod = category.updatedAt ? category.updatedAt.toISOString() : now;
      xml += this._urlElement(url, lastmod, 'weekly', '0.6');
    }
    // Add supplier pages
    for (const supplier of suppliers) {
      const url = `${baseUrl}/suppliers/${supplier.id}`;
      const lastmod = supplier.updatedAt ? supplier.updatedAt.toISOString() : now;
      xml += this._urlElement(url, lastmod, 'weekly', '0.7');
    }
    xml += '</urlset>';
    return xml;
  }
  /**
   * Generate a sitemap index XML
   * @param {string} baseUrl - The base URL of the site
   * @param {Array<{url: string, lastmod: string}>} sitemaps - Array of sitemap objects
   * @returns {string} - XML string
   */
  generateSitemapIndex(baseUrl, sitemaps) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    for (const sitemap of sitemaps) {
      xml += '  <sitemap>\n';
      xml += `    <loc>${baseUrl}${sitemap.url}</loc>\n`;
      if (sitemap.lastmod) {
        xml += `    <lastmod>${sitemap.lastmod}</lastmod>\n`;
      }
      xml += '  </sitemap>\n';
    }
    xml += '</sitemapindex>';
    return xml;
  }
  /**
   * Generate a single URL element for sitemap
   * @param {string} loc - URL
   * @param {string} lastmod - Last modified date (ISO)
   * @param {string} changefreq - Change frequency (daily, weekly, monthly, yearly)
   * @param {string} priority - Priority (0.0 - 1.0)
   * @returns {string} - XML element
   */
  _urlElement(loc, lastmod, changefreq = 'weekly', priority = '0.5') {
    let xml = '  <url>\n';
    xml += `    <loc>${this._escapeXml(loc)}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += '  </url>\n';
    return xml;
  }
  /**
   * Escape XML special characters
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  _escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
module.exports = new SitemapService();
