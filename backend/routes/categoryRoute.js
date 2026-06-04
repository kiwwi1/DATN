import express from 'express';
import { 
    getAllCategories, 
    getCategoryTree,
    getCategory,
    getSubCategories
} from '../controllers/categoryController.js';

const categoryRouter = express.Router();

// Public routes
categoryRouter.get('/list', getAllCategories); // Get all categories with filters
categoryRouter.get('/tree', getCategoryTree); // Get hierarchical category tree (Shopee style)
categoryRouter.get('/:id/subcategories', getSubCategories); // Get subcategories of a category
categoryRouter.get('/:id', getCategory); // Get single category by ID or slug

export default categoryRouter;













