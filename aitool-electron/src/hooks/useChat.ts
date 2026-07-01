import { useCallback, useRef } from 'react'
import { useChatStore } from '../store/chatStore'
import { useSettingStore } from '../store/settingStore'
import { streamChat, interruptChat } from '../api/chat'
import type { AgentEvent, ToolCall } from '../types'

export function useChat() {
  const store = useChatStore()
  const { apiBaseUrl, userId } = useSettingStore()
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentMsgIdRef = useRef<string | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      const session = store.currentSession()
      if (!session || store.isStreaming) return

      store.addUserMessage(content)

      const assistantMsg = store.createAssistantMessage()
      currentMsgIdRef.current = assistantMsg.id
      currentSessionIdRef.current = session.id

      store.setStreaming(true)
      store.setError(null)

      abortControllerRef.current = new AbortController()

      await streamChat({
        content,
        sessionId: session.id,
        userId,
        baseUrl: apiBaseUrl,
        signal: abortControllerRef.current.signal,
        onEvent: (event: AgentEvent) => {
          const msgId = currentMsgIdRef.current
          const sid = currentSessionIdRef.current
          if (!msgId || !sid) return

          switch (event.type) {
            case 'TEXT_BLOCK_DELTA':
              if (event.delta) store.appendTextDelta(sid, msgId, event.delta)
              break

            case 'THINKING_BLOCK_DELTA':
              if (event.delta) store.appendThinkingDelta(sid, msgId, event.delta)
              break

            case 'TOOL_CALL_START':
              if (event.toolCallName && event.toolCallId) {
                const toolCall: ToolCall = {
                  id: event.toolCallId,
                  name: event.toolCallName,
                  input: {},
                  status: 'running',
                }
                store.addToolCall(sid, msgId, toolCall)
              }
              break

            case 'TOOL_RESULT_TEXT_DELTA':
              if (event.toolCallId && event.delta) {
                store.updateToolCallResult(sid, event.toolCallId, event.delta)
              }
              break

            case 'MODEL_CALL_START':
              store.setModelThinking(sid, msgId, true)
              break

            case 'MODEL_CALL_END':
              store.setModelThinking(sid, msgId, false)
              break

            case 'ERROR':
              store.setError(event.error ?? '未知错误')
              break

            default:
              break
          }
        },
        onError: (error: string) => {
          store.setError(error)
          if (currentMsgIdRef.current && currentSessionIdRef.current) {
            store.finalizeMessage(currentSessionIdRef.current, currentMsgIdRef.current)
          }
          store.setStreaming(false)
          currentMsgIdRef.current = null
          currentSessionIdRef.current = null
        },
        onDone: () => {
          if (currentMsgIdRef.current && currentSessionIdRef.current) {
            store.finalizeMessage(currentSessionIdRef.current, currentMsgIdRef.current)
          }
          store.setStreaming(false)
          currentMsgIdRef.current = null
          currentSessionIdRef.current = null
        },
      })
    },
    [store, apiBaseUrl, userId]
  )

  const stopGeneration = useCallback(() => {
    // 1. abort SSE stream on client side
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    // 2. notify backend to interrupt agent
    const session = store.currentSession()
    if (session) {
      interruptChat(apiBaseUrl, session.id, userId)
    }
    // 3. finalize UI state
    store.setStreaming(false)
    if (currentMsgIdRef.current && currentSessionIdRef.current) {
      store.finalizeMessage(currentSessionIdRef.current, currentMsgIdRef.current)
    }
    currentMsgIdRef.current = null
    currentSessionIdRef.current = null
  }, [store, apiBaseUrl, userId])

  return {
    sendMessage,
    stopGeneration,
    isStreaming: store.isStreaming,
    error: store.error,
  }
}
