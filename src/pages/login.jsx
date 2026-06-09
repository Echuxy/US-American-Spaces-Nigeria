import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.flagBar}>
            <div style={{ background: '#B22234', flex: 1 }} />
            <div style={{ background: '#fff', flex: 1 }} />
            <div style={{ background: '#3C3B6E', flex: 1 }} />
          </div>
          <h1 style={styles.title}>🇺🇸 American Spaces Nigeria</h1>
          <p style={styles.subtitle}>Activity Reporting Platform</p>
        </div>

        {/* Form */}
        <div style={styles.form}>
          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <p style={styles.footer}>
          U.S. Embassy & Consulates in Nigeria · Public Diplomacy Section
        </p>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1f3a 0%, #2d3561 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '420px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: '#1a1f3a',
    padding: '32px 24px 24px',
    textAlign: 'center',
  },
  flagBar: {
    display: 'flex',
    height: '6px',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  title: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: 700,
    margin: '0 0 6px',
  },
  subtitle: {
    color: '#93a4d4',
    fontSize: '13px',
    margin: 0,
  },
  form: {
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '-6px',
  },
  input: {
    padding: '11px 14px',
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border 0.2s',
  },
  btn: {
    marginTop: '8px',
    padding: '13px',
    background: 'linear-gradient(135deg, #B22234, #3C3B6E)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.3px',
  },
  error: {
    color: '#dc2626',
    fontSize: '13px',
    background: '#fef2f2',
    padding: '10px 12px',
    borderRadius: '6px',
    margin: 0,
  },
  footer: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#9ca3af',
    padding: '0 24px 20px',
  },
}