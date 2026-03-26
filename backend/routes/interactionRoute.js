import express from 'express';
import { trackInteraction, getRecommendations } from '../controllers/interactionController.js';
import authUser from '../middleware/auth.js';

const interactionRouter = express.Router();

interactionRouter.post('/track', authUser, trackInteraction);
interactionRouter.post('/recommendations', authUser, getRecommendations);

export default interactionRouter;
