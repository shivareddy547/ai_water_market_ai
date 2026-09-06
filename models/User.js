'use strict';
const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
module.exports = (sequelize) => {
    class User extends Model {
        static associate(models) {
            User.hasMany(models.Otp, {
                foreignKey: 'user_id',
                as: 'otps'
            });
            User.hasMany(models.CustomerAddress, {
                foreignKey: 'user_id',
                as: 'addresses'
            });
            User.hasMany(models.CustomerOrder, {
                foreignKey: 'user_id',
                as: 'customerOrders'
            });
        }
        async comparePassword(password) {
            if (!this.password) return false;
            return bcrypt.compare(password, this.password);
        }
    }
    User.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        firstName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'first_name',
            validate: { notEmpty: true }
        },
        lastName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'last_name',
            validate: { notEmpty: true }
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true,
            field: 'email',
            validate: { isEmail: true }
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true,
            unique: true,
            field: 'phone'
        },
        phoneCountryCode: {
            type: DataTypes.STRING(10),
            allowNull: true,
            defaultValue: '+91',
            field: 'phone_country_code'
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'password'
        },
        role: {
            type: DataTypes.ENUM('user', 'supplier', 'delivery', 'admin'),
            allowNull: false,
            defaultValue: 'user',
            field: 'role'
        },
        supplierId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'supplier_id'
        },
        emailVerified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'email_verified'
        },
        phoneVerified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'phone_verified'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'is_active'
        },
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_login'
        },
        storeName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'store_name'
        },
        businessType: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'business_type'
        },
        gst: {
            type: DataTypes.STRING(20),
            allowNull: true,
            field: 'gst'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        city: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        stateName: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'state_name'
        },
        pincode: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        categories: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: []
        },
        commission: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 10
        },
        verificationStatus: {
            type: DataTypes.ENUM('pending', 'verified', 'rejected'),
            allowNull: false,
            defaultValue: 'pending',
            field: 'verification_status'
        },
        rejectReason: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'reject_reason'
        },
        isFeatured: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'is_featured'
        },
        cartData: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {},
            field: 'cart_data'
        },
        logo: {
            type: DataTypes.STRING,
            allowNull: true
        },
        coverImage: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'cover_image'
        },
        warehouseAddresses: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
            field: 'warehouse_addresses'
        },
        tagline: {
            type: DataTypes.STRING,
            allowNull: true
        },
        whatsapp: {
            type: DataTypes.STRING,
            allowNull: true
        },
        website: {
            type: DataTypes.STRING,
            allowNull: true
        },
        wishlistData: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
            field: 'wishlist_data'
        }
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        underscored: true,
        hooks: {
            beforeSave: async (user) => {
                if (user.changed('password') && user.password) {
                    user.password = await bcrypt.hash(user.password, 10);
                }
            }
        },
        defaultScope: {
            attributes: { exclude: ['password'] }
        },
        scopes: {
            withPassword: { attributes: {} }
        }
    });
    return User;
};
