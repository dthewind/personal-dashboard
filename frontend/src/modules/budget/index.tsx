import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import QuickAdd from './pages/QuickAdd'
import Transactions from './pages/Transactions'
import Bills from './pages/Bills'
import Trends from './pages/Trends'
import IncomePage from './pages/Income'
import OutlookPage from './pages/Outlook'
import ImportPage from './pages/Import'
import LookupPage from './pages/Lookup'

const TABS = [
  { to: '/budget/dashboard', label: 'Dashboard' },
  { to: '/budget/add', label: 'Quick Add' },
  { to: '/budget/transactions', label: 'Transactions' },
  { to: '/budget/bills', label: 'Bills' },
  { to: '/budget/income', label: 'Income' },
  { to: '/budget/outlook', label: 'Outlook' },
  { to: '/budget/trends', label: 'Trends' },
  { to: '/budget/import', label: 'Import', desktopOnly: true },
  { to: '/budget/lookup', label: 'Lookup', desktopOnly: true },
]

export default function BudgetModule() {
  return (
    <div className="text-left">
      <nav className="flex gap-1 mb-1 border-b border-gray-800 pb-1 -mx-4 px-4 mt-1 overflow-x-auto">
        {TABS.map(({ to, label, desktopOnly }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              } ${desktopOnly ? 'hidden sm:inline-flex' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="add" element={<QuickAdd />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="bills" element={<Bills />} />
        <Route path="income" element={<IncomePage />} />
        <Route path="outlook" element={<OutlookPage />} />
        <Route path="trends" element={<Trends />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="lookup" element={<LookupPage />} />
      </Routes>
    </div>
  )
}
