import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";

// Create a new category
const createCategory = async (req, res) => {
    try {
        const { name, slug, description, image, icon, level, parentCategory, order } = req.body;

        // Validate required fields
        if (!name || !slug || !level) {
            return res.json({ success: false, message: "Name, slug, and level are required" });
        }

        // Check if slug already exists
        const existingCategory = await categoryModel.findOne({ slug });
        if (existingCategory) {
            return res.json({ success: false, message: "Category slug already exists" });
        }

        // If level > 1, parentCategory is required
        if (level > 1 && !parentCategory) {
            return res.json({ success: false, message: "Parent category is required for sub-categories" });
        }

        // Validate parent category exists
        if (parentCategory) {
            const parent = await categoryModel.findById(parentCategory);
            if (!parent) {
                return res.json({ success: false, message: "Parent category not found" });
            }
            // Validate level hierarchy
            if (parent.level >= level) {
                return res.json({ success: false, message: "Invalid category level hierarchy" });
            }
        }

        const categoryData = {
            name,
            slug,
            description: description || '',
            image: image || '',
            icon: icon || '',
            level,
            parentCategory: parentCategory || null,
            order: order || 0
        };

        const category = new categoryModel(categoryData);
        await category.save();

        res.json({ success: true, message: "Category created successfully", category });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Get all categories with optional filtering
const getAllCategories = async (req, res) => {
    try {
        const { level, parentCategory, isActive } = req.query;

        let filter = {};
        if (level) filter.level = parseInt(level);
        if (parentCategory) filter.parentCategory = parentCategory;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const categories = await categoryModel
            .find(filter)
            .populate('parentCategory', 'name slug level')
            .sort({ order: 1, name: 1 });

        res.json({ success: true, categories });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Get category tree (hierarchical structure like Shopee)
const getCategoryTree = async (req, res) => {
    try {
        // Get all main categories (level 1)
        const mainCategories = await categoryModel
            .find({ level: 1, isActive: true })
            .sort({ order: 1, name: 1 });

        // Build tree structure
        const categoryTree = await Promise.all(
            mainCategories.map(async (mainCat) => {
                // Get sub-categories (level 2)
                const subCategories = await categoryModel
                    .find({ parentCategory: mainCat._id, level: 2, isActive: true })
                    .sort({ order: 1, name: 1 });

                // Get sub-sub-categories (level 3) for each sub-category
                const subCatsWithChildren = await Promise.all(
                    subCategories.map(async (subCat) => {
                        const subSubCategories = await categoryModel
                            .find({ parentCategory: subCat._id, level: 3, isActive: true })
                            .sort({ order: 1, name: 1 });

                        return {
                            ...subCat.toObject(),
                            children: subSubCategories
                        };
                    })
                );

                return {
                    ...mainCat.toObject(),
                    children: subCatsWithChildren
                };
            })
        );

        res.json({ success: true, categoryTree });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Get single category by ID or slug
const getCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Try to find by ID first, then by slug
        let category = await categoryModel.findById(id).populate('parentCategory');
        if (!category) {
            category = await categoryModel.findOne({ slug: id }).populate('parentCategory');
        }

        if (!category) {
            return res.json({ success: false, message: "Category not found" });
        }

        // Get sub-categories
        const subCategories = await categoryModel.find({ parentCategory: category._id });

        res.json({ success: true, category, subCategories });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Update category
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Check if category exists
        const category = await categoryModel.findById(id);
        if (!category) {
            return res.json({ success: false, message: "Category not found" });
        }

        // If changing slug, check it doesn't exist
        if (updateData.slug && updateData.slug !== category.slug) {
            const existingSlug = await categoryModel.findOne({ slug: updateData.slug });
            if (existingSlug) {
                return res.json({ success: false, message: "Slug already exists" });
            }
        }

        // Update category
        const updatedCategory = await categoryModel.findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: Date.now() },
            { new: true }
        );

        res.json({ success: true, message: "Category updated successfully", category: updatedCategory });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Delete category (soft delete - set isActive to false)
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if category exists
        const category = await categoryModel.findById(id);
        if (!category) {
            return res.json({ success: false, message: "Category not found" });
        }

        // Check if category has sub-categories
        const hasSubCategories = await categoryModel.findOne({ parentCategory: id });
        if (hasSubCategories) {
            return res.json({ success: false, message: "Cannot delete category with sub-categories" });
        }

        // Check if category has products
        const hasProducts = await productModel.findOne({ 
            $or: [
                { category: id },
                { subCategory: id },
                { subSubCategory: id }
            ]
        });
        if (hasProducts) {
            return res.json({ success: false, message: "Cannot delete category with products" });
        }

        // Soft delete - set isActive to false
        await categoryModel.findByIdAndUpdate(id, { isActive: false });

        res.json({ success: true, message: "Category deleted successfully" });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Get subcategories by parent category ID
const getSubCategories = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate parent category exists
        const parentCategory = await categoryModel.findById(id);
        if (!parentCategory) {
            return res.json({ success: false, message: "Parent category not found" });
        }

        // Get all subcategories (direct children)
        const subcategories = await categoryModel
            .find({ parentCategory: id, isActive: true })
            .sort({ order: 1, name: 1 });

        res.json({ success: true, subcategories });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Update product count for category
const updateProductCount = async (categoryId) => {
    try {
        const count = await productModel.countDocuments({ 
            $or: [
                { category: categoryId },
                { subCategory: categoryId },
                { subSubCategory: categoryId }
            ],
            isActive: true
        });
        
        await categoryModel.findByIdAndUpdate(categoryId, { productCount: count });
    } catch (error) {
        console.log('Error updating product count:', error);
    }
}

export { 
    createCategory, 
    getAllCategories, 
    getCategoryTree,
    getCategory,
    getSubCategories,
    updateCategory, 
    deleteCategory,
    updateProductCount
};






