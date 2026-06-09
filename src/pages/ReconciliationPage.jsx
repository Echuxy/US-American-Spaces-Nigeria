import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CONDITIONS = ['Good', 'Fair', 'Poor', 'Condemned']
const CONDITION_COLORS = { Good: '#16a34a', Fair: '#d97706', Poor: '#dc2626', Condemned: '#6b7280' }
const RECON_STATUS_COLORS = { present: '#16a34a', missing: '#dc2626', damaged: '#d97706' }

const QUARTERS = (() => {
  const qs = []
  for (let y = 2024; y <= 2030; y++) {
    for (let q = 1; q <= 4; q++) qs.push(`Q${q} ${y}`)
  }
  return qs
})()

function quarterDates(q) {
  const [qn, yr] = q.split(' ')
  const y = parseInt(yr)
  const starts = { Q1: '01-01', Q2: '04-01', Q3: '07-01', Q4: '10-01' }
  const ends = { Q1: '03-31', Q2: '06-30', Q3: '09-30', Q4: '12-31' }
  return { start: `${y}-${starts[qn]}`, end: `${y}-${ends[qn]}` }
}

export default function ReconciliationPage() {
  const { profile, canReview, isAdmin, isPAO, isSpecialist, isCoordinator } = useAuth()
  const navigate = useNavigate()
  const canAuthorise = isAdmin || isPAO || isSpecialist || isCoordinator

  const [reconciliations, setReconciliations] = useState([])
  const [spaces, setSpaces] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  // New reconciliation
  const [showNew, setShowNew] = useState(false)
  const [newSpace, setNewSpace] = useState(profile?.space_id ?? '')
  const [newQuarter, setNewQuarter] = useState('Q2 2026')
  const [creating, setCreating] = useState(false)

  // Active reconciliation being filled
  const [activeRecon, setActiveRecon] = useState(null)
  const [items, setItems] = useState([])
  const [generalNotes, setGeneralNotes] = useState('')
  const [verifierComment, setVerifierComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filter
  const [filterSpace, setFilterSpace] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: sp } = await supabase.from('american_spaces').select('id,name,state').eq('active', true).order('name')
    setSpaces(sp ?? [])

    let q = supabase.from('reconciliations')
      .select(`*, american_spaces(name,state), profiles!submitted_by(full_name), profiles!verified_by(full_name)`)
      .order('created_at', { ascending: false })
    if (profile?.role === 'space_director') q = q.eq('space_id', profile.space_id)
    const { data: r } = await q
    setReconciliations(r ?? [])
    setLoading(false)
  }

  async function openReconciliation(recon) {
    setActiveRecon(recon)
    setGeneralNotes(recon.general_notes ?? '')
    setVerifierComment(recon.verifier_comment ?? '')
    setError('')

    // Load assets for the space
    const { data: a } = await supabase.from('assets')
      .select('id, name, category, quantity, condition, serial_tag')
      .eq('space_id', recon.space_id)
      .eq('is_deleted', false)
      .order('category')
    setAssets(a ?? [])

    // Load existing reconciliation items
    const { data: ri } = await supabase.from('reconciliation_items')
      .select('*')
      .eq('reconciliation_id', recon.id)
    const existing = {}
    ;(ri ?? []).forEach(i => { existing[i.asset_id] = i })

    // Build items list — pre-fill from existing or defaults
    setItems((a ?? []).map(asset => existing[asset.id] ? {
      asset_id: asset.id,
      quantity_expected: asset.quantity,
      quantity_found: existing[asset.id].quantity_found,
      condition_found: existing[asset.id].condition_found,
      recon_status: existing[asset.id].recon_status,
      notes: existing[asset.id].notes ?? '',
    } : {
      asset_id: asset.id,
      quantity_expected: asset.quantity,
      quantity_found: asset.quantity,
      condition_found: asset.condition,
      recon_status: 'present',
      notes: '',
    }))
  }

  function updateItem(assetId, field, value) {
    setItems(prev => prev.map(i => i.asset_id === assetId ? { ...i, [field]: value } : i))
  }

  async function createReconciliation() {
    if (!newSpace) return setError('Please select a space.')
    setCreating(true)
    setError('')
    const { start, end } = quarterDates(newQuarter)
    const { data, error: e } = await supabase.from('reconciliations').insert({
      space_id: newSpace,
      quarter: newQuarter,
      period_start: start,
      period_end: end,
      status: 'open',
    }).select().single()
    if (e) { setError(e.message); setCreating(false); return }
    setShowNew(false)
    await loadData()
    setCreating(false)
    setSuccess(`✅ ${newQuarter} reconciliation created.`)
    openReconciliation(data)
  }

  async function saveItems(submit = false) {
    setSaving(true)
    setError('')

    // Upsert all reconciliation items
    const upsertData = items.map(i => ({
      reconciliation_id: activeRecon.id,
      asset_id: i.asset_id,
      quantity_expected: i.quantity_expected,
      quantity_found: parseInt(i.quantity_found) || 0,
      condition_found: i.condition_found,
      recon_status: i.recon_status,
      notes: i.notes,
    }))

    // Delete existing items and re-insert (simplest upsert approach)
    await supabase.from('reconciliation_items').delete().eq('reconciliation_id', activeRecon.id)
    const { error: insErr } = await supabase.from('reconciliation_items').insert(upsertData)
    if (insErr) { setError(insErr.message); setSaving(false); return }

    // Update reconciliation record
    const update = { general_notes: generalNotes }
    if (submit) {
      update.status = 'submitted'
      update.submitted_by = profile.id
      update.submitted_at = new Date().toISOString()
    }
    await supabase.from('reconciliations').update(update).eq('id', activeRecon.id)

    setSuccess(submit ? '📤 Reconciliation submitted for verification.' : '💾 Progress saved.')
    await loadData()
    // Refresh activeRecon
    const { data: updated } = await supabase.from('reconciliations')
      .select(`*, american_spaces(name,state), profiles!submitted_by(full_name), profiles!verified_by(full_name)`)
      .eq('id', activeRecon.id).single()
    setActiveRecon(updated)
    setSaving(false)
  }

  async function verifyReconciliation() {
    if (!verifierComment.trim()) return setError('Please add a verification comment.')
    setSaving(true)
    await supabase.from('reconciliations').update({
      status: 'verified',
      verified_by: profile.id,
      verified_at: new Date().toISOString(),
      verifier_comment: verifierComment,
    }).eq('id', activeRecon.id)

    // Update asset conditions based on what was found
    for (const item of items) {
      await supabase.from('assets').update({
        condition: item.condition_found,
        quantity: item.quantity_found,
      }).eq('id', item.asset_id)
    }

    setSuccess('✅ Reconciliation verified and asset records updated.')
    await loadData()
    setActiveRecon(null)
    setSaving(false)
  }

  const filtered = reconciliations.filter(r => {
    if (filterSpace && r.space_id !== filterSpace) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  const STATUS_COLORS = { open: '#6b7280', submitted: '#d97706', verified: '#16a34a' }
  const STATUS_LABELS = { open: 'Open', submitted: 'Submitted — Awaiting Verification', verified: '✅ Verified' }

  // ── Active Reconciliation View ────────────────────────────
  if (activeRecon) {
    const isOpen = activeRecon.status === 'open'
    const isSubmitted = activeRecon.status === 'submitted'
    const isVerified = activeRecon.status === 'verified'
    const canVerify = canAuthorise && isSubmitted
    const canEdit = (profile?.role === 'space_director' || canAuthorise) && (isOpen || isSubmitted)

    const missing = items.filter(i => i.recon_status === 'missing').length
    const damaged = items.filter(i => i.recon_status === 'damaged').length
    const present = items.filter(i => i.recon_status === 'present').length

    return (
      <div style={s.page}>
        <div style={s.topbar}>
          <button style={s.backBtn} onClick={() => { setActiveRecon(null); setItems([]) }}>← Back</button>
          <div style={s.topbarCenter}>
            <h1 style={s.appTitle}>🔄 {activeRecon.quarter} Reconciliation</h1>
            <p style={s.appSub}>{activeRecon.american_spaces?.name}</p>
          </div>
          <span style={{ ...s.statusBadge, background: STATUS_COLORS[activeRecon.status] }}>
            {STATUS_LABELS[activeRecon.status]}
          </span>
        </div>

        <div style={s.body}>
          {error && <div style={s.errorBox}>{error}</div>}
          {success && <div style={s.successBox}>{success}</div>}

          {/* Summary */}
          <div style={s.statGrid}>
            <StatCard icon="📦" label="Total Assets" value={items.length} color="#3C3B6E" />
            <StatCard icon="✅" label="Present" value={present} color="#16a34a" />
            <StatCard icon="⚠️" label="Damaged" value={damaged} color="#d97706" />
            <StatCard icon="❌" label="Missing" value={missing} color="#dc2626" />
          </div>

          {/* Items table */}
          <div style={s.tableCard}>
            <div style={s.tableHeader}>
              <h3 style={s.tableTitle}>Asset Checklist</h3>
              {isVerified && <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>✅ Verified by {activeRecon.profiles__verified_by?.full_name ?? 'reviewer'}</span>}
            </div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Asset', 'Category', 'Expected Qty', 'Found Qty', 'Condition Found', 'Status', 'Notes'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const asset = assets.find(a => a.id === item.asset_id)
                    if (!asset) return null
                    return (
                      <tr key={item.asset_id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={s.td}>
                          <span style={{ fontWeight: 600 }}>{asset.name}</span>
                          {asset.serial_tag && <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af' }}>#{asset.serial_tag}</span>}
                        </td>
                        <td style={s.td}><span style={s.catTag}>{asset.category}</span></td>
                        <td style={{ ...s.td, textAlign: 'center' }}>{item.quantity_expected}</td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {canEdit && !isVerified
                            ? <input style={{ ...s.smallInput, width: '60px', textAlign: 'center' }}
                                type="number" min="0" value={item.quantity_found}
                                onChange={e => updateItem(item.asset_id, 'quantity_found', e.target.value)} />
                            : item.quantity_found}
                        </td>
                        <td style={s.td}>
                          {canEdit && !isVerified
                            ? <select style={s.smallInput} value={item.condition_found}
                                onChange={e => updateItem(item.asset_id, 'condition_found', e.target.value)}>
                                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            : <span style={{ ...s.condBadge, background: CONDITION_COLORS[item.condition_found] + '22', color: CONDITION_COLORS[item.condition_found] }}>{item.condition_found}</span>
                          }
                        </td>
                        <td style={s.td}>
                          {canEdit && !isVerified
                            ? <select style={s.smallInput} value={item.recon_status}
                                onChange={e => updateItem(item.asset_id, 'recon_status', e.target.value)}>
                                <option value="present">Present</option>
                                <option value="missing">Missing</option>
                                <option value="damaged">Damaged</option>
                              </select>
                            : <span style={{ ...s.condBadge, background: RECON_STATUS_COLORS[item.recon_status] + '22', color: RECON_STATUS_COLORS[item.recon_status], textTransform: 'capitalize' }}>{item.recon_status}</span>
                          }
                        </td>
                        <td style={s.td}>
                          {canEdit && !isVerified
                            ? <input style={{ ...s.smallInput, width: '140px' }} type="text"
                                placeholder="Optional notes..."
                                value={item.notes}
                                onChange={e => updateItem(item.asset_id, 'notes', e.target.value)} />
                            : <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.notes || '—'}</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* General notes */}
          {canEdit && !isVerified && (
            <div style={s.notesCard}>
              <label style={s.fieldLabel}>General Reconciliation Notes</label>
              <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                placeholder="Any general observations about this reconciliation..."
                value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} />
            </div>
          )}

          {isVerified && activeRecon.general_notes && (
            <div style={s.notesCard}>
              <p style={s.fieldLabel}>General Notes</p>
              <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>{activeRecon.general_notes}</p>
            </div>
          )}

          {/* Verifier comment box */}
          {canVerify && (
            <div style={s.verifyCard}>
              <h3 style={s.fieldLabel}>✍️ Verification Comment *</h3>
              <textarea style={{ ...s.input, resize: 'vertical', marginTop: '8px' }} rows={3}
                placeholder="Enter your verification comment..."
                value={verifierComment} onChange={e => setVerifierComment(e.target.value)} />
              <button style={{ ...s.verifyBtn, opacity: saving ? 0.7 : 1, marginTop: '12px' }}
                onClick={verifyReconciliation} disabled={saving}>
                {saving ? 'Verifying...' : '✅ Verify & Update Asset Records'}
              </button>
            </div>
          )}

          {isVerified && activeRecon.verifier_comment && (
            <div style={{ ...s.verifyCard, background: '#f0fdf4', border: '1px solid #86efac' }}>
              <p style={s.fieldLabel}>Verifier Comment</p>
              <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>{activeRecon.verifier_comment}</p>
            </div>
          )}

          {/* Action buttons */}
          {canEdit && !isVerified && (
            <div style={s.actions}>
              <button style={{ ...s.draftBtn, opacity: saving ? 0.7 : 1 }}
                onClick={() => saveItems(false)} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save Progress'}
              </button>
              {(isOpen || (isSubmitted && profile?.role === 'space_director')) && (
                <button style={{ ...s.submitBtnRecon, opacity: saving ? 0.7 : 1 }}
                  onClick={() => saveItems(true)} disabled={saving}>
                  {saving ? 'Submitting...' : '📤 Submit for Verification'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Reconciliation List View ──────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => navigate('/inventory')}>← Inventory</button>
        <div style={s.topbarCenter}>
          <h1 style={s.appTitle}>🔄 Quarterly Reconciliations</h1>
          <p style={s.appSub}>American Spaces Nigeria</p>
        </div>
        <button style={s.addBtn} onClick={() => setShowNew(true)}>+ New Reconciliation</button>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* Filters */}
        <div style={s.filterCard}>
          <div style={s.filterRow}>
            {canAuthorise && (
              <select style={s.filterInput} value={filterSpace} onChange={e => setFilterSpace(e.target.value)}>
                <option value="">All Spaces</option>
                {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
            )}
            <select style={s.filterInput} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
            </select>
          </div>
        </div>

        {/* Reconciliation cards */}
        {loading ? <p style={s.empty}>Loading...</p>
          : filtered.length === 0 ? <p style={s.empty}>No reconciliations found. Create one to get started.</p>
          : (
            <div style={s.reconGrid}>
              {filtered.map(r => (
                <div key={r.id} style={s.reconCard}>
                  <div style={s.reconCardHeader}>
                    <div>
                      <h3 style={s.reconQuarter}>{r.quarter}</h3>
                      <p style={s.reconSpace}>{r.american_spaces?.name}</p>
                    </div>
                    <span style={{ ...s.statusBadge, background: STATUS_COLORS[r.status] }}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>
                  <div style={s.reconMeta}>
                    <span style={s.reconMetaItem}>📅 {r.period_start} → {r.period_end}</span>
                    {r.profiles?.full_name && (
                      <span style={s.reconMetaItem}>👤 Submitted by {r.profiles.full_name}</span>
                    )}
                    {r.submitted_at && (
                      <span style={s.reconMetaItem}>
                        🕐 {new Date(r.submitted_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {r.status === 'verified' && (
                      <span style={{ ...s.reconMetaItem, color: '#16a34a', fontWeight: 600 }}>
                        ✅ Verified {r.verified_at ? new Date(r.verified_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </span>
                    )}
                  </div>
                  <button style={s.openReconBtn} onClick={() => openReconciliation(r)}>
                    {r.status === 'open' ? '📝 Fill Reconciliation'
                      : r.status === 'submitted' && canAuthorise ? '✅ Verify'
                      : '👁 View'}
                  </button>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* New reconciliation modal */}
      {showNew && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>+ New Quarterly Reconciliation</h3>
              <button style={s.closeBtn} onClick={() => setShowNew(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {error && <div style={s.errorBox}>{error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {canAuthorise && (
                  <div>
                    <label style={s.fieldLabel}>American Space *</label>
                    <select style={{ ...s.input, marginTop: '5px' }} value={newSpace} onChange={e => setNewSpace(e.target.value)}>
                      <option value="">— Select Space —</option>
                      {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={s.fieldLabel}>Quarter *</label>
                  <select style={{ ...s.input, marginTop: '5px' }} value={newQuarter} onChange={e => setNewQuarter(e.target.value)}>
                    {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <button style={{ ...s.submitBtn, opacity: creating ? 0.7 : 1 }}
                  onClick={createReconciliation} disabled={creating}>
                  {creating ? 'Creating...' : '✅ Create Reconciliation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  topbar: { background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '16px', height: '64px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' },
  topbarCenter: { flex: 1 },
  appTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' },
  appSub: { margin: 0, fontSize: '11px', color: '#93a4d4' },
  addBtn: { padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  statusBadge: { padding: '5px 12px', borderRadius: '20px', color: '#fff', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' },
  body: { padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' },
  statCard: { background: '#fff', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', position: 'relative', overflow: 'hidden' },
  statIcon: { width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 },
  statValue: { margin: 0, fontSize: '22px', fontWeight: 800, color: '#111827' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6b7280' },
  statAccent: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px' },
  filterCard: { background: '#fff', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  filterInput: { padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '13px', flex: '1 1 160px', fontFamily: "'Segoe UI', sans-serif" },
  tableCard: { background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  tableHeader: { background: '#f8faff', borderBottom: '1px solid #e5e7eb', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tableTitle: { margin: 0, fontSize: '14px', fontWeight: 700, color: '#1a1f3a' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', background: '#f8faff', borderBottom: '2px solid #e5e7eb', fontSize: '12px', fontWeight: 700, color: '#374151', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { padding: '10px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  catTag: { background: '#eef0ff', color: '#3C3B6E', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' },
  condBadge: { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap' },
  smallInput: { padding: '6px 8px', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '13px', fontFamily: "'Segoe UI', sans-serif" },
  notesCard: { background: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '8px' },
  verifyCard: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '18px' },
  verifyBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  fieldLabel: { fontSize: '12px', fontWeight: 700, color: '#374151', margin: 0 },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', sans-serif" },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingBottom: '24px' },
  draftBtn: { padding: '12px 24px', background: '#fff', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', color: '#374151' },
  submitBtnRecon: { padding: '12px 28px', background: 'linear-gradient(135deg, #B22234, #3C3B6E)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  reconGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  reconCard: { background: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '12px' },
  reconCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' },
  reconQuarter: { margin: 0, fontSize: '18px', fontWeight: 800, color: '#1a1f3a' },
  reconSpace: { margin: '4px 0 0', fontSize: '13px', color: '#6b7280' },
  reconMeta: { display: 'flex', flexDirection: 'column', gap: '4px' },
  reconMetaItem: { fontSize: '12px', color: '#6b7280' },
  openReconBtn: { padding: '10px', background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', overflow: 'hidden' },
  modalHeader: { background: '#1a1f3a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, color: '#fff', fontSize: '16px', fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '20px' },
  empty: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
}