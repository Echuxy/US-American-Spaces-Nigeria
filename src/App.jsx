import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Core pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// Reports
import ReportForm from './pages/ReportForm'
import ReviewPage from './pages/ReviewPage'

// Inventory
import InventoryPage from './pages/InventoryPage'
import ReconciliationPage from './pages/ReconciliationPage'

// Modules
import AdminUsersPage from './pages/AdminUsersPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import ProgrammeProposalsPage from './pages/ProgrammeProposalsPage'
import CalendarPage from './pages/CalendarPage'
import EODNotesPage from './pages/EODNotesPage'
import AnalyticsPage from './pages/AnalyticsPage'

// ── Route guards ──────────────────────────────────────────────

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminOnly({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function DirectorOnly({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!['space_director', 'admin'].includes(profile?.role))
    return <Navigate to="/dashboard" replace />
  return children
}

function ReviewerOnly({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!['admin', 'pao', 'specialist', 'coordinator'].includes(profile?.role))
    return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function Spinner() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1f3a, #2d3561)',
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(255,255,255,0.2)',
          borderTop: '3px solid #fff', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ margin: 0, fontSize: '14px', color: '#93a4d4' }}>Loading...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Activity Reports */}
          <Route path="/report/new" element={
            <ProtectedRoute><DirectorOnly><ReportForm /></DirectorOnly></ProtectedRoute>
          } />
          <Route path="/report/:id" element={
            <ProtectedRoute><ReviewPage /></ProtectedRoute>
          } />

          {/* Inventory */}
          <Route path="/inventory" element={
            <ProtectedRoute><InventoryPage /></ProtectedRoute>
          } />
          <Route path="/reconciliation" element={
            <ProtectedRoute><ReconciliationPage /></ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin/users" element={
            <ProtectedRoute><AdminOnly><AdminUsersPage /></AdminOnly></ProtectedRoute>
          } />

          {/* Announcements */}
          <Route path="/announcements" element={
            <ProtectedRoute><AnnouncementsPage /></ProtectedRoute>
          } />

          {/* Programme Proposals & Calendar */}
          <Route path="/proposals" element={
            <ProtectedRoute><ProgrammeProposalsPage /></ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute><CalendarPage /></ProtectedRoute>
          } />

          {/* EOD Notes */}
          <Route path="/eod-notes" element={
            <ProtectedRoute><EODNotesPage /></ProtectedRoute>
          } />

          {/* Analytics */}
          <Route path="/analytics" element={
            <ProtectedRoute><ReviewerOnly><AnalyticsPage /></ReviewerOnly></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}