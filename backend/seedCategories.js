import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import categoryModel from './models/categoryModel.js';

// Helper function to create slug from Vietnamese text
const createSlug = (text) => {
    const from = "àáãảạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđùúủũụưừứửữựòóỏõọôồốổỗộơờớởỡợìíỉĩịäëïîöüûñçýỳỹỵỷ";
    const to = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeduuuuuuuuuuuoooooooooooooooooiiiiiaeiiouuncyyyyy";
    
    let slug = text.toLowerCase().trim();
    for (let i = 0; i < from.length; i++) {
        slug = slug.replace(new RegExp(from[i], 'g'), to[i]);
    }
    
    slug = slug.replace(/[^a-z0-9\s-]/g, '')
             .replace(/\s+/g, '-')
             .replace(/-+/g, '-')
             .replace(/^-+|-+$/g, '');
    
    return slug;
}

// Complete category data from Shopee Vietnam API
const categoryData = [
    {
        catid: 11035567,
        name: 'Men Clothes',
        display_name: 'Thời Trang Nam',
        icon: '👔',
        level: 1,
        order: 1,
        children: [
            { catid: 11035568, name: 'Jackets, Coats & Vests', display_name: 'Áo Khoác' },
            { catid: 11035572, name: 'Suit Jackets & Blazers', display_name: 'Áo Vest và Blazer' },
            { catid: 11035578, name: 'Hoodies & Sweatshirts', display_name: 'Áo Hoodie, Áo Len & Áo Nỉ' },
            { catid: 11035583, name: 'Jeans', display_name: 'Quần Jeans' },
            { catid: 11035584, name: 'Pants/Suits', display_name: 'Quần Dài/Quần Âu' },
            { catid: 11035590, name: 'Shorts', display_name: 'Quần Short' },
            { catid: 11035592, name: 'Tops', display_name: 'Áo' },
            { catid: 11035597, name: 'Tanks', display_name: 'Áo Ba Lỗ' },
            { catid: 11035598, name: 'Innerwear & Underwear', display_name: 'Đồ Lót' },
            { catid: 11035603, name: 'Sleepwear', display_name: 'Đồ Ngủ' },
            { catid: 11035604, name: 'Sets', display_name: 'Đồ Bộ' },
            { catid: 11035605, name: 'Socks', display_name: 'Vớ/Tất' },
            { catid: 11035606, name: 'Traditional Wear', display_name: 'Trang Phục Truyền Thống' },
            { catid: 11035611, name: 'Costumes', display_name: 'Đồ Hóa Trang' },
            { catid: 11035612, name: 'Occupational Attire', display_name: 'Trang Phục Ngành Nghề' },
            { catid: 11035613, name: 'Others', display_name: 'Khác' },
            { catid: 11035614, name: 'Men Jewelries', display_name: 'Trang Sức Nam' },
            { catid: 11035620, name: 'Eyewear', display_name: 'Kính Mắt Nam' },
            { catid: 11035625, name: 'Belts', display_name: 'Thắt Lưng Nam' },
            { catid: 11035626, name: 'Neckties, Bow Ties & Cravats', display_name: 'Cà vạt & Nơ cổ' },
            { catid: 11035627, name: 'Additional Accessories', display_name: 'Phụ Kiện Nam' }
        ]
    },
    {
        catid: 11035639,
        name: 'Women Clothes',
        display_name: 'Thời Trang Nữ',
        icon: '👗',
        level: 1,
        order: 2,
        children: [
            { catid: 11035648, name: 'Pants & Leggings', display_name: 'Quần' },
            { catid: 11035652, name: 'Shorts', display_name: 'Quần đùi' },
            { catid: 11035656, name: 'Skirts', display_name: 'Chân váy' },
            { catid: 11035657, name: 'Jeans', display_name: 'Quần jeans' },
            { catid: 11035658, name: 'Dresses', display_name: 'Đầm/Váy' },
            { catid: 11035659, name: 'Wedding Dresses', display_name: 'Váy cưới' },
            { catid: 11035660, name: 'Jumpsuits, Playsuits & Overalls', display_name: 'Đồ liền thân' },
            { catid: 11035665, name: 'Jackets, Coats & Vests', display_name: 'Áo khoác, Áo choàng & Vest' },
            { catid: 11035672, name: 'Sweaters & Cardigans', display_name: 'Áo len & Cardigan' },
            { catid: 11035673, name: 'Hoodies & Sweatshirts', display_name: 'Hoodie và Áo nỉ' },
            { catid: 11035677, name: 'Sets', display_name: 'Bộ' },
            { catid: 11035682, name: 'Lingerie & Underwear', display_name: 'Đồ lót' },
            { catid: 11035692, name: 'Sleepwear & Pajamas', display_name: 'Đồ ngủ' },
            { catid: 11035640, name: 'Tops', display_name: 'Áo' },
            { catid: 11035730, name: 'Sportwear', display_name: 'Đồ tập' },
            { catid: 11035697, name: 'Maternity Wear', display_name: 'Đồ Bầu' },
            { catid: 11035705, name: 'Traditional Wear', display_name: 'Đồ truyền thống' },
            { catid: 11035711, name: 'Costumes', display_name: 'Đồ hóa trang' },
            { catid: 11035713, name: 'Fabric', display_name: 'Vải' },
            { catid: 11035726, name: 'Socks & Stockings', display_name: 'Vớ/ Tất' },
            { catid: 11035712, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11036030,
        name: 'Mobile & Gadgets',
        display_name: 'Điện Thoại & Phụ Kiện',
        icon: '📱',
        level: 1,
        order: 3,
        children: [
            { catid: 11036031, name: 'Mobile Phones', display_name: 'Điện thoại' },
            { catid: 11036041, name: 'Tablets', display_name: 'Máy tính bảng' },
            { catid: 11036048, name: 'Powerbanks', display_name: 'Pin Dự Phòng' },
            { catid: 11036054, name: 'Batteries, Cables & Charger', display_name: 'Pin Gắn Trong, Cáp và Bộ Sạc' },
            { catid: 11036060, name: 'Cases, Covers, & Skins', display_name: 'Ốp lưng, bao da, Miếng dán điện thoại' },
            { catid: 11036064, name: 'Screen Protectors', display_name: 'Bảo vệ màn hình' },
            { catid: 11036074, name: 'Phone Holders', display_name: 'Đế giữ điện thoại' },
            { catid: 11036083, name: 'Memory Cards', display_name: 'Thẻ nhớ' },
            { catid: 11036084, name: 'Sims', display_name: 'Sim' },
            { catid: 11036091, name: 'Other Accessories', display_name: 'Phụ kiện khác' },
            { catid: 11036097, name: 'Other devices', display_name: 'Thiết bị khác' }
        ]
    },
    {
        catid: 11036194,
        name: 'Moms, Kids & Babies',
        display_name: 'Mẹ & Bé',
        icon: '👶',
        level: 1,
        order: 4,
        children: [
            { catid: 11036195, name: 'Baby Travel Essentials', display_name: 'Đồ dùng du lịch cho bé' },
            { catid: 11036204, name: 'Feeding Essentials', display_name: 'Đồ dùng ăn dặm cho bé' },
            { catid: 11036213, name: 'Maternity Accessories', display_name: 'Phụ kiện cho mẹ' },
            { catid: 11036217, name: 'Maternity Healthcare', display_name: 'Chăm sóc sức khỏe mẹ' },
            { catid: 11036222, name: 'Bath & Body Care', display_name: 'Đồ dùng phòng tắm & Chăm sóc cơ thể bé' },
            { catid: 11036233, name: 'Nursery', display_name: 'Đồ dùng phòng ngủ cho bé' },
            { catid: 11036240, name: 'Baby Safety', display_name: 'An toàn cho bé' },
            { catid: 11036248, name: 'Baby Food', display_name: 'Thực phẩm cho bé' },
            { catid: 11036253, name: 'Baby Healthcare', display_name: 'Chăm sóc sức khỏe bé' },
            { catid: 11036260, name: 'Diapering & Potty', display_name: 'Tã & bô em bé' },
            { catid: 11036266, name: 'Toys', display_name: 'Đồ chơi' },
            { catid: 11036277, name: 'Gift Sets & Packages', display_name: 'Bộ & Gói quà tặng' },
            { catid: 11036278, name: 'Others', display_name: 'Khác' },
            { catid: 11059299, name: 'Milk 24 months and ups', display_name: 'Sữa công thức trên 24 tháng' },
            { catid: 11059300, name: 'Milk Formula 0- 24 months', display_name: 'Sữa công thức 0-24 tháng tuổi' }
        ]
    },
    {
        catid: 11036132,
        name: 'Consumer Electronics',
        display_name: 'Thiết Bị Điện Tử',
        icon: '🎧',
        level: 1,
        order: 5,
        children: [
            { catid: 11036167, name: 'Tivi Accessories', display_name: 'Phụ kiện tivi' },
            { catid: 11036172, name: 'Gaming & Console', display_name: 'Máy Game Console' },
            { catid: 11036182, name: 'Console Accessories', display_name: 'Phụ kiện Console' },
            { catid: 11036184, name: 'Video Games', display_name: 'Đĩa game' },
            { catid: 11036133, name: 'Accessories and spare parts', display_name: 'Linh phụ kiện' },
            { catid: 11036143, name: 'Earphones', display_name: 'Tai nghe nhét tai' },
            { catid: 11036135, name: 'Audio', display_name: 'Loa' },
            { catid: 11036151, name: 'Tivi', display_name: 'Tivi' },
            { catid: 11036157, name: 'Tivi Box', display_name: 'Tivi Box' },
            { catid: 11109141, name: 'Headphones', display_name: 'Headphones' }
        ]
    },
    {
        catid: 11036670,
        name: 'Home & Living',
        display_name: 'Nhà Cửa & Đời Sống',
        icon: '🏠',
        level: 1,
        order: 6,
        children: [
            { catid: 11036683, name: 'Bedding', display_name: 'Chăn, Ga, Gối & Nệm' },
            { catid: 11036695, name: 'Furniture', display_name: 'Đồ nội thất' },
            { catid: 11036717, name: 'Home Decoration', display_name: 'Trang trí nhà cửa' },
            { catid: 11036732, name: 'Tools and Home improvement', display_name: 'Dụng cụ & Thiết bị tiện ích' },
            { catid: 11036748, name: 'Kitchenware and food storage', display_name: 'Đồ dùng nhà bếp và hộp đựng thực phẩm' },
            { catid: 11036760, name: 'Lighting', display_name: 'Đèn' },
            { catid: 11036776, name: 'Outdoor & Garden', display_name: 'Ngoài trời & Sân vườn' },
            { catid: 11036671, name: 'Bathroom', display_name: 'Đồ dùng phòng tắm' },
            { catid: 11111670, name: 'Regilious and Worship items', display_name: 'Vật phẩm thờ cúng' },
            { catid: 11111669, name: 'Party supplies', display_name: 'Đồ trang trí tiệc' },
            { catid: 11111665, name: 'Housekeeping and Laundry', display_name: 'Chăm sóc nhà cửa và giặt ủi' },
            { catid: 11111668, name: 'Houseorganizers', display_name: 'Sắp xếp nhà cửa' },
            { catid: 11111666, name: 'Drinkware', display_name: 'Dụng cụ pha chế' },
            { catid: 11111664, name: 'Home Fragrance & Aromatherapy', display_name: 'Tinh dầu thơm phòng' },
            { catid: 11111667, name: 'Dinnerware', display_name: 'Đồ dùng phòng ăn' }
        ]
    },
    {
        catid: 11035954,
        name: 'Computer & Accessories',
        display_name: 'Máy Tính & Laptop',
        icon: '💻',
        level: 1,
        order: 7,
        children: [
            { catid: 11035955, name: 'Desktop Computers', display_name: 'Máy Tính Bàn' },
            { catid: 11035961, name: 'Monitors', display_name: 'Màn Hình' },
            { catid: 11035962, name: 'Desktop & Laptop Components', display_name: 'Linh Kiện Máy Tính' },
            { catid: 11035975, name: 'Data Storage', display_name: 'Thiết Bị Lưu Trữ' },
            { catid: 11035983, name: 'Network Components', display_name: 'Thiết Bị Mạng' },
            { catid: 11035993, name: 'Printers, Scanners & Projectors', display_name: 'Máy In, Máy Scan & Máy Chiếu' },
            { catid: 11036000, name: 'Peripherals & Accessories', display_name: 'Phụ Kiện Máy Tính' },
            { catid: 11036015, name: 'Laptops', display_name: 'Laptop' },
            { catid: 11036016, name: 'Others', display_name: 'Khác' },
            { catid: 11036023, name: 'Gaming', display_name: 'Gaming' }
        ]
    },
    {
        catid: 11036279,
        name: 'Beauty & Personal Care',
        display_name: 'Sắc Đẹp',
        icon: '💄',
        level: 1,
        order: 8,
        children: [
            { catid: 11036328, name: 'Skincare', display_name: 'Chăm sóc da mặt' },
            { catid: 11036280, name: 'Bath & Body Care', display_name: 'Tắm & chăm sóc cơ thể' },
            { catid: 11036314, name: 'Makeup', display_name: 'Trang điểm' },
            { catid: 11036297, name: 'Hair Care', display_name: 'Chăm sóc tóc' },
            { catid: 11036321, name: 'Beauty Tools & Accessories', display_name: 'Dụng cụ & Phụ kiện Làm đẹp' },
            { catid: 11111646, name: 'Oral Care', display_name: 'Vệ sinh răng miệng' },
            { catid: 11036310, name: 'Perfumes & Fragrances', display_name: 'Nước hoa' },
            { catid: 11036304, name: "Men's Care", display_name: 'Chăm sóc nam giới' },
            { catid: 11036344, name: 'Others', display_name: 'Khác' },
            { catid: 11111647, name: 'Feminine Care', display_name: 'Chăm sóc phụ nữ' },
            { catid: 11036343, name: 'Beauty Sets & Packages', display_name: 'Bộ sản phẩm làm đẹp' }
        ]
    },
    {
        catid: 11036101,
        name: 'Cameras',
        display_name: 'Máy Ảnh & Máy Quay Phim',
        icon: '📷',
        level: 1,
        order: 9,
        children: [
            { catid: 11036102, name: 'Cameras', display_name: 'Máy ảnh - Máy quay phim' },
            { catid: 11036109, name: 'Security Cameras & Systems', display_name: 'Camera giám sát & Camera hệ thống' },
            { catid: 11036114, name: 'Memory Cards', display_name: 'Thẻ nhớ' },
            { catid: 11036115, name: 'Lenses', display_name: 'Ống kính' },
            { catid: 11036119, name: 'Camera Accessories', display_name: 'Phụ kiện máy ảnh' },
            { catid: 11036129, name: 'Drones', display_name: 'Máy bay camera & Phụ kiện' }
        ]
    },
    {
        catid: 11036345,
        name: 'Health',
        display_name: 'Sức Khỏe',
        icon: '💊',
        level: 1,
        order: 10,
        children: [
            { catid: 11036352, name: 'Medical Supplies', display_name: 'Vật tư y tế' },
            { catid: 11036373, name: 'Insect Repellents', display_name: 'Chống muỗi & xua đuổi côn trùng' },
            { catid: 11036346, name: 'Food Supplement', display_name: 'Thực phẩm chức năng' },
            { catid: 11036370, name: 'Adult Diapers & Incontinence', display_name: 'Tã người lớn' },
            { catid: 11036348, name: 'Beauty Supplements', display_name: 'Hỗ trợ làm đẹp' },
            { catid: 11036375, name: 'Sexual Wellness', display_name: 'Hỗ trợ tình dục' },
            { catid: 11036372, name: 'Massage & Therapy Devices', display_name: 'Dụng cụ massage và trị liệu' },
            { catid: 11036381, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11035788,
        name: 'Watches',
        display_name: 'Đồng Hồ',
        icon: '⌚',
        level: 1,
        order: 11,
        children: [
            { catid: 11035789, name: 'Men Watches', display_name: 'Đồng Hồ Nam' },
            { catid: 11035790, name: 'Women Watches', display_name: 'Đồng Hồ Nữ' },
            { catid: 11035791, name: 'Set & Couple Watches', display_name: 'Bộ Đồng Hồ & Đồng Hồ Cặp' },
            { catid: 11035792, name: 'Kid Watches', display_name: 'Đồng Hồ Trẻ Em' },
            { catid: 11035793, name: 'Watches Accessories', display_name: 'Phụ Kiện Đồng Hồ' },
            { catid: 11035800, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11035825,
        name: 'Women Shoes',
        display_name: 'Giày Dép Nữ',
        icon: '👠',
        level: 1,
        order: 12,
        children: [
            { catid: 11035826, name: 'Boots', display_name: 'Bốt' },
            { catid: 11035830, name: 'Sneakers', display_name: 'Giày Thể Thao/ Sneaker' },
            { catid: 11035831, name: 'Flats', display_name: 'Giày Đế Bằng' },
            { catid: 11035837, name: 'Heels', display_name: 'Giày Cao Gót' },
            { catid: 11035838, name: 'Wedges', display_name: 'Giày Đế Xuồng' },
            { catid: 11035839, name: 'Flat Sandals & Flip Flops', display_name: 'Xăng-đan Và Dép' },
            { catid: 11035845, name: 'Shoe Care & Accessories', display_name: 'Phụ Kiện Giày' },
            { catid: 11035852, name: 'Others', display_name: 'Giày Khác' }
        ]
    },
    {
        catid: 11035801,
        name: 'Men Shoes',
        display_name: 'Giày Dép Nam',
        icon: '👞',
        level: 1,
        order: 13,
        children: [
            { catid: 11035802, name: 'Boots', display_name: 'Bốt' },
            { catid: 11035807, name: 'Sneakers', display_name: 'Giày Thể Thao/ Sneakers' },
            { catid: 11035808, name: 'Slip Ons & Mules', display_name: 'Giày Sục' },
            { catid: 11035809, name: 'Loafers & Boat Shoes', display_name: 'Giày Tây Lười' },
            { catid: 11035810, name: 'Oxfords & Lace-Ups', display_name: 'Giày Oxfords & Giày Buộc Dây' },
            { catid: 11035811, name: 'Sandals & Flip Flops', display_name: 'Xăng-đan và Dép' },
            { catid: 11035817, name: 'Shoe Care & Accessories', display_name: 'Phụ kiện giày dép' },
            { catid: 11035824, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11035761,
        name: 'Women Bags',
        display_name: 'Túi Ví Nữ',
        icon: '👜',
        level: 1,
        order: 14,
        children: [
            { catid: 11035762, name: 'Backpacks', display_name: 'Ba Lô Nữ' },
            { catid: 11035763, name: 'Laptop Bags', display_name: 'Cặp Laptop' },
            { catid: 11035768, name: 'Clutches & Wristlets', display_name: 'Ví Dự Tiệc & Ví Cầm Tay' },
            { catid: 11035769, name: 'Waist Bags & Chest Bags', display_name: 'Túi Đeo Hông & Túi Đeo Ngực' },
            { catid: 11035770, name: 'Tote Bags', display_name: 'Túi Tote' },
            { catid: 11035771, name: 'Top-handle Bags', display_name: 'Túi Quai Xách' },
            { catid: 11035772, name: 'Crossbody & Shoulder Bags', display_name: 'Túi Đeo Chéo & Túi Đeo Vai' },
            { catid: 11035773, name: 'Wallets', display_name: 'Ví/Bóp Nữ' },
            { catid: 11035780, name: 'Bag Accessories', display_name: 'Phụ Kiện Túi' },
            { catid: 11035787, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11036971,
        name: 'Home Appliances',
        display_name: 'Thiết Bị Điện Gia Dụng',
        icon: '🔌',
        level: 1,
        order: 15,
        children: [
            { catid: 11036972, name: 'Kitchen Appliances', display_name: 'Đồ gia dụng nhà bếp' },
            { catid: 11036990, name: 'Large Appliance', display_name: 'Đồ gia dụng lớn' },
            { catid: 11037000, name: 'Vacuums & Floor care', display_name: 'Máy hút bụi & Thiết bị làm sạch' },
            { catid: 11037007, name: 'Air Conditioners & Fans', display_name: 'Quạt & Máy nóng lạnh' },
            { catid: 11037016, name: 'Garment Care', display_name: 'Thiết bị chăm sóc quần áo' },
            { catid: 11037023, name: 'Others', display_name: 'Khác' },
            { catid: 11111623, name: 'Blenders, Mixers & Grinders', display_name: 'Máy xay, ép, máy đánh trứng trộn bột, máy xay thực phẩm' },
            { catid: 11111620, name: 'Electric Cookers', display_name: 'Bếp điện' }
        ]
    },
    {
        catid: 11035853,
        name: 'Fashion Accessories',
        display_name: 'Phụ Kiện & Trang Sức Nữ',
        icon: '💎',
        level: 1,
        order: 16,
        children: [
            { catid: 11035854, name: 'Rings', display_name: 'Nhẫn' },
            { catid: 11035855, name: 'Earrings', display_name: 'Bông tai' },
            { catid: 11035856, name: 'Scarves & Shawls', display_name: 'Khăn choàng' },
            { catid: 11035857, name: 'Gloves', display_name: 'Găng tay' },
            { catid: 11035858, name: 'Hair Accessories', display_name: 'Phụ kiện tóc' },
            { catid: 11035865, name: 'Bracelets & Bangles', display_name: 'Vòng tay & Lắc tay' },
            { catid: 11035866, name: 'Anklets', display_name: 'Lắc chân' },
            { catid: 11035867, name: 'Hats & Caps', display_name: 'Mũ' },
            { catid: 11035868, name: 'Necklaces', display_name: 'Dây chuyền' },
            { catid: 11035869, name: 'Eyewear', display_name: 'Kính mắt' },
            { catid: 11035874, name: 'Investment Precious Metals', display_name: 'Kim loại quý' },
            { catid: 11035880, name: 'Belts', display_name: 'Thắt lưng' },
            { catid: 11035881, name: 'Neckties, Bow Ties & Cravats', display_name: 'Cà vạt & Nơ cổ' },
            { catid: 11035882, name: 'Additional Accessories', display_name: 'Phụ kiện thêm' },
            { catid: 11035891, name: 'Accessories Sets & Packages', display_name: 'Bộ phụ kiện' },
            { catid: 11035892, name: 'Others', display_name: 'Khác' },
            { catid: 11035893, name: 'Socks & Stockings', display_name: 'Vớ/ Tất' },
            { catid: 11035897, name: 'Umbrella', display_name: 'Ô/Dù' }
        ]
    },
    {
        catid: 11035478,
        name: 'Sport & Outdoor',
        display_name: 'Thể Thao & Du Lịch',
        icon: '⚽',
        level: 1,
        order: 17,
        children: [
            { catid: 11035479, name: 'Luggage', display_name: 'Vali' },
            { catid: 11035487, name: 'Travel Bags', display_name: 'Túi du lịch' },
            { catid: 11035492, name: 'Travel Accessories', display_name: 'Phụ kiện du lịch' },
            { catid: 11035503, name: 'Sports & Outdoor Recreation Equipments', display_name: 'Dụng Cụ Thể Thao & Dã Ngoại' },
            { catid: 11035531, name: 'Sports Footwear', display_name: 'Giày Thể Thao' },
            { catid: 11035543, name: 'Sports & Outdoor Apparels', display_name: 'Thời Trang Thể Thao & Dã Ngoại' },
            { catid: 11035553, name: 'Sports & Outdoor Accessories', display_name: 'Phụ Kiện Thể Thao & Dã Ngoại' },
            { catid: 11035566, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11036525,
        name: 'Grocery',
        display_name: 'Bách Hóa Online',
        icon: '🛒',
        level: 1,
        order: 18,
        children: [
            { catid: 11036532, name: 'Snacks', display_name: 'Đồ ăn vặt' },
            { catid: 11036526, name: 'Convenience / Ready-to-eat', display_name: 'Đồ chế biến sẵn' },
            { catid: 11036544, name: 'Food Staples', display_name: 'Nhu yếu phẩm' },
            { catid: 11036552, name: 'Cooking Essentials', display_name: 'Nguyên liệu nấu ăn' },
            { catid: 11036562, name: 'Baking Needs', display_name: 'Đồ làm bánh' },
            { catid: 11036591, name: 'Dairy & Eggs', display_name: 'Sữa - trứng' },
            { catid: 11036576, name: 'Beverages', display_name: 'Đồ uống' },
            { catid: 11036570, name: 'Breakfast Cereals & Spread', display_name: 'Ngũ cốc & mứt' },
            { catid: 11036611, name: 'Bakery', display_name: 'Các loại bánh' },
            { catid: 11036616, name: 'Alcoholic Beverages', display_name: 'Đồ uống có cồn' },
            { catid: 11036622, name: 'Gift Set & Hampers', display_name: 'Bộ quà tặng' },
            { catid: 11036601, name: 'Fresh & Frozen Food', display_name: 'Thực phẩm tươi sống và thực phẩm đông lạnh' },
            { catid: 11036623, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11036793,
        name: 'Automotive',
        display_name: 'Ô Tô & Xe Máy & Xe Đạp',
        icon: '🚗',
        level: 1,
        order: 19,
        children: [
            { catid: 11036794, name: 'Bike, E-bike', display_name: 'Xe đạp, xe điện' },
            { catid: 11036804, name: 'Motorbike', display_name: 'Mô tô, xe máy' },
            { catid: 11036811, name: 'Car', display_name: 'Xe Ô tô' },
            { catid: 11036817, name: 'Helmets', display_name: 'Mũ bảo hiểm' },
            { catid: 11036824, name: 'Motorbike Accessories', display_name: 'Phụ kiện xe máy' },
            { catid: 11036846, name: 'Bicycle & E-bike Accessories', display_name: 'Phụ kiện xe đạp' },
            { catid: 11108984, name: 'Interior Accessories', display_name: 'Phụ kiện bên trong ô tô' },
            { catid: 11108967, name: 'Automotive Oils & Lubes', display_name: 'Dầu nhớt & dầu nhờn' },
            { catid: 11109015, name: 'Auto Parts & Spares', display_name: 'Phụ tùng ô tô' },
            { catid: 11108953, name: 'Motorbike Spare Parts', display_name: 'Phụ tùng xe máy' },
            { catid: 11109002, name: 'Exterior Accessories', display_name: 'Phụ kiện bên ngoài ô tô' },
            { catid: 11108974, name: 'Automotive Care', display_name: 'Chăm sóc ô tô' },
            { catid: 11116267, name: 'Automotive Services', display_name: 'Dịch vụ cho xe' }
        ]
    },
    {
        catid: 11036863,
        name: 'Books & Stationery',
        display_name: 'Nhà Sách Online',
        icon: '📚',
        level: 1,
        order: 20,
        children: [
            { catid: 11108503, name: 'Domestic Books', display_name: 'Sách Tiếng Việt' },
            { catid: 11108540, name: 'Foreign Books', display_name: 'Sách ngoại văn' },
            { catid: 11108576, name: 'Gift & Wrapping', display_name: 'Gói Quà' },
            { catid: 11108584, name: 'Writing & Correction', display_name: 'Bút viết' },
            { catid: 11108591, name: 'School & Office Supplies', display_name: 'Dụng cụ học sinh & văn phòng' },
            { catid: 11108635, name: 'Coloring & Arts', display_name: 'Màu, Họa Cụ và Đồ Thủ Công' },
            { catid: 11108610, name: 'Notebooks & Paper Products', display_name: 'Sổ và Giấy Các Loại' },
            { catid: 11036914, name: 'Souvenirs', display_name: 'Quà Lưu Niệm' },
            { catid: 11108624, name: 'Music & Media', display_name: 'Nhạc cụ và phụ kiện âm nhạc' }
        ]
    },
    {
        catid: 11035741,
        name: 'Men Bags',
        display_name: 'Balo & Túi Ví Nam',
        icon: '🎒',
        level: 1,
        order: 21,
        children: [
            { catid: 11035742, name: 'Backpacks', display_name: 'Ba Lô Nam' },
            { catid: 11035743, name: 'Laptop Backpacks', display_name: 'Ba Lô Laptop Nam' },
            { catid: 11035744, name: 'Laptop Bags & Cases', display_name: 'Túi & Cặp Đựng Laptop' },
            { catid: 11035747, name: 'Laptop Sleeves', display_name: 'Túi Chống Sốc Laptop Nam' },
            { catid: 11035748, name: 'Tote Bags', display_name: 'Túi Tote Nam' },
            { catid: 11035749, name: 'Briefcases', display_name: 'Cặp Xách Công Sở Nam' },
            { catid: 11035750, name: 'Clutches', display_name: 'Ví Cầm Tay Nam' },
            { catid: 11035751, name: 'Waist Bags & Chest Bags', display_name: 'Túi Đeo Hông & Túi Đeo Ngực Nam' },
            { catid: 11035752, name: 'Crossbody & Shoulder Bags', display_name: 'Túi Đeo Chéo Nam' },
            { catid: 11035753, name: 'Wallets', display_name: 'Bóp/Ví Nam' },
            { catid: 11035760, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11036382,
        name: 'Kid Fashion',
        display_name: 'Thời Trang Trẻ Em',
        icon: '👧',
        level: 1,
        order: 22,
        children: [
            { catid: 11036418, name: 'Boy Clothes', display_name: 'Trang phục bé trai' },
            { catid: 11036438, name: 'Girl Clothes', display_name: 'Trang phục bé gái' },
            { catid: 11036461, name: 'Boy Shoes', display_name: 'Giày dép bé trai' },
            { catid: 11036469, name: 'Girl Shoes', display_name: 'Giày dép bé gái' },
            { catid: 11036477, name: 'Others', display_name: 'Khác' },
            { catid: 11036383, name: 'Baby Clothes', display_name: 'Quần áo em bé' },
            { catid: 11036396, name: 'Baby Mittens & Footwear', display_name: 'Giày tập đi & Tất sơ sinh' },
            { catid: 11036397, name: 'Baby & Kids Accessories', display_name: 'Phụ kiện trẻ em' }
        ]
    },
    {
        catid: 11036932,
        name: 'Toys',
        display_name: 'Đồ Chơi',
        icon: '🧸',
        level: 1,
        order: 23,
        children: [
            { catid: 11036933, name: 'Hobbies & Collectibles', display_name: 'Sở thích & Sưu tầm' },
            { catid: 11036939, name: 'Game Zone', display_name: 'Đồ chơi giải trí' },
            { catid: 11036946, name: 'Educational Toys', display_name: 'Đồ chơi giáo dục' },
            { catid: 11036954, name: 'Baby & Toddler Toys', display_name: 'Đồ chơi cho trẻ sơ sinh & trẻ nhỏ' },
            { catid: 11036960, name: 'Action & Outdoor Toys', display_name: 'Đồ chơi vận động & ngoài trời' },
            { catid: 11036966, name: 'Dolls & Stuffed Toys', display_name: 'Búp bê & Đồ chơi nhồi bông' }
        ]
    },
    {
        catid: 11036624,
        name: 'Home care',
        display_name: 'Giặt Giũ & Chăm Sóc Nhà Cửa',
        icon: '🧹',
        level: 1,
        order: 24,
        children: [
            { catid: 11036625, name: 'Laundry', display_name: 'Giặt giũ & Chăm sóc nhà cửa' },
            { catid: 11036634, name: 'Toilet Paper', display_name: 'Giấy vệ sinh, khăn giấy' },
            { catid: 11036639, name: 'Household Cleaning', display_name: 'Vệ sinh nhà cửa' },
            { catid: 11036647, name: 'Dishwashing', display_name: 'Vệ sinh bát đĩa' },
            { catid: 11036649, name: 'Cleaning Tools', display_name: 'Dụng cụ vệ sinh' },
            { catid: 11036654, name: 'Air Fresheners', display_name: 'Chất khử mùi, làm thơm' },
            { catid: 11036660, name: 'Insect Killer', display_name: 'Thuốc diệt côn trùng' },
            { catid: 11036664, name: 'Food preservation', display_name: 'Túi, màng bọc thực phẩm' },
            { catid: 11036668, name: 'Trash Bags', display_name: 'Bao bì, túi đựng rác' }
        ]
    },
    {
        catid: 11036478,
        name: 'Pets',
        display_name: 'Chăm Sóc Thú Cưng',
        icon: '🐾',
        level: 1,
        order: 25,
        children: [
            { catid: 11036479, name: 'Pet Food', display_name: 'Thức ăn cho thú cưng' },
            { catid: 11036490, name: 'Pet Accessories', display_name: 'Phụ kiện cho thú cưng' },
            { catid: 11036498, name: 'Litter & Toilet', display_name: 'Vệ sinh cho thú cưng' },
            { catid: 11036510, name: 'Pet Clothing & Accessories', display_name: 'Quần áo thú cưng' },
            { catid: 11036519, name: 'Pet Healthcare', display_name: 'Chăm sóc sức khỏe' },
            { catid: 11116223, name: 'Pet Grooming', display_name: 'Làm đẹp cho thú cưng' },
            { catid: 11036524, name: 'Others', display_name: 'Khác' }
        ]
    },
    {
        catid: 11035898,
        name: 'Tickets, Vouchers & Services',
        display_name: 'Voucher & Dịch Vụ',
        icon: '🎫',
        level: 1,
        order: 26,
        children: [
            { catid: 11035905, name: 'F&B', display_name: 'Nhà hàng & Ăn uống' },
            { catid: 11035899, name: 'Events & Attractions', display_name: 'Sự kiện & Giải trí' },
            { catid: 11035931, name: 'Telco', display_name: 'Nạp tiền tài khoản' },
            { catid: 11035922, name: 'Beauty & Wellness', display_name: 'Sức khỏe & Làm đẹp' },
            { catid: 11035929, name: 'Transport', display_name: 'Gọi xe' },
            { catid: 11035930, name: 'Lessons & Workshops', display_name: 'Khóa học' },
            { catid: 11035936, name: 'Travel', display_name: 'Du lịch & Khách sạn' },
            { catid: 11035909, name: 'Shopping', display_name: 'Mua sắm' },
            { catid: 11035949, name: 'Shopee', display_name: 'Mã quà tặng Shopee' },
            { catid: 11035913, name: 'Utilities', display_name: 'Thanh toán hóa đơn' },
            { catid: 11035914, name: 'Services', display_name: 'Dịch vụ khác' }
        ]
    },
    {
        catid: 11116484,
        name: 'Tools & Home Improvement',
        display_name: 'Dụng cụ và thiết bị tiện ích',
        icon: '🔧',
        level: 1,
        order: 27,
        children: [
            { catid: 11116487, name: 'Handtool', display_name: 'Dụng cụ cầm tay' },
            { catid: 11116485, name: 'Large tools and equipment', display_name: 'Dụng cụ điện và thiết bị lớn' },
            { catid: 11116489, name: 'Electrical Circuitry & Parts', display_name: 'Thiết bị mạch điện' },
            { catid: 11116488, name: 'Building and construction', display_name: 'Vật liệu xây dựng' },
            { catid: 11116486, name: 'Accessories', display_name: 'Thiết bị và phụ kiện xây dựng' }
        ]
    }
];

// Seed categories
const seedCategories = async () => {
    try {
        await connectDB();

        // Clear existing categories
        console.log('Clearing existing categories...');
        await categoryModel.deleteMany({});

        let totalInserted = 0;

        // Process each main category
        for (const mainCat of categoryData) {
            // Insert main category (level 1)
            const mainCategoryDoc = {
                name: mainCat.display_name,
                slug: createSlug(mainCat.display_name),
                description: mainCat.name,
                level: 1,
                order: mainCat.order,
                icon: mainCat.icon || '',
                isActive: true
            };

            const insertedMainCat = await categoryModel.create(mainCategoryDoc);
            totalInserted++;
            console.log(`✅ Inserted: ${insertedMainCat.name}`);

            // Insert subcategories (level 2) if they exist
            if (mainCat.children && mainCat.children.length > 0) {
                for (let i = 0; i < mainCat.children.length; i++) {
                    const subCat = mainCat.children[i];
                    const subCategoryDoc = {
                        name: subCat.display_name,
                        slug: createSlug(`${subCat.display_name}-${mainCat.display_name}`),
                        description: subCat.name,
                level: 2,
                        parentCategory: insertedMainCat._id,
                        order: i + 1,
                        isActive: true
                    };

                    await categoryModel.create(subCategoryDoc);
                    totalInserted++;
                }
                console.log(`  ├─ Added ${mainCat.children.length} subcategories`);
            }
        }

        console.log('\n🎉 Category seeding completed successfully!');
        console.log(`📊 Total categories inserted: ${totalInserted}`);
        console.log(`   - Main categories (Level 1): ${categoryData.length}`);
        console.log(`   - Sub-categories (Level 2): ${totalInserted - categoryData.length}`);
        
        // Display category tree
        console.log('\n📋 Category Tree Structure:');
        const allMainCategories = await categoryModel.find({ level: 1 }).sort({ order: 1 });
        for (const mainCat of allMainCategories) {
            console.log(`\n${mainCat.icon} ${mainCat.name}`);
            const subs = await categoryModel.find({ parentCategory: mainCat._id }).sort({ order: 1 });
            for (const subCat of subs) {
                console.log(`  ├─ ${subCat.name}`);
            }
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding categories:', error);
        process.exit(1);
    }
}

seedCategories();






