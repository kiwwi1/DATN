import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";

export const createCategoryService = async ({ name, slug, description, image, icon, level, parentCategory, order }) => {
    if (!name || !slug || !level) throw Object.assign(new Error("Name, slug, and level are required"), { status: 400 });

    const existingCategory = await categoryModel.findOne({ slug });
    if (existingCategory) throw Object.assign(new Error("Category slug already exists"), { status: 409 });

    if (level > 1 && !parentCategory) throw Object.assign(new Error("Parent category is required for sub-categories"), { status: 400 });

    if (parentCategory) {
        const parent = await categoryModel.findById(parentCategory);
        if (!parent) throw Object.assign(new Error("Parent category not found"), { status: 404 });
        if (parent.level >= level) throw Object.assign(new Error("Invalid category level hierarchy"), { status: 400 });
    }

    return categoryModel.create({
        name,
        slug,
        description: description || "",
        image: image || "",
        icon: icon || "",
        level,
        parentCategory: parentCategory || null,
        order: order || 0,
    });
};

export const getAllCategoriesService = async ({ level, parentCategory, isActive } = {}) => {
    const filter = {};
    if (level) filter.level = parseInt(level);
    if (parentCategory) filter.parentCategory = parentCategory;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    return categoryModel.find(filter).populate("parentCategory", "name slug level").sort({ order: 1, name: 1 });
};

export const getCategoryTreeService = async () => {
    const mainCategories = await categoryModel.find({ level: 1, isActive: true }).sort({ order: 1, name: 1 });
    return Promise.all(
        mainCategories.map(async (mainCat) => {
            const subCategories = await categoryModel.find({ parentCategory: mainCat._id, level: 2, isActive: true }).sort({ order: 1, name: 1 });
            const subCatsWithChildren = await Promise.all(
                subCategories.map(async (subCat) => {
                    const subSubCategories = await categoryModel.find({ parentCategory: subCat._id, level: 3, isActive: true }).sort({ order: 1, name: 1 });
                    return { ...subCat.toObject(), children: subSubCategories };
                })
            );
            return { ...mainCat.toObject(), children: subCatsWithChildren };
        })
    );
};

export const getCategoryService = async (id) => {
    let category = await categoryModel.findById(id).populate("parentCategory");
    if (!category) category = await categoryModel.findOne({ slug: id }).populate("parentCategory");
    if (!category) throw Object.assign(new Error("Category not found"), { status: 404 });
    const subCategories = await categoryModel.find({ parentCategory: category._id });
    return { category, subCategories };
};

export const updateCategoryService = async (id, updateData) => {
    const category = await categoryModel.findById(id);
    if (!category) throw Object.assign(new Error("Category not found"), { status: 404 });
    if (updateData.slug && updateData.slug !== category.slug) {
        const existingSlug = await categoryModel.findOne({ slug: updateData.slug });
        if (existingSlug) throw Object.assign(new Error("Slug already exists"), { status: 409 });
    }
    return categoryModel.findByIdAndUpdate(id, { ...updateData, updatedAt: Date.now() }, { new: true });
};

export const deleteCategoryService = async (id) => {
    const category = await categoryModel.findById(id);
    if (!category) throw Object.assign(new Error("Category not found"), { status: 404 });
    const hasSubCategories = await categoryModel.findOne({ parentCategory: id });
    if (hasSubCategories) throw Object.assign(new Error("Cannot delete category with sub-categories"), { status: 400 });
    const hasProducts = await productModel.findOne({ $or: [{ category: id }, { subCategory: id }, { subSubCategory: id }] });
    if (hasProducts) throw Object.assign(new Error("Cannot delete category with products"), { status: 400 });
    await categoryModel.findByIdAndUpdate(id, { isActive: false });
};

export const getSubCategoriesService = async (id) => {
    const parentCategory = await categoryModel.findById(id);
    if (!parentCategory) throw Object.assign(new Error("Parent category not found"), { status: 404 });
    return categoryModel.find({ parentCategory: id, isActive: true }).sort({ order: 1, name: 1 });
};

export const updateProductCountService = async (categoryId) => {
    const count = await productModel.countDocuments({
        $or: [{ category: categoryId }, { subCategory: categoryId }, { subSubCategory: categoryId }],
        isActive: true,
    });
    await categoryModel.findByIdAndUpdate(categoryId, { productCount: count });
};
