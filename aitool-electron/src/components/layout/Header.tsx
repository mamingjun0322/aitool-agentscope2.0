import { FC, useState } from 'react'
import { clsx } from 'clsx'
import { useTheme } from '../../hooks/useTheme'
import { useBackendHealth } from '../../hooks/useBackendHealth'
import SettingsPanel from '../ui/SettingsPanel'

const StatusDot: FC<{ status: 'checking' | 'online' | 'offline' }> = ({ status }) => (
  <span
    className={clsx(
      'inline-block w-2 h-2 rounded-full',
      status === 'online' && 'bg-green-500',
      status === 'offline' && 'bg-red-500',
      status === 'checking' && 'bg-yellow-400 animate-pulse'
    )}
    title={status === 'online' ? '后端已连接' : status === 'offline' ? '后端未连接' : '检测中...'}
  />
)

const Header: FC = () => {
  const { isDark, toggleTheme } = useTheme()
  const { status, check } = useBackendHealth()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <header className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-blue-500 font-bold text-lg">AgentScope</span>
          <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">AI 智能问答</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Backend status */}
          <button
            onClick={check}
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="点击重新检测后端"
          >
            <StatusDot status={status} />
            <span>
              {status === 'online' ? 'DeepSeek V4 Flash' : status === 'offline' ? '未连接' : '连接中...'}
            </span>
          </button>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
            title="设置"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
            title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}

export default Header
