import { FC, useState } from 'react'
import { useSettingStore } from '../../store/settingStore'
import { checkHealth } from '../../api/chat'

interface SettingsPanelProps {
  onClose: () => void
}

const SettingsPanel: FC<SettingsPanelProps> = ({ onClose }) => {
  const { apiBaseUrl, userId, setApiBaseUrl, setUserId } = useSettingStore()
  const [urlDraft, setUrlDraft] = useState(apiBaseUrl)
  const [userIdDraft, setUserIdDraft] = useState(userId)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const handleTest = async () => {
    setTestStatus('testing')
    const ok = await checkHealth(urlDraft.replace(/\/$/, ''))
    setTestStatus(ok ? 'ok' : 'fail')
  }

  const handleSave = () => {
    setApiBaseUrl(urlDraft.replace(/\/$/, ''))
    setUserId(userIdDraft.trim() || 'user-001')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">设置</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Backend URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              后端地址
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => { setUrlDraft(e.target.value); setTestStatus('idle') }}
                placeholder="http://localhost:8080"
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleTest}
                disabled={testStatus === 'testing'}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {testStatus === 'testing' ? '检测中...' : '连通测试'}
              </button>
            </div>
            {testStatus === 'ok' && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">连接成功</p>
            )}
            {testStatus === 'fail' && (
              <p className="mt-1 text-xs text-red-500">连接失败，请检查后端是否已启动</p>
            )}
          </div>

          {/* User ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              用户 ID
              <span className="ml-1 text-xs text-gray-400 font-normal">（用于隔离多用户会话）</span>
            </label>
            <input
              type="text"
              value={userIdDraft}
              onChange={(e) => setUserIdDraft(e.target.value)}
              placeholder="user-001"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Info */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-2.5 text-xs text-blue-600 dark:text-blue-400">
            <p className="font-medium mb-0.5">AgentScope Java 后端</p>
            <p className="text-blue-500 dark:text-blue-500">
              使用 ReActAgent + JsonFileAgentStateStore，支持多会话隔离与状态持久化。
              确保 AgentScope_java 项目已在本地启动（默认端口 8080）。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
