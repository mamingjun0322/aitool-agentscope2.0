import { FC, useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'

const ErrorToast: FC = () => {
  const error = useChatStore((s) => s.error)
  const setError = useChatStore((s) => s.setError)

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error, setError])

  if (!error) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5 shadow-lg text-sm z-50">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
      <button onClick={() => setError(null)} className="ml-1 hover:text-red-800 dark:hover:text-red-200">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default ErrorToast
