import {
    createCategoryService,
    getAllCategoriesService,
    getCategoryTreeService,
    getCategoryService,
    updateCategoryService,
    deleteCategoryService,
    getSubCategoriesService,
    updateProductCountService,
} from "../services/categoryService.js";

const createCategory = async (req, res) => {
    try {
        const category = await createCategoryService(req.body);
        res.json({ success: true, message: "Category created successfully", category });
    } catch (error) {
        console.error("[controller]", error?.message || error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getAllCategories = async (req, res) => {
    try {
        const categories = await getAllCategoriesService(req.query);
        res.json({ success: true, categories });
    } catch (error) {
        console.error("[controller]", error?.message || error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getCategoryTree = async (req, res) => {
    try {
        const categoryTree = await getCategoryTreeService();
        res.json({ success: true, categoryTree });
    } catch (error) {
        console.error("[controller]", error?.message || error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getCategory = async (req, res) => {
    try {
        const { category, subCategories } = await getCategoryService(req.params.id);
        res.json({ success: true, category, subCategories });
    } catch (error) {
        console.error("[controller]", error?.message || error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const updateCategory = async (req, res) => {
    try {
        const updatedCategory = await updateCategoryService(req.params.id, req.body);
        res.json({ success: true, message: "Category updated successfully", category: updatedCategory });
    } catch (error) {
        console.error("[controller]", error?.message || error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        await deleteCategoryService(req.params.id);
        res.json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
        console.error("[controller]", error?.message || error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getSubCategories = async (req, res) => {
    try {
        const subcategories = await getSubCategoriesService(req.params.id);
        res.json({ success: true, subcategories });
    } catch (error) {
        console.error("[controller]", error?.message || error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const updateProductCount = async (categoryId) => {
    try {
        await updateProductCountService(categoryId);
    } catch (error) {
        console.error("[category] Error updating product count:", error?.message || error);
    }
};

export { createCategory, getAllCategories, getCategoryTree, getCategory, getSubCategories, updateCategory, deleteCategory, updateProductCount };
