# Token Flow: Frontend ↔ Admin Panel

## ❌ Vấn Đề Cũ

**SessionStorage KHÔNG hoạt động giữa các origins khác nhau!**

```javascript
// ❌ KHÔNG HOẠT ĐỘNG
// Frontend (localhost:5173)
sessionStorage.setItem('vendorToken', token);
window.open('http://localhost:5174', '_blank');

// Admin (localhost:5174) 
const token = sessionStorage.getItem('vendorToken'); // null ❌
```

**Lý do:**
- SessionStorage bị isolated theo origin (protocol + domain + port)
- `localhost:5173` ≠ `localhost:5174` → Khác origin
- Mỗi origin có SessionStorage riêng, không thể truy cập lẫn nhau

## ✅ Giải Pháp Mới

### Truyền token qua URL Parameter

```javascript
// Frontend → Admin
window.open(`http://localhost:5174/add?vendorToken=${token}`, '_blank');
```

### Flow Hoàn Chỉnh:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (localhost:5173)                    │
├─────────────────────────────────────────────────────────────────┤
│  1. User đăng nhập → Nhận token                                │
│  2. User là vendor → Click "VENDOR'S PAGE"                     │
│  3. window.open('http://localhost:5174/add?vendorToken=xyz')  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN (localhost:5174)                      │
├─────────────────────────────────────────────────────────────────┤
│  4. Tab mới mở với URL có token                                │
│  5. App.jsx đọc URLSearchParams.get('vendorToken')            │
│  6. Lưu token vào localStorage của admin                       │
│  7. Xóa token khỏi URL (security)                             │
│  8. Vendor có thể thêm sản phẩm                               │
└─────────────────────────────────────────────────────────────────┘
```

## 📝 Code Changes

### 1. Frontend - Navbar.jsx & VendorRegis.jsx

**Trước:**
```javascript
sessionStorage.setItem('vendorToken', token);
window.open('http://localhost:5174', '_blank');
```

**Sau:**
```javascript
window.open(`http://localhost:5174/add?vendorToken=${token}`, '_blank');
```

**Files đã sửa:**
- ✅ `frontend/src/components/Navbar.jsx` (2 chỗ: desktop + mobile menu)
- ✅ `frontend/src/pages/VendorRegis.jsx`

### 2. Admin - App.jsx

**Trước:**
```javascript
useEffect(() => {
  const vendorToken = sessionStorage.getItem("vendorToken"); // ❌ null
  const localToken = localStorage.getItem("token");
  
  if (vendorToken) {
    setToken(vendorToken);
    // ...
  }
}, []);
```

**Sau:**
```javascript
useEffect(() => {
  // Lấy token từ URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const vendorTokenFromUrl = urlParams.get("vendorToken");
  
  if (vendorTokenFromUrl) {
    // Lưu vào localStorage của admin
    setToken(vendorTokenFromUrl);
    localStorage.setItem("token", vendorTokenFromUrl);
    
    // Xóa token khỏi URL (security)
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    // Fallback: check localStorage
    const localToken = localStorage.getItem("token");
    if (localToken) {
      setToken(localToken);
    }
  }
}, []);
```

## 🔐 Security Considerations

### ✅ Đã làm:
1. **Clean URL**: Token bị xóa khỏi URL ngay sau khi lưu vào localStorage
2. **HTTPS Production**: Trong production, phải dùng HTTPS để mã hóa URL
3. **Short-lived tokens**: Token nên có expiration time

### 🚨 Lưu ý:
- Token qua URL vẫn xuất hiện trong:
  - Browser history
  - Server logs (nếu có proxy/nginx)
  - Referer headers
  
**→ Giải pháp production tốt hơn:**
- Dùng backend redirect endpoint
- Hoặc dùng JWT refresh token mechanism
- Hoặc OAuth flow

## 🧪 Testing

### Test Flow:

1. **Login as Vendor**
   ```
   Frontend (localhost:5173) 
   → Login với vendor account
   → Click "VENDOR'S PAGE" button
   ```

2. **Check Admin Opens**
   ```
   → Tab mới mở: http://localhost:5174/add?vendorToken=...
   → Token được lưu vào localStorage
   → URL clean thành: http://localhost:5174/add
   ```

3. **Verify Token Works**
   ```
   → Admin panel không yêu cầu login lại
   → Có thể add product với categories mới
   → Token được dùng cho API calls
   ```

### Debug Commands:

```javascript
// Trong Browser Console của Admin (localhost:5174)

// Check token trong localStorage
localStorage.getItem('token')

// Check URL params (trước khi clean)
new URLSearchParams(window.location.search).get('vendorToken')

// Verify token hoạt động
console.log(token) // Trong React DevTools
```

## 📚 Origins & Storage Scope

### Origin Definition:
```
Origin = Protocol + Domain + Port

✅ Same Origin:
- http://localhost:5173/page1
- http://localhost:5173/page2

❌ Different Origins:
- http://localhost:5173  (Frontend)
- http://localhost:5174  (Admin)
- https://localhost:5173 (Different protocol)
```

### Storage Scope:

| Storage Type | Scope | Cross-Origin Access |
|--------------|-------|---------------------|
| **SessionStorage** | Per origin, per tab | ❌ No |
| **LocalStorage** | Per origin (all tabs) | ❌ No |
| **Cookies** | Per domain | ✅ Yes (với domain settings) |
| **URL Params** | Per request | ✅ Yes |

## 🎯 Alternative Solutions (Not Used)

### Option 1: Cookies
```javascript
// Set cookie with domain
document.cookie = `token=${token}; domain=localhost; path=/`;
```
**Pros:** Automatic cross-origin (same domain)
**Cons:** CSRF risks, cookie limitations

### Option 2: PostMessage API
```javascript
// Parent window
window.open('http://localhost:5174').postMessage(token, 'http://localhost:5174');

// Child window
window.addEventListener('message', (e) => {
  if (e.origin === 'http://localhost:5173') {
    localStorage.setItem('token', e.data);
  }
});
```
**Pros:** Secure, no URL exposure
**Cons:** More complex, timing issues

### Option 3: Backend Redirect
```javascript
// Frontend
window.location = 'http://localhost:4000/auth/vendor-redirect';

// Backend creates secure session
res.redirect('http://localhost:5174/add');
```
**Pros:** Most secure
**Cons:** Requires backend changes, server session

## ✅ Current Solution: URL Parameters

**Why we chose this:**
- ✅ Simple implementation
- ✅ Works immediately
- ✅ No backend changes needed
- ✅ Token cleaned from URL after use
- ✅ Good for development

**For Production:**
Consider backend redirect or OAuth flow for better security.















