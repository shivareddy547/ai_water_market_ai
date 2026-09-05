'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'wishlist_data', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: []
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'wishlist_data');
  }
};
