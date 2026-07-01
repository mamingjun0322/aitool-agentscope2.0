import { FC } from 'react'
import { clsx } from 'clsx'
import { useChatStore } from '../../store/chatStore'
import { useSettingStore } from '../../store/settingStore'
import type { Session } from '../../types'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const SessionItem: FC<{
  session: Session
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}> = ({ session, isActive, onSelect, onDelete }) => (
  <div
    className={clsx(
      'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
      isActive
        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
    )}
    onClick={onSelect}
  >
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium truncate">{session.title}</div>
      <div className="text-xs text-gray-400 dark:text-gray-500">{formatTime(session.updatedAt)}</div>
    </div>
    <button
      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all shrink-0"
      onClick={(e) => {
        e.stopPropagation()
        onDelete()
      }}
      title="删除会话"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
)

const Sidebar: FC = () => {
  const { sessions, currentSessionId, createSession, switchSession, deleteSession } = useChatStore()
  const { userId } = useSettingStore()

  return (
    <aside className="flex flex-col w-60 min-w-[200px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-full select-none">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => createSession(userId)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建对话
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
            暂无会话
            <br />
            点击上方按钮新建对话
          </p>
        )}
        {sessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={session.id === currentSessionId}
            onSelect={() => switchSession(session.id)}
            onDelete={() => deleteSession(session.id)}
          />
        ))}
      </div>
    </aside>
  )
}

export default Sidebar
