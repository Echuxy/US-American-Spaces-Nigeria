import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { REPORT_STATUSES, PILLARS, STRATEGIC_PRIORITIES } from '../lib/programmeData'

export default function Dashboard() {
  const { profile, canReview, isAdmin, isPAO, isSpecialist, isCoordinator, signOut } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterSpace, setFilterSpace] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPillar, setFilterPillar] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: sp } = await supabase
      .from('american_spaces')
      .select('id, name, state')
      .eq('active', true)
      .order('name')
    setSpaces(sp ?? [])

    let q = supabase
      .from('reports')
      .select(`id, programme_title, activity_date, status, pillar,
        programme_category, strategic_priorities, attendance,
        amount_spent, created_at,
        american_spaces(name, state),
        profiles!submitted_by(full_name)`)
      .order('activity_date', { ascending: false })

    // Space directors only see their own space
    if (profile?.role === 'space_director' && profile?.space_id) {
      q = q.eq('space_id', profile.space_id)
    }

    const { data } = await q
    setReports(data ?? [])
    setLoading(false)
  }

  // ── Filtered reports ──────────────────────────────────────
  const filtered = reports.filter(r => {
    if (filterSpace && r.american_spaces?.name !== filterSpace) return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterPillar && r.pillar !== filterPillar) return false
    if (filterPriority && !(r.strategic_priorities ?? []).includes(filterPriority)) return false
    if (filterDateFrom && r.activity_date < filterDateFrom) return false
    if (filterDateTo && r.activity_date > filterDateTo) return false
    if (search && !r.programme_title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ── Stats ─────────────────────────────────────────────────
  const totalReports = filtered.length
  const totalAttendance = filtered.reduce((a, r) => a + (r.attendance ?? 0), 0)
  const totalSpent = filtered.reduce((a, r) => a + (Number(r.amount_spent) ?? 0), 0)
  const pendingReview = filtered.filter(r =>
    (profile?.role === 'coordinator' && r.status === 'submitted') ||
    (profile?.role === 'specialist' && r.status === 'coordinator_reviewed') ||
    ((profile?.role === 'pao' || profile?.role === 'admin') && r.status === 'specialist_reviewed')
  ).length
  const approved = filtered.filter(r => r.status === 'approved').length

  // ── Pillar breakdown ──────────────────────────────────────
  const pillarCounts = PILLARS.map(p => ({
    label: p.label,
    count: filtered.filter(r => r.pillar === p.label).length,
  })).filter(p => p.count > 0).sort((a, b) => b.count - a.count)

  const maxPillar = Math.max(...pillarCounts.map(p => p.count), 1)

  // ── Priority breakdown ────────────────────────────────────
  const priorityCounts = STRATEGIC_PRIORITIES.map(p => ({
    label: p,
    short: p.replace('Making America ', '').replace('Celebrating American ', 'American '),
    count: filtered.filter(r => (r.strategic_priorities ?? []).includes(p)).length,
  }))

  function clearFilters() {
    setFilterSpace(''); setFilterStatus(''); setFilterPillar('')
    setFilterPriority(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch('')
  }

  const isFiltered = filterSpace || filterStatus || filterPillar ||
    filterPriority || filterDateFrom || filterDateTo || search

  return (
    <div style={s.page}>

      {/* ── TOPBAR ── */}
      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <div style={s.flagStripe} />
          <div>
            <h1 style={s.appTitle}>🇺🇸 American Spaces Nigeria</h1>
            <p style={s.appSub}>Activity Reporting Platform</p>
          </div>
        </div>
        <div style={s.topbarRight}>
          <span style={s.userBadge}>
            {profile?.full_name} · <em>{profile?.role?.replace('_', ' ')}</em>
          </span>
          {(profile?.role === 'space_director' || profile?.role === 'admin') && (
            <button style={s.newReportBtn} onClick={() => navigate('/report/new')}>
              + New Report
            </button>
          )}
          <button style={s.navBtn} onClick={() => navigate('/inventory')}>📦 Inventory</button>
          <button style={s.navBtn} onClick={() => navigate('/proposals')}>🎯 Proposals</button>
          <button style={s.navBtn} onClick={() => navigate('/calendar')}>📅 Calendar</button>
          <button style={s.navBtn} onClick={() => navigate('/announcements')}>📢 Notices</button>
          <button style={s.navBtn} onClick={() => navigate('/eod-notes')}>📓 EOD Notes</button>
          {(profile?.role === 'admin' || profile?.role === 'pao' || profile?.role === 'specialist' || profile?.role === 'coordinator') && (
            <button style={s.navBtn} onClick={() => navigate('/analytics')}>📊 Analytics</button>
          )}
          {profile?.role === 'admin' && (
            <button style={s.navBtn} onClick={() => navigate('/admin/users')}>👥 Users</button>
          )}
          <button style={s.signOutBtn} onClick={signOut}>Sign Out</button>
        </div>
      </div>

      <div style={s.body}>

        {/* ── STAT CARDS ── */}
        <div style={s.statGrid}>
          <StatCard icon="📋" label="Total Reports" value={totalReports} color="#3C3B6E" />
          <StatCard icon="👥" label="Total Attendance" value={totalAttendance.toLocaleString()} color="#B22234" />
          <StatCard icon="💰" label="Amount Spent" value={`₦${totalSpent.toLocaleString()}`} color="#0369a1" />
          <StatCard icon="✅" label="PAO Approved" value={approved} color="#16a34a" />
          {canReview && (
            <StatCard icon="⏳" label="Awaiting Your Review" value={pendingReview}
              color={pendingReview > 0 ? '#d97706' : '#6b7280'} />
          )}
        </div>

        {/* ── CHARTS ROW ── */}
        <div style={s.chartsRow}>

          {/* Pillar bar chart */}
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Reports by Programming Pillar</h3>
            {pillarCounts.length === 0
              ? <p style={s.empty}>No data yet.</p>
              : pillarCounts.map(p => (
                <div key={p.label} style={s.barRow}>
                  <span style={s.barLabel}>{p.label}</span>
                  <div style={s.barTrack}>
                    <div style={{
                      ...s.barFill,
                      width: `${(p.count / maxPillar) * 100}%`,
                      background: 'linear-gradient(90deg, #3C3B6E, #B22234)',
                    }} />
                  </div>
                  <span style={s.barCount}>{p.count}</span>
                </div>
              ))
            }
          </div>

          {/* Priority breakdown */}
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Strategic Priority Alignment</h3>
            {priorityCounts.map((p, i) => {
              const colors = ['#B22234', '#3C3B6E', '#0369a1', '#16a34a']
              return (
                <div key={p.label} style={s.priorityRow}>
                  <div style={{ ...s.priorityDot, background: colors[i] }} />
                  <span style={s.priorityRowLabel}>{p.short}</span>
                  <span style={{ ...s.priorityCount, background: colors[i] + '22', color: colors[i] }}>
                    {p.count}
                  </span>
                </div>
              )
            })}
          </div>

        </div>

        {/* ── FILTERS ── */}
        <div style={s.filterCard}>
          <div style={s.filterRow}>
            <input style={s.filterInput} placeholder="🔍 Search by title..."
              value={search} onChange={e => setSearch(e.target.value)} />

            {(isAdmin || isPAO || isSpecialist || isCoordinator) && (
              <select style={s.filterInput} value={filterSpace}
                onChange={e => setFilterSpace(e.target.value)}>
                <option value="">All Spaces</option>
                {spaces.map(sp => (
                  <option key={sp.id} value={sp.name}>{sp.name}</option>
                ))}
              </select>
            )}

            <select style={s.filterInput} value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(REPORT_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select style={s.filterInput} value={filterPillar}
              onChange={e => setFilterPillar(e.target.value)}>
              <option value="">All Pillars</option>
              {PILLARS.map(p => (
                <option key={p.id} value={p.label}>{p.label}</option>
              ))}
            </select>

            <select style={s.filterInput} value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}>
              <option value="">All Priorities</option>
              {STRATEGIC_PRIORITIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div style={s.filterRow2}>
            <label style={s.dateLabel}>From</label>
            <input style={s.filterInput} type="date" value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)} />
            <label style={s.dateLabel}>To</label>
            <input style={s.filterInput} type="date" value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)} />
            {isFiltered && (
              <button style={s.clearBtn} onClick={clearFilters}>✕ Clear Filters</button>
            )}
            <span style={s.resultCount}>{filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* ── REPORT TABLE ── */}
        <div style={s.tableCard}>
          {loading ? (
            <p style={s.empty}>Loading reports...</p>
          ) : filtered.length === 0 ? (
            <p style={s.empty}>No reports found. {isFiltered && 'Try clearing the filters.'}</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Date', 'Space', 'Programme Title', 'Pillar', 'Attendance', 'Amount (₦)', 'Status', 'Action'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const st = REPORT_STATUSES[r.status]
                    const isPending =
                      (profile?.role === 'coordinator' && r.status === 'submitted') ||
                      (profile?.role === 'specialist' && r.status === 'coordinator_reviewed') ||
                      ((profile?.role === 'pao' || profile?.role === 'admin') && r.status === 'specialist_reviewed')
                    return (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={s.td}>{r.activity_date}</td>
                        <td style={s.td}>{r.american_spaces?.name?.replace('American Corner ', '')?.replace('American Center ', 'AC ')}</td>
                        <td style={{ ...s.td, maxWidth: '200px' }}>
                          <span style={s.titleCell}>{r.programme_title}</span>
                        </td>
                        <td style={s.td}>
                          <span style={s.pillarTag}>{r.pillar}</span>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>{r.attendance}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          {Number(r.amount_spent).toLocaleString()}
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.statusBadge, background: st?.color }}>
                            {st?.label}
                          </span>
                        </td>
                        <td style={s.td}>
                          <button
                            style={{ ...s.viewBtn, ...(isPending ? s.viewBtnUrgent : {}) }}
                            onClick={() => navigate(`/report/${r.id}`)}>
                            {isPending ? '👁 Review' : 'View'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function StatCard({ icon, label, value, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statIcon, background: color + '18' }}>{icon}</div>
      <div>
        <p style={s.statValue}>{value}</p>
        <p style={s.statLabel}>{label}</p>
      </div>
      <div style={{ ...s.statAccent, background: color }} />
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" },
  topbar: {
    background: 'linear-gradient(135deg, #1a1f3a, #2d3561)',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
  },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  flagStripe: {
    width: '6px', height: '36px', borderRadius: '3px',
    background: 'linear-gradient(180deg, #B22234 33%, #fff 33%, #fff 66%, #3C3B6E 66%)',
  },
  appTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' },
  appSub: { margin: 0, fontSize: '11px', color: '#93a4d4' },
  topbarRight: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  userBadge: { fontSize: '12px', color: '#93a4d4' },
  newReportBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #B22234, #8b1c2a)',
    color: '#fff', border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },
  navBtn: {
    padding: '7px 12px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  signOutBtn: {
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
  },
  body: { padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },

  // Stat cards
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' },
  statCard: {
    background: '#fff', borderRadius: '12px', padding: '18px',
    display: 'flex', alignItems: 'center', gap: '14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)', position: 'relative', overflow: 'hidden',
  },
  statIcon: { width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 },
  statValue: { margin: 0, fontSize: '22px', fontWeight: 800, color: '#111827' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6b7280' },
  statAccent: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px' },

  // Charts
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  chartCard: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  chartTitle: { margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#1a1f3a' },
  barRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  barLabel: { fontSize: '12px', color: '#374151', width: '160px', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  barTrack: { flex: 1, height: '10px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '5px', transition: 'width 0.4s ease' },
  barCount: { fontSize: '12px', fontWeight: 700, color: '#374151', width: '24px', textAlign: 'right' },
  priorityRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f3f4f6' },
  priorityDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  priorityRowLabel: { flex: 1, fontSize: '13px', color: '#374151' },
  priorityCount: { fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' },

  // Filters
  filterCard: { background: '#fff', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '10px' },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  filterRow2: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' },
  filterInput: {
    padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px',
    fontSize: '13px', outline: 'none', flex: '1 1 160px', minWidth: '140px',
    fontFamily: "'Segoe UI', sans-serif",
  },
  dateLabel: { fontSize: '12px', color: '#6b7280', fontWeight: 600 },
  clearBtn: {
    padding: '8px 14px', background: '#fef2f2', border: '1px solid #fca5a5',
    color: '#dc2626', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600,
  },
  resultCount: { fontSize: '12px', color: '#6b7280', marginLeft: 'auto' },

  // Table
  tableCard: { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 14px', background: '#f8faff',
    borderBottom: '2px solid #e5e7eb', fontSize: '12px',
    fontWeight: 700, color: '#374151', textAlign: 'left', whiteSpace: 'nowrap',
  },
  td: { padding: '11px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  titleCell: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' },
  pillarTag: {
    background: '#eef0ff', color: '#3C3B6E', padding: '3px 8px',
    borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
  },
  statusBadge: { padding: '4px 10px', borderRadius: '20px', color: '#fff', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' },
  viewBtn: {
    padding: '6px 14px', background: '#f3f4f6', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600, color: '#374151',
  },
  viewBtnUrgent: {
    background: 'linear-gradient(135deg, #B22234, #3C3B6E)',
    color: '#fff', border: 'none',
  },
  empty: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },
}