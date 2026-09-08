'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
     * FIX: This migration is intentionally left empty.
     * These columns are already added by `20261012000000-add-store-profile-fields.js`.
     * Running this caused duplicate column errors.
     */
  },
  down: async (queryInterface, Sequelize) => {
    // Intentionally left empty.
  }
};
