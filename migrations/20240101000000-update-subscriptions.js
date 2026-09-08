'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
     * FIX: This migration is intentionally left empty.
     * These columns are now included directly in the `20260907000000-create-subscriptions-table.js` migration.
     * Running this caused errors because the `subscriptions` table did not exist yet at this timestamp.
     */
  },
  down: async (queryInterface, Sequelize) => {
    // Intentionally left empty.
  }
};
