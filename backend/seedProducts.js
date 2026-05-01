import mongoose from 'mongoose';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectDB from './config/mongodb.js';
import productModel from './models/productModel.js';
import categoryModel from './models/categoryModel.js';
import userModel from './models/userModel.js';
import bcrypt from 'bcrypt';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Unsplash photo pool ────────────────────────────────────────────────────────
const UNSPLASH_POOL = {
    smartphone: [
        '1511707171634-5f897ff02aa9','1601784551446-20c9e07cdbdb','1592750475338-74b7b21085ab',
        '1556656793-08538906a9f8','1565849904461-04a58ad377cb','1512054502232-10a0a035d672',
        '1574920162043-b872873f19bc','1580910051074-3eb694886505',
    ],
    laptop: [
        '1531297484001-80022131f5a1','1588872657578-7efd1f1555ed','1484788984921-03950022c9ef',
        '1496181133206-80ce9b88a853','1525547719571-a2d4ac8945e2','1611532736597-de2d4265fba3',
        '1593642632559-0c6d3fc62b89','1541807084-5c52e6e76241',
    ],
    headphones: [
        '1505740420928-5e560c06d30e','1484704849700-f032a568e944','1590658268037-6bf12165f8df',
        '1583394838336-acd977736f90','1610397648930-477b8c7f0943','1524678714210-9917a6c619c2',
    ],
    speaker: [
        '1608043152269-423dbba4e7e1','1545454675-3479531966-3','1608043152269-423dbba4e7e1',
        '1545454675-3479531966b3','1542816374-a5910ee88b30','1558618666-fcd25c85cd64',
    ],
    keyboard: [
        '1587829741301-dc798b83add3','1541140532-83aab8f9c29c','1609872994526-4a928866eb8c',
        '1618384887929-16ec33fab9ef','1601944182139-62c68e9ef3b9','1544244015-0df4b3ffc6b0',
    ],
    mouse: [
        '1527864550417-7fd91fc51a46','1611532736597-de2d4265fba3','1553860722-6c8e03c756c5',
        '1625315714082-bef3f97a91d5','1586023492125-27b2c045efd3','1629429347062-01fa2a53d8ba',
    ],
    monitor: [
        '1547082299-de5d8fa06060','1606229365406-0e7795b2e9a0','1593640408182-31c4db86efdc',
        '1593305841991-05c297ba4575','1616594039964-ae9021a400a0','1517694712202-14dd9538aa97',
    ],
    powerbank: [
        '1609091839311-d5365f9ff1c5','1609742239903-3b0b0c6c4a8a','1601784551446-20c9e07cdbdb',
        '1556656793-08538906a9f8','1574920162043-b872873f19bc','1565849904461-04a58ad377cb',
    ],
    phone_case: [
        '1565849904461-04a58ad377cb','1601784551446-20c9e07cdbdb','1556656793-08538906a9f8',
        '1512054502232-10a0a035d672','1574920162043-b872873f19bc','1580910051074-3eb694886505',
    ],
    tshirt_men: [
        '1521572163474-6864f9cf17ab','1503341504253-dff4815485f1','1620799140408-edc6dcb6d633',
        '1618354691373-d851c5c3a990','1576566588028-4147f3842f27','1593030761757-71fae45fa0e7',
        '1609902726285-00668009f929','1542451542907-18e44dec7f01',
    ],
    shirt_men: [
        '1596755389378-c31d21fd1273','1503341504253-dff4815485f1','1521572163474-6864f9cf17ab',
        '1618354691373-d851c5c3a990','1576566588028-4147f3842f27','1584744982873-aef6c56b27bc',
    ],
    jacket_men: [
        '1551028719-00167b16eac5','1556906781-9beea22ef7ad','1548883354-94bcfe321cbb',
        '1591047139829-d91aecb6caea','1511556820780-d912e42b4980','1605908502724-9093a79e257e',
    ],
    jeans_men: [
        '1604176354204-9268737828e4','1542272604-787c3835535d','1555689502-c4b22d76b',
        '1598300042247-d088f8ab3a91','1548883354-94bcfe321cbb','1473966603-c5a2c20d78e7',
    ],
    shorts_men: [
        '1562183241-840b8af0721e','1538805060514-3d1b1a3e5b3b','1506629082681-aa2991d5cbb0',
        '1517816428104-797678c7cf0c','1521572163474-6864f9cf17ab','1503341504253-dff4815485f1',
    ],
    underwear: [
        '1617952236317-0bd127407984','1604176354204-9268737828e4','1597762470488-3877b7efed1e',
        '1562183241-840b8af0721e','1538805060514-3d1b1a3e5b3b','1473966603-c5a2c20d78e7',
    ],
    socks: [
        '1613940505898-9d5c8f66de5e','1562183241-840b8af0721e','1617952236317-0bd127407984',
        '1604176354204-9268737828e4','1473966603-c5a2c20d78e7','1538805060514-3d1b1a3e5b3b',
    ],
    dress_women: [
        '1596783366167-67e1e9d1c182','1515886657613-9f3515b0c78f','1509631179647-0177331693ae',
        '1572804013427-4d505db99343','1612336307429-8a06da3a7645','1589465885857-44edb59bbff2',
        '1539109136881-3be0616acf4b','1485968579580-fc6f9571af05',
    ],
    blouse_women: [
        '1588099065673-48a0a45ae60a','1509631179647-0177331693ae','1607522370275-f14206abe36f',
        '1596783366167-67e1e9d1c182','1515886657613-9f3515b0c78f','1572804013427-4d505db99343',
    ],
    jeans_women: [
        '1603344204980-4edb0ea63148','1542272604-787c3835535d','1604176354204-9268737828e4',
        '1473966603-c5a2c20d78e7','1548883354-94bcfe321cbb','1598300042247-d088f8ab3a91',
    ],
    skirt_women: [
        '1583846783-d616de79cd5a','1515886657613-9f3515b0c78f','1596783366167-67e1e9d1c182',
        '1509631179647-0177331693ae','1572804013427-4d505db99343','1612336307429-8a06da3a7645',
    ],
    pants_women: [
        '1543163521-1bf539c55dd2','1603344204980-4edb0ea63148','1473966603-c5a2c20d78e7',
        '1542272604-787c3835535d','1604176354204-9268737828e4','1548883354-94bcfe321cbb',
    ],
    jacket_women: [
        '1591047139829-d91aecb6caea','1551028719-00167b16eac5','1606298255894-27f3a68c672c',
        '1516575334481-f47ac3b93658','1539109136881-3be0616acf4b','1485968579580-fc6f9571af05',
    ],
    cardigan_women: [
        '1576566588028-4147f3842f27','1516575334481-f47ac3b93658','1591047139829-d91aecb6caea',
        '1551028719-00167b16eac5','1539109136881-3be0616acf4b','1485968579580-fc6f9571af05',
    ],
    hoodie_women: [
        '1576566588028-4147f3842f27','1620799140408-edc6dcb6d633','1548883354-94bcfe321cbb',
        '1539109136881-3be0616acf4b','1591047139829-d91aecb6caea','1521572163474-6864f9cf17ab',
    ],
    sleepwear: [
        '1605463756701-e89034d0e0ef','1583846783-d616de79cd5a','1515886657613-9f3515b0c78f',
        '1596783366167-67e1e9d1c182','1509631179647-0177331693ae','1572804013427-4d505db99343',
    ],
    lingerie: [
        '1585487000160-6214da930b1b','1607522370275-f14206abe36f','1588099065673-48a0a45ae60a',
        '1509631179647-0177331693ae','1596783366167-67e1e9d1c182','1515886657613-9f3515b0c78f',
    ],
    sneakers: [
        '1542291026-7eec264c27ff','1600185365926-d1e1b3b0c14a','1606107557195-0e29a4b5b4aa',
        '1491553895911-0055eca6402d','1604163546180-3a7847b4c58a','1542291026-7eec264c27ff',
        '1542291026-7eec264c27ff','1491553895911-0055eca6402d',
    ],
    leather_shoes: [
        '1449505278894-56226b82b0fc','1614252369475-531eba835eb1','1533167649149-b76abe02bcfd',
        '1491553895911-0055eca6402d','1542291026-7eec264c27ff','1600185365926-d1e1b3b0c14a',
    ],
    sandals: [
        '1519723600-ac4f8ba5c22c','1603487742131-4160ec999306','1449505278894-56226b82b0fc',
        '1521336978432-d352e68473e0','1542291026-7eec264c27ff','1600185365926-d1e1b3b0c14a',
    ],
    heels: [
        '1543163521-1bf539c55dd2','1603487742131-4160ec999306','1519723600-ac4f8ba5c22c',
        '1614252369475-531eba835eb1','1449505278894-56226b82b0fc','1521336978432-d352e68473e0',
    ],
    skincare: [
        '1556228578-8c89e6adf883','1556228578-8c89e6adf883','1596462502278-27bfdc403348',
        '1598440947619-2c35fc9aa908','1570194065650-d99fb4d8a609','1567721913486-6585f069b3d8',
        '1576091160550-2173dba999ef','1619451680405-23f3702f7e8e',
    ],
    lipstick: [
        '1586495777744-4e6b748040b5','1522338242992-e1d3935d8a96','1631214524914-14c2a7e0f517',
        '1512496015851-a90fb38ba796','1583241475880-083f84372725','1614159827710-06a6eaebc7d9',
    ],
    makeup: [
        '1522338242992-e1d3935d8a96','1586495777744-4e6b748040b5','1631214524914-14c2a7e0f517',
        '1512496015851-a90fb38ba796','1583241475880-083f84372725','1614159827710-06a6eaebc7d9',
    ],
    perfume: [
        '1541643600914-78b084683702','1523293182086-ff30864ca8db','1625791638099-88d56d4c7aa6',
        '1594035910387-fea47794261f','1619451680405-23f3702f7e8e','1567721913486-6585f069b3d8',
    ],
    haircare: [
        '1527799820374-dcf8d9d4a388','1522337360826-bb16a28d7e4c','1559827291-72ebf8a5caa2',
        '1556228578-8c89e6adf883','1596462502278-27bfdc403348','1598440947619-2c35fc9aa908',
    ],
    watch: [
        '1523275335684-37898b6baf30','1526045612212-70caf35c14df','1434494347-fce3aa8e-46ef',
        '1533139143976-30918515162d','1585386959690-f08843f9a0e9','1542496658-e33a3d9b8eec',
        '1559827260-dc57d45e2f7d','1434056886845-dac89ffe9b56',
    ],
    bedding: [
        '1540518614846-7eded433c457','1631049307264-da0ec9d70304','1555041469-db61526374e5',
        '1586105251261-72a756497a11','1617325247661-70cce2d5e8a3','1519710164239-da123dc03ef4',
    ],
    kitchen: [
        '1556909211-36987daf7b4d','1585515320237-53069e50db8f','1544636331-e516d67c5b3e',
        '1556909172-54557c7e4e7b','1565183928294-7063f23ce0f8','1556909119-f9006d60b4f6',
    ],
    water_bottle: [
        '1602143407151-7350a257a912','1560253023-3191a79e2a57','1617870788518-2ed70d3b9e79',
        '1561461153-3f6b4c8e5f68','1578916171728-46686eac8d58','1602143407151-7350a257a912',
    ],
    lamp: [
        '1558618047-0f0f2da8e55b','1572635196237-14b3f281503f','1507003211169-0a1dd7228f2d',
        '1513506003901-1e6a35d44e61','1524484485831-a92ffc0de03f','1558618047-0f0f2da8e55b',
    ],
    home_decor: [
        '1555041469-db61526374e5','1586105251261-72a756497a11','1538688423-f6b39cb80b33',
        '1505691938895-1758d7feb511','1519710164239-da123dc03ef4','1524484485831-a92ffc0de03f',
    ],
    handbag: [
        '1548036161-18ad4197a42b','1548036161-18ad4197a42b','1548036161-18ad4197a42b',
        '1594938298603-c8148c4b4f7d','1553062407-98eeb64c6a62','1584917865442-de89df76afd8',
        '1566150905458-1bf1fc113f0d','1547949003-9792a18a2841',
    ],
    wallet: [
        '1627123373133-72afba6dcce9','1548036161-18ad4197a42b','1553062407-98eeb64c6a62',
        '1594938298603-c8148c4b4f7d','1566150905458-1bf1fc113f0d','1547949003-9792a18a2841',
    ],
    backpack: [
        '1553062407-98eeb64c6a62','1553062407-98eeb64c6a62','1553062407-98eeb64c6a62',
        '1547949003-9792a18a2841','1548036161-18ad4197a42b','1584917865442-de89df76afd8',
    ],
    jewelry: [
        '1515562141207-7a88fb7ce338','1603916197580-15a56a7e8a83','1599643478520-0885c44f6587',
        '1573408301185-9521e7d27395','1576426563726-0ab0e382e898','1515562141207-7a88fb7ce338',
    ],
    hat: [
        '1521369909449-4463a27f6fce','1533655655888-89d9d82b9d0e','1495385766836-4b3f0bf0c7db',
        '1578874691223-c4f6c69145eb','1510134879692-8660d3bb6da4','1521369909449-4463a27f6fce',
    ],
    luggage: [
        '1553062407-98eeb64c6a62','1581553672347-c8e5db0ede1e','1553062407-98eeb64c6a62',
        '1507003211169-0a1dd7228f2d','1547949003-9792a18a2841','1548036161-18ad4197a42b',
    ],
    yoga: [
        '1599901860904-17e6ed7083a0','1571902943202-507ec2618e8f','1544367655-77f54e5ffc06',
        '1506629082681-aa2991d5cbb0','1519996529931-28324d5a630e','1562088287-bde35a1ea917',
    ],
    sportswear: [
        '1517836357463-d25dfeac3438','1562088287-bde35a1ea917','1544367655-77f54e5ffc06',
        '1571902943202-507ec2618e8f','1599901860904-17e6ed7083a0','1519996529931-28324d5a630e',
    ],
    camera: [
        '1502920917128-1aa500764bee','1540569014015-19a7be504e3a','1516035069371-29a1b244cc32',
        '1617347454431-2428ad2adf38','1519763518765-8f2c2c7add30','1502920917128-1aa500764bee',
    ],
    tv: [
        '1593359677879-a4bb92f4e542','1593359677879-a4bb92f4e542','1546054454-aa6c5f4b6b0d',
        '1461151304267-38535e780c79','1593359677879-a4bb92f4e542','1567690562286-28a17a29c74e',
    ],
    console: [
        '1612287230858-e34f628b6b6a','1593305667691-41d66a4ea1b5','1612287230858-e34f628b6b6a',
        '1607853202273-797f1c22a38e','1551103782-8ab51b7f7b44','1543512214-aa0d3bc1caf7',
    ],
    supplement: [
        '1556228578-8c89e6adf883','1584308666705-80ef57bead5f','1550572017-aca88f9eb90b',
        '1556228578-8c89e6adf883','1619451680405-23f3702f7e8e','1567721913486-6585f069b3d8',
    ],
    health: [
        '1584308666705-80ef57bead5f','1550572017-aca88f9eb90b','1556228578-8c89e6adf883',
        '1519823464938-c8ca9e4c7f24','1584308666705-80ef57bead5f','1550572017-aca88f9eb90b',
    ],
    book: [
        '1481627834876-b7833e8f5882','1544716278-96b8f16c8543','1512820790803-83ca734da794',
        '1532012197267-da84d127e765','1543002588-08e9db5f98b5','1481627834876-b7833e8f5882',
    ],
    food: [
        '1504674900247-0877df9cc836','1567620905732-2d1ec7ab7445','1551892374-ecf8754cf744',
        '1504674900247-0877df9cc836','1543353071-087092ec393a','1504674900247-0877df9cc836',
    ],
    storage: [
        '1531297484001-80022131f5a1','1607798748738-b15c40d33d57','1588872657578-7efd1f1555ed',
        '1496181133206-80ce9b88a853','1525547719571-a2d4ac8945e2','1611532736597-de2d4265fba3',
    ],
    router: [
        '1558618666-fcd25c85cd64','1531297484001-80022131f5a1','1562408590-23462901af14',
        '1558618666-fcd25c85cd64','1542816374-a5910ee88b30','1545454675-3479531966b3',
    ],
    coffee_machine: [
        '1495474472287-4d71bcdd2085','1514432324-87e79e71e31d','1520970519539-887b44b60b11',
        '1495474472287-4d71bcdd2085','1514432324-87e79e71e31d','1556909211-36987daf7b4d',
    ],
    appliance: [
        '1556909211-36987daf7b4d','1585515320237-53069e50db8f','1544636331-e516d67c5b3e',
        '1556909172-54557c7e4e7b','1565183928294-7063f23ce0f8','1556909119-f9006d60b4f6',
    ],
    helmet: [
        '1558618666-fcd25c85cd64','1542816374-a5910ee88b30','1553062407-98eeb64c6a62',
        '1547949003-9792a18a2841','1558618047-0f0f2da8e55b','1562408590-23462901af14',
    ],
    motorcycle: [
        '1558618666-fcd25c85cd64','1542816374-a5910ee88b30','1562408590-23462901af14',
        '1545454675-3479531966b3','1558618666-fcd25c85cd64','1542816374-a5910ee88b30',
    ],
    toys: [
        '1558618047-0f0f2da8e55b','1558618666-fcd25c85cd64','1542816374-a5910ee88b30',
        '1568702846938-0cb6e85ef7e0','1558618047-0f0f2da8e55b','1568702846938-0cb6e85ef7e0',
    ],
    kids_clothing: [
        '1503341504253-dff4815485f1','1521572163474-6864f9cf17ab','1620799140408-edc6dcb6d633',
        '1618354691373-d851c5c3a990','1576566588028-4147f3842f27','1609902726285-00668009f929',
    ],
    pet_food: [
        '1587300003966-64a09d89e6bc','1543466835-00a7240e-4b7c','1587300003966-64a09d89e6bc',
        '1527927922-d270c7e70547','1543466835-00a7240e-4b7c','1587300003966-64a09d89e6bc',
    ],
    cleaning: [
        '1563453392212-326f5e854473','1599420186-00d0de430d0e','1563453392212-326f5e854473',
        '1599420186-00d0de430d0e','1563453392212-326f5e854473','1599420186-00d0de430d0e',
    ],
};

const DEFAULT_POOL = [
    '1491553895911-0055eca6402d','1556228578-8c89e6adf883','1542291026-7eec264c27ff',
    '1503341504253-dff4815485f1','1558618047-0f0f2da8e55b',
];

const FALLBACK_IMAGE_POOL = [
    'https://picsum.photos/seed/datn-fallback-1/800/800',
    'https://picsum.photos/seed/datn-fallback-2/800/800',
    'https://picsum.photos/seed/datn-fallback-3/800/800',
];

const UNSPLASH_ID_REGEX = /^[a-zA-Z0-9_-]{12,40}$/;

const sanitizeUnsplashPool = (poolMap) => {
    const cleaned = {};
    let removed = 0;

    for (const [pool, ids] of Object.entries(poolMap)) {
        const unique = [...new Set((ids || []).filter(Boolean).map(String))];
        const valid = unique.filter((id) => UNSPLASH_ID_REGEX.test(id));
        removed += unique.length - valid.length;
        cleaned[pool] = valid;
    }

    if (removed > 0) {
        console.warn(`⚠ Removed ${removed} invalid Unsplash photo id(s) from pools`);
    }

    return cleaned;
};

const SAFE_UNSPLASH_POOL = sanitizeUnsplashPool(UNSPLASH_POOL);
const SAFE_DEFAULT_POOL = [...new Set(DEFAULT_POOL.filter((id) => UNSPLASH_ID_REGEX.test(id)))];

const toSeededImageUrl = (id) =>
    `https://picsum.photos/seed/datn-${encodeURIComponent(id)}/800/800`;

const getImages = (pool, count = 3) => {
    const ids = SAFE_UNSPLASH_POOL[pool] && SAFE_UNSPLASH_POOL[pool].length
        ? SAFE_UNSPLASH_POOL[pool]
        : SAFE_DEFAULT_POOL;
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, Math.min(count, ids.length)).map(toSeededImageUrl);

    if (chosen.length > 0) return chosen;

    // Last-resort fallback để tránh ảnh trống/vỡ khi pool lỗi hoàn toàn.
    return FALLBACK_IMAGE_POOL.slice(0, Math.max(1, count));
};

// ── Vendor data ────────────────────────────────────────────────────────────────
const VENDORS = [
    { name: 'Apple Official Store',   email: 'vendor.apple@shop.com',   shopName: 'Apple Official Store'   },
    { name: 'TechZone Vietnam',        email: 'vendor.techzone@shop.com', shopName: 'TechZone Vietnam'        },
    { name: 'FashionHub Việt Nam',     email: 'vendor.fashion@shop.com',  shopName: 'FashionHub Việt Nam'     },
    { name: 'Beauty & Skincare VN',    email: 'vendor.beauty@shop.com',   shopName: 'Beauty & Skincare VN'    },
    { name: 'HomeLife Shopee',         email: 'vendor.homelife@shop.com', shopName: 'HomeLife Shopee'         },
    { name: 'Sport & Outdoor VN',      email: 'vendor.sport@shop.com',    shopName: 'Sport & Outdoor VN'      },
    { name: 'Global Brand Vietnam',    email: 'vendor.global@shop.com',   shopName: 'Global Brand Vietnam'    },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const cartesian = (arrays) => {
    if (!arrays.length) return [[]];
    const [first, ...rest] = arrays;
    const restProd = cartesian(rest);
    return first.flatMap(val => restProd.map(c => [val, ...c]));
};

const PRICE_MULTIPLIERS = {
    'XS': 1.0, 'S': 1.0, 'M': 1.0, 'L': 1.05, 'XL': 1.1, 'XXL': 1.15, '3XL': 1.2,
    '128GB': 1.15, '256GB': 1.3, '512GB': 1.55, '1TB': 1.8, '2TB': 2.2, '64GB': 1.0,
    '30ml': 1.0, '35ml': 1.1, '50ml': 1.4, '100ml': 1.9, '250ml': 3.5,
    '16GB': 1.0, '32GB': 1.4, '64GB RAM': 2.2,
    '1L': 1.0, '1.8L': 1.35,
    '500GB': 1.0, '60 viên': 1.0, '120 viên': 1.8, '200 viên': 2.8, '400 viên': 5.0,
    '1 người': 1.0, '2 người': 1.9, '4 người': 3.6,
    '250g': 1.0, '500g': 1.85, '1kg': 3.4,
    '1kg (pet)': 1.0, '4kg': 3.6, '10kg': 8.0, '15kg': 11.5,
};

const buildVariants = (attributes, basePrice) => {
    if (!attributes?.length) return [];
    const valid = attributes.filter(a => a.values?.length);
    if (!valid.length) return [];
    const attrValues = valid.map(a => a.values.map(v => ({ name: a.name, value: v })));
    return cartesian(attrValues).map(combo => {
        const combination = {};
        let mult = 1.0;
        combo.forEach(({ name, value }) => {
            combination[name] = value;
            if (PRICE_MULTIPLIERS[value]) mult = Math.max(mult, PRICE_MULTIPLIERS[value]);
        });
        return {
            combination,
            price: Math.round(basePrice * mult / 1000) * 1000,
            stock: Math.floor(Math.random() * 80) + 5,
        };
    });
};

const jitter = (n, pct = 0.05) => Math.round(n * (1 + (Math.random() * 2 - 1) * pct));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ── Main seed function ─────────────────────────────────────────────────────────
const seedProducts = async () => {
    try {
        await connectDB();

        // 1. Load JSON
        const rawData = JSON.parse(readFileSync(join(__dirname, 'data/productData.json'), 'utf-8'));
        console.log(`📦 Loaded ${rawData.length} product templates`);

        // 2. Build category lookup (name → _id)
        const allCats = await categoryModel.find({}).lean();
        if (!allCats.length) {
            console.error('❌ No categories found. Run: node seedCategories.js first');
            process.exit(1);
        }
        const catByName = {};
        allCats.forEach(c => { catByName[c.name] = c; });
        console.log(`🗂  Found ${allCats.length} categories`);

        // 3. Create or fetch vendors
        const vendorIds = [];
        for (const v of VENDORS) {
            let user = await userModel.findOne({ email: v.email });
            if (!user) {
                const hashed = await bcrypt.hash('Vendor@123', 10);
                user = await userModel.create({
                    name: v.name,
                    email: v.email,
                    password: hashed,
                    role: 'vendor',
                    shopName: v.shopName,
                    emailVerified: true,
                });
                console.log(`👤 Created vendor: ${v.shopName}`);
            } else if (!user.emailVerified) {
                await userModel.updateOne(
                    { _id: user._id },
                    {
                        $set: { emailVerified: true },
                        $unset: { emailVerificationToken: '', emailVerificationExpires: '' },
                    }
                );
                user.emailVerified = true;
                console.log(`✉️  Bỏ qua xác minh email (seed) cho vendor: ${v.shopName}`);
            }
            vendorIds.push({ _id: user._id, shopName: v.shopName });
        }

        // 4. Clear existing products
        const existing = await productModel.countDocuments();
        if (existing > 0) {
            await productModel.deleteMany({});
            console.log(`🗑  Removed ${existing} old products`);
        }

        // 5. Insert products
        let inserted = 0;
        let skipped = 0;
        const docs = [];
        const now = Date.now();

        for (const tpl of rawData) {
            // Resolve category
            const mainCat = catByName[tpl.categoryName];
            if (!mainCat) {
                console.warn(`  ⚠ Category not found: "${tpl.categoryName}" — skipping "${tpl.name}"`);
                skipped++;
                continue;
            }
            const subCat = catByName[tpl.subCategoryName] || null;

            // Pick vendor (cycle through based on category)
            const vendor = pick(vendorIds);

            // Images
            const images = getImages(tpl.imagePool || 'food', 3);

            // Price with small jitter to look organic
            const price = jitter(tpl.price, 0.03);
            const originalPrice = tpl.originalPrice ? jitter(tpl.originalPrice, 0.02) : undefined;
            const discount = tpl.discount ?? 0;

            // Variants
            const variants = buildVariants(tpl.attributes, price);

            // Total stock: sum of variants if present, else from template
            const totalStock = variants.length
                ? variants.reduce((s, v) => s + v.stock, 0)
                : jitter(tpl.stock ?? 50, 0.1);

            docs.push({
                name: tpl.name,
                description: tpl.description,
                price,
                originalPrice,
                discount,
                image: images,
                category: mainCat._id,
                subCategory: subCat?._id || undefined,
                bestseller: (tpl.sold ?? 0) > 5000,
                date: now - Math.floor(Math.random() * 180 * 24 * 60 * 60 * 1000), // up to 6 months ago
                sold: jitter(tpl.sold ?? 0, 0.15),
                vendorId: vendor._id,
                vendorShopName: vendor.shopName,
                stock: totalStock,
                rating: Math.min(5, Math.max(3.5, tpl.rating + (Math.random() * 0.2 - 0.1))),
                reviewCount: jitter(tpl.reviewCount ?? 0, 0.1),
                brand: tpl.brand || '',
                tags: tpl.tags || [],
                attributes: tpl.attributes || [],
                variants,
                isActive: true,
            });
            inserted++;
        }

        await productModel.insertMany(docs);

        console.log('\n🎉 Product seeding completed!');
        console.log(`✅ Inserted : ${inserted}`);
        console.log(`⚠  Skipped  : ${skipped}`);

        // Summary by category
        const cats = [...new Set(rawData.map(p => p.categoryName))];
        console.log('\n📊 By category:');
        for (const c of cats) {
            const count = rawData.filter(p => p.categoryName === c).length;
            console.log(`   ${c.padEnd(40)} ${count}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

seedProducts();
