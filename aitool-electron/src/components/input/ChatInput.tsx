import { FC, useRef, useState, KeyboardEvent } from 'react'
import { clsx } from 'clsx'
import { useChatStore } from '../../store/chatStore'
import { useSettingStore } from '../../store/settingStore'
import { useChat } from '../../hooks/useChat'

const ChatInput: FC = () => {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentSessionId = useChatStore((s) => s.currentSessionId)
  const createSession = useChatStore((s) => s.createSession)
  const { userId } = useSettingStore()
  const { sendMessage, stopGeneration, isStreaming } = useChat()

  const handleSend = async () => {
    const text = value.trim()
    if (!text || isStreaming) return

    let sessionId = currentSessionId
    if (!sessionId) {
      const session = createSession(userId)
      sessionId = session.id
    }

    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    await sendMessage(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      {isStreaming && (
        <div className="flex justify-center mb-2">
          <button
            onClick={stopGeneration}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full text-xs hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
            停止生成
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={isStreaming}
          placeholder="请输入您的问题... (Enter 发送，Shift+Enter 换行)"
          rows={1}
          className={clsx(
            'flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors',
            'text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
            'focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'max-h-40 overflow-y-auto'
          )}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || isStreaming}
          className={clsx(
            'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all',
            value.trim() && !isStreaming
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
          )}
          title="发送 (Enter)"
        >
          {isStreaming ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 pl-1">
        AI 可能会犯错，请核实重要信息
      </p>
    </div>
  )
}

export default ChatInput
