'use strict';
const { CustomerOrder, User, SupplierOrder, Subscription, Notification } = require('../models');
const { v4: uuidv4 } = require('uuid');
class CustomerOrderService {
    calcNextDelivery(frequency) {
        const d = new Date();
        const f = (frequency || '').toLowerCase();
        if (f === 'daily') d.setDate(d.getDate() + 1);
        else if (f === 'alternate days') d.setDate(d.getDate() + 2);
        else if (f === 'weekly') d.setDate(d.getDate() + 7);
        else if (f === 'monthly') d.setMonth(d.getMonth() + 1);
        else d.setDate(d.getDate() + 1); // Default to 1 day
        return d;
    }
    async createOrder(userId, payload) {
        const { subOrders, paymentMethod } = payload;
        // Calculate total amount
        const totalAmount = subOrders.reduce((sum, so) => sum + Number(so.grandTotal || 0), 0);
        // Generate IDs for suborders if not present
        const subOrdersWithIds = subOrders.map(s => ({
            ...s,
            id: s.id || `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
        }));
        // Create CustomerOrder
        const orderNumber = `PO-${Date.now()}`;
        const customerOrder = await CustomerOrder.create({
            id: uuidv4(),
            userId,
            orderNumber,
            subOrders: subOrdersWithIds,
            totalAmount,
            paymentMethod,
            status: 'Placed'
        });
        // Fetch customer details for supplier order mapping
        const customer = await User.findByPk(userId);
        const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'Customer';
        // Process each sub-order for suppliers and subscriptions
        for (const subOrder of customerOrder.subOrders) {
            const supplierId = subOrder.supplierId;
            if (!supplierId) continue;
            // 1. Create or Update SupplierOrder
            const supplierEntry = {
                id: subOrder.id,
                customer: customerName,
                phone: subOrder.address?.phone || '',
                address: `${subOrder.address?.line || ''}${subOrder.address?.landmark ? ', ' + subOrder.address.landmark : ''}, ${subOrder.address?.city || ''} - ${subOrder.address?.pincode || ''}`,
                area: subOrder.address?.city || '',
                items: subOrder.lines.map(l => ({ 
                    name: l.name, 
                    qty: l.qty, 
                    price: l.price,
                    image: l.image,
                    categoryIcon: l.categoryIcon || '💧'
                })),
                total: subOrder.grandTotal || 0,
                paymentMode: paymentMethod,
                paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
                status: 'Pending',
                deliveryPersonId: null,
                createdAt: new Date().toISOString(),
                assignedAt: '',
                acceptedAt: '',
                startedAt: '',
                deliveredAt: '',
                statusHistory: [{ status: 'Pending', time: new Date().toISOString(), by: 'Customer order' }],
                platformFeeEnabled: subOrder.platformFeeEnabled || false,
                platformFeeType: subOrder.platformFeeType || 'percentage',
                platformFeeValue: subOrder.platformFeeValue || 0,
                platformFee: subOrder.platformFee || 0
            };
            let supplierOrder = await SupplierOrder.findOne({ where: { userId: supplierId } });
            if (supplierOrder) {
                const orders = supplierOrder.orders || [];
                orders.unshift(supplierEntry);
                supplierOrder.orders = orders;
                supplierOrder.changed('orders', true);
                await supplierOrder.save();
            } else {
                await SupplierOrder.create({
                    id: uuidv4(),
                    userId: supplierId,
                    orders: [supplierEntry]
                });
            }
            // 2. Create Subscriptions for any subscription items
            for (const line of subOrder.lines) {
                if (line.isSubscription && line.frequency) {
                    await Subscription.create({
                        id: uuidv4(),
                        userId: userId,
                        orderId: customerOrder.id,
                        supplierId: supplierId,
                        productId: line.productId || null,
                        productName: line.name,
                        frequency: line.frequency,
                        quantity: line.qty,
                        price: line.subscriptionPrice != null ? line.subscriptionPrice : line.price,
                        status: 'active',
                        nextDeliveryDate: this.calcNextDelivery(line.frequency),
                        details: {
                            variantName: line.name,
                            supplier: subOrder.supplier,
                            image: line.image || null,
                            categoryIcon: line.categoryIcon || '💧',
                            addressId: subOrder.addressId || null,
                            paymentMethod: paymentMethod,
                            timeSlot: '',
                            depositPerDelivery: line.deposit > 0 ? Number(line.deposit) / Number(line.qty) : 0,
                            deliveriesDone: 0,
                            customDays: 0,
                            startedOn: new Date().toISOString().split('T')[0],
                            history: []
                        }
                    });
                }
            }
            // 3. Create Notification for Supplier
            await Notification.create({
                id: uuidv4(),
                userId: supplierId,
                type: 'new_order',
                title: 'New Order Received',
                message: `You have received a new order #${subOrder.id} from ${customerName}.`,
                link: '/supplier/orders',
                isRead: false
            });
        }
        return customerOrder;
    }
    async getOrders(userId) {
        return await CustomerOrder.findAll({
            where: { userId },
            order: [['created_at', 'DESC']]
        });
    }
}
module.exports = new CustomerOrderService();
