import { useState, useEffect, useCallback } from 'react'
import { checkHealth } from '../api/chat'
import { useSettingStore } from '../store/settingStore'

export type BackendStatus = 'checking' | 'online' | 'offline'

export function useBackendHealth() {
  const { apiBaseUrl } = useSettingStore()
  const [status, setStatus] = useState<BackendStatus>('checking')

  const check = useCallback(async () => {
    setStatus('checking')
    const ok = await checkHealth(apiBaseUrl)
    setStatus(ok ? 'online' : 'offline')
  }, [apiBaseUrl])

  // check on mount and every 30 seconds
  useEffect(() => {
    check()
    const timer = setInterval(check, 30000)
    return () => clearInterval(timer)
  }, [check])

  return { status, check }
}
