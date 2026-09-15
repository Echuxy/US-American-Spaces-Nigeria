import { useState } from 'react'

export default function SummitRegistration() {
  const [name, setName] = useState(() => localStorage.getItem('summit2026-name') || '')
  const [registered, setRegistered] = useState(false)

  const register = (event) => {
    event.preventDefault()
    const value = name.trim()
    if (!value) return
    localStorage.setItem('summit2026-name', value)
    setRegistered(true)
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7fb', fontFamily: 'Inter,system-ui,sans-serif', padding: '32px 18px' }}>
      <section style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid #dce3ec', borderRadius: 18, padding: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#718096' }}>SUMMIT OF AMERICAN SPACES IN NIGERIA 2026</div>
        <h1 style={{ color: '#173b68', lineHeight: 1.1 }}>Participant Registration</h1>
        <p style={{ color: '#526277', lineHeight: 1.55 }}>Scan the Summit QR code to open this page on your device, enter your display name, and continue to the interactive programme.</p>
        {registered ? (
          <div>
            <div style={{ padding: 14, borderRadius: 10, background: '#eef6ef', color: '#245a32', marginBottom: 14 }}>Registration saved for <strong>{name.trim()}</strong>.</div>
            <a href="/summit-2026" style={{ display: 'inline-block', background: '#173b68', color: '#fff', padding: '11px 15px', borderRadius: 8, textDecoration: 'none' }}>Enter Summit</a>
          </div>
        ) : (
          <form onSubmit={register}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#526277', marginBottom: 6 }}>Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d5dde7', borderRadius: 9, padding: 11, fontSize: 14, marginBottom: 12 }} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#526277', marginBottom: 16 }}><input type="checkbox" /> Allow anonymous Parking Lot posts</label>
            <button type="submit" style={{ border: 0, background: '#173b68', color: '#fff', borderRadius: 9, padding: '11px 16px', cursor: 'pointer', fontWeight: 700 }}>Register & Continue</button>
          </form>
        )}
      </section>
    </main>
  )
}
