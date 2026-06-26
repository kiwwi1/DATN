import express from 'express';
import { trackInteraction, getRecommendations, getWishlist, toggleWishlist } from '../controllers/interactionController.js';
import authUser from '../middleware/auth.js';

const interactionRouter = express.Router();

interactionRouter.post('/track', authUser, trackInteraction);
interactionRouter.post('/recommendations', authUser, getRecommendations);
interactionRouter.get('/wishlist', authUser, getWishlist);
interactionRouter.post('/wishlist/toggle', authUser, toggleWishlist);

export default interactionRouter;
