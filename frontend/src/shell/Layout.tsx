import { Outlet } from 'react-router-dom'
import Nav from './Nav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <main className="px-4 pt-0 pb-4">
        <Outlet />
      </main>
    </div>
  )
}
