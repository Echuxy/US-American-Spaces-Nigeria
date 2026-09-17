import { useMemo, useState } from 'react'
import { getSummitDeviceId, summitBackendEnabled, summitSupabase } from '../lib/summitSupabase'

const STORAGE_NAME = 'summit2026-name'
const STORAGE_ANONYMOUS = 'summit2026-anonymous'

export default function SummitRegistration() {
  const [name, setName] = useState(() => localStorage.getItem(STORAGE_NAME) || '')
  const [anonymous, setAnonymous] = useState(() => localStorage.getItem(STORAGE_ANONYMOUS) === 'true')
  const [registered, setRegistered] = useState(false)
  const [backendMessage, setBackendMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const summitUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/summit-2026'
    return `${window.location.origin}/summit-2026`
  }, [])

  const qrUrl = useMemo(() => `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(summitUrl)}`, [summitUrl])

  const register = async (event) => {
    event.preventDefault()
    const value = name.trim()
    if (!value || saving) return

    setSaving(true)
    setBackendMessage('')
    localStorage.setItem(STORAGE_NAME, value)
    localStorage.setItem(STORAGE_ANONYMOUS, String(anonymous))

    if (summitSupabase) {
      const deviceId = getSummitDeviceId()
      const { error } = await summitSupabase.from('participants').upsert({
        display_name: value,
        anonymous_parking: anonymous,
        device_id: deviceId,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'device_id' })
      if (error) {
        console.error('Summit participant registration failed', error)
        setBackendMessage('Registration is saved on this device. Live backend registration will retry when the Summit backend is available.')
      } else {
        setBackendMessage('Registration is saved to the Summit backend for live event operations.')
      }
    } else {
      setBackendMessage('Registration is saved on this device. Live cross-device sync will activate when the Summit backend settings are added.')
    }

    setRegistered(true)
    setSaving(false)
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7fb', fontFamily: 'Inter,system-ui,sans-serif', padding: 'clamp(18px,5vw,48px) 14px' }}>
      <section style={{ maxWidth: 860, margin: '0 auto', background: '#fff', border: '1px solid #dce3ec', borderRadius: 18, padding: 'clamp(20px,4vw,32px)', boxShadow: '0 12px 40px rgba(23,59,104,.08)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#718096' }}>U.S. DIPLOMATIC MISSION NIGERIA • PUBLIC DIPLOMACY SECTION</div>
          <a href="/summit-2026" style={{ display:'inline-flex', alignItems:'center', textDecoration:'none', border:'1px solid #d2dce8', borderRadius:8, padding:'8px 11px', color:'#173b68', background:'#f7f9fc', fontSize:11, fontWeight:800 }}>⌂ Summit Home</a>
        </div>
        <h1 style={{ color: '#173b68', lineHeight: 1.1, marginBottom: 8 }}>Summit of American Spaces in Nigeria 2026</h1>
        <p style={{ color: '#526277', lineHeight: 1.55, marginTop: 0 }}>Participant access • September 21–23, 2026 • Black Diamond Suites, Victoria Island, Lagos</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(190px,240px)', gap: 28, alignItems: 'start' }}>
          <div>
            {registered ? (
              <div>
                <div style={{ padding: 14, borderRadius: 10, background: '#eef6ef', color: '#245a32', marginBottom: 14 }}>Registration saved for <strong>{name.trim()}</strong>.</div>
                <p style={{ color: '#526277', lineHeight: 1.5 }}>{backendMessage}</p>
                <a href="/summit-2026" style={{ display: 'inline-block', background: '#173b68', color: '#fff', padding: '11px 15px', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>Enter Summit</a>
              </div>
            ) : (
              <form onSubmit={register}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#526277', marginBottom: 6 }}>Display name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d5dde7', borderRadius: 9, padding: 11, fontSize: 14, marginBottom: 12 }} />
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#526277', marginBottom: 16 }}><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Allow anonymous Parking Lot posts</label>
                <button type="submit" disabled={saving} style={{ border: 0, background: saving ? '#7d8ea5' : '#173b68', color: '#fff', borderRadius: 9, padding: '11px 16px', cursor: saving ? 'wait' : 'pointer', fontWeight: 700 }}>{saving ? 'Saving…' : 'Register & Continue'}</button>
              </form>
            )}
          </div>

          <aside style={{ textAlign: 'center', border: '1px solid #e1e7ef', borderRadius: 14, padding: 14, background: '#fafbfd' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#526277', marginBottom: 8 }}>SUMMIT ACCESS QR</div>
            <img src={qrUrl} alt="QR code for the Summit participant page" width="210" height="210" style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto', background: '#fff' }} />
            <div style={{ marginTop: 10, fontSize: 10, lineHeight: 1.4, color: '#718096', wordBreak: 'break-all' }}>{summitUrl}</div>
          </aside>
        </div>

        <div style={{ marginTop: 24, padding: 14, borderRadius: 10, background: '#f0f5fb', color: '#40546d', fontSize: 12, lineHeight: 1.55 }}>
          <strong>Backend status:</strong> {summitBackendEnabled ? 'Summit backend configuration detected.' : 'Summit backend configuration is not yet present in this deployment.'} Participant registration remains usable in either mode.
        </div>
      </section>
      <style>{`@media(max-width:620px){section>div:nth-of-type(1){grid-template-columns:1fr!important}aside{max-width:280px;margin:0 auto;width:100%;box-sizing:border-box}}`}</style>
    </main>
  )
}
