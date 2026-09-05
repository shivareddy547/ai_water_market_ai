'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('users', 'logo', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {}
    try {
      await queryInterface.addColumn('users', 'cover_image', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {}
    try {
      await queryInterface.addColumn('users', 'warehouse_addresses', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      });
    } catch (e) {}
    try {
      await queryInterface.addColumn('users', 'tagline', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {}
    try {
      await queryInterface.addColumn('users', 'whatsapp', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {}
    try {
      await queryInterface.addColumn('users', 'website', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {}
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'logo');
    await queryInterface.removeColumn('users', 'cover_image');
    await queryInterface.removeColumn('users', 'warehouse_addresses');
    await queryInterface.removeColumn('users', 'tagline');
    await queryInterface.removeColumn('users', 'whatsapp');
    await queryInterface.removeColumn('users', 'website');
  }
};
