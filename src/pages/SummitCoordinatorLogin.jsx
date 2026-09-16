import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { summitSupabase } from '../lib/summitSupabase'

const COORDINATOR_EMAIL = 'amcenterlagosinfo@gmail.com'

export default function SummitCoordinatorLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(COORDINATOR_EMAIL)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sessionEmail, setSessionEmail] = useState('')

  useEffect(() => {
    let mounted = true
    if (!summitSupabase) { setLoading(false); setError('Summit backend configuration is missing.'); return () => { mounted = false } }
    summitSupabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const currentEmail = data.session?.user?.email || ''
      setSessionEmail(currentEmail); setLoading(false)
      if (currentEmail && currentEmail.toLowerCase() === COORDINATOR_EMAIL.toLowerCase()) navigate('/summit-2026/control-room', { replace: true })
    })
    return () => { mounted = false }
  }, [navigate])

  if (loading) return <div className="summit-login"><div className="login-card">Checking Summit coordinator session…</div></div>
  if (sessionEmail && sessionEmail.toLowerCase() !== COORDINATOR_EMAIL.toLowerCase()) return <div className="summit-login"><div className="login-card"><div className="eyebrow">SUMMIT OF AMERICAN SPACES IN NIGERIA 2026</div><h1>Coordinator Access</h1><p>This account is signed in to the Summit backend but is not authorized for the Control Room.</p><button className="primary" onClick={async () => { await summitSupabase?.auth.signOut(); setSessionEmail('') }}>Sign out</button></div></div>

  const signIn = async event => {
    event.preventDefault(); setError(''); setSubmitting(true)
    if (!summitSupabase) { setError('Summit backend configuration is missing.'); setSubmitting(false); return }
    const { data, error: signInError } = await summitSupabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) { setError(signInError.message); setSubmitting(false); return }
    const signedInEmail = data.user?.email || ''
    if (signedInEmail.toLowerCase() !== COORDINATOR_EMAIL.toLowerCase()) { await summitSupabase.auth.signOut(); setError('This account is not authorized for the Summit Control Room.'); setSubmitting(false); return }
    navigate('/summit-2026/control-room', { replace: true })
  }

  return <div className="summit-login"><style>{`.summit-login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#071d35,#123f6d);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#172337}.login-card{width:min(440px,100%);box-sizing:border-box;background:#fff;border-radius:18px;padding:32px;box-shadow:0 22px 60px rgba(0,0,0,.25)}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.1em;color:#315c87}.login-card h1{margin:8px 0 7px;font-size:28px;color:#123b68}.login-card p{font-size:13px;line-height:1.55;color:#65758a}.field{display:block;margin-top:18px;font-size:11px;font-weight:700;color:#41536a}.field input{width:100%;box-sizing:border-box;margin-top:7px;border:1px solid #ccd7e3;border-radius:9px;padding:11px;font:inherit;font-size:13px}.primary{margin-top:20px;width:100%;border:0;border-radius:9px;padding:12px;background:#173b68;color:#fff;font-weight:700;cursor:pointer}.primary:disabled{opacity:.6;cursor:wait}.error{margin-top:14px;padding:10px;border-radius:9px;background:#fff1f1;border:1px solid #e6bcbc;color:#8c3030;font-size:12px;line-height:1.45}.hint{margin-top:18px;padding:11px;border-radius:9px;background:#f4f7fa;color:#66788d;font-size:11px;line-height:1.5}`}</style><div className="login-card"><div className="eyebrow">SUMMIT OF AMERICAN SPACES IN NIGERIA 2026</div><h1>Coordinator Access</h1><p>Sign in to the dedicated Summit Control Room. This is separate from the existing American Spaces activity-reporting login.</p><form onSubmit={signIn}><label className="field">Coordinator email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label className="field">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label><button className="primary" disabled={submitting}>{submitting?'Signing in…':'Sign in to Control Room'}</button></form>{error&&<div className="error">{error}</div>}<div className="hint">Authorized coordinator identity: <strong>{COORDINATOR_EMAIL}</strong>. Do not share the password in chat.</div></div></div>
}
