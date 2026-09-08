'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
     * FIX: This migration is intentionally left empty.
     * The `subscriptions` table is fully created in a later migration (`20260907000000-create-subscriptions-table.js`)
     * to resolve foreign key dependency issues with `customer_orders` and `products`.
     * Running it here caused "relation users does not exist" because users hadn't been created yet.
     */
  },
  down: async (queryInterface, Sequelize) => {
    // Intentionally left empty. The table is dropped in the down method of 20260907000000-create-subscriptions-table.js
  }
};
