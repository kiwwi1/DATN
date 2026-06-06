import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShopContext } from "../../context/ShopContext";
import { formatPrice } from "../../utils/priceFormat";
import { formatImageUrl } from "../../utils/imageUtils";
import { useChatInbox } from "../../hooks/useChatInbox";

const FloatingChatButton = () => {
  const navigate = useNavigate();
  const { token, backendUrl, userId } = useContext(ShopContext);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [conversationContexts, setConversationContexts] = useState({});
  const [quickByConversation, setQuickByConversation] = useState({});
  const bottomRef = useRef(null);

  const {
    conversations,
    activeId,
    setActiveId,
    messages,
    loading,
    sending,
    loadConversations,
    sendMessageContent,
    normalizeId,
  } = useChatInbox({
    backendUrl,
    token,
    userId,
    enabled: open,
  });

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("vi-VN");
  };

  const activeConversation = useMemo(
    () => conversations.find((conversation) => normalizeId(conversation._id) === normalizeId(activeId)) || null,
    [conversations, activeId, normalizeId]
  );

  const filteredConversations = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((conversation) =>
      String(conversation.partner?.name || "").toLowerCase().includes(keyword)
    );
  }, [conversations, searchTerm]);

  const activeProductContext = useMemo(
    () => conversationContexts[normalizeId(activeId)] || null,
    [conversationContexts, activeId, normalizeId]
  );

  const activeQuickOptions = useMemo(
    () => quickByConversation[normalizeId(activeId)] || [],
    [quickByConversation, activeId, normalizeId]
  );

  useEffect(() => {
    if (!open) return;
    loadConversations();
  }, [open, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const openConversation = async (event) => {
      const conversationId = event?.detail?.conversationId;
      const productContext = event?.detail?.productContext || null;
      const quickOptions = Array.isArray(event?.detail?.quickOptions) ? event.detail.quickOptions : [];
      if (!conversationId) return;

      setOpen(true);
      await loadConversations({ preferredActiveId: conversationId });

      const normalizedConversationId = normalizeId(conversationId);
      if (productContext) {
        setConversationContexts((previous) => ({ ...previous, [normalizedConversationId]: productContext }));
      }
      if (quickOptions.length > 0) {
        setQuickByConversation((previous) => ({ ...previous, [normalizedConversationId]: quickOptions }));
      }
      setActiveId(normalizedConversationId);
    };

    window.addEventListener("open-chat-conversation", openConversation);
    return () => window.removeEventListener("open-chat-conversation", openConversation);
  }, [loadConversations, normalizeId, setActiveId]);

  const onSend = async () => {
    const prodId = activeProductContext?.id || null;
    const success = await sendMessageContent(text, prodId);
    if (success) {
      setText("");
      if (prodId) {
        setConversationContexts((previous) => {
          const next = { ...previous };
          delete next[normalizeId(activeId)];
          return next;
        });
      }
    }
  };

  const handleSendQuickOption = async (option) => {
    const prodId = activeProductContext?.id || null;
    const success = await sendMessageContent(option, prodId);
    if (success && prodId) {
      setConversationContexts((previous) => {
        const next = { ...previous };
        delete next[normalizeId(activeId)];
        return next;
      });
    }
  };

  const handleSendProductOnly = async () => {
    if (!activeProductContext) return;
    const prodId = activeProductContext.id;
    const success = await sendMessageContent(`[Sản phẩm] ${activeProductContext.name}`, prodId);
    if (success) {
      setConversationContexts((previous) => {
        const next = { ...previous };
        delete next[normalizeId(activeId)];
        return next;
      });
    }
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
        <div className="fixed inset-x-2 bottom-2 top-16 z-50 overflow-hidden rounded-sm border border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-5 sm:top-auto sm:h-[620px] sm:w-[680px] sm:max-w-[calc(100vw-20px)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-3xl font-medium text-orange-500">Chat</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              x
            </button>
          </div>
          <div className="grid h-[calc(100%-56px)] grid-cols-1 sm:grid-cols-[240px_1fr]">
            <div className="max-h-44 overflow-y-auto border-b border-gray-200 sm:max-h-none sm:border-b-0 sm:border-r">
              <div className="flex items-center gap-2 border-b border-gray-100 p-3">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-orange-400"
                  placeholder="Tìm theo tên"
                />
                <button type="button" className="whitespace-nowrap text-sm text-gray-600 hover:text-gray-800">
                  Tất cả
                </button>
              </div>
              {loading ? (
                <p className="p-3 text-xs text-gray-500">Đang tải...</p>
              ) : filteredConversations.length === 0 ? (
                <p className="p-3 text-xs text-gray-500">Chưa có hội thoại</p>
              ) : (
                filteredConversations.map((conversation) => (
                  <button
                    key={normalizeId(conversation._id)}
                    type="button"
                    onClick={() => setActiveId(normalizeId(conversation._id))}
                    className={`w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50 ${
                      normalizeId(activeId) === normalizeId(conversation._id) ? "bg-gray-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-600">
                        {String(conversation.partner?.name || "S").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {conversation.partner?.name || "Shop"}
                          </p>
                          <span className="text-[11px] text-gray-500">{formatDate(conversation.updatedAt)}</span>
                        </div>
                        <p className="truncate text-xs text-gray-500">{conversation.lastMessage || "..."}</p>
                        {conversation.unreadCount > 0 && (
                          <span className="mt-1 inline-block rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] text-white">
                            {conversation.unreadCount}
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
                            src={formatImageUrl(activeProductContext.image, {
                              variant: "thumb",
                              width: 96,
                              height: 96,
                              fit: "cover",
                              quality: 76,
                              format: "webp",
                            })}
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
                          <button
                            type="button"
                            onClick={handleSendProductOnly}
                            className="rounded bg-orange-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-orange-600 flex-shrink-0"
                          >
                            Gửi link sản phẩm
                          </button>
                        </div>
                        {activeQuickOptions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {activeQuickOptions.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => handleSendQuickOption(option)}
                                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-100"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {messages.map((message) => {
                      const mine = normalizeId(message.senderId) === normalizeId(userId);
                      return (
                        <div key={message._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded px-2.5 py-2 text-xs ${
                              mine ? "bg-orange-500 text-white" : "bg-white text-gray-800 border border-gray-100"
                            }`}
                          >
                            {message.productId && (
                              <div className={`mb-1.5 rounded p-1.5 flex items-center gap-2 border text-left ${
                                mine ? "bg-orange-600 border-orange-400 text-white" : "bg-gray-50 border-gray-100 text-gray-800"
                              }`}>
                                <img
                                  src={formatImageUrl(message.productId.image, {
                                    variant: "thumb",
                                    width: 64,
                                    height: 64,
                                    fit: "cover",
                                    quality: 70,
                                    format: "webp",
                                  })}
                                  alt={message.productId.name}
                                  className="h-9 w-9 rounded object-cover bg-white flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[10px] font-medium">{message.productId.name}</p>
                                  <p className={`text-[11px] font-bold ${mine ? "text-orange-100" : "text-orange-600"}`}>
                                    {formatPrice(message.productId.price || 0)}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div>{message.content}</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                    <p className="text-2xl font-semibold text-gray-700">Chào mừng bạn đến với Shop Chat</p>
                    <p className="mt-1 text-sm text-gray-400">Bắt đầu trò chuyện với shop ngay bây giờ</p>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="flex items-center gap-2 border-t border-gray-100 p-2">
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && onSend()}
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
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
