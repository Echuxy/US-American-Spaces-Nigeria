import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [tab, setTab] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!fullName.trim()) return setError('Please enter your full name.')
    if (!email.trim()) return setError('Please enter your email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    })

    if (signUpErr) { setError(signUpErr.message); setLoading(false); return }

    // Update profile with full name
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        email: email,
        role: 'space_director', // default role, admin assigns later
      })
    }

    setSuccess('✅ Account created successfully! You can now log in. Your role will be assigned by the Admin shortly.')
    setTab('login')
    setPassword('')
    setConfirmPassword('')
    setLoading(false)
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.flagBar}>
            <div style={{ background: '#B22234', flex: 1 }} />
            <div style={{ background: '#fff', flex: 1 }} />
            <div style={{ background: '#3C3B6E', flex: 1 }} />
          </div>
          <h1 style={s.title}>🇺🇸 American Spaces Nigeria</h1>
          <p style={s.subtitle}>Activity Reporting Platform</p>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button style={{ ...s.tabBtn, ...(tab === 'login' ? s.tabActive : {}) }}
            onClick={() => { setTab('login'); setError(''); setSuccess('') }}>
            Sign In
          </button>
          <button style={{ ...s.tabBtn, ...(tab === 'signup' ? s.tabActive : {}) }}
            onClick={() => { setTab('signup'); setError(''); setSuccess('') }}>
            Create Account
          </button>
        </div>

        {/* Forms */}
        <div style={s.form}>
          {error && <div style={s.errorBox}>{error}</div>}
          {success && <div style={s.successBox}>{success}</div>}

          {/* LOGIN FORM */}
          {tab === 'login' && (
            <>
              <label style={s.label}>Email Address</label>
              <input style={s.input} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" />

              <label style={s.label}>Password</label>
              <input style={s.input} type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" />

              <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
                onClick={handleLogin} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <p style={s.noteText}>
                Don't have an account? Click <strong>Create Account</strong> above to register.
              </p>
            </>
          )}

          {/* SIGN UP FORM */}
          {tab === 'signup' && (
            <>
              <label style={s.label}>Full Name *</label>
              <input style={s.input} type="text" value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Amaka Okafor" />

              <label style={s.label}>Email Address *</label>
              <input style={s.input} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" />

              <label style={s.label}>Password *</label>
              <input style={s.input} type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters" />

              <label style={s.label}>Confirm Password *</label>
              <input style={s.input} type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password" />

              <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
                onClick={handleSignUp} disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <div style={s.noteBox}>
                ℹ️ After registering, your account will be reviewed and a role assigned by the Admin before you can access the platform fully.
              </div>
            </>
          )}
        </div>

        <p style={s.footer}>
          U.S. Embassy & Consulates in Nigeria · Public Diplomacy Section
        </p>
      </div>
    </div>
  )
}

const s = {
  wrapper: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1f3a 0%, #2d3561 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: '#fff', borderRadius: '16px',
    width: '100%', maxWidth: '420px',
    overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: '#1a1f3a', padding: '32px 24px 24px', textAlign: 'center',
  },
  flagBar: {
    display: 'flex', height: '6px', borderRadius: '3px',
    overflow: 'hidden', marginBottom: '20px',
  },
  title: { color: '#fff', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' },
  subtitle: { color: '#93a4d4', fontSize: '13px', margin: 0 },
  tabs: {
    display: 'flex', borderBottom: '2px solid #f3f4f6',
  },
  tabBtn: {
    flex: 1, padding: '14px', background: 'transparent',
    border: 'none', cursor: 'pointer', fontSize: '14px',
    fontWeight: 600, color: '#6b7280', transition: 'all 0.2s',
  },
  tabActive: {
    color: '#1a1f3a', borderBottom: '2px solid #B22234',
    marginBottom: '-2px', background: '#f8faff',
  },
  form: {
    padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  label: { fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '-4px' },
  input: {
    padding: '11px 14px', border: '1.5px solid #d1d5db',
    borderRadius: '8px', fontSize: '14px', outline: 'none',
    fontFamily: "'Segoe UI', sans-serif",
  },
  btn: {
    marginTop: '6px', padding: '13px',
    background: 'linear-gradient(135deg, #B22234, #3C3B6E)',
    color: '#fff', border: 'none', borderRadius: '8px',
    fontSize: '15px', fontWeight: 700, cursor: 'pointer',
  },
  noteText: { fontSize: '12px', color: '#6b7280', textAlign: 'center', margin: 0 },
  noteBox: {
    background: '#fffbeb', border: '1px solid #fcd34d',
    borderRadius: '8px', padding: '10px 12px',
    fontSize: '12px', color: '#92400e',
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fca5a5',
    color: '#dc2626', padding: '10px 12px', borderRadius: '6px', fontSize: '13px',
  },
  successBox: {
    background: '#f0fdf4', border: '1px solid #86efac',
    color: '#16a34a', padding: '10px 12px', borderRadius: '6px', fontSize: '13px',
  },
  footer: {
    textAlign: 'center', fontSize: '11px', color: '#9ca3af', padding: '0 24px 20px',
  },
}