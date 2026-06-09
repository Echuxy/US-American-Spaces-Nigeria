import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TODAY = new Date().toISOString().split('T')[0]

const EMPTY_FORM = {
  highlights: '',
  challenges: '',
  follow_ups: '',
  visitor_count: '',
}

export default function EODNotesPage() {
  const { profile, isAdmin, isPAO, isSpecialist, isCoordinator } = useAuth()
  const navigate = useNavigate()
  const canViewAll = isAdmin || isPAO || isSpecialist || isCoordinator
  const isDirector = profile?.role === 'space_director'

  const [notes, setNotes] = useState([])
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [todayNote, setTodayNote] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedNote, setSelectedNote] = useState(null)

  // Filters
  const [filterSpace, setFilterSpace] = useState(canViewAll ? '' : profile?.space_id ?? '')
  const [filterDate, setFilterDate] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: sp } = await supabase.from('american_spaces')
      .select('id,name,state').eq('active', true).order('name')
    setSpaces(sp ?? [])

    let q = supabase.from('eod_notes')
      .select(`*, american_spaces(name,state), profiles!submitted_by(full_name)`)
      .order('note_date', { ascending: false })
    if (!canViewAll) q = q.eq('space_id', profile?.space_id)
    const { data } = await q
    setNotes(data ?? [])

    // Check if today's note exists for this director
    if (isDirector && profile?.space_id) {
      const existing = (data ?? []).find(n =>
        n.space_id === profile.space_id && n.note_date === TODAY
      )
      if (existing) {
        setTodayNote(existing)
        setForm({
          highlights: existing.highlights ?? '',
          challenges: existing.challenges ?? '',
          follow_ups: existing.follow_ups ?? '',
          visitor_count: existing.visitor_count ?? '',
        })
      } else {
        setTodayNote(null)
        setForm(EMPTY_FORM)
      }
    }
    setLoading(false)
  }

  async function saveNote() {
    setError('')
    if (!form.highlights.trim()) return setError('Highlights are required.')
    setSaving(true)

    const payload = {
      space_id: profile.space_id,
      submitted_by: profile.id,
      note_date: TODAY,
      highlights: form.highlights,
      challenges: form.challenges,
      follow_ups: form.follow_ups,
      visitor_count: parseInt(form.visitor_count) || 0,
    }

    let err
    if (todayNote) {
      // Update existing
      const { error: e } = await supabase.from('eod_notes')
        .update(payload).eq('id', todayNote.id)
      err = e
    } else {
      // Insert new
      const { error: e } = await supabase.from('eod_notes').insert(payload)
      err = e
    }

    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(todayNote ? '✅ End-of-day note updated.' : '✅ End-of-day note saved successfully.')
    await loadData()
    setSaving(false)
  }

  const filtered = notes.filter(n => {
    if (filterSpace && n.space_id !== filterSpace) return false
    if (filterDate && n.note_date !== filterDate) return false
    if (search && !n.highlights?.toLowerCase().includes(search.toLowerCase()) &&
        !n.american_spaces?.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Stats
  const thisMonth = notes.filter(n => n.note_date?.startsWith(TODAY.slice(0, 7)))
  const totalVisitors = filtered.reduce((s, n) => s + (n.visitor_count ?? 0), 0)
  const spacesWithNotes = new Set(thisMonth.map(n => n.space_id)).size

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div style={s.topbarCenter}>
          <h1 style={s.appTitle}>📓 End-of-Day Notes</h1>
          <p style={s.appSub}>American Spaces Nigeria</p>
        </div>
        <span style={s.dateBadge}>📅 {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        <div style={s.layout}>

          {/* LEFT — Today's note form (directors) or stats (reviewers) */}
          <div style={s.left}>

            {/* Director: today's entry form */}
            {isDirector && (
              <div style={s.formCard}>
                <div style={s.formCardHeader}>
                  <h3 style={s.formCardTitle}>
                    {todayNote ? '✏️ Update Today\'s Note' : '📝 Today\'s End-of-Day Note'}
                  </h3>
                  {todayNote && <span style={s.savedBadge}>✅ Saved</span>}
                </div>

                <Field label="Highlights of the Day *">
                  <textarea style={{ ...s.input, resize: 'vertical' }} rows={4}
                    placeholder="What happened today? Key activities, visitors, achievements..."
                    value={form.highlights}
                    onChange={e => setForm(f => ({ ...f, highlights: e.target.value }))} />
                </Field>

                <Field label="Challenges Encountered">
                  <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                    placeholder="Any difficulties, issues, or problems faced today..."
                    value={form.challenges}
                    onChange={e => setForm(f => ({ ...f, challenges: e.target.value }))} />
                </Field>

                <Field label="Follow-up Actions">
                  <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                    placeholder="Tasks to follow up on tomorrow or upcoming week..."
                    value={form.follow_ups}
                    onChange={e => setForm(f => ({ ...f, follow_ups: e.target.value }))} />
                </Field>

                <Field label="Visitor / Patron Count">
                  <input style={s.input} type="number" min="0"
                    placeholder="Number of visitors/patrons today"
                    value={form.visitor_count}
                    onChange={e => setForm(f => ({ ...f, visitor_count: e.target.value }))} />
                </Field>

                <button style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}
                  onClick={saveNote} disabled={saving}>
                  {saving ? 'Saving...' : todayNote ? '✅ Update Note' : '💾 Save Note'}
                </button>
              </div>
            )}

            {/* Stats card */}
            <div style={s.statsCard}>
              <h3 style={s.statsTitle}>📊 This Month's Summary</h3>
              <div style={s.statsGrid}>
                <StatItem icon="📓" label="Notes Filed" value={thisMonth.length} color="#3C3B6E" />
                <StatItem icon="🏢" label="Spaces Active" value={spacesWithNotes} color="#B22234" />
                <StatItem icon="👥" label="Total Visitors" value={totalVisitors.toLocaleString()} color="#0369a1" />
                <StatItem icon="📅" label="Filtered Notes" value={filtered.length} color="#16a34a" />
              </div>
            </div>
          </div>

          {/* RIGHT — Notes list */}
          <div style={s.right}>
            {/* Filters */}
            <div style={s.filterCard}>
              <div style={s.filterRow}>
                <input style={s.filterInput} placeholder="🔍 Search highlights..."
                  value={search} onChange={e => setSearch(e.target.value)} />
                {canViewAll && (
                  <select style={s.filterInput} value={filterSpace}
                    onChange={e => setFilterSpace(e.target.value)}>
                    <option value="">All Spaces</option>
                    {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name.replace('American Corner ','').replace('American Center ','AC ')}</option>)}
                  </select>
                )}
                <input style={s.filterInput} type="date" value={filterDate}
                  onChange={e => setFilterDate(e.target.value)} />
                {(filterSpace || filterDate || search) && (
                  <button style={s.clearBtn}
                    onClick={() => { setFilterSpace(canViewAll ? '' : profile?.space_id ?? ''); setFilterDate(''); setSearch('') }}>
                    ✕ Clear
                  </button>
                )}
              </div>
              <p style={s.resultCount}>{filtered.length} note{filtered.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Notes list */}
            {loading ? <p style={s.empty}>Loading notes...</p>
              : filtered.length === 0
                ? <p style={s.empty}>No notes found.</p>
                : (
                  <div style={s.notesList}>
                    {filtered.map(note => (
                      <div key={note.id} style={{
                        ...s.noteCard,
                        borderLeft: note.note_date === TODAY ? '4px solid #B22234' : '4px solid #e5e7eb',
                      }}
                        onClick={() => setSelectedNote(note)}>
                        <div style={s.noteHeader}>
                          <div>
                            <div style={s.noteDateRow}>
                              <span style={s.noteDate}>
                                {new Date(note.note_date + 'T00:00:00').toLocaleDateString('en-NG', {
                                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                })}
                              </span>
                              {note.note_date === TODAY && <span style={s.todayTag}>Today</span>}
                            </div>
                            {canViewAll && (
                              <p style={s.noteSpace}>{note.american_spaces?.name}</p>
                            )}
                          </div>
                          <div style={s.noteStats}>
                            {note.visitor_count > 0 && (
                              <span style={s.visitorChip}>👥 {note.visitor_count}</span>
                            )}
                          </div>
                        </div>

                        <p style={s.noteHighlight}>
                          {note.highlights?.slice(0, 140)}{(note.highlights?.length ?? 0) > 140 ? '...' : ''}
                        </p>

                        <div style={s.noteFooter}>
                          <span style={s.noteAuthor}>By {note.profiles?.full_name}</span>
                          <div style={s.noteIndicators}>
                            {note.challenges && <span style={s.indTag} title="Has challenges">⚠️</span>}
                            {note.follow_ups && <span style={s.indTag} title="Has follow-ups">🔔</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        </div>
      </div>

      {/* ── NOTE DETAIL MODAL ── */}
      {selectedNote && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '560px' }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>
                  {new Date(selectedNote.note_date + 'T00:00:00').toLocaleDateString('en-NG', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </h3>
                <p style={s.modalSub}>{selectedNote.american_spaces?.name} · {selectedNote.profiles?.full_name}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setSelectedNote(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {selectedNote.visitor_count > 0 && (
                <div style={s.visitorBox}>
                  👥 <strong>{selectedNote.visitor_count}</strong> visitor{selectedNote.visitor_count !== 1 ? 's' : ''} today
                </div>
              )}

              <Section title="✨ Highlights">
                <p style={s.noteText}>{selectedNote.highlights}</p>
              </Section>

              {selectedNote.challenges && (
                <Section title="⚠️ Challenges Encountered">
                  <p style={s.noteText}>{selectedNote.challenges}</p>
                </Section>
              )}

              {selectedNote.follow_ups && (
                <Section title="🔔 Follow-up Actions">
                  <p style={s.noteText}>{selectedNote.follow_ups}</p>
                </Section>
              )}

              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '16px 0 0' }}>
                Last updated: {new Date(selectedNote.updated_at).toLocaleString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

function StatItem({ icon, label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px', background: color + '10', borderRadius: '10px' }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#6b7280' }}>{label}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</p>
      {children}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" },
  topbar: { background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '16px', height: '64px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  topbarCenter: { flex: 1 },
  appTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' },
  appSub: { margin: 0, fontSize: '11px', color: '#93a4d4' },
  dateBadge: { fontSize: '12px', color: '#93a4d4', whiteSpace: 'nowrap' },
  body: { padding: '24px', maxWidth: '1200px', margin: '0 auto' },
  layout: { display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' },
  left: { display: 'flex', flexDirection: 'column', gap: '16px' },
  right: { display: 'flex', flexDirection: 'column', gap: '14px' },
  formCard: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  formCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  formCardTitle: { margin: 0, fontSize: '15px', fontWeight: 700, color: '#1a1f3a' },
  savedBadge: { fontSize: '11px', background: '#f0fdf4', color: '#16a34a', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 },
  saveBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  statsCard: { background: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  statsTitle: { margin: '0 0 14px', fontSize: '14px', fontWeight: 700, color: '#1a1f3a' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  filterCard: { background: '#fff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' },
  filterInput: { padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '13px', flex: '1 1 140px', fontFamily: "'Segoe UI', sans-serif" },
  clearBtn: { padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  resultCount: { fontSize: '12px', color: '#6b7280', margin: '8px 0 0' },
  notesList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  noteCard: { background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  noteHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  noteDateRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  noteDate: { fontSize: '13px', fontWeight: 700, color: '#111827' },
  todayTag: { fontSize: '10px', background: '#fef2f2', color: '#B22234', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 },
  noteSpace: { margin: '3px 0 0', fontSize: '12px', color: '#6b7280' },
  noteStats: { display: 'flex', gap: '6px' },
  visitorChip: { fontSize: '12px', background: '#eef0ff', color: '#3C3B6E', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 },
  noteHighlight: { fontSize: '13px', color: '#374151', lineHeight: 1.6, margin: '0 0 10px' },
  noteFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  noteAuthor: { fontSize: '11px', color: '#9ca3af' },
  noteIndicators: { display: 'flex', gap: '4px' },
  indTag: { fontSize: '14px', cursor: 'default' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHeader: { background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { margin: 0, color: '#fff', fontSize: '16px', fontWeight: 700 },
  modalSub: { margin: '4px 0 0', color: '#93a4d4', fontSize: '12px' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '20px', overflowY: 'auto' },
  visitorBox: { background: '#eef0ff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#3C3B6E', marginBottom: '16px' },
  noteText: { fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', sans-serif" },
  empty: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
}