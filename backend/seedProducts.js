import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import productModel from './models/productModel.js';
import categoryModel from './models/categoryModel.js';
import userModel from './models/userModel.js';
import bcrypt from 'bcrypt';

// Sample product data by category
const productTemplates = {
    'Điện Thoại & Phụ Kiện': [
        { name: 'iPhone 15 Pro Max', brand: 'Apple', priceRange: [25000000, 35000000], tags: ['flagship', 'ios', '5g'] },
        { name: 'Samsung Galaxy S24 Ultra', brand: 'Samsung', priceRange: [22000000, 30000000], tags: ['flagship', 'android', '5g'] },
        { name: 'Xiaomi 14 Pro', brand: 'Xiaomi', priceRange: [15000000, 20000000], tags: ['flagship', 'android'] },
        { name: 'OPPO Find X7', brand: 'OPPO', priceRange: [12000000, 18000000], tags: ['camera', 'android'] },
        { name: 'Realme GT 5 Pro', brand: 'Realme', priceRange: [8000000, 12000000], tags: ['gaming', 'android'] },
        { name: 'Tai nghe Bluetooth', brand: 'Sony', priceRange: [500000, 3000000], tags: ['audio', 'wireless'] },
        { name: 'Ốp lưng chống sốc', brand: 'UAG', priceRange: [200000, 800000], tags: ['accessory', 'protection'] },
        { name: 'Sạc dự phòng 20000mAh', brand: 'Anker', priceRange: [300000, 1000000], tags: ['powerbank', 'charging'] }
    ],
    'Thời Trang Nam': [
        { name: 'Áo thun nam basic', brand: 'UNIQLO', priceRange: [100000, 300000], tags: ['tshirt', 'casual'] },
        { name: 'Quần jean nam slim fit', brand: 'Levi\'s', priceRange: [500000, 1500000], tags: ['jeans', 'denim'] },
        { name: 'Áo sơ mi nam công sở', brand: 'OWEN', priceRange: [300000, 800000], tags: ['shirt', 'formal'] },
        { name: 'Áo khoác hoodie', brand: 'Nike', priceRange: [800000, 2000000], tags: ['hoodie', 'sports'] },
        { name: 'Quần short kaki', brand: 'ROUTINE', priceRange: [200000, 500000], tags: ['shorts', 'casual'] }
    ],
    'Thời Trang Nữ': [
        { name: 'Đầm công sở nữ', brand: 'IVY moda', priceRange: [400000, 1200000], tags: ['dress', 'formal'] },
        { name: 'Áo kiểu nữ', brand: 'Canifa', priceRange: [200000, 600000], tags: ['blouse', 'casual'] },
        { name: 'Quần jean nữ', brand: 'ZARA', priceRange: [400000, 1000000], tags: ['jeans', 'denim'] },
        { name: 'Váy maxi nữ', brand: 'H&M', priceRange: [500000, 1500000], tags: ['dress', 'maxi'] },
        { name: 'Áo len cardigan', brand: 'UNIQLO', priceRange: [300000, 800000], tags: ['cardigan', 'winter'] }
    ],
    'Máy Tính & Laptop': [
        { name: 'MacBook Pro M3', brand: 'Apple', priceRange: [35000000, 60000000], tags: ['laptop', 'premium'] },
        { name: 'Dell XPS 15', brand: 'Dell', priceRange: [25000000, 40000000], tags: ['laptop', 'business'] },
        { name: 'ASUS ROG Gaming', brand: 'ASUS', priceRange: [20000000, 45000000], tags: ['laptop', 'gaming'] },
        { name: 'Lenovo ThinkPad', brand: 'Lenovo', priceRange: [15000000, 30000000], tags: ['laptop', 'business'] },
        { name: 'Chuột gaming RGB', brand: 'Logitech', priceRange: [300000, 2000000], tags: ['mouse', 'gaming'] },
        { name: 'Bàn phím cơ', brand: 'Keychron', priceRange: [1000000, 3000000], tags: ['keyboard', 'mechanical'] }
    ],
    'Giày Dép Nam': [
        { name: 'Giày thể thao nam', brand: 'Nike', priceRange: [1000000, 3000000], tags: ['sneakers', 'sports'] },
        { name: 'Giày da công sở', brand: 'Clarks', priceRange: [1500000, 3500000], tags: ['formal', 'leather'] },
        { name: 'Dép sandal nam', brand: 'Adidas', priceRange: [300000, 800000], tags: ['sandals', 'casual'] },
        { name: 'Giày lười nam', brand: 'ECCO', priceRange: [1200000, 2500000], tags: ['loafers', 'casual'] }
    ],
    'Giày Dép Nữ': [
        { name: 'Giày cao gót', brand: 'Charles & Keith', priceRange: [800000, 2000000], tags: ['heels', 'formal'] },
        { name: 'Giày thể thao nữ', brand: 'Adidas', priceRange: [1000000, 2500000], tags: ['sneakers', 'sports'] },
        { name: 'Dép sandal nữ', brand: 'Skechers', priceRange: [400000, 1000000], tags: ['sandals', 'casual'] },
        { name: 'Boot nữ', brand: 'Dr.Martens', priceRange: [2000000, 4000000], tags: ['boots', 'fashion'] }
    ],
    'Sắc Đẹp': [
        { name: 'Son môi lì', brand: 'MAC', priceRange: [400000, 800000], tags: ['lipstick', 'makeup'] },
        { name: 'Kem dưỡng da', brand: 'Innisfree', priceRange: [200000, 600000], tags: ['skincare', 'moisturizer'] },
        { name: 'Serum vitamin C', brand: 'The Ordinary', priceRange: [300000, 700000], tags: ['serum', 'skincare'] },
        { name: 'Phấn nền', brand: 'L\'Oreal', priceRange: [300000, 800000], tags: ['foundation', 'makeup'] },
        { name: 'Nước hoa nữ', brand: 'Chanel', priceRange: [2000000, 5000000], tags: ['perfume', 'fragrance'] }
    ],
    'Nhà Cửa & Đời Sống': [
        { name: 'Chăn ga gối đệm', brand: 'Everon', priceRange: [500000, 2000000], tags: ['bedding', 'home'] },
        { name: 'Đèn led trang trí', brand: 'Philips', priceRange: [200000, 1000000], tags: ['lighting', 'decor'] },
        { name: 'Bình nước giữ nhiệt', brand: 'Zojirushi', priceRange: [400000, 1200000], tags: ['drinkware', 'thermos'] },
        { name: 'Gối ôm', brand: 'Hanvico', priceRange: [150000, 400000], tags: ['pillow', 'bedding'] }
    ],
    'Đồng Hồ': [
        { name: 'Đồng hồ nam Casio', brand: 'Casio', priceRange: [800000, 3000000], tags: ['watch', 'men'] },
        { name: 'Đồng hồ nữ Michael Kors', brand: 'Michael Kors', priceRange: [3000000, 8000000], tags: ['watch', 'women', 'luxury'] },
        { name: 'Đồng hồ thông minh', brand: 'Apple Watch', priceRange: [8000000, 15000000], tags: ['smartwatch', 'tech'] },
        { name: 'Đồng hồ cơ tự động', brand: 'Seiko', priceRange: [5000000, 15000000], tags: ['automatic', 'mechanical'] }
    ],
    'Thiết Bị Điện Tử': [
        { name: 'Tai nghe gaming', brand: 'HyperX', priceRange: [800000, 3000000], tags: ['headset', 'gaming'] },
        { name: 'Loa bluetooth', brand: 'JBL', priceRange: [500000, 2000000], tags: ['speaker', 'audio'] },
        { name: 'Webcam HD', brand: 'Logitech', priceRange: [800000, 2500000], tags: ['webcam', 'streaming'] },
        { name: 'Tivi 4K Smart', brand: 'Samsung', priceRange: [8000000, 30000000], tags: ['tv', '4k', 'smart'] }
    ]
};

// Generate random description
const generateDescription = (productName, brand, category) => {
    const descriptions = [
        `${productName} ${brand} chính hãng, chất lượng cao. Thiết kế hiện đại, phù hợp với mọi phong cách. Bảo hành 12 tháng.`,
        `Sản phẩm ${productName} đến từ thương hiệu ${brand} nổi tiếng. Chất liệu cao cấp, bền đẹp theo thời gian. Giao hàng nhanh toàn quốc.`,
        `${productName} ${brand} - Lựa chọn hàng đầu trong phân khúc ${category}. Thiết kế sang trọng, tính năng vượt trội. Miễn phí vận chuyển.`,
        `Mua ${productName} ${brand} giá tốt. Sản phẩm được kiểm định nghiêm ngặt, đảm bảo chất lượng. Đổi trả trong 7 ngày.`,
        `${productName} chính hãng ${brand}. Mẫu mã đa dạng, nhiều lựa chọn. Phù hợp làm quà tặng. Ưu đãi cực khủng!`
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
};

// Generate product attributes based on category
const generateAttributes = (categoryName) => {
    if (categoryName.includes('Thời Trang') || categoryName.includes('Giày Dép')) {
        return [
            { name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] },
            { name: 'Màu sắc', values: ['Đen', 'Trắng', 'Xanh', 'Đỏ', 'Xám'] }
        ];
    } else if (categoryName.includes('Điện Thoại') || categoryName.includes('Máy Tính')) {
        return [
            { name: 'Bộ nhớ', values: ['64GB', '128GB', '256GB', '512GB'] },
            { name: 'Màu sắc', values: ['Đen', 'Trắng', 'Xanh', 'Tím'] }
        ];
    } else if (categoryName.includes('Sắc Đẹp')) {
        return [
            { name: 'Dung tích', values: ['30ml', '50ml', '100ml'] },
            { name: 'Màu sắc', values: ['Natural', 'Nude', 'Pink', 'Red'] }
        ];
    } else {
        return [
            { name: 'Màu sắc', values: ['Đen', 'Trắng', 'Xám', 'Be'] }
        ];
    }
};

// Get product-specific images based on category and product name
const getProductImages = (productName, categoryName, brand) => {
    const keywords = {
        // Electronics
        'iPhone': 'iphone,smartphone,apple',
        'Samsung Galaxy': 'samsung,smartphone,android',
        'Xiaomi': 'xiaomi,smartphone,phone',
        'OPPO': 'oppo,smartphone',
        'Realme': 'realme,smartphone',
        'MacBook': 'macbook,laptop,apple',
        'Dell': 'dell,laptop,computer',
        'ASUS': 'asus,laptop,gaming',
        'Lenovo': 'lenovo,laptop,thinkpad',
        'Tai nghe': 'headphones,earphones,audio',
        'Ốp lưng': 'phone-case,protection',
        'Sạc dự phòng': 'powerbank,battery',
        'Chuột': 'mouse,gaming',
        'Bàn phím': 'keyboard,mechanical',
        'Webcam': 'webcam,camera',
        'Loa': 'speaker,bluetooth',
        'Tivi': 'television,tv,smart-tv',
        
        // Fashion
        'Áo thun': 'tshirt,shirt,fashion',
        'Quần jean': 'jeans,denim,pants',
        'Áo sơ mi': 'dress-shirt,formal-shirt',
        'Áo khoác': 'jacket,coat,hoodie',
        'Quần short': 'shorts,summer',
        'Đầm': 'dress,fashion,women',
        'Áo kiểu': 'blouse,top,fashion',
        'Váy': 'skirt,dress,fashion',
        'Áo len': 'sweater,cardigan,winter',
        
        // Shoes
        'Giày thể thao': 'sneakers,shoes,sports',
        'Giày da': 'leather-shoes,formal',
        'Giày cao gót': 'high-heels,shoes,fashion',
        'Dép': 'sandals,slippers',
        'Giày lười': 'loafers,shoes',
        'Boot': 'boots,shoes,fashion',
        
        // Beauty
        'Son môi': 'lipstick,makeup,cosmetics',
        'Kem dưỡng': 'skincare,cream,beauty',
        'Serum': 'serum,skincare,beauty',
        'Phấn': 'makeup,foundation,cosmetics',
        'Nước hoa': 'perfume,fragrance,bottle',
        
        // Home & Living
        'Chăn ga': 'bedding,blanket,bedroom',
        'Đèn': 'lamp,lighting,decoration',
        'Bình nước': 'water-bottle,thermos',
        'Gối': 'pillow,cushion,bedroom',
        
        // Watches
        'Đồng hồ': 'watch,timepiece,luxury'
    };

    // Find matching keyword
    let searchKeyword = 'product';
    for (const [key, value] of Object.entries(keywords)) {
        if (productName.includes(key)) {
            searchKeyword = value;
            break;
        }
    }

    // If no specific match, use category-based keywords
    if (searchKeyword === 'product') {
        const categoryKeywords = {
            'Điện Thoại': 'smartphone,phone,mobile',
            'Máy Tính': 'laptop,computer,notebook',
            'Thời Trang Nam': 'men-fashion,menswear,clothing',
            'Thời Trang Nữ': 'women-fashion,womenswear,dress',
            'Giày Dép': 'shoes,footwear,sneakers',
            'Sắc Đẹp': 'beauty,cosmetics,makeup',
            'Đồng Hồ': 'watch,timepiece,clock',
            'Thiết Bị Điện Tử': 'electronics,gadgets,tech',
            'Nhà Cửa': 'home,furniture,decor'
        };

        for (const [key, value] of Object.entries(categoryKeywords)) {
            if (categoryName.includes(key)) {
                searchKeyword = value;
                break;
            }
        }
    }

    // Generate images using LoremFlickr (keyword-based placeholder images)
    const images = [];
    const keywords_array = searchKeyword.split(',');
    const mainKeyword = keywords_array[0];
    
    for (let i = 0; i < 4; i++) {
        // Rotate through keywords for variety
        const keyword = keywords_array[i % keywords_array.length];
        // Using LoremFlickr which returns images based on keywords
        images.push(`https://loremflickr.com/800/800/${keyword}?random=${Date.now() + i}`);
    }
    
    return images;
};

// Seed products
const seedProducts = async () => {
    try {
        await connectDB();

        console.log('🔍 Checking database...');

        // Get all level 1 categories
        const categories = await categoryModel.find({ level: 1 }).sort({ order: 1 });
        console.log(`✅ Found ${categories.length} main categories`);

        // Create sample vendors if they don't exist
        console.log('👥 Creating sample vendors...');
        const vendorData = [
            { email: 'vendor1@shop.com', password: await bcrypt.hash('123456', 10), name: 'Shop Điện Thoại ABC', role: 'vendor', shopName: 'Shop Điện Thoại ABC' },
            { email: 'vendor2@shop.com', password: await bcrypt.hash('123456', 10), name: 'Shop Thời Trang XYZ', role: 'vendor', shopName: 'Shop Thời Trang XYZ' },
            { email: 'vendor3@shop.com', password: await bcrypt.hash('123456', 10), name: 'Shop Công Nghệ 24/7', role: 'vendor', shopName: 'Shop Công Nghệ 24/7' },
            { email: 'vendor4@shop.com', password: await bcrypt.hash('123456', 10), name: 'Shop Giày Dép Việt', role: 'vendor', shopName: 'Shop Giày Dép Việt' },
            { email: 'vendor5@shop.com', password: await bcrypt.hash('123456', 10), name: 'Shop Sắc Đẹp Korea', role: 'vendor', shopName: 'Shop Sắc Đẹp Korea' },
        ];

        const vendors = [];
        for (const vData of vendorData) {
            let vendor = await userModel.findOne({ email: vData.email });
            if (!vendor) {
                vendor = await userModel.create(vData);
                console.log(`  ✅ Created vendor: ${vendor.shopName}`);
            } else {
                console.log(`  ⏩ Vendor exists: ${vendor.shopName}`);
            }
            vendors.push(vendor);
        }

        // Clear existing products
        console.log('\n🗑️  Clearing existing products...');
        await productModel.deleteMany({});

        // Generate products
        console.log('\n📦 Generating 200 products...\n');
        let totalProducts = 0;
        const targetTotal = 200;
        const products = [];

        while (totalProducts < targetTotal) {
            for (const category of categories) {
                if (totalProducts >= targetTotal) break;

                const categoryName = category.name;
                const templates = productTemplates[categoryName] || productTemplates['Nhà Cửa & Đời Sống'];

                // Get subcategories for this category
                const subCategories = await categoryModel.find({ parentCategory: category._id });

                // Generate products for this category
                const productsPerTemplate = Math.ceil((targetTotal / categories.length) / templates.length);

                for (const template of templates) {
                    if (totalProducts >= targetTotal) break;

                    for (let i = 0; i < productsPerTemplate && totalProducts < targetTotal; i++) {
                        const vendor = vendors[Math.floor(Math.random() * vendors.length)];
                        const subCategory = subCategories.length > 0 ? subCategories[Math.floor(Math.random() * subCategories.length)] : null;

                        const [minPrice, maxPrice] = template.priceRange;
                        const price = Math.floor(Math.random() * (maxPrice - minPrice + 1) + minPrice);
                        const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 10 : 0;
                        const originalPrice = discount > 0 ? Math.floor(price / (1 - discount / 100)) : price;

                        const product = {
                            name: `${template.name} ${i > 0 ? `Model ${i + 1}` : ''}`.trim(),
                            description: generateDescription(template.name, template.brand, categoryName),
                            price: price,
                            originalPrice: originalPrice,
                            discount: discount,
                            image: getProductImages(template.name, categoryName, template.brand),
                            category: category._id,
                            subCategory: subCategory ? subCategory._id : null,
                            brand: template.brand,
                            tags: template.tags,
                            vendorId: vendor._id,
                            vendorShopName: vendor.shopName,
                            stock: Math.floor(Math.random() * 500) + 50,
                            rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 to 5.0
                            reviewCount: Math.floor(Math.random() * 1000),
                            sold: Math.floor(Math.random() * 5000),
                            bestseller: Math.random() > 0.8,
                            attributes: generateAttributes(categoryName),
                            date: Date.now(),
                            isActive: true
                        };

                        products.push(product);
                        totalProducts++;

                        if (totalProducts % 20 === 0) {
                            console.log(`  📦 Generated ${totalProducts}/${targetTotal} products...`);
                        }
                    }
                }
            }
        }

        // Insert all products
        console.log('\n💾 Inserting products into database...');
        await productModel.insertMany(products);

        console.log('\n🎉 Product seeding completed successfully!');
        console.log(`📊 Total products created: ${totalProducts}`);
        console.log(`📊 Categories covered: ${categories.length}`);
        console.log(`📊 Vendors created: ${vendors.length}`);

        // Display summary
        console.log('\n📋 Products by Category:');
        for (const category of categories) {
            const count = products.filter(p => p.category.toString() === category._id.toString()).length;
            console.log(`  ${category.name}: ${count} products`);
        }

        console.log('\n📋 Vendors:');
        vendors.forEach(v => console.log(`  - ${v.shopName} (${v.email})`));

        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding products:', error);
        process.exit(1);
    }
};

seedProducts();

