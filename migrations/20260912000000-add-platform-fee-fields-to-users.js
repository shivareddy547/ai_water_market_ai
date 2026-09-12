'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'platform_fee_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('users', 'platform_fee_type', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'percentage'
    });
    await queryInterface.addColumn('users', 'platform_fee_value', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'platform_fee_value');
    await queryInterface.removeColumn('users', 'platform_fee_type');
    await queryInterface.removeColumn('users', 'platform_fee_enabled');
  }
};
