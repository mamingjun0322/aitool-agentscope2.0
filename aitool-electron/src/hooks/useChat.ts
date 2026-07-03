import { useCallback, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { useSettingStore } from '../store/settingStore'
import { confirmChat, interruptChat, streamChat } from '../api/chat'
import type { AgentEvent, PendingConfirmation, ToolCall } from '../types'

export function useChat() {
  const store = useChatStore()
  const { apiBaseUrl, userId } = useSettingStore()
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentMsgIdRef = useRef<string | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const awaitingConfirmationRef = useRef(false)
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null)

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      const msgId = currentMsgIdRef.current
      const sessionId = currentSessionIdRef.current
      if (!msgId || !sessionId) return

      switch (event.type) {
        case 'TEXT_BLOCK_DELTA':
          if (event.delta) store.appendTextDelta(sessionId, msgId, event.delta)
          break

        case 'THINKING_BLOCK_DELTA':
          if (event.delta) store.appendThinkingDelta(sessionId, msgId, event.delta)
          break

        case 'TOOL_CALL_START':
          if (event.toolCallName && event.toolCallId) {
            const toolCall: ToolCall = {
              id: event.toolCallId,
              name: event.toolCallName,
              input: {},
              status: 'running',
            }
            store.addToolCall(sessionId, msgId, toolCall)
          }
          break

        case 'TOOL_RESULT_TEXT_DELTA':
          if (event.toolCallId && event.delta) {
            store.updateToolCallResult(sessionId, event.toolCallId, event.delta)
          }
          break

        case 'MODEL_CALL_START':
          store.setModelThinking(sessionId, msgId, true)
          break

        case 'MODEL_CALL_END':
          store.setModelThinking(sessionId, msgId, false)
          break

        case 'REQUIRE_USER_CONFIRM':
          if (event.replyId && event.toolCalls?.length) {
            awaitingConfirmationRef.current = true
            setPendingConfirmation({
              replyId: event.replyId,
              sessionId,
              toolCalls: event.toolCalls,
            })
          }
          break

        case 'ERROR':
          store.setError(event.error ?? '未知错误')
          break

        default:
          break
      }
    },
    [store]
  )

  const finishStream = useCallback(() => {
    const msgId = currentMsgIdRef.current
    const sessionId = currentSessionIdRef.current
    if (msgId && sessionId) {
      store.finalizeMessage(sessionId, msgId)
    }
    store.setStreaming(false)
    abortControllerRef.current = null

    if (!awaitingConfirmationRef.current) {
      currentMsgIdRef.current = null
      currentSessionIdRef.current = null
    }
  }, [store])

  const failStream = useCallback(
    (error: string) => {
      store.setError(error)
      awaitingConfirmationRef.current = false
      setPendingConfirmation(null)
      finishStream()
      currentMsgIdRef.current = null
      currentSessionIdRef.current = null
    },
    [finishStream, store]
  )

  const sendMessage = useCallback(
    async (content: string) => {
      const session = store.currentSession()
      if (!session || store.isStreaming || pendingConfirmation) return

      store.addUserMessage(content)

      const assistantMsg = store.createAssistantMessage()
      currentMsgIdRef.current = assistantMsg.id
      currentSessionIdRef.current = session.id
      awaitingConfirmationRef.current = false
      setPendingConfirmation(null)

      store.setStreaming(true)
      store.setError(null)

      abortControllerRef.current = new AbortController()

      await streamChat({
        content,
        sessionId: session.id,
        userId,
        baseUrl: apiBaseUrl,
        signal: abortControllerRef.current.signal,
        onEvent: handleEvent,
        onError: failStream,
        onDone: finishStream,
      })
    },
    [apiBaseUrl, failStream, finishStream, handleEvent, pendingConfirmation, store, userId]
  )

  const confirmPermission = useCallback(
    async (approved: boolean) => {
      if (!pendingConfirmation || store.isStreaming) return

      awaitingConfirmationRef.current = false
      setPendingConfirmation(null)
      store.setStreaming(true)
      store.setError(null)
      abortControllerRef.current = new AbortController()

      await confirmChat({
        sessionId: pendingConfirmation.sessionId,
        userId,
        approved,
        toolCalls: pendingConfirmation.toolCalls,
        message: approved ? '用户已批准工具调用' : '用户已拒绝工具调用',
        baseUrl: apiBaseUrl,
        signal: abortControllerRef.current.signal,
        onEvent: handleEvent,
        onError: failStream,
        onDone: finishStream,
      })
    },
    [apiBaseUrl, failStream, finishStream, handleEvent, pendingConfirmation, store, userId]
  )

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    const session = store.currentSession()
    if (session) {
      interruptChat(apiBaseUrl, session.id, userId)
    }

    awaitingConfirmationRef.current = false
    setPendingConfirmation(null)
    store.setStreaming(false)
    if (currentMsgIdRef.current && currentSessionIdRef.current) {
      store.finalizeMessage(currentSessionIdRef.current, currentMsgIdRef.current)
    }
    currentMsgIdRef.current = null
    currentSessionIdRef.current = null
  }, [apiBaseUrl, store, userId])

  return {
    sendMessage,
    confirmPermission,
    stopGeneration,
    pendingConfirmation,
    isStreaming: store.isStreaming,
    error: store.error,
  }
}
