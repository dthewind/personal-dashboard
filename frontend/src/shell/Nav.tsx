import { NavLink } from 'react-router-dom'

const modules = [
  { path: '/budget', label: 'Budget' },
  { path: '/investing', label: 'Investing' },
  { path: '/collab', label: 'Collab' },
  { path: '/workout', label: 'Workout' },
]

export default function Nav() {
  return (
    <nav className="flex gap-1 border-b border-gray-800 px-4 py-2">
      {modules.map(({ path, label }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isActive
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
