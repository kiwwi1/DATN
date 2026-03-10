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

// Cartesian product helper
const cartesian = (arrays) => {
    if (arrays.length === 0) return [[]];
    const [first, ...rest] = arrays;
    const restProduct = cartesian(rest);
    return first.flatMap(val => restProduct.map(combo => [val, ...combo]));
};

// Generate SKU variants from attributes and a base price
const generateVariants = (attributes, basePrice) => {
    if (!attributes || attributes.length === 0) return [];

    const validAttrs = attributes.filter(a => a.values && a.values.length > 0);
    if (validAttrs.length === 0) return [];

    const attrValues = validAttrs.map(a => a.values.map(v => ({ name: a.name, value: v })));
    const combos = cartesian(attrValues);

    // Price multipliers simulate real-world pricing (larger sizes/more storage = more expensive)
    const priceMultipliers = {
        'S': 1.0, 'M': 1.0, 'L': 1.05, 'XL': 1.1, 'XXL': 1.15,
        '64GB': 1.0, '128GB': 1.15, '256GB': 1.3, '512GB': 1.55,
        '30ml': 1.0, '50ml': 1.4, '100ml': 1.9
    };

    return combos.map(combo => {
        const combination = {};
        let multiplier = 1.0;
        combo.forEach(({ name, value }) => {
            combination[name] = value;
            if (priceMultipliers[value]) multiplier = Math.max(multiplier, priceMultipliers[value]);
        });
        const variantPrice = Math.round(basePrice * multiplier / 1000) * 1000;
        return {
            combination,
            price: variantPrice,
            stock: Math.floor(Math.random() * 100) + 10
        };
    });
};

// Curated Unsplash photo IDs per product category
// Format: https://images.unsplash.com/photo-{id}?w=800&h=800&fit=crop&auto=format
const UNSPLASH_POOL = {
    smartphone: [
        '1511707171634-5f897ff02aa9', // iPhone on desk
        '1601784551446-20c9e07cdbdb', // phone hand
        '1592750475338-74b7b21085ab', // Samsung Galaxy
        '1556656793-08538906a9f8',    // phone screen
        '1565849904461-04a58ad377cb', // modern phone
        '1512054502232-10a0a035d672', // phone lifestyle
        '1574920162043-b872873f19bc', // phone flat lay
        '1580910051074-3eb694886505', // two phones
    ],
    laptop: [
        '1531297484001-80022131f5a1', // laptop workspace
        '1588872657578-7efd1f1555ed', // laptop screen
        '1484788984921-03950022c9ef', // MacBook
        '1496181133206-80ce9b88a853', // laptop coffee
        '1525547719571-a2d4ac8945e2', // minimal laptop
        '1611532736597-de2d4265fba3', // laptop desk
        '1593642632559-0c6d3fc62b89', // laptop workspace
        '1541807084-5c52e6e76241',    // MacBook open
    ],
    headphones: [
        '1505740420928-5e560c06d30e', // headphones product
        '1484704849700-f032a568e944', // headphones ear
        '1590658268037-6bf12165f8df', // white headphones
        '1583394838336-acd977736f90', // airpods
        '1610397648930-477b8c7f0943', // earbuds
        '1524678714210-9917a6c619c2', // in-ear headphones
        '1612444253978-83c66e5ae5d9', // wireless headphones
        '1613040809024-b4ef55237011', // studio headphones
    ],
    keyboard: [
        '1587829741301-dc798b83add3', // mechanical keyboard
        '1541140532-83aab8f9c29c',    // keyboard setup
        '1609872994526-4a928866eb8c', // keyboard rgb
        '1620573907823-8fccaa76e5cc', // keyboard top view
        '1618384887929-16ec33fab9ef', // gaming keyboard
        '1601944182139-62c68e9ef3b9', // keyboard flat
        '1544244015-0df4b3ffc6b0',    // minimal keyboard
        '1593640408182-31c4f2955b2b', // keyboard with mouse
    ],
    mouse: [
        '1585771724684-38269d6639fd', // gaming mouse
        '1527864550417-7fd91fc51a46', // mouse desk
        '1613140421733-1c6cdabb8816', // wireless mouse
        '1572435555646-7ad9a149ad91', // mouse top view
        '1563791877-d2a7d4524c5f',    // ergonomic mouse
        '1607798748738-b15c40d33d57', // mouse product shot
        '1637197771316-c82b395baeea', // gaming mouse rgb
        '1628260412297-a3377e45006f', // mouse pad with mouse
    ],
    speaker: [
        '1510915361894-db8b60106cb1', // bluetooth speaker
        '1608043152269-423dbba4e7e1', // speaker lifestyle
        '1558618666-fcd25c85cd64',    // round speaker
        '1545454675-3b9b2de8bde7',    // jbl speaker
        '1505740420928-5e560c06d30e', // speaker product
        '1578319439584-104c94d37305', // portable speaker
        '1548186228-0b2b69be8ecd',    // speaker setup
        '1619472351888-f844a0b33f5b', // small speaker
    ],
    tshirt_men: [
        '1521572163474-6864f9cf17ab', // white t-shirt
        '1602810318383-e386cc2a3ccf', // polo shirt men
        '1591195853828-11db59a44f43', // casual shirt men
        '1622470953794-aa9c70b0fb9d', // tee outfit
        '1529391409740-59f2cea08bc4', // men jacket
        '1516257984-08fe7c9e8c2b',    // men style
        '1617137968427-85a7c067bee5', // men white shirt
        '1490551082967-bf2a3c50a2f4', // men fashion photo
    ],
    shirt_men: [
        '1602810318383-e386cc2a3ccf', // shirt men
        '1617137968427-85a7c067bee5', // men white shirt
        '1603252109360-909baaf261ae', // formal shirt
        '1588196749597-9ff075ee6b5b', // shirt detail
        '1556821840-3a63f8550af9',    // men outfit
        '1516257984-08fe7c9e8c2b',    // men style
        '1490551082967-bf2a3c50a2f4', // men fashion
        '1582552938357-32b906df40cb', // men collection
    ],
    jeans_men: [
        '1542272954-eec5a323dfaa', // denim jeans
        '1475180429745-4bda80ae5c8f', // jeans street
        '1541099649105-f69ad21f3246', // jeans product
        '1594938298603-e8d9b06c7ca0', // jeans detail
        '1604176424472-9d9c8be8f5c7', // casual pants
        '1617038220319-276d3cfad36b', // men pants
        '1624378439432-1a6ee476df05', // denim product
        '1495105787522-5adfd8463e4f', // men wear jeans
    ],
    jacket_men: [
        '1529391409740-59f2cea08bc4', // leather jacket
        '1551698618-1dfe5d97d256',    // men jacket
        '1617038220319-276d3cfad36b', // puffer jacket
        '1508214751196-bcfd4ca60f91', // winter jacket
        '1539533018421-edd134a20132', // bomber jacket
        '1591047139829-d91aecb6caea', // oversized jacket
        '1495105787522-5adfd8463e4f', // jacket outfit
        '1507679799987-c73779587ccf', // casual jacket
    ],
    dress_women: [
        '1485968579580-b6d095142e6e', // casual dress
        '1515886657613-9f3515b0c78f', // summer dress
        '1539109136881-3be0616acf4b', // floral dress
        '1529374255404-311a2a4f1fd9', // women fashion
        '1496747611176-843222e1e57c', // women style
        '1581044777550-4cfa2732121f', // elegant dress
        '1594633312681-425c7b97ccd1', // outfit post
        '1612336307429-8a898d10e223', // women look
    ],
    blouse_women: [
        '1539109136881-3be0616acf4b', // blouse women
        '1485968579580-b6d095142e6e', // top outfit
        '1529374255404-311a2a4f1fd9', // women clothing
        '1581044777550-4cfa2732121f', // women top
        '1496747611176-843222e1e57c', // fashion photo
        '1515886657613-9f3515b0c78f', // women wear
        '1594633312681-425c7b97ccd1', // outfit details
        '1612336307429-8a898d10e223', // style look
    ],
    skirt_women: [
        '1594633312681-425c7b97ccd1', // skirt outfit
        '1515886657613-9f3515b0c78f', // women fashion
        '1529374255404-311a2a4f1fd9', // women style
        '1483985988355-763728e1cee9', // fashion shot
        '1539109136881-3be0616acf4b', // women apparel
        '1612336307429-8a898d10e223', // women look
        '1485968579580-b6d095142e6e', // casual outfit
        '1581044777550-4cfa2732121f', // clothing post
    ],
    sneakers: [
        '1542291026-7eec264c27ff', // Nike sneakers
        '1606107557195-0e29a4b5b4aa', // white sneakers
        '1491553895911-0055eca6402d', // running shoes
        '1595950653106-bdbce154b9dc', // sneakers product
        '1600269452121-4f2416e55c28', // air jordan
        '1515955656352-a1fa3a549cfe', // sneakers detail
        '1589099758740-e61c9bd5f576', // shoes lifestyle
        '1556048219-bb6978360b84',    // neon sneakers
    ],
    leather_shoes: [
        '1560769629-975ec94e6a86', // leather shoes
        '1614252235316-8bfb4c9be3c7', // dress shoes
        '1543163521-1bf539c55dd2', // ankle boots
        '1515347619252-60a4bf4fff4f', // sandals formal
        '1491553895911-0055eca6402d', // shoes pair
        '1542291026-7eec264c27ff', // shoes product
        '1606107557195-0e29a4b5b4aa', // shoes white bg
        '1595950653106-bdbce154b9dc', // footwear
    ],
    heels: [
        '1515347619252-60a4bf4fff4f', // high heels
        '1543163521-1bf539c55dd2',    // heels fashion
        '1560769629-975ec94e6a86',    // stiletto
        '1614252235316-8bfb4c9be3c7', // women heels
        '1590674899484-d5640e854abe', // shoes women
        '1556048219-bb6978360b84',    // sandal heels
        '1515655653318-2d128f56d38d', // fashion heels
        '1562273138-f46be4ebdf33',    // heels product
    ],
    sandals: [
        '1515347619252-60a4bf4fff4f', // sandals
        '1543163521-1bf539c55dd2',    // summer sandals
        '1590674899484-d5640e854abe', // sandal lifestyle
        '1556048219-bb6978360b84',    // flat sandals
        '1562273138-f46be4ebdf33',    // sandal product
        '1614252235316-8bfb4c9be3c7', // shoes summer
        '1515655653318-2d128f56d38d', // flip flops
        '1607522370275-f6bec83b5a73', // beach sandals
    ],
    lipstick: [
        '1596462502278-27bfdc403348', // lipstick product
        '1631214524020-3e96929e5e41', // makeup collection
        '1522338242992-e1d3935eb58a', // cosmetics flat lay
        '1571781926291-c477ebfd024b', // makeup brushes
        '1487412947147-5cebf100d293', // beauty products
        '1516975080664-ed2fc6a32937', // lipstick swatch
        '1618014085524-c79c22561d02', // makeup artist
        '1560800452-f2d475982b96',    // cosmetics bag
    ],
    skincare: [
        '1599305445671-ac291c95aaa9', // skincare routine
        '1612817288484-6f916006741a', // serum dropper
        '1571781926291-c477ebfd024b', // beauty products
        '1522338242992-e1d3935eb58a', // cosmetics
        '1570194065650-d99fb4bedf0a', // cream jar
        '1487412947147-5cebf100d293', // beauty flat lay
        '1508739773434-c26b3d09e071', // moisturizer
        '1616394584738-fc6e612e71b9', // skincare set
    ],
    perfume: [
        '1586495777744-4e6232bf5d52', // perfume bottle
        '1619994403073-cf6a98b5054b', // fragrance
        '1541643600914-78b084683702', // perfume luxury
        '1557683311-eac922347aa1',    // perfume flat lay
        '1544161513-0179fe746fd5',    // fragrance bottle
        '1588776814546-1ffcf47267a5', // cologne
        '1594744803329-e58504ab3360', // perfume wood
        '1556228578-8c89e6adf883',    // perfume aesthetic
    ],
    watch: [
        '1523275335684-37898b6baf30', // classic watch
        '1434056886845-dac89ffe9b56', // luxury watch
        '1546868871-7041f2a55e12',    // smart watch
        '1522312346375-d1a52e2b99b3', // watch collection
        '1587836374828-4db96a7c9fb2', // watch lifestyle
        '1548169874-53a18294f4c9',    // watch close up
        '1609587312208-cea54be969e7', // modern watch
        '1528360983277-13d401cdc186', // watch product
    ],
    bedding: [
        '1555041469-a586c61ea9bc',    // cozy bedroom
        '1611078489935-0cb964de46d6', // bed sheets
        '1522771739844-6a9f6a5f59bc', // bedroom interior
        '1540518614846-7eded433c457', // pillow bed
        '1505693416388-ac5ce68fe46a', // white bedding
        '1618221641282-c4062db39700', // bedroom aesthetic
        '1513161455079-7dc1de15ef3e', // cozy room
        '1583845112239-97ef1341b271', // bedroom decor
    ],
    lamp: [
        '1507149833265-60c372daea22', // desk lamp
        '1558618666-fcd25c85cd64',    // table lamp
        '1565814329452-e5d52a6f2a9e', // floor lamp
        '1513506003901-1e6a35d44fa0', // lamp room
        '1519710164239-da1523d7c4f5', // modern lamp
        '1524484485831-a92ffc0de03f', // pendant light
        '1533090161767-e4ba892d1e9e', // bedroom lamp
        '1616486029423-aaa4789e8c9a', // aesthetic lamp
    ],
    water_bottle: [
        '1602143407151-7111542de6e8', // water bottle
        '1606168094336-48f205522f5a', // thermos bottle
        '1600271772470-3ab5a1564f1f', // reusable bottle
        '1579871494447-9811cf80d66c', // flask bottle
        '1523362628745-0c100150b504', // sport bottle
        '1553531384-cc64ac80f931',    // metal water bottle
        '1542860020-5ae9d5e25ea0',    // hydro flask
        '1532635248-cf3f02a75853',    // tumbler cup
    ],
    default: [
        '1523275335684-37898b6baf30',
        '1542291026-7eec264c27ff',
        '1521572163474-6864f9cf17ab',
        '1531297484001-80022131f5a1',
        '1505740420928-5e560c06d30e',
        '1596462502278-27bfdc403348',
        '1523275335684-37898b6baf30',
        '1434056886845-dac89ffe9b56',
    ],
};

// Simple deterministic hash so the same product always gets the same image
function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return Math.abs(h);
}

// Map product name / category to an Unsplash photo pool key
function resolvePoolKey(productName, categoryName) {
    const name = productName.toLowerCase();
    const cat  = categoryName.toLowerCase();

    if (name.includes('iphone') || name.includes('samsung') || name.includes('xiaomi') ||
        name.includes('oppo') || name.includes('realme') || name.includes('điện thoại') ||
        cat.includes('điện thoại'))                              return 'smartphone';
    if (name.includes('macbook') || name.includes('laptop') ||
        name.includes('máy tính') || cat.includes('máy tính'))  return 'laptop';
    if (name.includes('tai nghe') || name.includes('airpod'))   return 'headphones';
    if (name.includes('bàn phím'))                              return 'keyboard';
    if (name.includes('chuột'))                                 return 'mouse';
    if (name.includes('loa'))                                   return 'speaker';

    if (name.includes('áo thun') || name.includes('áo polo'))  return 'tshirt_men';
    if (name.includes('áo sơ mi') || name.includes('áo khoác') && cat.includes('nam')) return 'shirt_men';
    if (name.includes('quần jean') || name.includes('quần dài') || name.includes('quần âu')) return 'jeans_men';
    if ((name.includes('áo khoác') || name.includes('jacket')) && cat.includes('nam')) return 'jacket_men';

    if (name.includes('đầm') || (name.includes('váy') && !name.includes('dài'))) return 'dress_women';
    if (name.includes('áo kiểu') || name.includes('blouse'))   return 'blouse_women';
    if (name.includes('váy') || name.includes('chân váy'))     return 'skirt_women';

    if (name.includes('giày thể thao') || name.includes('sneaker')) return 'sneakers';
    if (name.includes('giày da') || name.includes('giày tây') || name.includes('boot')) return 'leather_shoes';
    if (name.includes('giày cao gót') || name.includes('stiletto')) return 'heels';
    if (name.includes('dép') || name.includes('sandal'))       return 'sandals';

    if (name.includes('son') || name.includes('lipstick'))     return 'lipstick';
    if (name.includes('kem') || name.includes('serum') || name.includes('toner') ||
        name.includes('dưỡng da'))                             return 'skincare';
    if (name.includes('nước hoa') || name.includes('perfume')) return 'perfume';

    if (name.includes('đồng hồ') || cat.includes('đồng hồ'))  return 'watch';
    if (name.includes('chăn') || name.includes('ga trải') || name.includes('gối')) return 'bedding';
    if (name.includes('đèn'))                                  return 'lamp';
    if (name.includes('bình nước') || name.includes('bình giữ nhiệt')) return 'water_bottle';

    // Category fallback
    if (cat.includes('thời trang nam'))     return 'tshirt_men';
    if (cat.includes('thời trang nữ'))     return 'dress_women';
    if (cat.includes('giày'))              return 'sneakers';
    if (cat.includes('sắc đẹp'))           return 'skincare';
    if (cat.includes('đồng hồ'))           return 'watch';
    if (cat.includes('nhà cửa'))           return 'bedding';

    return 'default';
}

// Build 4 Unsplash image URLs deterministically for a product
const getProductImages = (productName, categoryName) => {
    const pool = UNSPLASH_POOL[resolvePoolKey(productName, categoryName)];
    const base = simpleHash(productName + categoryName);
    const images = [];
    for (let i = 0; i < 4; i++) {
        const id = pool[(base + i) % pool.length];
        images.push(`https://images.unsplash.com/photo-${id}?w=800&h=800&fit=crop&auto=format`);
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
                        const basePrice = Math.floor(Math.random() * (maxPrice - minPrice + 1) + minPrice);
                        const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 10 : 0;
                        const originalPrice = discount > 0 ? Math.floor(basePrice / (1 - discount / 100)) : basePrice;

                        const attrs = generateAttributes(categoryName);
                        const variants = generateVariants(attrs, basePrice);

                        // Derive product-level price (min variant) and stock (sum of variants)
                        const price = variants.length > 0
                            ? Math.min(...variants.map(v => v.price))
                            : basePrice;
                        const stock = variants.length > 0
                            ? variants.reduce((s, v) => s + v.stock, 0)
                            : Math.floor(Math.random() * 500) + 50;

                        const product = {
                            name: `${template.name} ${i > 0 ? `Model ${i + 1}` : ''}`.trim(),
                            description: generateDescription(template.name, template.brand, categoryName),
                            price: price,
                            originalPrice: originalPrice,
                            discount: discount,
                            image: getProductImages(template.name, categoryName),
                            category: category._id,
                            subCategory: subCategory ? subCategory._id : null,
                            brand: template.brand,
                            tags: template.tags,
                            vendorId: vendor._id,
                            vendorShopName: vendor.shopName,
                            stock: stock,
                            rating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // 3.0 to 5.0
                            reviewCount: Math.floor(Math.random() * 1000),
                            sold: Math.floor(Math.random() * 5000),
                            bestseller: Math.random() > 0.8,
                            attributes: attrs,
                            variants: variants,
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

