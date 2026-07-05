import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './shell/Layout'
import BudgetModule from './modules/budget'
import InvestingModule from './modules/investing'
import CollabModule from './modules/collab'
import WorkoutModule from './modules/workout'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/budget" replace />} />
        <Route path="budget/*" element={<BudgetModule />} />
        <Route path="investing/*" element={<InvestingModule />} />
        <Route path="collab/*" element={<CollabModule />} />
        <Route path="workout/*" element={<WorkoutModule />} />
      </Route>
    </Routes>
  )
}
