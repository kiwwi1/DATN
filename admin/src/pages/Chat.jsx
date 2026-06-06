import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { toast } from 'react-toastify'
import { backendUrl } from '../App'
import { formatPrice } from '../utils/priceFormat'
import { formatImageUrl } from '../utils/imageUtils'

const Chat = ({ token }) => {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const socketRef = useRef(null)
  const bottomRef = useRef(null)

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === activeId) || null,
    [conversations, activeId]
  )

  useEffect(() => {
    if (!token) return
    const socket = io(backendUrl, {
      transports: ['websocket'],
      auth: { token },
      withCredentials: true,
    })
    socketRef.current = socket
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  const loadConversations = async () => {
    if (!token) return
    setLoading(true)
    try {
      const response = await axios.get(`${backendUrl}/api/chat/list`, { headers: { token } })
      if (response.data.success) {
        const nextConversations = response.data.conversations || []
        setConversations(nextConversations)
        setActiveId((prev) => prev || nextConversations[0]?._id || '')
      } else {
        toast.error(response.data.message || 'Không tải được danh sách chat')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (conversationId) => {
    if (!token || !conversationId) {
      setMessages([])
      return
    }
    try {
      const response = await axios.get(`${backendUrl}/api/chat/${conversationId}/messages`, { headers: { token } })
      if (response.data.success) {
        setMessages(response.data.messages || [])
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation._id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
          )
        )
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  useEffect(() => {
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!activeId || !socketRef.current) return
    socketRef.current.emit('join_room', activeId)
    loadMessages(activeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const onNewMessage = (message) => {
      if (!message?.conversationId) return
      const conversationId = message.conversationId.toString()

      setConversations((prev) =>
        prev
          .map((conversation) => {
            if (conversation._id !== conversationId) return conversation
            return {
              ...conversation,
              lastMessage: message.content,
              updatedAt: message.createdAt,
              unreadCount: conversation._id === activeId ? 0 : (conversation.unreadCount || 0) + 1,
            }
          })
          .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      )

      if (conversationId === activeId) {
        setMessages((prev) => {
          if (prev.some((item) => item._id === message._id)) return prev
          return [...prev, message]
        })
      }
    }

    socket.on('new_message', onNewMessage)
    return () => socket.off('new_message', onNewMessage)
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const onSend = async () => {
    if (!token || !activeId || !text.trim()) return
    setSending(true)
    try {
      const response = await axios.post(
        `${backendUrl}/api/chat/${activeId}/send`,
        { content: text },
        { headers: { token } }
      )
      if (response.data.success) {
        setText('')
      } else {
        toast.error(response.data.message || 'Gửi tin nhắn thất bại')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="admin-page-title text-2xl font-bold tracking-tight text-slate-800">Tin nhắn với Khách hàng</h1>
        <p className="admin-page-subtitle text-xs text-slate-400 mt-1 font-medium">Hỗ trợ trực tiếp, tư vấn sản phẩm và phản hồi nhanh các thắc mắc từ người mua.</p>
      </div>

      {/* Main Chat Layout Container */}
      <div className="admin-card grid h-[76vh] overflow-hidden lg:grid-cols-[320px_1fr] bg-white border border-slate-200 rounded-2xl shadow-xs">
        
        {/* Left Panel: Conversation Thread List */}
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r flex flex-col min-w-0">
          <div className="border-b border-slate-100 px-4 py-3 shrink-0 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-450">Hội thoại hiện có</h2>
            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">{conversations.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="p-6 text-center space-y-2">
                <div className="h-6 w-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-[11px] font-semibold text-slate-400">Đang tải danh sách...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <svg className="w-8 h-8 text-slate-250 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xs font-bold text-slate-400 leading-normal">Chưa nhận cuộc chat nào từ người mua.</p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive = activeId === conversation._id;
                const partnerName = conversation.partner?.name || 'Khách hàng';
                const initialLetter = String(partnerName).slice(0, 1).toUpperCase();
                
                return (
                  <button
                    type="button"
                    key={conversation._id}
                    onClick={() => setActiveId(conversation._id)}
                    className={`w-full px-4 py-3.5 text-left transition-all duration-150 flex items-center gap-3 border-l-3 ${
                      isActive 
                        ? 'bg-pink-50/40 border-pink-500' 
                        : 'border-transparent hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {initialLetter}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="truncate text-xs font-bold text-slate-800">
                          {partnerName}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex min-w-[18px] h-4.5 items-center justify-center rounded-full bg-pink-500 px-1 py-0.5 text-[9px] font-extrabold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-[11px] font-medium text-slate-450">{conversation.lastMessage || 'Chưa gửi tin nhắn'}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Right Panel: Chat Thread Content */}
        <div className="flex min-h-0 flex-col bg-slate-50/20">
          {/* Active Partner Info Header */}
          <div className="border-b border-slate-100 bg-white px-5 py-3.5 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {activeConversation ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-xs font-bold text-slate-800">
                    {activeConversation?.partner?.name || 'Khách hàng'}
                  </p>
                </>
              ) : (
                <p className="text-xs font-bold text-slate-400">Chưa chọn phiên trò chuyện</p>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeId ? (
              <div className="space-y-4">
                {messages.map((message) => {
                  const mine = message.senderRole === 'vendor'
                  return (
                    <div key={message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed ${
                          mine
                            ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-tr-none'
                            : 'border border-slate-150 bg-white text-slate-700 rounded-tl-none'
                        }`}
                      >
                        {message.productId && (
                          <div className={`mb-2 rounded-xl p-2 flex items-center gap-2 border text-left ${
                            mine ? 'bg-black/10 border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                          }`}>
                            <img
                              src={formatImageUrl(message.productId.image, {
                                variant: 'thumb',
                                width: 64,
                                height: 64,
                                fit: 'cover',
                                quality: 70,
                                format: 'webp',
                              })}
                              alt={message.productId.name}
                              className="h-9 w-9 rounded-lg object-cover bg-white flex-shrink-0 border border-slate-150"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[10px] font-bold">{message.productId.name}</p>
                              <p className={`text-[10px] font-extrabold mt-0.5 ${mine ? 'text-pink-100' : 'text-pink-600'}`}>
                                {formatPrice(message.productId.price || 0)}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="font-semibold">{message.content}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                <svg className="w-12 h-12 text-slate-200 mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                <p className="text-xs font-bold text-slate-400">Bấm chọn một cuộc hội thoại ở danh sách bên trái để phản hồi.</p>
              </div>
            )}
          </div>

          {/* Input Chat Area */}
          <div className="border-t border-slate-200 bg-white p-3 shrink-0">
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onSend()}
                disabled={!activeId || sending}
                placeholder={activeId ? 'Gõ tin nhắn gửi khách hàng...' : 'Chọn một cuộc hội thoại từ danh sách'}
                className="admin-input py-2.5 text-xs focus:border-pink-500 rounded-xl font-semibold"
              />
              <button
                type="button"
                onClick={onSend}
                disabled={!activeId || sending || !text.trim()}
                className="admin-btn-primary px-5 py-2.5 text-xs font-bold rounded-xl disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                <span>Gửi đi</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Chat
