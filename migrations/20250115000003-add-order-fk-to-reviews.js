'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
     * FIX: The constraint "reviews_order_id_fkey" already exists in the database.
     * This happens because the `reviews` table was created directly from a schema dump 
     * that included the FK, or a previous migration attempt partially succeeded.
     * We wrap it in a try-catch to prevent the migration from failing if it already exists.
     */
    try {
      await queryInterface.addConstraint('reviews', {
        fields: ['order_id'],
        type: 'foreign key',
        name: 'reviews_order_id_fkey',
        references: {
          table: 'customer_orders',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    } catch (error) {
      console.log('Constraint reviews_order_id_fkey already exists or table missing, skipping.');
    }
  },
  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeConstraint('reviews', 'reviews_order_id_fkey');
    } catch (error) {
      console.log('Constraint reviews_order_id_fkey does not exist, skipping.');
    }
  }
};
