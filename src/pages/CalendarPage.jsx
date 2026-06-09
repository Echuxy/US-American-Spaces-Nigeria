import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PILLARS } from '../lib/programmeData'

const PILLAR_COLORS = {
  'Education & Exchange': '#3b82f6',
  'English Language': '#8b5cf6',
  'Information & Media': '#f59e0b',
  'Arts & Culture': '#ec4899',
  'Alumni Engagement': '#14b8a6',
  'Democracy & Governance': '#B22234',
  'Speak with a Diplomat': '#3C3B6E',
  'Employability & Tech': '#16a34a',
}

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarPage() {
  const { profile, isAdmin, isPAO, isSpecialist, isCoordinator } = useAuth()
  const navigate = useNavigate()
  const canAdd = isAdmin || isPAO || isSpecialist || isCoordinator
  const canSeeAll = isAdmin || isPAO || isSpecialist || isCoordinator

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('month') // month | list
  const [filterSpace, setFilterSpace] = useState(canSeeAll ? '' : profile?.space_id ?? '')
  const [filterPillar, setFilterPillar] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

  // Add event form
  const [form, setForm] = useState({
    title: '', description: '', event_date: '', end_date: '',
    pillar: '', space_id: profile?.space_id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadData() }, [year, month])

  async function loadData() {
    setLoading(true)
    const { data: sp } = await supabase.from('american_spaces')
      .select('id,name,state').eq('active', true).order('name')
    setSpaces(sp ?? [])

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-31`

    let q = supabase.from('calendar_events')
      .select(`*, american_spaces(name,state), programme_proposals(composite_score, meets_threshold)`)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date')
    if (!canSeeAll) q = q.eq('space_id', profile?.space_id)
    const { data } = await q
    setEvents(data ?? [])
    setLoading(false)
  }

  async function addManualEvent() {
    setError('')
    if (!form.title.trim()) return setError('Event title is required.')
    if (!form.event_date) return setError('Event date is required.')
    const spaceId = canSeeAll ? form.space_id : profile?.space_id
    if (!spaceId) return setError('Please select a space.')
    setSaving(true)
    const { error: e } = await supabase.from('calendar_events').insert({
      space_id: spaceId,
      title: form.title,
      description: form.description,
      event_date: form.event_date,
      end_date: form.end_date || null,
      pillar: form.pillar || null,
      created_by: profile.id,
    })
    if (e) { setError(e.message); setSaving(false); return }
    setSuccess('✅ Event added to calendar.')
    setShowAddModal(false)
    setForm({ title: '', description: '', event_date: '', end_date: '', pillar: '', space_id: profile?.space_id ?? '' })
    await loadData()
    setSaving(false)
  }

  async function deleteEvent(id) {
    await supabase.from('calendar_events').delete().eq('id', id)
    setSelectedEvent(null)
    await loadData()
  }

  // ── Calendar grid logic ───────────────────────────────────
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const filteredEvents = events.filter(e => {
    if (filterSpace && e.space_id !== filterSpace) return false
    if (filterPillar && e.pillar !== filterPillar) return false
    return true
  })

  function eventsOnDay(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return filteredEvents.filter(e => e.event_date === dateStr)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div style={s.topbarCenter}>
          <h1 style={s.appTitle}>📅 Events Calendar</h1>
          <p style={s.appSub}>American Spaces Nigeria</p>
        </div>
        <div style={s.topbarRight}>
          <button style={{ ...s.viewBtn, ...(view === 'month' ? s.viewActive : {}) }}
            onClick={() => setView('month')}>📆 Month</button>
          <button style={{ ...s.viewBtn, ...(view === 'list' ? s.viewActive : {}) }}
            onClick={() => setView('list')}>📋 List</button>
          {canAdd && (
            <button style={s.addBtn} onClick={() => { setShowAddModal(true); setError('') }}>
              + Add Event
            </button>
          )}
          <button style={s.proposalBtn} onClick={() => navigate('/proposals')}>
            🎯 Proposals
          </button>
        </div>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* Filters + nav */}
        <div style={s.controlBar}>
          <div style={s.navRow}>
            <button style={s.navBtn} onClick={prevMonth}>‹</button>
            <h2 style={s.monthTitle}>{MONTHS[month]} {year}</h2>
            <button style={s.navBtn} onClick={nextMonth}>›</button>
          </div>
          <div style={s.filterRow}>
            {canSeeAll && (
              <select style={s.filterInput} value={filterSpace}
                onChange={e => setFilterSpace(e.target.value)}>
                <option value="">🌍 All Spaces</option>
                {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name.replace('American Corner ','').replace('American Center ','AC ')}</option>)}
              </select>
            )}
            <select style={s.filterInput} value={filterPillar}
              onChange={e => setFilterPillar(e.target.value)}>
              <option value="">All Pillars</option>
              {PILLARS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── MONTH VIEW ── */}
        {view === 'month' && (
          <div style={s.calCard}>
            {/* Day headers */}
            <div style={s.dayHeaders}>
              {DAYS.map(d => <div key={d} style={s.dayHeader}>{d}</div>)}
            </div>

            {/* Grid */}
            <div style={s.grid}>
              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} style={s.emptyCell} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayEvents = eventsOnDay(day)
                const todayCell = isToday(day)
                return (
                  <div key={day}
                    style={{
                      ...s.dayCell,
                      background: todayCell ? '#eef0ff' : '#fff',
                      border: todayCell ? '2px solid #3C3B6E' : '1px solid #f3f4f6',
                    }}
                    onClick={() => setSelectedDay(day)}>
                    <span style={{
                      ...s.dayNum,
                      background: todayCell ? '#3C3B6E' : 'transparent',
                      color: todayCell ? '#fff' : '#374151',
                    }}>{day}</span>
                    <div style={s.eventDots}>
                      {dayEvents.slice(0, 3).map(ev => (
                        <div key={ev.id}
                          style={{
                            ...s.eventDot,
                            background: PILLAR_COLORS[ev.pillar] ?? '#6b7280',
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev) }}
                          title={ev.title}>
                          <span style={s.dotText}>{ev.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span style={s.moreEvents}>+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={s.legend}>
              {Object.entries(PILLAR_COLORS).map(([pillar, color]) => (
                <div key={pillar} style={s.legendItem}>
                  <div style={{ ...s.legendDot, background: color }} />
                  <span style={s.legendLabel}>{pillar}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <div style={s.listCard}>
            {loading ? <p style={s.empty}>Loading...</p>
              : filteredEvents.length === 0
                ? <p style={s.empty}>No events this month.</p>
                : filteredEvents.map(ev => (
                  <div key={ev.id} style={s.listItem}
                    onClick={() => setSelectedEvent(ev)}>
                    <div style={{ ...s.listAccent, background: PILLAR_COLORS[ev.pillar] ?? '#6b7280' }} />
                    <div style={s.listBody}>
                      <div style={s.listHeader}>
                        <h4 style={s.listTitle}>{ev.title}</h4>
                        <span style={s.listDate}>{ev.event_date}{ev.end_date ? ` → ${ev.end_date}` : ''}</span>
                      </div>
                      <div style={s.listMeta}>
                        <span style={s.metaChip}>{ev.american_spaces?.name?.replace('American Corner ','').replace('American Center ','AC ')}</span>
                        {ev.pillar && <span style={{ ...s.metaChip, background: (PILLAR_COLORS[ev.pillar] ?? '#6b7280') + '18', color: PILLAR_COLORS[ev.pillar] ?? '#6b7280' }}>{ev.pillar}</span>}
                        {ev.programme_proposals?.meets_threshold && (
                          <span style={s.approvedTag}>✅ AI Approved</span>
                        )}
                      </div>
                      {ev.description && <p style={s.listDesc}>{ev.description}</p>}
                    </div>
                  </div>
                ))
            }
          </div>
        )}

        {/* Day detail panel */}
        {selectedDay && view === 'month' && (
          <div style={s.dayPanel}>
            <div style={s.dayPanelHeader}>
              <h3 style={s.dayPanelTitle}>
                {MONTHS[month]} {selectedDay}, {year}
              </h3>
              <button style={s.closeBtn} onClick={() => setSelectedDay(null)}>✕</button>
            </div>
            {eventsOnDay(selectedDay).length === 0
              ? <p style={s.empty}>No events on this day.</p>
              : eventsOnDay(selectedDay).map(ev => (
                <div key={ev.id} style={s.dayEventCard}
                  onClick={() => { setSelectedEvent(ev); setSelectedDay(null) }}>
                  <div style={{ ...s.listAccent, background: PILLAR_COLORS[ev.pillar] ?? '#6b7280' }} />
                  <div>
                    <p style={s.dayEventTitle}>{ev.title}</p>
                    <p style={s.dayEventSpace}>{ev.american_spaces?.name}</p>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* ── EVENT DETAIL MODAL ── */}
      {selectedEvent && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '480px' }}>
            <div style={{ ...s.modalHeader, background: PILLAR_COLORS[selectedEvent.pillar] ?? '#1a1f3a' }}>
              <h3 style={s.modalTitle}>{selectedEvent.title}</h3>
              <button style={s.closeModalBtn} onClick={() => setSelectedEvent(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.detailGrid}>
                <Detail label="Space" value={selectedEvent.american_spaces?.name} />
                <Detail label="Date" value={selectedEvent.event_date + (selectedEvent.end_date ? ` → ${selectedEvent.end_date}` : '')} />
                {selectedEvent.pillar && <Detail label="Pillar" value={selectedEvent.pillar} />}
                {selectedEvent.programme_proposals?.composite_score > 0 && (
                  <Detail label="AI Score" value={`${selectedEvent.programme_proposals.composite_score}/100`} />
                )}
              </div>
              {selectedEvent.description && (
                <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: '12px 0 0' }}>
                  {selectedEvent.description}
                </p>
              )}
              {selectedEvent.programme_proposals?.meets_threshold && (
                <div style={s.aiTag}>✅ AI-reviewed and approved (≥75 composite score)</div>
              )}
              <div style={s.modalActions}>
                {selectedEvent.proposal_id && (
                  <button style={s.viewProposalBtn}
                    onClick={() => { setSelectedEvent(null); navigate('/proposals') }}>
                    🎯 View Proposal
                  </button>
                )}
                {canAdd && (
                  <button style={s.deleteEventBtn} onClick={() => deleteEvent(selectedEvent.id)}>
                    🗑️ Remove Event
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD EVENT MODAL ── */}
      {showAddModal && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '480px' }}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>+ Add Calendar Event</h3>
              <button style={s.closeModalBtn} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {error && <div style={s.errorBox}>{error}</div>}
              <Field label="Event Title *">
                <input style={s.input} value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Independence Day Celebration" />
              </Field>
              {canSeeAll && (
                <Field label="Space *">
                  <select style={s.input} value={form.space_id}
                    onChange={e => setForm(f => ({ ...f, space_id: e.target.value }))}>
                    <option value="">— Select Space —</option>
                    {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                  </select>
                </Field>
              )}
              <div style={s.row}>
                <Field label="Start Date *">
                  <input style={s.input} type="date" value={form.event_date}
                    onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
                </Field>
                <Field label="End Date">
                  <input style={s.input} type="date" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </Field>
              </div>
              <Field label="Programming Pillar">
                <select style={s.input} value={form.pillar}
                  onChange={e => setForm(f => ({ ...f, pillar: e.target.value }))}>
                  <option value="">— Select Pillar —</option>
                  {PILLARS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Description">
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional details..." />
              </Field>
              <button style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }}
                onClick={addManualEvent} disabled={saving}>
                {saving ? 'Saving...' : '✅ Add to Calendar'}
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

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" },
  topbar: { background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '12px', height: '64px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  topbarCenter: { flex: 1 },
  appTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' },
  appSub: { margin: 0, fontSize: '11px', color: '#93a4d4' },
  topbarRight: { display: 'flex', gap: '8px', alignItems: 'center' },
  viewBtn: { padding: '7px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' },
  viewActive: { background: 'rgba(255,255,255,0.25)', fontWeight: 700 },
  addBtn: { padding: '7px 14px', background: '#B22234', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  proposalBtn: { padding: '7px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' },
  body: { padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  controlBar: { background: '#fff', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  navRow: { display: 'flex', alignItems: 'center', gap: '16px' },
  navBtn: { width: '36px', height: '36px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  monthTitle: { margin: 0, fontSize: '20px', fontWeight: 800, color: '#1a1f3a', minWidth: '200px', textAlign: 'center' },
  filterRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  filterInput: { padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontFamily: "'Segoe UI', sans-serif" },
  calCard: { background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  dayHeaders: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#1a1f3a' },
  dayHeader: { padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#93a4d4' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#f3f4f6' },
  emptyCell: { background: '#f9fafb', minHeight: '100px' },
  dayCell: { minHeight: '100px', padding: '6px', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', flexDirection: 'column', gap: '3px' },
  dayNum: { width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, marginBottom: '2px' },
  eventDots: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 },
  eventDot: { borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', overflow: 'hidden' },
  dotText: { fontSize: '11px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' },
  moreEvents: { fontSize: '10px', color: '#6b7280', fontWeight: 600 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '12px 16px', borderTop: '1px solid #f3f4f6', background: '#f9fafb' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  legendDot: { width: '10px', height: '10px', borderRadius: '50%' },
  legendLabel: { fontSize: '11px', color: '#6b7280' },
  listCard: { background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  listItem: { display: 'flex', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.15s' },
  listAccent: { width: '4px', flexShrink: 0 },
  listBody: { padding: '14px 16px', flex: 1 },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' },
  listTitle: { margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827' },
  listDate: { fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' },
  listMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' },
  metaChip: { fontSize: '11px', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '20px' },
  approvedTag: { fontSize: '11px', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 },
  listDesc: { fontSize: '12px', color: '#9ca3af', margin: 0 },
  dayPanel: { background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  dayPanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  dayPanelTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#1a1f3a' },
  closeBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280' },
  dayEventCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f9fafb', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' },
  dayEventTitle: { margin: 0, fontSize: '13px', fontWeight: 700, color: '#111827' },
  dayEventSpace: { margin: '2px 0 0', fontSize: '11px', color: '#6b7280' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHeader: { background: '#1a1f3a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, color: '#fff', fontSize: '15px', fontWeight: 700, flex: 1, paddingRight: '10px' },
  closeModalBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '20px', overflowY: 'auto' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '8px' },
  aiTag: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, marginTop: '12px' },
  modalActions: { display: 'flex', gap: '10px', marginTop: '16px' },
  viewProposalBtn: { flex: 1, padding: '10px', background: '#eef0ff', color: '#3C3B6E', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  deleteEventBtn: { padding: '10px 16px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', sans-serif" },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #B22234, #3C3B6E)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  empty: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
}