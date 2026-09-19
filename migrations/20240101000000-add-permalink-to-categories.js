'use strict';

/*
 * FIX: This migration previously tried to ALTER TABLE "categories" ADD COLUMN "permalink"
 * but ran BEFORE the `categories` table was created (by 20250115120004-create-categories.js),
 * causing: ERROR: relation "public.categories" does not exist
 *
 * The `permalink` column is now created directly inside the `create-categories` migration
 * (matching the schema dump where `permalink VARCHAR(255) NOT NULL UNIQUE` is part of the table).
 * This migration is intentionally left as a no-op to preserve migration history ordering.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // No-op: permalink column is now created with the categories table itself.
  },

  down: async (queryInterface, Sequelize) => {
    // No-op: nothing to reverse.
  }
};
