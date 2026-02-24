# Cập Nhật Hệ Thống Category

## 🎉 Tính Năng Mới

Hệ thống admin đã được cập nhật để hỗ trợ **313 categories** từ Shopee Vietnam, bao gồm:
- **27 Main Categories** (Level 1) 
- **286 Subcategories** (Level 2)

## ✅ Những Gì Đã Thay Đổi

### 1. Backend Updates

#### Đã thêm API mới:
```
GET /api/category/:id/subcategories
```
Trả về tất cả subcategories của một category cụ thể.

#### Các API Category hiện có:
- `GET /api/category/list` - Lấy tất cả categories
- `GET /api/category/tree` - Lấy cây phân cấp categories
- `GET /api/category/:id` - Lấy thông tin category cụ thể
- `GET /api/category/:id/subcategories` - Lấy subcategories (MỚI)

### 2. Admin Panel Updates

#### File đã cập nhật: `admin/src/pages/Add.jsx`

**Thay đổi chính:**
1. **Dynamic Category Dropdown**: Thay vì hardcoded categories (Men, Women, Kids), giờ load từ database
2. **Subcategory Selection**: Tự động load subcategories khi chọn main category
3. **Icon Display**: Hiển thị icon emoji cho mỗi category
4. **Better UX**: 
   - Loading state khi fetch categories
   - Disable subcategory dropdown nếu không có subcategories
   - Show message khi category không có subcategories

## 📋 Danh Sách Categories

### Main Categories (27):
1. 👔 Thời Trang Nam (21 subcategories)
2. 👗 Thời Trang Nữ (21 subcategories)
3. 📱 Điện Thoại & Phụ Kiện (11 subcategories)
4. 👶 Mẹ & Bé (15 subcategories)
5. 🎧 Thiết Bị Điện Tử (10 subcategories)
6. 🏠 Nhà Cửa & Đời Sống (15 subcategories)
7. 💻 Máy Tính & Laptop (10 subcategories)
8. 💄 Sắc Đẹp (11 subcategories)
9. 📷 Máy Ảnh & Máy Quay Phim (6 subcategories)
10. 💊 Sức Khỏe (8 subcategories)
11. ⌚ Đồng Hồ (6 subcategories)
12. 👠 Giày Dép Nữ (8 subcategories)
13. 👞 Giày Dép Nam (8 subcategories)
14. 👜 Túi Ví Nữ (10 subcategories)
15. 🔌 Thiết Bị Điện Gia Dụng (8 subcategories)
16. 💎 Phụ Kiện & Trang Sức Nữ (18 subcategories)
17. ⚽ Thể Thao & Du Lịch (8 subcategories)
18. 🛒 Bách Hóa Online (13 subcategories)
19. 🚗 Ô Tô & Xe Máy & Xe Đạp (13 subcategories)
20. 📚 Nhà Sách Online (9 subcategories)
21. 🎒 Balo & Túi Ví Nam (11 subcategories)
22. 👧 Thời Trang Trẻ Em (8 subcategories)
23. 🧸 Đồ Chơi (6 subcategories)
24. 🧹 Giặt Giũ & Chăm Sóc Nhà Cửa (9 subcategories)
25. 🐾 Chăm Sóc Thú Cưng (7 subcategories)
26. 🎫 Voucher & Dịch Vụ (11 subcategories)
27. 🔧 Dụng cụ và thiết bị tiện ích (5 subcategories)

## 🚀 Cách Sử Dụng

### Thêm Sản Phẩm Mới:

1. **Chọn Category Chính:**
   - Dropdown hiển thị tất cả 27 categories với icon
   - Bắt buộc phải chọn

2. **Chọn Subcategory (Tùy chọn):**
   - Tự động load khi chọn category chính
   - Nếu category không có subcategories, dropdown sẽ bị disable
   - Có thể bỏ qua nếu không cần

3. **Điền các thông tin khác:**
   - Tên sản phẩm
   - Mô tả
   - Giá
   - Size
   - Upload ảnh

## 🔄 Restart Backend

Sau khi seed categories, cần restart backend server:

```bash
cd E:\Code\GR1\backend
npm start
```

hoặc nếu đang dùng nodemon:
```bash
nodemon server.js
```

## 🧪 Testing

### Test API:
```bash
# Get all categories
curl http://localhost:4000/api/category/list

# Get main categories only
curl http://localhost:4000/api/category/list?level=1

# Get subcategories of a category
curl http://localhost:4000/api/category/{categoryId}/subcategories

# Get category tree
curl http://localhost:4000/api/category/tree
```

### Test trong Admin Panel:
1. Login vào admin panel
2. Vào trang "Add Product"
3. Kiểm tra dropdown categories load đúng
4. Chọn một category và xem subcategories load
5. Thêm một sản phẩm mới

## 📝 Notes

- Category và Subcategory được lưu dưới dạng **MongoDB ObjectId** trong database
- Không còn sử dụng hardcoded strings như "Men", "Women", "Kids"
- Tất cả categories đã có slug SEO-friendly (tự động tạo từ tên tiếng Việt)
- Có thể thêm categories mới qua API `/api/category/create` (Admin only)

## 🐛 Troubleshooting

### Nếu categories không load:
1. Kiểm tra backend server đang chạy
2. Kiểm tra đã seed categories chưa: `node seedCategories.js`
3. Check console của browser để xem lỗi
4. Verify MongoDB connection

### Nếu subcategories không hiện:
1. Kiểm tra category đã chọn có subcategories hay không
2. Check API endpoint `/api/category/{id}/subcategories`
3. Verify trong database category có parentCategory hay không

## 📞 Support

Nếu có vấn đề gì, check:
- Browser console (F12)
- Backend terminal logs
- MongoDB database content















