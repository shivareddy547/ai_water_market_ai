'use strict';
const { User, SupplierOrder } = require('../models');
class DeliveryRouteService {
    async getAssignedOrders(deliveryUser) {
        if (deliveryUser.role !== 'delivery') {
            const err = new Error('Only delivery persons can access delivery routes');
            err.status = 403;
            throw err;
        }
        const supplierId = deliveryUser.supplierId;
        if (!supplierId) {
            const err = new Error('No supplier is assigned to your account');
            err.status = 404;
            throw err;
        }
        const supplier = await User.findByPk(supplierId);
        if (!supplier) {
            const err = new Error('Supplier not found');
            err.status = 404;
            throw err;
        }
        const supplierOrder = await SupplierOrder.findOne({
            where: { userId: supplierId }
        });
        let orders = [];
        if (supplierOrder && Array.isArray(supplierOrder.orders)) {
            orders = supplierOrder.orders;
            const hasDeliveryPersonAssignment = orders.some(
                o => o.deliveryPersonId || o.delivery_person_id || o.deliveryBoyId
            );
            if (hasDeliveryPersonAssignment) {
                orders = orders.filter(o =>
                    o.deliveryPersonId === deliveryUser.id ||
                    o.delivery_person_id === deliveryUser.id ||
                    o.deliveryBoyId === deliveryUser.id
                );
            }
        }
        const warehouseAddresses = supplier.warehouseAddresses || [];
        const primaryWarehouse = warehouseAddresses.find(a => a.isPrimary) || warehouseAddresses[0] || null;
        let warehouseAddressStr = '';
        if (primaryWarehouse) {
            const parts = [
                primaryWarehouse.addressLine,
                primaryWarehouse.landmark,
                primaryWarehouse.city,
                primaryWarehouse.state,
                primaryWarehouse.pincode
            ].filter(Boolean);
            warehouseAddressStr = parts.join(', ');
        } else if (supplier.address) {
            const parts = [supplier.address, supplier.city, supplier.stateName, supplier.pincode]
                .filter(Boolean);
            warehouseAddressStr = parts.join(', ');
        }
        return {
            orders,
            warehouse: {
                storeName: supplier.storeName || '',
                address: warehouseAddressStr,
                warehouseAddresses,
                primaryWarehouse
            }
        };
    }
}
module.exports = new DeliveryRouteService();
