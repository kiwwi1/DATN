import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { backendUrl } from "../App";

const Chat = ({ token }) => {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === activeId) || null,
    [conversations, activeId]
  );

  useEffect(() => {
    if (!token) return;
    const socket = io(backendUrl, { transports: ["websocket"] });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const loadConversations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/chat/list`, {
        headers: { token },
      });
      if (res.data.success) {
        const list = res.data.conversations || [];
        setConversations(list);
        setActiveId((prev) => prev || list[0]?._id || "");
      } else {
        toast.error(res.data.message || "Không tải được danh sách chat");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!token || !conversationId) {
      setMessages([]);
      return;
    }
    try {
      const res = await axios.get(`${backendUrl}/api/chat/${conversationId}/messages`, {
        headers: { token },
      });
      if (res.data.success) {
        setMessages(res.data.messages || []);
        setConversations((prev) =>
          prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!activeId || !socketRef.current) return;
    socketRef.current.emit("join_room", activeId);
    loadMessages(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onNewMessage = (msg) => {
      if (!msg?.conversationId) return;
      const conversationId = msg.conversationId.toString();
      setConversations((prev) =>
        prev
          .map((c) => {
            if (c._id !== conversationId) return c;
            const unreadCount = c.unreadCount || 0;
            return {
              ...c,
              lastMessage: msg.content,
              updatedAt: msg.createdAt,
              unreadCount: c._id === activeId ? 0 : unreadCount + 1,
            };
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );

      if (conversationId === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on("new_message", onNewMessage);
    return () => socket.off("new_message", onNewMessage);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = async () => {
    if (!token || !activeId || !text.trim()) return;
    setSending(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/chat/${activeId}/send`,
        { content: text },
        { headers: { token } }
      );
      if (res.data.success) {
        setText("");
      } else {
        toast.error(res.data.message || "Gửi tin nhắn thất bại");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[80vh] bg-white rounded-lg shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[320px_1fr]">
      <div className="border-r border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Tin nhắn khách hàng</h2>
        </div>
        <div className="overflow-y-auto h-[calc(80vh-64px)]">
          {loading ? (
            <p className="p-4 text-sm text-gray-500">Đang tải...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Chưa có cuộc hội thoại nào</p>
          ) : (
            conversations.map((c) => (
              <button
                type="button"
                key={c._id}
                onClick={() => setActiveId(c._id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${
                  activeId === c._id ? "bg-orange-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-gray-800 truncate">
                    {c.partner?.name || "Khách hàng"}
                  </p>
                  {c.unreadCount > 0 && (
                    <span className="text-xs bg-orange-500 text-white rounded-full px-2 py-0.5">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-1">
                  {c.lastMessage || "Chưa có tin nhắn"}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <p className="font-medium text-gray-800">
            {activeConversation?.partner?.name || "Chọn cuộc hội thoại"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {activeId ? (
            messages.map((m) => {
              const mine = m.senderRole === "vendor";
              return (
                <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                      mine
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-800 border border-gray-100"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500">Hãy chọn một cuộc hội thoại.</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-gray-100 bg-white flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            disabled={!activeId || sending}
            placeholder={activeId ? "Nhập phản hồi..." : "Chọn cuộc hội thoại để nhắn"}
            className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-gray-100"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!activeId || sending || !text.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
