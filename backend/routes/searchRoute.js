import express from 'express';
import { searchProducts, autocomplete, getTrending } from '../controllers/searchController.js';

const searchRouter = express.Router();

searchRouter.get('/', searchProducts);
searchRouter.get('/autocomplete', autocomplete);
searchRouter.get('/trending', getTrending);

export default searchRouter;
