import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const EMPTY_FORM = {
  title: '', body: '', target_space_id: '', is_pinned: false, expires_at: '',
}

export default function AnnouncementsPage() {
  const { profile, isAdmin, isSpecialist, isPAO, isCoordinator } = useAuth()
  const navigate = useNavigate()
  const canApprove = isAdmin || isSpecialist
  const canPost = true // all roles can post

  const [announcements, setAnnouncements] = useState([])
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState('approved') // approved | pending

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: sp } = await supabase.from('american_spaces')
      .select('id,name').eq('active', true).order('name')
    setSpaces(sp ?? [])

    const { data } = await supabase.from('announcements')
      .select(`*, profiles!posted_by(full_name, role), american_spaces(name)`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setAnnouncements(data ?? [])
    setLoading(false)
  }

  async function handlePost() {
    setError('')
    if (!form.title.trim()) return setError('Title is required.')
    if (!form.body.trim()) return setError('Message body is required.')
    setSaving(true)
    const { error: e } = await supabase.from('announcements').insert({
      title: form.title,
      body: form.body,
      posted_by: profile.id,
      target_space_id: form.target_space_id || null,
      is_pinned: form.is_pinned,
      expires_at: form.expires_at || null,
      status: canApprove ? 'approved' : 'pending',
      approved_by: canApprove ? profile.id : null,
    })
    if (e) { setError(e.message); setSaving(false); return }
    setSuccess(canApprove
      ? '✅ Announcement posted and published.'
      : '📨 Announcement submitted for approval.')
    setShowForm(false)
    setForm(EMPTY_FORM)
    await loadData()
    setSaving(false)
  }

  async function handleApprove(ann, approve) {
    await supabase.from('announcements').update({
      status: approve ? 'approved' : 'rejected',
      approved_by: profile.id,
    }).eq('id', ann.id)
    setSuccess(approve ? '✅ Announcement approved and published.' : '🚫 Announcement rejected.')
    await loadData()
  }

  async function handlePin(ann) {
    await supabase.from('announcements').update({ is_pinned: !ann.is_pinned }).eq('id', ann.id)
    await loadData()
  }

  async function handleDelete(id) {
    await supabase.from('announcements').delete().eq('id', id)
    await loadData()
  }

  const approved = announcements.filter(a => a.status === 'approved')
  const pending = announcements.filter(a => a.status === 'pending')
  const displayed = tab === 'approved' ? approved : pending

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div style={s.topbarCenter}>
          <h1 style={s.appTitle}>📢 Announcements & Notice Board</h1>
          <p style={s.appSub}>American Spaces Nigeria</p>
        </div>
        <button style={s.addBtn} onClick={() => { setShowForm(true); setError('') }}>
          + Post Announcement
        </button>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* Tabs */}
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(tab === 'approved' ? s.tabActive : {}) }}
            onClick={() => setTab('approved')}>
            📣 Published ({approved.length})
          </button>
          {canApprove && (
            <button style={{ ...s.tab, ...(tab === 'pending' ? s.tabActive : {}) }}
              onClick={() => setTab('pending')}>
              ⏳ Pending Approval ({pending.length})
              {pending.length > 0 && <span style={s.badge}>{pending.length}</span>}
            </button>
          )}
        </div>

        {/* Announcement cards */}
        {loading ? <p style={s.empty}>Loading...</p>
          : displayed.length === 0
            ? <p style={s.empty}>{tab === 'approved' ? 'No announcements yet.' : 'No pending announcements.'}</p>
            : (
              <div style={s.cardList}>
                {displayed.map(ann => (
                  <div key={ann.id} style={{
                    ...s.annCard,
                    borderLeft: ann.is_pinned ? '4px solid #B22234' : '4px solid #e5e7eb',
                  }}>
                    <div style={s.annHeader}>
                      <div style={s.annTitleRow}>
                        {ann.is_pinned && <span style={s.pinTag}>📌 Pinned</span>}
                        {ann.target_space_id
                          ? <span style={s.spaceTag}>📍 {ann.american_spaces?.name?.replace('American Corner ', '')}</span>
                          : <span style={s.allSpacesTag}>🌍 All Spaces</span>}
                        <h3 style={s.annTitle}>{ann.title}</h3>
                      </div>
                      <div style={s.annMeta}>
                        <span style={s.metaText}>By {ann.profiles?.full_name}</span>
                        <span style={s.metaDot}>·</span>
                        <span style={s.metaText}>
                          {new Date(ann.created_at).toLocaleDateString('en-NG', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                        {ann.expires_at && (
                          <>
                            <span style={s.metaDot}>·</span>
                            <span style={{ ...s.metaText, color: '#d97706' }}>
                              Expires {new Date(ann.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <p style={s.annBody}>{ann.body}</p>

                    <div style={s.annActions}>
                      {tab === 'pending' && canApprove && (
                        <>
                          <button style={s.approveBtn} onClick={() => handleApprove(ann, true)}>
                            ✅ Approve & Publish
                          </button>
                          <button style={s.rejectBtn} onClick={() => handleApprove(ann, false)}>
                            ✕ Reject
                          </button>
                        </>
                      )}
                      {tab === 'approved' && canApprove && (
                        <button style={s.pinBtn} onClick={() => handlePin(ann)}>
                          {ann.is_pinned ? '📌 Unpin' : '📌 Pin'}
                        </button>
                      )}
                      {(isAdmin || ann.posted_by === profile?.id) && (
                        <button style={s.deleteBtn} onClick={() => handleDelete(ann.id)}>
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>

      {/* Post Announcement Modal */}
      {showForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>📢 New Announcement</h3>
              <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {error && <div style={s.errorBox}>{error}</div>}
              {!canApprove && (
                <div style={s.noteBox}>
                  ℹ️ Your announcement will be submitted for Admin/Specialist approval before publishing.
                </div>
              )}
              <Field label="Title *">
                <input style={s.input} value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Announcement title" />
              </Field>
              <Field label="Message *">
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={5}
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write your announcement here..." />
              </Field>
              <Field label="Target Audience">
                <select style={s.input} value={form.target_space_id}
                  onChange={e => setForm(f => ({ ...f, target_space_id: e.target.value }))}>
                  <option value="">🌍 All Spaces</option>
                  {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </Field>
              <Field label="Expiry Date (optional)">
                <input style={s.input} type="date" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </Field>
              {canApprove && (
                <label style={s.checkRow}>
                  <input type="checkbox" checked={form.is_pinned}
                    onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} />
                  <span style={{ fontSize: '13px', color: '#374151' }}>📌 Pin this announcement to the top</span>
                </label>
              )}
              <button style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }}
                onClick={handlePost} disabled={saving}>
                {saving ? 'Posting...' : canApprove ? '📣 Publish Now' : '📨 Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" },
  topbar: { background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '16px', height: '64px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  topbarCenter: { flex: 1 },
  appTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' },
  appSub: { margin: 0, fontSize: '11px', color: '#93a4d4' },
  addBtn: { padding: '8px 16px', background: '#B22234', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  body: { padding: '24px', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  tabs: { display: 'flex', gap: '8px', background: '#fff', padding: '8px', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  tab: { flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#6b7280', position: 'relative' },
  tabActive: { background: '#1a1f3a', color: '#fff' },
  badge: { position: 'absolute', top: '6px', right: '6px', background: '#B22234', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px' },
  cardList: { display: 'flex', flexDirection: 'column', gap: '14px' },
  annCard: { background: '#fff', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  annHeader: { marginBottom: '10px' },
  annTitleRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  annTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827', flex: 1 },
  pinTag: { fontSize: '11px', background: '#fef2f2', color: '#B22234', padding: '3px 8px', borderRadius: '20px', fontWeight: 700 },
  spaceTag: { fontSize: '11px', background: '#eef0ff', color: '#3C3B6E', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 },
  allSpacesTag: { fontSize: '11px', background: '#f0fdf4', color: '#16a34a', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 },
  annMeta: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: '12px', color: '#6b7280' },
  metaDot: { fontSize: '12px', color: '#d1d5db' },
  annBody: { fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: '0 0 14px', whiteSpace: 'pre-wrap' },
  annActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  approveBtn: { padding: '7px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  rejectBtn: { padding: '7px 14px', background: '#fff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  pinBtn: { padding: '7px 14px', background: '#fff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  deleteBtn: { padding: '7px 14px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHeader: { background: '#1a1f3a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, color: '#fff', fontSize: '16px', fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '20px', overflowY: 'auto' },
  noteBox: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400e', marginBottom: '14px' },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', sans-serif" },
  checkRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', cursor: 'pointer' },
  submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #B22234, #3C3B6E)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  empty: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
}