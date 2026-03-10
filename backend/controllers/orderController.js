import orderModel from '../models/orderModel.js';
import userModel from '../models/userModel.js';
import productModel from '../models/productModel.js';
import Stripe from 'stripe';

//placing orders using cod method
const currency = 'vnd';
const deliveryFee = 30000;
//gateway initialize
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Parse "Size: M, Màu sắc: Đỏ" → { "Size": "M", "Màu sắc": "Đỏ" }
function parseAttributeString(attrStr) {
    if (!attrStr) return {};
    const result = {};
    attrStr.split(', ').forEach(part => {
        const colonIdx = part.indexOf(': ');
        if (colonIdx !== -1) {
            result[part.substring(0, colonIdx).trim()] = part.substring(colonIdx + 2).trim();
        }
    });
    return result;
}

// Helper function để cập nhật số lượng đã bán
const updateProductSold = async (items) => {
    try {
        for (const item of items) {
            await productModel.findByIdAndUpdate(
                item._id,
                { $inc: { sold: item.quantity } }
            );
        }
        console.log('✅ Product sold counts updated successfully');
    } catch (error) {
        console.error('❌ Error updating product sold counts:', error);
        throw error;
    }
};

// Trừ stock của variant tương ứng khi đặt hàng
const deductVariantStock = async (items) => {
    try {
        for (const item of items) {
            const product = await productModel.findById(item._id);
            if (!product || !product.variants || product.variants.length === 0) continue;

            // Ưu tiên dùng selectedAttributes (structured), fallback sang parse size string
            let combination = {};
            if (item.selectedAttributes && item.selectedAttributes.length > 0) {
                item.selectedAttributes.forEach(attr => { combination[attr.name] = attr.value; });
            } else if (item.size) {
                combination = parseAttributeString(item.size);
            }

            if (Object.keys(combination).length === 0) continue;

            const variantIdx = product.variants.findIndex(v => {
                const combo = v.combination || {};
                return Object.entries(combination).every(([k, val]) => combo[k] === val);
            });

            if (variantIdx === -1) continue;

            product.variants[variantIdx].stock = Math.max(
                0,
                (product.variants[variantIdx].stock || 0) - item.quantity
            );
            // Sync product-level stock
            product.stock = product.variants.reduce((s, v) => s + (v.stock || 0), 0);
            product.markModified('variants');
            await product.save();
        }
        console.log('✅ Variant stocks deducted successfully');
    } catch (error) {
        console.error('❌ Error deducting variant stocks:', error);
    }
};

// Helper function để format và log order info
const logOrderInfo = (order) => {
    console.log('\n📋 Order Summary:');
    console.log('Order ID:', order._id);
    console.log('User ID:', order.userId);
    console.log('Total Amount:', order.amount);
    console.log('Payment Method:', order.paymentMethod);
    console.log('Payment Status:', order.payment ? '✅ Paid' : '⏳ Pending');
    console.log('Order Status:', order.status);
    console.log('Items Count:', order.items.length);
    
    if (order.vendors && order.vendors.length > 0) {
        console.log('\n👥 Vendors:');
        order.vendors.forEach((vendor, index) => {
            console.log(`  ${index + 1}. ${vendor.vendorShopName || 'Unknown Shop'}`);
            console.log(`     Vendor ID: ${vendor.vendorId}`);
            console.log(`     Items: ${vendor.items.length}`);
            console.log(`     Subtotal: ${vendor.subtotal}`);
        });
    }
    
    console.log('\n📦 Items:');
    order.items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name}`);
        console.log(`     Price: ${item.price} ${item.discount > 0 ? `(${item.discount}% off)` : ''}`);
        console.log(`     Quantity: ${item.quantity}`);
        if (item.selectedAttributes && item.selectedAttributes.length > 0) {
            console.log(`     Attributes: ${item.selectedAttributes.map(a => `${a.name}: ${a.value}`).join(', ')}`);
        }
        if (item.brand) {
            console.log(`     Brand: ${item.brand}`);
        }
    });
    console.log('\n');
};

//place order using cod method
const placeOrder = async (req,res) =>{
    try {
        const {userId, items, amount, address } = req.body;
        
        // Log received data for debugging
        console.log('📦 Received Order Request:');
        console.log('User ID:', userId);
        console.log('Items Count:', items.length);
        console.log('Total Amount:', amount);
        console.log('Items Detail:', JSON.stringify(items, null, 2));
        
        // Validate required fields
        if (!userId || !items || !Array.isArray(items) || items.length === 0) {
            return res.json({
                success: false,
                message: 'Invalid order data: Missing required fields'
            });
        }

        // Validate each item has required fields
        for (const item of items) {
            if (!item._id || !item.name || !item.price || !item.quantity) {
                return res.json({
                    success: false,
                    message: 'Invalid item data: Missing required fields'
                });
            }
        }

        // Build vendors array for multi-vendor tracking
        const vendorsMap = new Map();
        items.forEach(item => {
            if (item.vendorId) {
                const vendorIdStr = item.vendorId.toString();
                if (!vendorsMap.has(vendorIdStr)) {
                    vendorsMap.set(vendorIdStr, {
                        vendorId: item.vendorId,
                        vendorShopName: item.vendorShopName || '',
                        items: [],
                        subtotal: 0
                    });
                }
                
                const vendor = vendorsMap.get(vendorIdStr);
                vendor.items.push({
                    productId: item._id,
                    name: item.name,
                    price: item.price,
                    originalPrice: item.originalPrice,
                    discount: item.discount || 0,
                    quantity: item.quantity,
                    image: item.image,
                    brand: item.brand,
                    selectedAttributes: item.selectedAttributes,
                    size: item.size
                });
                vendor.subtotal += item.price * item.quantity;
            }
        });

        const vendors = Array.from(vendorsMap.values());

        const orderData = {
            userId,
            items,
            amount,
            address,
            paymentMethod: 'COD',
            payment: false,
            date: Date.now(),
            vendors: vendors.length > 0 ? vendors : undefined
        };

        console.log('💾 Saving Order:', JSON.stringify(orderData, null, 2));

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        console.log('✅ Order saved successfully:', newOrder._id);
        logOrderInfo(newOrder);

        // Cập nhật số lượng đã bán cho các sản phẩm
        await updateProductSold(items);
        // Trừ stock variant tương ứng
        await deductVariantStock(items);

        // Remove ordered items from user's cart
        const user = await userModel.findById(userId);
        if (user && user.cartData) {
            const updatedCart = { ...user.cartData };
            
            // Remove each ordered item from cart
            items.forEach(item => {
                const productId = item._id;
                const sizeKey = item.size;
                
                if (updatedCart[productId] && updatedCart[productId][sizeKey]) {
                    delete updatedCart[productId][sizeKey];
                    
                    // If no more sizes for this product, remove the product entirely
                    if (Object.keys(updatedCart[productId]).length === 0) {
                        delete updatedCart[productId];
                    }
                }
            });
            
            await userModel.findByIdAndUpdate(userId, { cartData: updatedCart });
            console.log('🛒 Cart updated: removed ordered items');
        }

        res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder._id
        })
    } catch (error) {
        console.error('❌ Error placing order:', error);
        res.json({
            success: false,
            message: error.message
        })
    }

}

//placing orders using online method

const placeOrderStripe = async (req,res) =>{
    try {
        const {userId, items, amount, address } = req.body;
        const {origin} = req.headers;
        
        // Log received data for debugging
        console.log('💳 Received Stripe Order Request:');
        console.log('User ID:', userId);
        console.log('Items Count:', items.length);
        console.log('Total Amount:', amount);
        
        // Validate required fields
        if (!userId || !items || !Array.isArray(items) || items.length === 0) {
            return res.json({
                success: false,
                message: 'Invalid order data: Missing required fields'
            });
        }

        // Validate each item has required fields
        for (const item of items) {
            if (!item._id || !item.name || !item.price || !item.quantity) {
                return res.json({
                    success: false,
                    message: 'Invalid item data: Missing required fields'
                });
            }
        }

        // Build vendors array for multi-vendor tracking
        const vendorsMap = new Map();
        items.forEach(item => {
            if (item.vendorId) {
                const vendorIdStr = item.vendorId.toString();
                if (!vendorsMap.has(vendorIdStr)) {
                    vendorsMap.set(vendorIdStr, {
                        vendorId: item.vendorId,
                        vendorShopName: item.vendorShopName || '',
                        items: [],
                        subtotal: 0
                    });
                }
                
                const vendor = vendorsMap.get(vendorIdStr);
                vendor.items.push({
                    productId: item._id,
                    name: item.name,
                    price: item.price,
                    originalPrice: item.originalPrice,
                    discount: item.discount || 0,
                    quantity: item.quantity,
                    image: item.image,
                    brand: item.brand,
                    selectedAttributes: item.selectedAttributes,
                    size: item.size
                });
                vendor.subtotal += item.price * item.quantity;
            }
        });

        const vendors = Array.from(vendorsMap.values());

        const orderData = {
            userId,
            items,
            amount,
            address,
            paymentMethod: 'Stripe',
            payment: false,
            date: Date.now(),
            vendors: vendors.length > 0 ? vendors : undefined
        };
        
        // Validate Stripe amount limit for VND
        const STRIPE_VND_LIMIT = 99999999; // ₫99,999,999
        if (currency === 'vnd' && amount > STRIPE_VND_LIMIT) {
            console.log(`❌ Order amount ${amount} exceeds Stripe VND limit ${STRIPE_VND_LIMIT}`);
            return res.json({
                success: false,
                message: `Tổng đơn hàng vượt quá giới hạn thanh toán Stripe (₫99,999,999). Vui lòng thanh toán bằng COD hoặc chia nhỏ đơn hàng.`
            });
        }

        console.log('💾 Saving Stripe Order:', JSON.stringify(orderData, null, 2));
        
        const newOrder = new orderModel(orderData);
        await newOrder.save();
        
        console.log('✅ Stripe Order saved successfully:', newOrder._id);
        logOrderInfo(newOrder);
        
        // Create Stripe line items
        const line_items = items.map((item) => {
            return {
                price_data: {
                    currency: currency,
                    product_data: {
                        name: item.name,
                        description: item.brand ? `Brand: ${item.brand}` : undefined,
                        images: item.image && item.image.length > 0 ? [item.image[0]] : undefined
                    },
                    // VND is already the smallest currency unit, no need to multiply
                    // For other currencies like USD, you would multiply by 100
                    unit_amount: Math.round(item.price),
                },
                quantity: item.quantity,
            }
        });

        line_items.push({
            price_data: {
                currency: currency,
                product_data: {
                    name: 'Shipping fee',
                },
                // VND is already the smallest currency unit
                unit_amount: Math.round(deliveryFee),
            },
            quantity: 1,
        });

        const session = await stripe.checkout.sessions.create({
            line_items,
            mode: 'payment',
            success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
            cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
        });
        
        res.json({
            success: true,
            message: 'Order placed successfully',
            sessionUrl: session.url,
            orderId: newOrder._id
        });
    } catch (error) {
        console.error('❌ Error placing Stripe order:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
}

//Verify Stripe
const verifyStripePayment = async (req, res) => {
    try {
        console.log("Verify Stripe Payment Request:", req.body);
        const { orderId, success } = req.body;
        
        if (!orderId) {
            console.log("Missing orderId in request");
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }
        
        console.log(`Finding order with ID: ${orderId}`);
        const order = await orderModel.findById(orderId);
        
        if (!order) {
            console.log(`Order not found: ${orderId}`);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        console.log("Order found:", order);
        
        // Lấy userId từ order
        const userId = order.userId;
        console.log(`UserId from order: ${userId}`);
        
        // Check if the success parameter is true
        // Convert to string for comparison since URL params are strings
        const successValue = String(success).toLowerCase();
        console.log(`Success value: ${successValue}`);
        
        if (successValue === 'true') {
            console.log("Payment successful, updating order status");
            // Update the order payment status
            order.payment = true;
            await order.save();
            
            // Cập nhật số lượng đã bán cho các sản phẩm
            await updateProductSold(order.items);
            // Trừ stock variant tương ứng
            await deductVariantStock(order.items);
            
            // Remove ordered items from user's cart
            console.log(`Removing ordered items from cart for user: ${userId}`);
            const user = await userModel.findById(userId);
            if (user && user.cartData) {
                const updatedCart = { ...user.cartData };
                
                // Remove each ordered item from cart
                order.items.forEach(item => {
                    const productId = item._id;
                    const sizeKey = item.size;
                    
                    if (updatedCart[productId] && updatedCart[productId][sizeKey]) {
                        delete updatedCart[productId][sizeKey];
                        
                        // If no more sizes for this product, remove the product entirely
                        if (Object.keys(updatedCart[productId]).length === 0) {
                            delete updatedCart[productId];
                        }
                    }
                });
                
                await userModel.findByIdAndUpdate(userId, { cartData: updatedCart });
                console.log('🛒 Cart updated: removed ordered items');
            }
            
            return res.status(200).json({
                success: true,
                message: 'Payment verified successfully'
            });
        } else {
            console.log("Payment verification failed");
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }
        
    } catch (error) {
        console.log("Error in verifyStripePayment:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


//All orders data for admin panel

const allOrders = async (req,res) =>{
    try {  
        const orders = await orderModel.find({}).sort({ date: -1 }); // Sort by newest first
        console.log(`📊 Fetched ${orders.length} orders for admin panel`);
        res.json({success: true, orders})
    } catch (error) {
        console.error('❌ Error fetching all orders:', error);
        res.json({success: false, message: error.message})
    }

}


//User orders data for frontend

const userOrders = async (req,res) =>{ 
    try {
        const {userId} = req.body
        const orders = await orderModel.find({ userId }).sort({ date: -1 }); // Sort by newest first
        
        console.log(`👤 Fetched ${orders.length} orders for user: ${userId}`);
        
        res.json({
            success: true,
            orders
        })
    } catch (error) {
        console.error('❌ Error fetching user orders:', error);
        res.json({
            success: false,
            message: error.message
        })
    }

}

//update order status from admin panel

const updateOrderStatus = async (req,res) =>{
    try {
        const {orderId, status} = req.body
        
        console.log(`🔄 Admin updating order ${orderId} to status: ${status}`);
        
        const order = await orderModel.findById(orderId)
        if(!order){
            console.log('❌ Order not found');
            return res.status(404).json({success: false, message: 'Order not found'})
        }
        
        const oldStatus = order.status;
        order.status = status       
        await order.save()
        
        console.log(`✅ Order status updated: ${oldStatus} → ${status}`);
        
        res.json({success: true, message: 'Order status updated successfully', order})
        
    } catch (error) {
        console.error('❌ Error updating order status:', error);
        res.json({success: false, message: error.message})
    }

}

//Vendor orders data - orders containing vendor's products
const vendorOrders = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        
        console.log(`🏪 Fetching orders for vendor: ${vendorId}`);
        
        // Find all orders that contain products from this vendor
        const orders = await orderModel.find({}).sort({ date: -1 }); // Sort by newest first
        
        // Filter orders to only include those with vendor's products
        const vendorOrdersData = orders.filter(order => {
            return order.items.some(item => item.vendorId && item.vendorId.toString() === vendorId.toString());
        }).map(order => {
            // Only include vendor's products in the items array
            const vendorItems = order.items.filter(item => 
                item.vendorId && item.vendorId.toString() === vendorId.toString()
            );
            
            // Calculate total amount for vendor's items only
            const vendorAmount = vendorItems.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);
            
            // Log vendor items for debugging
            console.log(`  📦 Order ${order._id}: ${vendorItems.length} items, Total: ${vendorAmount}`);
            
            return {
                ...order.toObject(),
                items: vendorItems,
                vendorAmount: vendorAmount
            };
        });
        
        console.log(`✅ Found ${vendorOrdersData.length} orders for vendor`);
        
        res.json({success: true, orders: vendorOrdersData});
        
    } catch (error) {
        console.error('❌ Error fetching vendor orders:', error);
        res.json({success: false, message: error.message});
    }
}

//update order status from vendor panel - only for orders containing vendor's products
const updateVendorOrderStatus = async (req, res) => {
    try {
        const {orderId, status} = req.body;
        const vendorId = req.vendorId;
        
        console.log(`🔄 Vendor ${vendorId} updating order ${orderId} to status: ${status}`);
        
        const order = await orderModel.findById(orderId);
        if(!order){
            console.log('❌ Order not found');
            return res.status(404).json({success: false, message: 'Order not found'});
        }
        
        // Check if this order contains any products from this vendor
        const hasVendorProducts = order.items.some(item => 
            item.vendorId && item.vendorId.toString() === vendorId.toString()
        );
        
        if (!hasVendorProducts) {
            console.log('❌ Unauthorized: Order does not contain vendor products');
            return res.json({success: false, message: 'Unauthorized - This order does not contain your products'});
        }
        
        const oldStatus = order.status;
        order.status = status;       
        await order.save();
        
        console.log(`✅ Order status updated: ${oldStatus} → ${status}`);
        
        res.json({success: true, message: 'Order status updated successfully', order});
        
    } catch (error) {
        console.error('❌ Error updating vendor order status:', error);
        res.json({success: false, message: error.message});
    }
}



export {placeOrder, allOrders, userOrders, updateOrderStatus,placeOrderStripe, verifyStripePayment, vendorOrders, updateVendorOrderStatus}




