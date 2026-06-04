import express from "express";
import authUser from "../middleware/auth.js";
import {
    initConversation,
    listConversations,
    getMessages,
    sendMessage,
} from "../controllers/chatController.js";

const chatRouter = express.Router();

chatRouter.post("/init", authUser, initConversation);
chatRouter.get("/list", authUser, listConversations);
chatRouter.get("/:id/messages", authUser, getMessages);
chatRouter.post("/:id/send", authUser, sendMessage);

export default chatRouter;
