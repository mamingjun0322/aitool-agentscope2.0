import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface SettingStore {
  theme: Theme
  apiBaseUrl: string
  userId: string
  setTheme: (theme: Theme) => void
  setApiBaseUrl: (url: string) => void
  setUserId: (id: string) => void
}

export const useSettingStore = create<SettingStore>()(
  persist(
    (set) => ({
      theme: 'system',
      apiBaseUrl: 'http://localhost:8088',
      userId: 'user-001',
      setTheme: (theme) => set({ theme }),
      setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
      setUserId: (id) => set({ userId: id }),
    }),
    {
      name: 'agentscope-settings',
      version: 1,
      // 迁移：将旧的 8080 端口自动升级为 8088
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Partial<SettingStore>
        if (version < 1 && state.apiBaseUrl === 'http://localhost:8080') {
          state.apiBaseUrl = 'http://localhost:8088'
        }
        return state as SettingStore
      },
    }
  )
)
