import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { toast } from 'react-toastify'
import { backendUrl } from '../App'

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
      <div>
        <h1 className="admin-page-title">Tin nhắn khách hàng</h1>
        <p className="admin-page-subtitle">Trao đổi trực tiếp với khách để xử lý đơn hàng nhanh hơn.</p>
      </div>

      <div className="admin-card grid h-[78vh] overflow-hidden lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Danh sách hội thoại</h2>
          </div>

          <div className="h-[260px] overflow-y-auto lg:h-[calc(78vh-53px)]">
            {loading ? (
              <p className="p-4 text-sm text-slate-500">Đang tải hội thoại...</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Chưa có cuộc hội thoại nào</p>
            ) : (
              conversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation._id}
                  onClick={() => setActiveId(conversation._id)}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left transition ${
                    activeId === conversation._id ? 'bg-pink-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {conversation.partner?.name || 'Khách hàng'}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-pink-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{conversation.lastMessage || 'Chưa có tin nhắn'}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">
              {activeConversation?.partner?.name || 'Chọn một cuộc hội thoại'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
            {activeId ? (
              <div className="space-y-3">
                {messages.map((message) => {
                  const mine = message.senderRole === 'vendor'
                  return (
                    <div key={message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-lg px-3 py-2 text-sm ${
                          mine
                            ? 'bg-pink-500 text-white'
                            : 'border border-slate-200 bg-white text-slate-800'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Hãy chọn một cuộc hội thoại để bắt đầu phản hồi.</p>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onSend()}
                disabled={!activeId || sending}
                placeholder={activeId ? 'Nhập phản hồi...' : 'Chọn hội thoại để nhắn tin'}
                className="admin-input"
              />
              <button
                type="button"
                onClick={onSend}
                disabled={!activeId || sending || !text.trim()}
                className="admin-btn-primary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Chat
