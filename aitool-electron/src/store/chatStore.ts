import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Session, Message, ContentBlock, ToolCall } from '../types'

interface ChatStore {
  sessions: Session[]
  currentSessionId: string | null
  isStreaming: boolean
  error: string | null

  currentSession: () => Session | null
  currentMessages: () => Message[]

  createSession: (userId?: string) => Session
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  updateSessionTitle: (id: string, title: string) => void

  addUserMessage: (content: string) => Message
  createAssistantMessage: () => Message
  appendTextDelta: (sessionId: string, msgId: string, delta: string) => void
  appendThinkingDelta: (sessionId: string, msgId: string, delta: string) => void
  addToolCall: (sessionId: string, msgId: string, toolCall: ToolCall) => void
  updateToolCallResult: (sessionId: string, toolCallId: string, result: string) => void
  finalizeMessage: (sessionId: string, msgId: string) => void
  setModelThinking: (sessionId: string, msgId: string, thinking: boolean) => void

  setStreaming: (val: boolean) => void
  setError: (msg: string | null) => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      isStreaming: false,
      error: null,

      currentSession: () => {
        const { sessions, currentSessionId } = get()
        return sessions.find((s) => s.id === currentSessionId) ?? null
      },

      currentMessages: () => {
        const session = get().currentSession()
        return session?.messages ?? []
      },

      createSession: (userId?: string) => {
        const session: Session = {
          id: uuidv4(),
          title: '新对话',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          userId: userId ?? 'user-001',
        }
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
        }))
        return session
      },

      switchSession: (id: string) => {
        set({ currentSessionId: id })
      },

      deleteSession: (id: string) => {
        set((state) => {
          const filtered = state.sessions.filter((s) => s.id !== id)
          const newCurrentId =
            state.currentSessionId === id
              ? filtered[0]?.id ?? null
              : state.currentSessionId
          return { sessions: filtered, currentSessionId: newCurrentId }
        })
      },

      updateSessionTitle: (id: string, title: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title, updatedAt: Date.now() } : s
          ),
        }))
      },

      addUserMessage: (content: string) => {
        const { currentSessionId } = get()
        if (!currentSessionId) throw new Error('No active session')
        const msg: Message = {
          id: uuidv4(),
          role: 'user',
          content: [{ type: 'text', text: content }],
          createdAt: Date.now(),
        }
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== currentSessionId) return s
            const isFirst = s.messages.filter((m) => m.role === 'user').length === 0
            return {
              ...s,
              messages: [...s.messages, msg],
              title: isFirst ? content.slice(0, 20) : s.title,
              updatedAt: Date.now(),
            }
          }),
        }))
        return msg
      },

      createAssistantMessage: () => {
        const { currentSessionId } = get()
        if (!currentSessionId) throw new Error('No active session')
        const msg: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: [],
          createdAt: Date.now(),
          isStreaming: true,
        }
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === currentSessionId
              ? { ...s, messages: [...s.messages, msg], updatedAt: Date.now() }
              : s
          ),
        }))
        return msg
      },

      appendTextDelta: (sessionId: string, msgId: string, delta: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.id !== msgId) return m
                const blocks = [...m.content]
                const last = blocks[blocks.length - 1]
                if (last && last.type === 'text') {
                  blocks[blocks.length - 1] = { type: 'text', text: last.text + delta }
                } else {
                  blocks.push({ type: 'text', text: delta })
                }
                return { ...m, content: blocks }
              }),
            }
          }),
        }))
      },

      appendThinkingDelta: (sessionId: string, msgId: string, delta: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.id !== msgId) return m
                const blocks = [...m.content]
                const last = blocks[blocks.length - 1]
                if (last && last.type === 'thinking') {
                  blocks[blocks.length - 1] = {
                    type: 'thinking',
                    text: last.text + delta,
                    collapsed: last.collapsed,
                  }
                } else {
                  blocks.push({ type: 'thinking', text: delta, collapsed: true })
                }
                return { ...m, content: blocks }
              }),
            }
          }),
        }))
      },

      addToolCall: (sessionId: string, msgId: string, toolCall: ToolCall) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.id !== msgId) return m
                const block: ContentBlock = { type: 'tool_call', toolCall }
                return { ...m, content: [...m.content, block] }
              }),
            }
          }),
        }))
      },

      updateToolCallResult: (sessionId: string, toolCallId: string, result: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s
            return {
              ...s,
              messages: s.messages.map((m) => ({
                ...m,
                content: m.content.map((block) => {
                  if (block.type === 'tool_call' && block.toolCall.id === toolCallId) {
                    return {
                      ...block,
                      toolCall: {
                        ...block.toolCall,
                        result,
                        status: 'success' as const,
                      },
                    }
                  }
                  return block
                }),
              })),
            }
          }),
        }))
      },

      finalizeMessage: (sessionId: string, msgId: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === msgId ? { ...m, isStreaming: false, isModelThinking: false } : m
              ),
            }
          }),
        }))
      },

      setModelThinking: (sessionId: string, msgId: string, thinking: boolean) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === msgId ? { ...m, isModelThinking: thinking } : m
              ),
            }
          }),
        }))
      },

      setStreaming: (val: boolean) => set({ isStreaming: val }),
      setError: (msg: string | null) => set({ error: msg }),
    }),
    {
      name: 'agentscope-chat-store',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
)
