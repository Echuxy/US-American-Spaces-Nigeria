import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { summitSupabase } from './lib/summitSupabase'
import './summit-cinematic.css'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Summit2026 from './pages/Summit2026'
import SummitPortal from './pages/SummitPortal'
import SummitLanding from './pages/SummitLanding'
import SummitControlRoom from './pages/SummitControlRoom'
import SummitLiveScreen from './pages/SummitLiveScreen'
import SummitRegistration from './pages/SummitRegistration'
import SummitCoordinatorLogin from './pages/SummitCoordinatorLogin'
import SummitContentManager from './pages/SummitContentManager'
import SummitCoordinatorWorkspace from './pages/SummitCoordinatorWorkspace'
import SummitParticipantManager from './components/SummitParticipantManager'
import ReportForm from './pages/ReportForm'
import ReviewPage from './pages/ReviewPage'
import InventoryPage from './pages/InventoryPage'
import ReconciliationPage from './pages/ReconciliationPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import ProgrammeProposalsPage from './pages/ProgrammeProposalsPage'
import CalendarPage from './pages/CalendarPage'
import EODNotesPage from './pages/EODNotesPage'
import AnalyticsPage from './pages/AnalyticsPage'
const SUMMIT_COORDINATOR_EMAIL='amcenterlagosinfo@gmail.com'
function ProtectedRoute({children}){const {user,loading}=useAuth();if(loading)return <Spinner/>;if(!user)return <Navigate to="/login" replace/>;return children}
function AdminOnly({children}){const {profile,loading}=useAuth();if(loading)return <Spinner/>;if(profile?.role!=='admin')return <Navigate to="/dashboard" replace/>;return children}
function DirectorOnly({children}){const {profile,loading}=useAuth();if(loading)return <Spinner/>;if(!['space_director','admin'].includes(profile?.role))return <Navigate to="/dashboard" replace/>;return children}
function ReviewerOnly({children}){const {profile,loading}=useAuth();if(loading)return <Spinner/>;if(!['admin','pao','specialist','coordinator'].includes(profile?.role))return <Navigate to="/dashboard" replace/>;return children}
function PublicRoute({children}){const {user,loading}=useAuth();if(loading)return <Spinner/>;if(user)return <Navigate to="/dashboard" replace/>;return children}
function SummitGate({Component}){const navigate=useNavigate();const [loading,setLoading]=useState(true);const [authorized,setAuthorized]=useState(false);useEffect(()=>{if(!summitSupabase){setLoading(false);return}const check=session=>{const email=session?.user?.email||'';const ok=email.toLowerCase()===SUMMIT_COORDINATOR_EMAIL.toLowerCase();setAuthorized(ok);setLoading(false);if(!ok)navigate('/summit-2026/control-room/login',{replace:true})};summitSupabase.auth.getSession().then(({data})=>check(data.session));const {data:listener}=summitSupabase.auth.onAuthStateChange((_event,session)=>check(session));return()=>listener.subscription.unsubscribe()},[navigate]);if(loading)return <Spinner/>;if(!summitSupabase||!authorized)return null;return <Component/>}
function Spinner(){return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#07111d',color:'#f5f1e8'}}>Loading Summit…</div>}
function ExistingApplicationRoutes(){return <AuthProvider><Routes><Route path="/login" element={<PublicRoute><Login/></PublicRoute>}/><Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/><Route path="/report/new" element={<ProtectedRoute><DirectorOnly><ReportForm/></DirectorOnly></ProtectedRoute>}/><Route path="/report/:id" element={<ProtectedRoute><ReviewPage/></ProtectedRoute>}/><Route path="/inventory" element={<ProtectedRoute><InventoryPage/></ProtectedRoute>}/><Route path="/reconciliation" element={<ProtectedRoute><ReconciliationPage/></ProtectedRoute>}/><Route path="/admin/users" element={<ProtectedRoute><AdminOnly><AdminUsersPage/></ProtectedRoute>}/><Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage/></ProtectedRoute>}/><Route path="/proposals" element={<ProtectedRoute><ProgrammeProposalsPage/></ProtectedRoute>}/><Route path="/calendar" element={<ProtectedRoute><CalendarPage/></Route>}/><Route path="/eod-notes" element={<ProtectedRoute><EODNotesPage/></ProtectedRoute>}/><Route path="/analytics" element={<ProtectedRoute><ReviewerOnly><AnalyticsPage/></ReviewerOnly></ProtectedRoute>}/><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes></AuthProvider>}
function SummitRoutes(){return <Routes><Route path="/summit-2026/register" element={<SummitRegistration/>}/><Route path="/summit-2026" element={<SummitLanding/>}/><Route path="/summit-2026/participant" element={<SummitPortal/>}/><Route path="/summit-2026/live" element={<SummitLiveScreen/>}/><Route path="/summit-2026/legacy" element={<Summit2026/>}/><Route path="/summit-2026/control-room/login" element={<SummitCoordinatorLogin/>}/><Route path="/summit-2026/coordinator" element={<SummitGate Component={SummitCoordinatorWorkspace}/>}/><Route path="/summit-2026/control-room/content" element={<SummitGate Component={SummitContentManager}/>}/><Route path="/summit-2026/control-room/participants" element={<SummitGate Component={SummitParticipantManager}/>}/><Route path="/summit-2026/control-room" element={<SummitGate Component={SummitControlRoom}/>}/><Route path="/american-spaces-nigeria" element={<Navigate to="/summit-2026" replace/>}/><Route path="*" element={<ExistingApplicationRoutes/>}/></Routes>}
export default function App(){return <BrowserRouter><SummitRoutes/></BrowserRouter>}