'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('categories', 'permalink', {
      type: Sequelize.STRING,
      allowNull: true
    });
    const [categories] = await queryInterface.sequelize.query("SELECT id, name FROM categories");
    for (const cat of categories) {
      let slug = cat.name.toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
      if (!slug) slug = `category-${cat.id.substring(0, 8)}`;
      await queryInterface.sequelize.query(`UPDATE categories SET permalink = :slug WHERE id = :id`, {
        replacements: { slug, id: cat.id }
      });
    }
    await queryInterface.changeColumn('categories', 'permalink', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('categories', 'permalink');
  }
};
