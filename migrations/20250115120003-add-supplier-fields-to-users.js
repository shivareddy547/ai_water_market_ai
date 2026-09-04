'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'store_name', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    await queryInterface.addColumn('users', 'business_type', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('users', 'gst', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
    await queryInterface.addColumn('users', 'description', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('users', 'address', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('users', 'city', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('users', 'state_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('users', 'pincode', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'store_name');
    await queryInterface.removeColumn('users', 'business_type');
    await queryInterface.removeColumn('users', 'gst');
    await queryInterface.removeColumn('users', 'description');
    await queryInterface.removeColumn('users', 'address');
    await queryInterface.removeColumn('users', 'city');
    await queryInterface.removeColumn('users', 'state_name');
    await queryInterface.removeColumn('users', 'pincode');
  }
};
