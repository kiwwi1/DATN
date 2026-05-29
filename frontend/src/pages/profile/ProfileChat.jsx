import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShopContext } from "../../context/ShopContext";
import ProfileSidebar from "../../components/profile/ProfileSidebar";
import { useChatInbox } from "../../hooks/useChatInbox";

const ProfileChat = () => {
  const { backendUrl, token, userId } = useContext(ShopContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const normalizeChatId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value._id) return String(value._id);
    return String(value);
  };

  const queryConversationId = searchParams.get("id") || "";

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
    enabled: true,
    resolveNextActiveId: ({ conversations: list, preferredActiveId, previousActiveId }) => {
      if (preferredActiveId && list.some((conversation) => normalizeChatId(conversation._id) === preferredActiveId)) {
        return preferredActiveId;
      }
      if (previousActiveId && list.some((conversation) => normalizeChatId(conversation._id) === previousActiveId)) {
        return previousActiveId;
      }
      return normalizeChatId(list[0]?._id);
    },
  });

  const activeConversation = useMemo(
    () => conversations.find((conversation) => normalizeId(conversation._id) === normalizeId(activeId)) || null,
    [conversations, activeId, normalizeId]
  );

  useEffect(() => {
    if (!token) return;
    loadConversations({ preferredActiveId: queryConversationId });
  }, [token, queryConversationId, loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    setSearchParams({ id: activeId });
  }, [activeId, setSearchParams]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = async () => {
    const success = await sendMessageContent(text);
    if (success) setText("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 md:flex-row">
      <ProfileSidebar />
      <div className="flex-1 p-3 md:p-6">
        <div className="mx-auto h-[78vh] max-w-6xl overflow-hidden rounded-lg bg-white shadow-sm grid grid-cols-1 md:h-[80vh] md:grid-cols-[320px_1fr]">
          <div className="border-r border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Tin nhắn với shop</h2>
            </div>
            <div className="overflow-y-auto h-[calc(80vh-64px)]">
              {loading ? (
                <p className="p-4 text-sm text-gray-500">Đang tải...</p>
              ) : conversations.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Chưa có cuộc hội thoại nào</p>
              ) : (
                conversations.map((conversation) => (
                  <button
                    type="button"
                    key={normalizeId(conversation._id)}
                    onClick={() => setActiveId(normalizeId(conversation._id))}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${
                      normalizeId(activeId) === normalizeId(conversation._id) ? "bg-orange-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-gray-800 truncate">
                        {conversation.partner?.name || "Shop"}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="text-xs bg-orange-500 text-white rounded-full px-2 py-0.5">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {conversation.lastMessage || "Chưa có tin nhắn"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <p className="font-medium text-gray-800">{activeConversation?.partner?.name || "Chọn cuộc hội thoại"}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {activeId ? (
                messages.map((message) => {
                  const mine = normalizeId(message.senderId) === normalizeId(userId);
                  return (
                    <div key={message._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                          mine ? "bg-orange-500 text-white" : "bg-white text-gray-800 border border-gray-100"
                        }`}
                      >
                        {message.content}
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
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && onSend()}
                disabled={!activeId || sending}
                placeholder={activeId ? "Nhập tin nhắn..." : "Chọn cuộc hội thoại để nhắn"}
                className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-orange-400 disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={onSend}
                disabled={!activeId || sending || !text.trim()}
                className="px-4 py-2 bg-orange-500 text-white text-sm rounded disabled:opacity-50"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileChat;
