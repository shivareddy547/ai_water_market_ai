'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add SEO fields to products table
    await queryInterface.addColumn('products', 'meta_title', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('products', 'meta_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('products', 'meta_keywords', {
      type: Sequelize.STRING,
      allowNull: true
    });
    // Add SEO fields to categories table
    await queryInterface.addColumn('categories', 'meta_title', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('categories', 'meta_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Remove SEO fields from products table
    await queryInterface.removeColumn('products', 'meta_title');
    await queryInterface.removeColumn('products', 'meta_description');
    await queryInterface.removeColumn('products', 'meta_keywords');
    // Remove SEO fields from categories table
    await queryInterface.removeColumn('categories', 'meta_title');
    await queryInterface.removeColumn('categories', 'meta_description');
  }
};
