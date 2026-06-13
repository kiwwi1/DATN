import {
    addProductService,
    generateProductDescriptionService,
    listProductsService,
    listProductsByCategoryService,
    removeProductService,
    singleProductService,
    toggleProductActiveService,
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
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const listProductsByCategory = async (req, res) => {
    try {
        const categoryId = req.query.category || req.body?.category;
        if (!categoryId) {
            return res.status(400).json({ success: false, message: "category is required" });
        }
        const products = await listProductsByCategoryService(categoryId);
        res.json({ success: true, products });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const removeProduct = async (req, res) => {
    try {
        const result = await removeProductService(req.body.id, req.vendorId);
        const message =
            result?.mode === "soft_deleted"
                ? "Product has linked data, marked inactive instead of deleting"
                : "Product removed successfully";
        res.json({ success: true, message, mode: result?.mode || "hard_deleted" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const singleProduct = async (req, res) => {
    try {
        const productId = req.query.productId || req.body?.productId;
        if (!productId) {
            return res.status(400).json({ success: false, message: "productId is required" });
        }
        const product = await singleProductService(productId);
        res.json({ success: true, product });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
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

const toggleProductActive = async (req, res) => {
    try {
        const { productId, isActive } = req.body;
        const product = await toggleProductActiveService(productId, req.vendorId, isActive);
        res.json({
            success: true,
            message: product.isActive ? "Product is now visible" : "Product is now hidden",
            product,
        });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const listVendorProducts = async (req, res) => {
    try {
        const result = await listVendorProductsService(req.vendorId, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
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

const generateProductDescription = async (req, res) => {
    try {
        const {
            name,
            category,
            subCategory,
            attributes,
            target,
            price,
            usp,
            specs,
            benefits,
            material,
            variants,
            imageBase64,
            imageMimeType,
            imageUrl,
        } = req.body;
        const result = await generateProductDescriptionService({
            name,
            category,
            subCategory,
            attributes,
            target,
            price,
            usp,
            specs,
            benefits,
            material,
            variants,
            imageBase64,
            imageMimeType,
            imageUrl,
        });
        res.json({
            success: true,
            description: result.description,
            source: result.source,
        });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export {
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
};
