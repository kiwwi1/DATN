import express from 'express';
import {
    addProduct,
    generateProductDescription,
    listProduct,
    removeProduct,
    singleProduct,
    updateProduct,
    listVendorProducts,
    listProductsByCategory,
    vendorShopPublic,
    toggleProductActive,
} from '../controllers/productController.js';
import upload from '../middleware/multer.js';
import vendorAuth from '../middleware/vendorAuth.js';



const productRouter = express.Router();

productRouter.post('/add',vendorAuth,upload.fields([{name:'image1',maxCount:1},{name:'image2',maxCount:1},{name:'image3',maxCount:1},{name:'image4',maxCount:1}]),addProduct);
productRouter.get('/list', listProduct); // Public route for all products
productRouter.get('/vendor-list', vendorAuth, listVendorProducts); // Vendor-specific products
productRouter.post('/remove', vendorAuth, removeProduct);
productRouter.post('/generate-description', vendorAuth, generateProductDescription);
productRouter.get('/single', singleProduct); // single product details
productRouter.post('/update', vendorAuth, upload.fields([{name:'image0',maxCount:1},{name:'image1',maxCount:1},{name:'image2',maxCount:1},{name:'image3',maxCount:1}]), updateProduct);
productRouter.post('/toggle-active', vendorAuth, toggleProductActive);
productRouter.get('/list-by-category', listProductsByCategory);
productRouter.get('/vendor-shop/:vendorId', vendorShopPublic);
export default productRouter;
