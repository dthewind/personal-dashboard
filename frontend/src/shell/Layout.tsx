import { Outlet } from 'react-router-dom'
import Nav from './Nav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}
