# 📁 Category System - Shopee Style

Hệ thống phân loại sản phẩm theo cấu trúc phân cấp 3 tầng giống Shopee.

## 🏗️ Cấu trúc

### 1. Category Model
- **Level 1**: Danh mục chính (VD: Thời Trang Nam, Điện Tử)
- **Level 2**: Danh mục phụ (VD: Áo, Quần)
- **Level 3**: Danh mục chi tiết (VD: Áo Thun, Áo Sơ Mi)

### 2. Product Model
Đã được cập nhật để hỗ trợ:
- Tham chiếu đến category (ObjectId)
- Phân cấp: `category` → `subCategory` → `subSubCategory`
- Thêm các tính năng giống Shopee: stock, rating, discount, variants

## 🚀 Cách sử dụng

### Bước 1: Seed dữ liệu mẫu

```bash
cd backend
node seedCategories.js
```

Script này sẽ tạo:
- 10 danh mục chính (Level 1)
- 15 danh mục phụ (Level 2)
- 13 danh mục chi tiết (Level 3)

### Bước 2: Khởi động server

```bash
npm run server
# hoặc
node server.js
```

## 📡 API Endpoints

### Public Endpoints (không cần authentication)

#### 1. Lấy tất cả danh mục
```
GET /api/category/list
```

Query params:
- `level`: Filter by level (1, 2, or 3)
- `parentCategory`: Filter by parent category ID
- `isActive`: Filter by active status (true/false)

Example:
```javascript
// Lấy tất cả danh mục chính
GET /api/category/list?level=1

// Lấy sub-categories của một category
GET /api/category/list?level=2&parentCategory=64f5a1b2c3d4e5f6g7h8i9j0
```

#### 2. Lấy cây phân cấp danh mục (Category Tree)
```
GET /api/category/tree
```

Trả về cấu trúc phân cấp đầy đủ giống Shopee:
```json
{
  "success": true,
  "categoryTree": [
    {
      "_id": "...",
      "name": "Thời Trang Nam",
      "slug": "thoi-trang-nam",
      "icon": "👔",
      "children": [
        {
          "name": "Áo",
          "slug": "ao-nam",
          "children": [
            {
              "name": "Áo Thun Nam",
              "slug": "ao-thun-nam"
            }
          ]
        }
      ]
    }
  ]
}
```

#### 3. Lấy chi tiết một danh mục
```
GET /api/category/:id
```

Có thể dùng ID hoặc slug:
```javascript
GET /api/category/64f5a1b2c3d4e5f6g7h8i9j0
// hoặc
GET /api/category/thoi-trang-nam
```

### Admin Endpoints (cần adminAuth)

#### 4. Tạo danh mục mới
```
POST /api/category/create
Headers: { token: "admin_token" }
```

Body:
```json
{
  "name": "Thời Trang Nam",
  "slug": "thoi-trang-nam",
  "description": "Mô tả danh mục",
  "level": 1,
  "parentCategory": null,
  "image": "url_to_image",
  "icon": "👔",
  "order": 1
}
```

Lưu ý:
- `slug` phải unique
- Nếu `level > 1` thì phải có `parentCategory`
- `parentCategory` phải tồn tại và có level thấp hơn

#### 5. Cập nhật danh mục
```
PUT /api/category/update/:id
Headers: { token: "admin_token" }
```

Body (chỉ cần các field muốn update):
```json
{
  "name": "Tên mới",
  "description": "Mô tả mới",
  "isActive": true
}
```

#### 6. Xóa danh mục (soft delete)
```
DELETE /api/category/delete/:id
Headers: { token: "admin_token" }
```

Lưu ý:
- Không thể xóa category có sub-categories
- Không thể xóa category có products
- Thực hiện soft delete (set `isActive = false`)

## 💡 Ví dụ sử dụng trong Frontend

### 1. Hiển thị menu danh mục (giống Shopee)

```javascript
// Lấy category tree
const response = await fetch('http://localhost:4000/api/category/tree');
const { categoryTree } = await response.json();

// Render menu
categoryTree.forEach(mainCat => {
  console.log(mainCat.name); // Thời Trang Nam
  
  mainCat.children.forEach(subCat => {
    console.log('  ' + subCat.name); // Áo
    
    subCat.children.forEach(subSubCat => {
      console.log('    ' + subSubCat.name); // Áo Thun Nam
    });
  });
});
```

### 2. Filter sản phẩm theo danh mục

```javascript
// Trong productController, khi query products
const products = await productModel
  .find({ category: categoryId })
  .populate('category subCategory subSubCategory');
```

### 3. Tạo sản phẩm với categories

```javascript
const newProduct = {
  name: "Áo Thun Nam Basic",
  price: 150000,
  category: "64f5a1...", // ID của "Thời Trang Nam"
  subCategory: "64f5b2...", // ID của "Áo"
  subSubCategory: "64f5c3...", // ID của "Áo Thun Nam"
  // ... other fields
};
```

## 🎨 Tính năng mở rộng

### 1. Breadcrumb Navigation
```javascript
async function getBreadcrumb(categoryId) {
  const category = await categoryModel
    .findById(categoryId)
    .populate('parentCategory');
  
  const breadcrumb = [category.name];
  
  if (category.parentCategory) {
    const parent = await categoryModel
      .findById(category.parentCategory._id)
      .populate('parentCategory');
    
    breadcrumb.unshift(parent.name);
    
    if (parent.parentCategory) {
      breadcrumb.unshift(parent.parentCategory.name);
    }
  }
  
  return breadcrumb; // ["Thời Trang Nam", "Áo", "Áo Thun Nam"]
}
```

### 2. Product Count per Category
Đã có sẵn `productCount` field. Có thể update khi:
- Thêm/xóa sản phẩm
- Đổi category của sản phẩm

```javascript
import { updateProductCount } from '../controllers/categoryController.js';

// Sau khi tạo/update product
await updateProductCount(product.category);
await updateProductCount(product.subCategory);
```

## 📊 Database Schema

### Category Schema
```javascript
{
  name: String,           // Tên danh mục
  slug: String,          // URL-friendly name (unique)
  description: String,   // Mô tả
  image: String,         // Hình ảnh banner
  icon: String,          // Icon/emoji
  level: Number,         // 1, 2, hoặc 3
  parentCategory: ObjectId, // Reference to parent
  isActive: Boolean,     // Trạng thái hoạt động
  order: Number,         // Thứ tự hiển thị
  productCount: Number,  // Số lượng sản phẩm
  createdAt: Date,
  updatedAt: Date
}
```

## 🔧 Tips & Best Practices

1. **Luôn dùng populate** khi query products để lấy thông tin category đầy đủ
2. **Cache category tree** ở frontend vì nó ít thay đổi
3. **Validate level hierarchy** khi tạo/update categories
4. **Soft delete** thay vì hard delete để giữ lịch sử
5. **Index** các field thường xuyên query (đã setup sẵn)

## 🐛 Troubleshooting

### Lỗi "Category slug already exists"
- Mỗi slug phải unique
- Đổi sang slug khác hoặc thêm suffix

### Lỗi "Parent category not found"
- Đảm bảo parentCategory tồn tại trong database
- Kiểm tra ObjectId có đúng format không

### Lỗi "Invalid category level hierarchy"
- Level của parent phải nhỏ hơn level của child
- VD: Parent level 1, child phải level 2

## 📝 TODO / Future Enhancements

- [ ] Multi-language support
- [ ] Category SEO metadata
- [ ] Category banners/promotions
- [ ] Auto-update productCount trigger
- [ ] Category analytics
- [ ] Drag-and-drop reordering
- [ ] Category templates






