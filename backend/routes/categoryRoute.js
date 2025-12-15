import express from 'express';
import { 
    createCategory, 
    getAllCategories, 
    getCategoryTree,
    getCategory,
    getSubCategories,
    updateCategory, 
    deleteCategory 
} from '../controllers/categoryController.js';
import adminAuth from '../middleware/adminAuth.js';

const categoryRouter = express.Router();

// Public routes
categoryRouter.get('/list', getAllCategories); // Get all categories with filters
categoryRouter.get('/tree', getCategoryTree); // Get hierarchical category tree (Shopee style)
categoryRouter.get('/:id/subcategories', getSubCategories); // Get subcategories of a category
categoryRouter.get('/:id', getCategory); // Get single category by ID or slug

// Admin only routes
categoryRouter.post('/create', adminAuth, createCategory); // Create new category
categoryRouter.put('/update/:id', adminAuth, updateCategory); // Update category
categoryRouter.delete('/delete/:id', adminAuth, deleteCategory); // Delete category

export default categoryRouter;













