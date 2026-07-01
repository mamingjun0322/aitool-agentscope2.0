import { FC } from 'react'
import Layout from './components/layout/Layout'
import MessageList from './components/chat/MessageList'
import ChatInput from './components/input/ChatInput'
import ErrorToast from './components/ui/ErrorToast'
import { useTheme } from './hooks/useTheme'

const App: FC = () => {
  useTheme()

  return (
    <Layout>
      <MessageList />
      <ChatInput />
      <ErrorToast />
    </Layout>
  )
}

export default App
