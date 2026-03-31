import {
    addProductService,
    listProductsService,
    listProductsByCategoryService,
    removeProductService,
    singleProductService,
    updateProductService,
    listVendorProductsService,
    getVendorShopPublicService,
} from "../services/productService.js";

const addProduct = async (req, res) => {
    try {
        const product = await addProductService({
            body: req.body,
            files: req.files,
            vendorId: req.vendorId,
            vendorShopName: req.vendorShopName,
        });
        res.status(201).json({ success: true, message: "Product added successfully", product });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const listProduct = async (req, res) => {
    try {
        const products = await listProductsService();
        res.json({ success: true, products });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const listProductsByCategory = async (req, res) => {
    try {
        const products = await listProductsByCategoryService(req.body.category);
        res.json({ success: true, products });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const removeProduct = async (req, res) => {
    try {
        await removeProductService(req.body.id, req.vendorId);
        res.json({ success: true, message: "Product removed successfully" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const singleProduct = async (req, res) => {
    try {
        const product = await singleProductService(req.body.productId);
        res.json({ success: true, product });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product = await updateProductService(req.body.productId, req.vendorId, req.body, req.files);
        res.json({ success: true, message: "Product updated successfully", product });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const listVendorProducts = async (req, res) => {
    try {
        const products = await listVendorProductsService(req.vendorId);
        res.json({ success: true, products });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const vendorShopPublic = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const data = await getVendorShopPublicService(vendorId);
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export {
    addProduct,
    listProduct,
    removeProduct,
    singleProduct,
    updateProduct,
    listVendorProducts,
    listProductsByCategory,
    vendorShopPublic,
};
