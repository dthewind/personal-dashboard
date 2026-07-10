import { Outlet, useLocation } from 'react-router-dom'
import Nav from './Nav'
import ErrorBoundary from './ErrorBoundary'

export default function Layout() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <main className="px-4 pt-0 pb-4">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
