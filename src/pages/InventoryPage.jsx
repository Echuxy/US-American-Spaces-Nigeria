import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = [
  'Furniture & Fittings',
  'ICT & Electronics',
  'Books & Publications',
  'Programme Materials & Equipment',
]
const CONDITIONS = ['Good', 'Fair', 'Poor', 'Condemned']
const CONDITION_COLORS = { Good: '#16a34a', Fair: '#d97706', Poor: '#dc2626', Condemned: '#6b7280' }

const EMPTY_ASSET = {
  name: '', category: '', description: '', quantity: 1,
  condition: 'Good', acquisition_date: '', estimated_value: '',
  serial_tag: '',
}

export default function InventoryPage() {
  const { profile, isAdmin, isPAO, isSpecialist, isCoordinator } = useAuth()
  const navigate = useNavigate()
  const canAuthorise = isAdmin || isPAO || isSpecialist || isCoordinator
  const canAdd = canAuthorise || profile?.role === 'space_director'

  const [assets, setAssets] = useState([])
  const [spaces, setSpaces] = useState([])
  const [deleteRequests, setDeleteRequests] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterSpace, setFilterSpace] = useState(profile?.space_id ?? '')
  const [filterCat, setFilterCat] = useState('')
  const [filterCond, setFilterCond] = useState('')
  const [search, setSearch] = useState('')

  // Modals
  const [showAdd, setShowAdd] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteRequests, setShowDeleteRequests] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [form, setForm] = useState(EMPTY_ASSET)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: sp } = await supabase.from('american_spaces').select('id,name,state').eq('active', true).order('name')
    setSpaces(sp ?? [])

    let q = supabase.from('assets')
      .select(`*, american_spaces(name,state), profiles!added_by(full_name)`)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
    if (profile?.role === 'space_director') q = q.eq('space_id', profile.space_id)
    const { data: a } = await q
    setAssets(a ?? [])

    if (canAuthorise) {
      const { data: dr } = await supabase
        .from('asset_delete_requests')
        .select(`*, assets(name, category), profiles!requested_by(full_name)`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      setDeleteRequests(dr ?? [])
    }
    setLoading(false)
  }

  const filtered = assets.filter(a => {
    if (filterSpace && a.space_id !== filterSpace) return false
    if (filterCat && a.category !== filterCat) return false
    if (filterCond && a.condition !== filterCond) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ── Stats ─────────────────────────────────────────────────
  const totalAssets = filtered.length
  const totalValue = filtered.reduce((s, a) => s + Number(a.estimated_value ?? 0), 0)
  const condemned = filtered.filter(a => a.condition === 'Condemned').length
  const poor = filtered.filter(a => a.condition === 'Poor').length

  async function handleAddAsset() {
    setError('')
    if (!form.name.trim()) return setError('Asset name is required.')
    if (!form.category) return setError('Please select a category.')
    const spaceId = canAuthorise
      ? (filterSpace || profile?.space_id)
      : profile?.space_id
    if (!spaceId) return setError('No space selected.')
    setSaving(true)
    let photoUrl = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `${spaceId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('asset-photos').upload(path, photoFile)
      if (!upErr) {
        const { data } = supabase.storage.from('asset-photos').getPublicUrl(path)
        photoUrl = data.publicUrl
      }
    }
    const { error: insErr } = await supabase.from('assets').insert({
      space_id: spaceId,
      name: form.name,
      category: form.category,
      description: form.description,
      quantity: parseInt(form.quantity) || 1,
      condition: form.condition,
      acquisition_date: form.acquisition_date || null,
      estimated_value: parseFloat(form.estimated_value) || 0,
      serial_tag: form.serial_tag,
      photo_url: photoUrl,
      added_by: profile.id,
    })
    if (insErr) { setError(insErr.message); setSaving(false); return }
    setSuccess('✅ Asset added successfully.')
    setShowAdd(false)
    setForm(EMPTY_ASSET)
    setPhotoFile(null)
    setPhotoPreview(null)
    await loadData()
    setSaving(false)
  }

  async function requestDelete(asset) {
    setSelectedAsset(asset)
    setDeleteReason('')
    if (canAuthorise) {
      // Authorised roles delete directly
      setShowDeleteModal(true)
    } else {
      setShowDeleteModal(true)
    }
  }

  async function submitDeleteAction() {
    if (!deleteReason.trim()) return setError('Please provide a reason.')
    setSaving(true)
    setError('')
    if (canAuthorise) {
      // Direct soft delete
      await supabase.from('assets').update({
        is_deleted: true,
        deleted_by: profile.id,
        deleted_at: new Date().toISOString(),
        deletion_reason: deleteReason,
      }).eq('id', selectedAsset.id)
      setSuccess('🗑️ Asset deleted.')
    } else {
      // Space director raises a delete request
      await supabase.from('asset_delete_requests').insert({
        asset_id: selectedAsset.id,
        requested_by: profile.id,
        reason: deleteReason,
      })
      setSuccess('📨 Delete request submitted for authorisation.')
    }
    setShowDeleteModal(false)
    setDeleteReason('')
    await loadData()
    setSaving(false)
  }

  async function approveDeleteRequest(req, approved) {
    setSaving(true)
    await supabase.from('asset_delete_requests').update({
      status: approved ? 'approved' : 'rejected',
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.id)
    if (approved) {
      await supabase.from('assets').update({
        is_deleted: true,
        deleted_by: profile.id,
        deleted_at: new Date().toISOString(),
        deletion_reason: req.reason,
      }).eq('id', req.asset_id)
    }
    await loadData()
    setSaving(false)
  }

  return (
    <div style={s.page}>

      {/* Topbar */}
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div style={s.topbarCenter}>
          <h1 style={s.appTitle}>📦 Inventory Management</h1>
          <p style={s.appSub}>American Spaces Nigeria</p>
        </div>
        <div style={s.topbarRight}>
          {canAdd && (
            <button style={s.addBtn} onClick={() => { setShowAdd(true); setError('') }}>
              + Add Asset
            </button>
          )}
          {canAuthorise && deleteRequests.length > 0 && (
            <button style={s.reqBtn} onClick={() => setShowDeleteRequests(true)}>
              🗑️ Delete Requests ({deleteRequests.length})
            </button>
          )}
          <button style={s.reconBtn} onClick={() => navigate('/reconciliation')}>
            🔄 Reconciliations
          </button>
        </div>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* Stat cards */}
        <div style={s.statGrid}>
          <StatCard icon="📦" label="Total Assets" value={totalAssets} color="#3C3B6E" />
          <StatCard icon="💰" label="Total Est. Value" value={`₦${totalValue.toLocaleString()}`} color="#0369a1" />
          <StatCard icon="⚠️" label="Poor Condition" value={poor} color="#d97706" />
          <StatCard icon="🚫" label="Condemned" value={condemned} color="#dc2626" />
        </div>

        {/* Filters */}
        <div style={s.filterCard}>
          <div style={s.filterRow}>
            <input style={s.filterInput} placeholder="🔍 Search assets..."
              value={search} onChange={e => setSearch(e.target.value)} />
            {canAuthorise && (
              <select style={s.filterInput} value={filterSpace}
                onChange={e => setFilterSpace(e.target.value)}>
                <option value="">All Spaces</option>
                {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
            )}
            <select style={s.filterInput} value={filterCat}
              onChange={e => setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select style={s.filterInput} value={filterCond}
              onChange={e => setFilterCond(e.target.value)}>
              <option value="">All Conditions</option>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p style={s.resultCount}>{filtered.length} asset{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Asset Grid */}
        {loading ? <p style={s.empty}>Loading assets...</p>
          : filtered.length === 0 ? <p style={s.empty}>No assets found.</p>
          : (
            <div style={s.assetGrid}>
              {filtered.map(a => (
                <div key={a.id} style={s.assetCard}>
                  {a.photo_url
                    ? <img src={a.photo_url} alt={a.name} style={s.assetPhoto} />
                    : <div style={s.assetPhotoPlaceholder}>📦</div>
                  }
                  <div style={s.assetBody}>
                    <div style={s.assetHeader}>
                      <span style={s.assetName}>{a.name}</span>
                      <span style={{ ...s.condBadge, background: CONDITION_COLORS[a.condition] + '22', color: CONDITION_COLORS[a.condition] }}>
                        {a.condition}
                      </span>
                    </div>
                    <span style={s.catTag}>{a.category}</span>
                    <div style={s.assetMeta}>
                      <MetaRow label="Space" value={a.american_spaces?.name?.replace('American Corner ', '').replace('American Center ', 'AC ')} />
                      <MetaRow label="Qty" value={a.quantity} />
                      <MetaRow label="Value" value={`₦${Number(a.estimated_value).toLocaleString()}`} />
                      {a.serial_tag && <MetaRow label="Serial/Tag" value={a.serial_tag} />}
                      {a.acquisition_date && <MetaRow label="Acquired" value={a.acquisition_date} />}
                      {a.description && <MetaRow label="Notes" value={a.description} />}
                      <MetaRow label="Added by" value={a.profiles?.full_name} />
                    </div>
                    <button style={s.deleteBtn} onClick={() => requestDelete(a)}>
                      {canAuthorise ? '🗑️ Delete' : '📨 Request Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* ── ADD ASSET MODAL ── */}
      {showAdd && (
        <Modal title="Add New Asset" onClose={() => setShowAdd(false)}>
          {error && <div style={s.errorBox}>{error}</div>}
          <Field label="Asset Name *">
            <input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. HP Laptop" />
          </Field>
          <Field label="Category *">
            <select style={s.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">— Select —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {canAuthorise && (
            <Field label="Space *">
              <select style={s.input} value={filterSpace} onChange={e => setFilterSpace(e.target.value)}>
                <option value="">— Select Space —</option>
                {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
            </Field>
          )}
          <div style={s.row}>
            <Field label="Quantity">
              <input style={s.input} type="number" min="1" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </Field>
            <Field label="Condition">
              <select style={s.input} value={form.condition}
                onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div style={s.row}>
            <Field label="Acquisition Date">
              <input style={s.input} type="date" value={form.acquisition_date}
                onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))} />
            </Field>
            <Field label="Estimated Value (₦)">
              <input style={s.input} type="number" min="0" value={form.estimated_value}
                onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} />
            </Field>
          </div>
          <Field label="Serial / Tag Number">
            <input style={s.input} value={form.serial_tag}
              onChange={e => setForm(f => ({ ...f, serial_tag: e.target.value }))}
              placeholder="Optional" />
          </Field>
          <Field label="Description / Notes">
            <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Asset Photo">
            {photoPreview
              ? <div style={{ position: 'relative' }}>
                  <img src={photoPreview} alt="preview" style={{ width: '100%', borderRadius: '8px', maxHeight: '160px', objectFit: 'cover' }} />
                  <button style={s.removePhotoBtn} onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}>✕</button>
                </div>
              : <label style={s.photoLabel}>
                  📷 Click to upload photo
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files[0]
                      if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)) }
                    }} />
                </label>
            }
          </Field>
          <button style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }}
            onClick={handleAddAsset} disabled={saving}>
            {saving ? 'Saving...' : '✅ Add Asset'}
          </button>
        </Modal>
      )}

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && selectedAsset && (
        <Modal title={canAuthorise ? '🗑️ Delete Asset' : '📨 Request Asset Deletion'} onClose={() => setShowDeleteModal(false)}>
          {error && <div style={s.errorBox}>{error}</div>}
          <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 12px' }}>
            {canAuthorise
              ? `You are about to permanently delete "${selectedAsset.name}". This action cannot be undone.`
              : `You are requesting deletion of "${selectedAsset.name}". A Coordinator, Specialist, or PAO must approve this request.`}
          </p>
          <Field label="Reason *">
            <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
              placeholder="State the reason for deletion..."
              value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
          </Field>
          <button style={{ ...s.deleteConfirmBtn, opacity: saving ? 0.7 : 1 }}
            onClick={submitDeleteAction} disabled={saving}>
            {saving ? 'Processing...' : canAuthorise ? '🗑️ Confirm Delete' : '📨 Submit Request'}
          </button>
        </Modal>
      )}

      {/* ── DELETE REQUESTS MODAL ── */}
      {showDeleteRequests && (
        <Modal title="🗑️ Pending Delete Requests" onClose={() => setShowDeleteRequests(false)}>
          {deleteRequests.length === 0
            ? <p style={s.empty}>No pending requests.</p>
            : deleteRequests.map(req => (
              <div key={req.id} style={s.reqCard}>
                <p style={s.reqAsset}>{req.assets?.name} <span style={s.reqCat}>({req.assets?.category})</span></p>
                <p style={s.reqBy}>Requested by: <strong>{req.profiles?.full_name}</strong></p>
                <p style={s.reqReason}>Reason: {req.reason}</p>
                <p style={s.reqDate}>{new Date(req.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button style={s.approveBtn} onClick={() => approveDeleteRequest(req, true)} disabled={saving}>
                    ✅ Approve & Delete
                  </button>
                  <button style={s.rejectBtn} onClick={() => approveDeleteRequest(req, false)} disabled={saving}>
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))
          }
        </Modal>
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

function Modal({ title, onClose, children }) {
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>{title}</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

function MetaRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #f3f4f6', padding: '3px 0' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#374151', textAlign: 'right', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" },
  topbar: {
    background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', padding: '0 20px',
    display: 'flex', alignItems: 'center', gap: '16px', height: '64px',
    position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
  },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' },
  topbarCenter: { flex: 1 },
  appTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' },
  appSub: { margin: 0, fontSize: '11px', color: '#93a4d4' },
  topbarRight: { display: 'flex', gap: '10px', alignItems: 'center' },
  addBtn: { padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  reqBtn: { padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  reconBtn: { padding: '8px 14px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  body: { padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' },
  statCard: { background: '#fff', borderRadius: '12px', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', position: 'relative', overflow: 'hidden' },
  statIcon: { width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 },
  statValue: { margin: 0, fontSize: '22px', fontWeight: 800, color: '#111827' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6b7280' },
  statAccent: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px' },
  filterCard: { background: '#fff', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  filterInput: { padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '13px', flex: '1 1 160px', minWidth: '140px', fontFamily: "'Segoe UI', sans-serif" },
  resultCount: { fontSize: '12px', color: '#6b7280', margin: '8px 0 0' },
  assetGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  assetCard: { background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  assetPhoto: { width: '100%', height: '140px', objectFit: 'cover' },
  assetPhotoPlaceholder: { width: '100%', height: '100px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' },
  assetBody: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' },
  assetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' },
  assetName: { fontSize: '14px', fontWeight: 700, color: '#111827', flex: 1 },
  condBadge: { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap' },
  catTag: { fontSize: '11px', background: '#eef0ff', color: '#3C3B6E', padding: '3px 10px', borderRadius: '20px', alignSelf: 'flex-start', fontWeight: 600 },
  assetMeta: { display: 'flex', flexDirection: 'column', gap: '2px' },
  deleteBtn: { marginTop: '8px', padding: '8px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', sans-serif" },
  photoLabel: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', border: '2px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#6b7280', gap: '8px' },
  removePhotoBtn: { position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' },
  submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' },
  deleteConfirmBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' },
  reqCard: { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '14px', marginBottom: '12px' },
  reqAsset: { margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#111827' },
  reqCat: { fontWeight: 400, color: '#6b7280', fontSize: '12px' },
  reqBy: { margin: '0 0 4px', fontSize: '12px', color: '#374151' },
  reqReason: { margin: '0 0 4px', fontSize: '12px', color: '#374151', fontStyle: 'italic' },
  reqDate: { margin: 0, fontSize: '11px', color: '#9ca3af' },
  approveBtn: { flex: 1, padding: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  rejectBtn: { flex: 1, padding: '8px', background: '#fff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHeader: { background: '#1a1f3a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, color: '#fff', fontSize: '16px', fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '20px', overflowY: 'auto' },
  empty: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
}