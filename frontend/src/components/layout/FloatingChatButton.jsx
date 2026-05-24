import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { ShopContext } from "../../context/ShopContext";
import { formatPrice } from "../../utils/priceFormat";
import { formatImageUrl } from "../../utils/imageUtils";

const FloatingChatButton = () => {
  const navigate = useNavigate();
  const { token, backendUrl, userId } = useContext(ShopContext);
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [conversationContexts, setConversationContexts] = useState({});
  const [quickByConversation, setQuickByConversation] = useState({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value._id) return String(value._id);
    return String(value);
  };
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("vi-VN");
  };

  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === activeId) || null,
    [conversations, activeId]
  );
  const filteredConversations = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((c) =>
      String(c.partner?.name || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [conversations, searchTerm]);
  const activeProductContext = useMemo(
    () => conversationContexts[normalizeId(activeId)] || null,
    [conversationContexts, activeId]
  );
  const activeQuickOptions = useMemo(
    () => quickByConversation[normalizeId(activeId)] || [],
    [quickByConversation, activeId]
  );

  useEffect(() => {
    if (!token) return;
    const socket = io(backendUrl, { transports: ["websocket"] });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [backendUrl, token]);

  const loadConversations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/chat/list`, { headers: { token } });
      if (!res.data.success) throw new Error(res.data.message || "Không tải được danh sách chat");
      const list = res.data.conversations || [];
      setConversations(list);
      setActiveId((prev) => {
        const normalizedPrev = normalizeId(prev);
        const hasPrev = list.some((c) => normalizeId(c._id) === normalizedPrev);
        return hasPrev ? normalizedPrev : normalizeId(list[0]?._id);
      });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    const cid = normalizeId(conversationId);
    if (!token || !cid) {
      setMessages([]);
      return;
    }
    try {
      const res = await axios.get(`${backendUrl}/api/chat/${cid}/messages`, {
        headers: { token },
      });
      if (res.data.success) {
        setMessages(res.data.messages || []);
        setConversations((prev) =>
          prev.map((c) =>
            normalizeId(c._id) === cid ? { ...c, unreadCount: 0 } : c
          )
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  useEffect(() => {
    const cid = normalizeId(activeId);
    if (!open || !cid || !socketRef.current) return;
    socketRef.current.emit("join_room", cid);
    loadMessages(cid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onNewMessage = (msg) => {
      const conversationId = msg?.conversationId?.toString();
      if (!conversationId) return;
      setConversations((prev) =>
        prev
          .map((c) => {
            if (normalizeId(c._id) !== conversationId) return c;
            const isMine = msg.senderId?.toString() === userId?.toString();
            const unreadCount = c.unreadCount || 0;
            return {
              ...c,
              lastMessage: msg.content,
              updatedAt: msg.createdAt,
              unreadCount: c._id === activeId || isMine ? 0 : unreadCount + 1,
            };
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
      if (conversationId === normalizeId(activeId)) {
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      }
    };
    socket.on("new_message", onNewMessage);
    return () => socket.off("new_message", onNewMessage);
  }, [activeId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const openConversation = async (event) => {
      const conversationId = event?.detail?.conversationId;
      const productContext = event?.detail?.productContext || null;
      const quickOptions = Array.isArray(event?.detail?.quickOptions)
        ? event.detail.quickOptions
        : [];
      if (!conversationId) return;
      setOpen(true);
      await loadConversations();
      const cid = normalizeId(conversationId);
      if (productContext) {
        setConversationContexts((prev) => ({ ...prev, [cid]: productContext }));
      }
      if (quickOptions.length > 0) {
        setQuickByConversation((prev) => ({ ...prev, [cid]: quickOptions }));
      }
      setActiveId(cid);
    };
    window.addEventListener("open-chat-conversation", openConversation);
    return () => window.removeEventListener("open-chat-conversation", openConversation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sendMessageContent = async (rawContent) => {
    const content = String(rawContent || "").trim();
    if (!token || !activeId || !content) return;
    const cid = normalizeId(activeId);
    if (!cid) return;
    setSending(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/chat/${cid}/send`,
        { content },
        { headers: { token } }
      );
      if (!res.data.success) throw new Error(res.data.message || "Gửi tin nhắn thất bại");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSending(false);
    }
  };
  const onSend = async () => {
    await sendMessageContent(text);
    setText("");
  };

  const onOpenChat = async () => {
    if (!token) {
      navigate("/login");
      return;
    }
    setOpen(true);
    await loadConversations();
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-5 z-50 h-[620px] w-[680px] max-w-[calc(100vw-20px)] overflow-hidden rounded-sm border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-3xl font-medium text-orange-500">Chat</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
          <div className="grid h-[calc(620px-56px)] grid-cols-[240px_1fr]">
            <div className="border-r border-gray-200 overflow-y-auto">
              <div className="flex items-center gap-2 border-b border-gray-100 p-3">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-orange-400"
                  placeholder="Tìm theo tên"
                />
                <button
                  type="button"
                  className="whitespace-nowrap text-sm text-gray-600 hover:text-gray-800"
                >
                  Tất cả
                </button>
              </div>
              {loading ? (
                <p className="p-3 text-xs text-gray-500">Đang tải...</p>
              ) : filteredConversations.length === 0 ? (
                <p className="p-3 text-xs text-gray-500">Chưa có hội thoại</p>
              ) : (
                filteredConversations.map((c) => (
                  <button
                    key={normalizeId(c._id)}
                    type="button"
                    onClick={() => setActiveId(normalizeId(c._id))}
                    className={`w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50 ${
                      normalizeId(activeId) === normalizeId(c._id) ? "bg-gray-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-600">
                        {String(c.partner?.name || "S").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {c.partner?.name || "Shop"}
                          </p>
                          <span className="text-[11px] text-gray-500">{formatDate(c.updatedAt)}</span>
                        </div>
                        <p className="truncate text-xs text-gray-500">{c.lastMessage || "..."}</p>
                        {c.unreadCount > 0 && (
                          <span className="mt-1 inline-block rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="flex flex-col">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="truncate text-sm font-medium text-gray-700">
                  {activeConversation?.partner?.name || "Chọn hội thoại"}
                </p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-gray-100 p-3">
                {activeId ? (
                  <>
                    {activeProductContext && (
                      <div className="rounded-md border border-gray-200 bg-white p-2">
                        <p className="mb-2 text-xs text-gray-500">Bạn đang trao đổi với Người bán về sản phẩm này</p>
                        <div className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 p-2">
                          <img
                            src={formatImageUrl(activeProductContext.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })}
                            alt={activeProductContext.name}
                            className="h-12 w-12 rounded object-cover bg-white"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-gray-800">{activeProductContext.name}</p>
                            <p className="mt-0.5 text-sm font-semibold text-orange-600">
                              {formatPrice(activeProductContext.price || 0)}
                            </p>
                          </div>
                        </div>
                        {activeQuickOptions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {activeQuickOptions.map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => sendMessageContent(q)}
                                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-100"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {messages.map((m) => {
                      const mine = m.senderId?.toString() === userId?.toString();
                      return (
                        <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded px-2 py-1.5 text-xs ${
                              mine ? "bg-orange-500 text-white" : "bg-white text-gray-800 border border-gray-100"
                            }`}
                          >
                            {m.content}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                    <svg className="mb-4 h-24 w-24 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.335-3.114A7.948 7.948 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-2xl font-semibold text-gray-700">Chào mừng bạn đến với Shop Chat</p>
                    <p className="mt-1 text-sm text-gray-400">Bắt đầu trò chuyện với shop ngay bây giờ</p>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="flex items-center gap-2 border-t border-gray-100 p-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSend()}
                  disabled={!activeId || sending}
                  className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-orange-400 disabled:bg-gray-100"
                  placeholder={activeId ? "Nhập tin nhắn..." : "Chọn hội thoại"}
                />
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!activeId || sending || !text.trim()}
                  className="rounded bg-orange-500 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onOpenChat}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-md border border-gray-100 bg-white px-4 py-2 text-orange-500 shadow-lg transition-colors hover:bg-orange-50"
        aria-label="Mở chat"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.335-3.114A7.948 7.948 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="font-medium">Chat</span>
      </button>
    </>
  );
};

export default FloatingChatButton;
