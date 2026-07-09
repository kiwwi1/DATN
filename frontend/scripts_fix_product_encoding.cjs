const fs = require("fs");
const path = "frontend/src/pages/main/Product.jsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  /<Link to="\/" className="text-blue-600 hover:underline">\s*[\s\S]*?\s*<\/Link>/,
  `<Link to="/" className="text-blue-600 hover:underline">
            Trang chủ
          </Link>`
);

content = content.replaceAll('â€º', '›');
content = content.replace('document.title = `${localizeProductName(productData.name)} — Lumière`;', 'document.title = `${localizeProductName(productData.name)} - Lumiere`;');
content = content.replace('return () => { document.title = "Lumière"; };', 'return () => { document.title = "Lumiere"; };');
content = content.replace(/BÃ¡n bá»Ÿi:/g, 'Bán bởi:');
content = content.replace(/Tiáº¿t kiá»‡m/g, 'Tiết kiệm');
content = content.replace(/Tá»«/g, 'Từ');
content = content.replace(/âœ“ CÃ²n hÃ ng/g, '✓ Còn hàng');
content = content.replace(/Háº¿t hÃ ng/g, 'Hết hàng');
content = content.replace(/Háº¾T HÃ€NG/g, 'HẾT HÀNG');
content = content.replace(/THÃŠM VÃ€O GIá»Ž HÃ€NG/g, 'THÊM VÀO GIỎ HÀNG');
content = content.replace(/Bá» khá»i danh sÃ¡ch yÃªu thÃ­ch/g, 'Bỏ khỏi danh sách yêu thích');
content = content.replace(/ThÃªm vÃ o danh sÃ¡ch yÃªu thÃ­ch/g, 'Thêm vào danh sách yêu thích');
content = content.replace(/Nháº­n thÃ´ng bÃ¡o khi sáº£n pháº©m nÃ y giáº£m giÃ¡/g, 'Nhận thông báo khi sản phẩm này giảm giá');
content = content.replace(/\(cáº§n thÃªm vÃ o giá» trÆ°á»›c\)/g, '(cần thêm vào giỏ trước)');
content = content.replace(/Biáº¿n thá»ƒ nÃ y Ä‘Ã£ háº¿t hÃ ng/g, 'Biến thể này đã hết hàng');
content = content.replace(/Vui lÃ²ng chá»n kÃ­ch thÆ°á»›c sáº£n pháº©m!/g, 'Vui lòng chọn kích thước sản phẩm!');
content = content.replace(/Sáº£n pháº©m Ä‘Ã£ háº¿t hÃ ng/g, 'Sản phẩm đã hết hàng');
content = content.replace(/Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ thÃªm sáº£n pháº©m vÃ o giá» hÃ ng\./g, 'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
content = content.replace(/Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ mua hÃ ng\./g, 'Vui lòng đăng nhập để mua hàng.');
content = content.replace(/Sáº£n pháº©m/g, 'Sản phẩm');
content = content.replace(/ÄÃ£ bÃ¡n/g, 'Đã bán');
content = content.replace(/ÄÃ¡nh giÃ¡/g, 'Đánh giá');
content = content.replace(/Tá»‰ lá»‡ pháº£n há»“i/g, 'Tỉ lệ phản hồi');
content = content.replace(/Thá»i gian pháº£n há»“i/g, 'Thời gian phản hồi');
content = content.replace(/NgÆ°á»i theo dÃµi/g, 'Người theo dõi');

content = content.replace(
  /<div className="text-sm text-gray-700 mt-5 flex flex-col gap-3">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* Vendor \/ Shop card \*\//,
  `<div className="text-sm text-gray-700 mt-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span>Sản phẩm chính hãng 100%</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
              </svg>
              <span>Miễn phí vận chuyển cho đơn hàng trên 500.000₫</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
              </svg>
              <span>Đổi trả miễn phí trong 7 ngày</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              <span>Hỗ trợ thanh toán khi nhận hàng (COD)</span>
            </div>
          </div>
        </div>
      </div>
      {/* Vendor / Shop card */}`
);

fs.writeFileSync(path, content, "utf8");
