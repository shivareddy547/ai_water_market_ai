'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('users', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            first_name: {
                type: Sequelize.STRING(100),
                allowNull: false
            },
            last_name: {
                type: Sequelize.STRING(100),
                allowNull: false
            },
            email: {
                type: Sequelize.STRING(255),
                allowNull: true,
                unique: true
            },
            phone: {
                type: Sequelize.STRING(20),
                allowNull: true,
                unique: true
            },
            phone_country_code: {
                type: Sequelize.STRING(10),
                allowNull: true,
                defaultValue: '+91'
            },
            password: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            role: {
                type: Sequelize.ENUM('user', 'supplier', 'delivery', 'admin'),
                allowNull: false,
                defaultValue: 'user'
            },
            email_verified: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            phone_verified: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            last_login: {
                type: Sequelize.DATE,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });
        await queryInterface.addIndex('users', ['email'], {
            name: 'users_email_idx',
            unique: true,
            where: {
                email: { [Sequelize.Op.ne]: null }
            }
        });
        await queryInterface.addIndex('users', ['phone'], {
            name: 'users_phone_idx',
            unique: true,
            where: {
                phone: { [Sequelize.Op.ne]: null }
            }
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('users');
    }
};
