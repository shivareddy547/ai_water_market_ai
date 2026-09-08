'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('subscriptions', 'details', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('subscriptions', 'details');
  }
};
