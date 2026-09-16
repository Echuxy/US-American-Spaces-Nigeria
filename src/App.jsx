import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { summitSupabase } from './lib/summitSupabase'

// Core pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Summit2026 from './pages/Summit2026'
import SummitControlRoom from './pages/SummitControlRoom'
import SummitRegistration from './pages/SummitRegistration'
import SummitCoordinatorLogin from './pages/SummitCoordinatorLogin'

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

const SUMMIT_COORDINATOR_EMAIL = 'amcenterlagosinfo@gmail.com'

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
  if (!['space_director', 'admin'].includes(profile?.role)) return <Navigate to="/dashboard" replace />
  return children
}

function ReviewerOnly({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!['admin', 'pao', 'specialist', 'coordinator'].includes(profile?.role)) return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function SummitCoordinatorGate() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (!summitSupabase) { setLoading(false); return undefined }
    const checkSession = session => {
      const email = session?.user?.email || ''
      const allowed = email.toLowerCase() === SUMMIT_COORDINATOR_EMAIL.toLowerCase()
      setAuthorized(allowed)
      setLoading(false)
      if (!allowed) navigate('/summit-2026/control-room/login', { replace: true })
    }
    summitSupabase.auth.getSession().then(({ data }) => checkSession(data.session))
    const { data: listener } = summitSupabase.auth.onAuthStateChange((_event, session) => checkSession(session))
    return () => listener.subscription.unsubscribe()
  }, [navigate])

  if (loading) return <Spinner />
  if (!summitSupabase || !authorized) return null
  return <SummitControlRoom />
}

function Spinner() {
  return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1a1f3a,#2d3561)', fontFamily:"'Segoe UI',sans-serif" }}><div style={{ textAlign:'center', color:'#fff' }}><div style={{ width:'40px',height:'40px',border:'3px solid rgba(255,255,255,.2)',borderTop:'3px solid #fff',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px' }}/><p style={{ margin:0,fontSize:14,color:'#93a4d4' }}>Loading...</p></div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
}

function ExistingApplicationRoutes() {
  return <AuthProvider><Routes>
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/report/new" element={<ProtectedRoute><DirectorOnly><ReportForm /></DirectorOnly></ProtectedRoute>} />
    <Route path="/report/:id" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
    <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
    <Route path="/reconciliation" element={<ProtectedRoute><ReconciliationPage /></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute><AdminOnly><AdminUsersPage /></AdminOnly></ProtectedRoute>} />
    <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
    <Route path="/proposals" element={<ProtectedRoute><ProgrammeProposalsPage /></ProtectedRoute>} />
    <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
    <Route path="/eod-notes" element={<ProtectedRoute><EODNotesPage /></ProtectedRoute>} />
    <Route path="/analytics" element={<ProtectedRoute><ReviewerOnly><AnalyticsPage /></ReviewerOnly></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></AuthProvider>
}

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/summit-2026/register" element={<SummitRegistration />} />
    <Route path="/summit-2026" element={<Summit2026 />} />
    <Route path="/summit-2026/control-room/login" element={<SummitCoordinatorLogin />} />
    <Route path="/summit-2026/control-room" element={<SummitCoordinatorGate />} />
    <Route path="*" element={<ExistingApplicationRoutes />} />
  </Routes></BrowserRouter>
}
