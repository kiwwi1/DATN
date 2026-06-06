import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { toast } from "react-toastify";

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

export const useChatInbox = ({
  backendUrl,
  token,
  userId,
  enabled = true,
  autoLoadConversations = false,
  resolveNextActiveId,
  onActiveChanged,
}) => {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const socketRef = useRef(null);

  const normalizedActiveId = useMemo(() => normalizeId(activeId), [activeId]);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(backendUrl, {
      transports: ["websocket"],
      auth: { token },
      withCredentials: true,
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [backendUrl, token]);

  const loadConversations = useCallback(
    async (options = {}) => {
      if (!token) return { conversations: [], activeId: "" };

      const { preferredActiveId } = options;
      setLoading(true);
      try {
        const response = await axios.get(`${backendUrl}/api/chat/list`, { headers: { token } });
        if (!response.data.success) {
          throw new Error(response.data.message || "Không tải được danh sách chat");
        }

        const list = response.data.conversations || [];
        setConversations(list);

        setActiveId((previousActive) => {
          const prevId = normalizeId(previousActive);
          const requestedId = normalizeId(preferredActiveId);
          const nextId =
            resolveNextActiveId?.({
              conversations: list,
              previousActiveId: prevId,
              preferredActiveId: requestedId,
            }) ||
            (requestedId && list.some((conversation) => normalizeId(conversation._id) === requestedId)
              ? requestedId
              : prevId && list.some((conversation) => normalizeId(conversation._id) === prevId)
                ? prevId
                : normalizeId(list[0]?._id));

          return nextId;
        });

        return { conversations: list };
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
        return { conversations: [], activeId: "" };
      } finally {
        setLoading(false);
      }
    },
    [backendUrl, resolveNextActiveId, token]
  );

  const loadMessages = useCallback(
    async (conversationId) => {
      const conversationKey = normalizeId(conversationId);
      if (!token || !conversationKey) {
        setMessages([]);
        return;
      }

      try {
        const response = await axios.get(`${backendUrl}/api/chat/${conversationKey}/messages`, {
          headers: { token },
        });
        if (!response.data.success) return;

        setMessages(response.data.messages || []);
        setConversations((previous) =>
          previous.map((conversation) =>
            normalizeId(conversation._id) === conversationKey
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
      }
    },
    [backendUrl, token]
  );

  const sendMessageContent = useCallback(
    async (rawContent, productId = null) => {
      const content = String(rawContent || "").trim();
      if (!token || !normalizedActiveId || (!content && !productId)) return false;

      setSending(true);
      try {
        const response = await axios.post(
          `${backendUrl}/api/chat/${normalizedActiveId}/send`,
          { content, productId },
          { headers: { token } }
        );
        if (!response.data.success) {
          throw new Error(response.data.message || "Gửi tin nhắn thất bại");
        }
        return true;
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
        return false;
      } finally {
        setSending(false);
      }
    },
    [backendUrl, normalizedActiveId, token]
  );

  useEffect(() => {
    if (!enabled || !autoLoadConversations) return;
    loadConversations();
  }, [enabled, autoLoadConversations, loadConversations]);

  useEffect(() => {
    if (!enabled || !normalizedActiveId || !socketRef.current) return;
    socketRef.current.emit("join_room", normalizedActiveId);
    loadMessages(normalizedActiveId);
  }, [enabled, normalizedActiveId, loadMessages]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewMessage = (message) => {
      const conversationId = normalizeId(message?.conversationId);
      if (!conversationId) return;

      setConversations((previous) =>
        previous
          .map((conversation) => {
            if (normalizeId(conversation._id) !== conversationId) return conversation;
            const isMine = normalizeId(message.senderId) === normalizeId(userId);
            const unreadCount = conversation.unreadCount || 0;
            return {
              ...conversation,
              lastMessage: message.content,
              updatedAt: message.createdAt,
              unreadCount: normalizeId(conversation._id) === normalizedActiveId || isMine ? 0 : unreadCount + 1,
            };
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );

      if (conversationId === normalizedActiveId) {
        setMessages((previous) =>
          previous.some((item) => item._id === message._id) ? previous : [...previous, message]
        );
      }
    };

    socket.on("new_message", handleNewMessage);
    return () => socket.off("new_message", handleNewMessage);
  }, [normalizedActiveId, userId]);

  useEffect(() => {
    onActiveChanged?.(normalizedActiveId);
  }, [normalizedActiveId, onActiveChanged]);

  return {
    conversations,
    setConversations,
    activeId: normalizedActiveId,
    setActiveId,
    messages,
    setMessages,
    loading,
    sending,
    loadConversations,
    loadMessages,
    sendMessageContent,
    normalizeId,
  };
};
