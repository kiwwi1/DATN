import {
    initConversationService,
    sendMessageService,
    getConversationsService,
    getMessagesService,
} from "../services/chatService.js";

export const initConversation = async (req, res) => {
    try {
        const { vendorId } = req.body;
        const buyerId = req.body.userId;
        const conversation = await initConversationService(buyerId, vendorId);
        res.json({ success: true, conversation });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export const listConversations = async (req, res) => {
    try {
        const conversations = await getConversationsService(req.body.userId);
        res.json({ success: true, conversations });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const { messages, conversation, viewerRole } = await getMessagesService(
            id,
            req.body.userId
        );
        res.json({ success: true, conversation, messages, viewerRole });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const message = await sendMessageService(id, req.body.userId, content);

        const io = req.app.get("io");
        if (io) {
            io.to(id).emit("new_message", {
                _id: message._id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                senderRole: message.senderRole,
                content: message.content,
                read: message.read,
                createdAt: message.createdAt,
            });
        }

        res.json({ success: true, messageData: message });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};
