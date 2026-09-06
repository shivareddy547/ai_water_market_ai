'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ADD COLUMN: add is_popular boolean column to products table
    await queryInterface.addColumn('products', 'is_popular', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Reverse: REMOVE COLUMN
    await queryInterface.removeColumn('products', 'is_popular');
  }
};
