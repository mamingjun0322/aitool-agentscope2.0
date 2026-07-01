import { FC, ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

const Layout: FC<LayoutProps> = ({ children }) => (
  <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <Header />
    <div className="flex flex-1 min-h-0">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  </div>
)

export default Layout
