'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add is_featured boolean column to users table
    await queryInterface.addColumn('users', 'is_featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Reverse: remove is_featured column
    await queryInterface.removeColumn('users', 'is_featured');
  }
};
