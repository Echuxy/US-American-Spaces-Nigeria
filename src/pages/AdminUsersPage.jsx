import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLES = [
  { value: 'space_director', label: 'Space Director' },
  { value: 'coordinator', label: 'American Spaces Coordinator' },
  { value: 'specialist', label: 'Country AS Programme Specialist' },
  { value: 'pao', label: 'PAO' },
  { value: 'admin', label: 'Admin' },
]

const ROLE_COLORS = {
  admin: '#7c3aed',
  pao: '#B22234',
  specialist: '#0369a1',
  coordinator: '#d97706',
  space_director: '#16a34a',
}

const EMPTY_FORM = {
  full_name: '', email: '', password: '', role: 'space_director', space_id: '',
}

export default function AdminUsersPage() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [users, setUsers] = useState([])
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: sp } = await supabase
      .from('american_spaces').select('id,name,state').eq('active', true).order('name')
    setSpaces(sp ?? [])

    const { data: u } = await supabase
      .from('profiles')
      .select('*, american_spaces(name,state)')
      .order('full_name')
    setUsers(u ?? [])
    setLoading(false)
  }

  const filtered = users.filter(u => {
    if (filterRole && u.role !== filterRole) return false
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) &&
        !u.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setError('')
    setShowAdd(true)
    setEditUser(null)
  }

  function openEdit(user) {
    setEditUser(user)
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
      space_id: user.space_id ?? '',
    })
    setError('')
    setShowAdd(true)
  }

  async function handleSave() {
    setError('')
    if (!form.full_name.trim()) return setError('Full name is required.')
    if (!form.email.trim()) return setError('Email is required.')
    if (!editUser && !form.password.trim()) return setError('Password is required for new users.')
    if (form.role === 'space_director' && !form.space_id) return setError('Space Directors must be linked to a space.')
    setSaving(true)

    if (editUser) {
      // Update existing profile
      const { error: e } = await supabase.from('profiles').update({
        full_name: form.full_name,
        role: form.role,
        space_id: form.role === 'space_director' ? form.space_id : null,
      }).eq('id', editUser.id)
      if (e) { setError(e.message); setSaving(false); return }
      setSuccess(`✅ ${form.full_name}'s profile updated.`)
    } else {
      // Create new Supabase auth user via admin API
      // NOTE: This requires a Supabase Edge Function or service role key.
      // For now we use the signUp flow which sends a confirmation email.
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            role: form.role,
          },
          emailRedirectTo: window.location.origin,
        },
      })
      if (signUpErr) { setError(signUpErr.message); setSaving(false); return }

      // Update the profile with correct role and space
      if (data.user) {
        await supabase.from('profiles').update({
          full_name: form.full_name,
          role: form.role,
          space_id: form.role === 'space_director' ? form.space_id : null,
        }).eq('id', data.user.id)
      }
      setSuccess(`✅ Account created for ${form.full_name}. A confirmation email has been sent to ${form.email}.`)
    }

    setShowAdd(false)
    await loadData()
    setSaving(false)
  }

  async function toggleActive(user) {
    // Soft deactivate: set a custom metadata flag
    const { error: e } = await supabase.from('profiles').update({
      role: user.role === 'deactivated' ? 'space_director' : 'deactivated',
    }).eq('id', user.id)
    if (!e) {
      setSuccess(`User ${user.role === 'deactivated' ? 'reactivated' : 'deactivated'}.`)
      await loadData()
    }
  }

  // Stats
  const byRole = ROLES.reduce((acc, r) => {
    acc[r.value] = users.filter(u => u.role === r.value).length
    return acc
  }, {})

  return (
    <div style={s.page}>
      {/* Topbar */}
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div style={s.topbarCenter}>
          <h1 style={s.appTitle}>👥 User Management</h1>
          <p style={s.appSub}>Admin Panel — American Spaces Nigeria</p>
        </div>
        <button style={s.addBtn} onClick={openAdd}>+ Create User</button>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* Role stats */}
        <div style={s.statGrid}>
          {ROLES.map(r => (
            <StatCard key={r.value} label={r.label}
              value={byRole[r.value] ?? 0} color={ROLE_COLORS[r.value]} />
          ))}
        </div>

        {/* Filters */}
        <div style={s.filterCard}>
          <div style={s.filterRow}>
            <input style={s.filterInput} placeholder="🔍 Search by name or email..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select style={s.filterInput} value={filterRole}
              onChange={e => setFilterRole(e.target.value)}>
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <p style={s.resultCount}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Users table */}
        <div style={s.tableCard}>
          {loading ? <p style={s.empty}>Loading users...</p>
            : filtered.length === 0 ? <p style={s.empty}>No users found.</p>
            : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Name', 'Email', 'Role', 'Space', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={s.td}>
                          <div style={s.nameCell}>
                            <div style={{ ...s.avatar, background: ROLE_COLORS[u.role] + '22', color: ROLE_COLORS[u.role] }}>
                              {u.full_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <span style={s.nameText}>{u.full_name}</span>
                          </div>
                        </td>
                        <td style={s.td}><span style={s.emailText}>{u.email}</span></td>
                        <td style={s.td}>
                          <span style={{ ...s.roleBadge, background: ROLE_COLORS[u.role] + '18', color: ROLE_COLORS[u.role] }}>
                            {ROLES.find(r => r.value === u.role)?.label ?? u.role}
                          </span>
                        </td>
                        <td style={s.td}>
                          {u.american_spaces?.name
                            ? <span style={s.spaceTag}>{u.american_spaces.name.replace('American Corner ', '').replace('American Center ', 'AC ')}</span>
                            : <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>}
                        </td>
                        <td style={s.td}>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            {new Date(u.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={s.actionBtns}>
                            <button style={s.editBtn} onClick={() => openEdit(u)}>✏️ Edit</button>
                            {u.id !== profile?.id && (
                              <button
                                style={{ ...s.deactivateBtn, ...(u.role === 'deactivated' ? s.reactivateBtn : {}) }}
                                onClick={() => toggleActive(u)}>
                                {u.role === 'deactivated' ? '✅ Reactivate' : '🚫 Deactivate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAdd && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{editUser ? '✏️ Edit User' : '+ Create New User'}</h3>
              <button style={s.closeBtn} onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {error && <div style={s.errorBox}>{error}</div>}

              <Field label="Full Name *">
                <input style={s.input} value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Amaka Okafor" />
              </Field>

              <Field label="Email Address *">
                <input style={s.input} type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  readOnly={!!editUser} />
              </Field>

              {!editUser && (
                <Field label="Password *">
                  <input style={s.input} type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Minimum 8 characters" />
                </Field>
              )}

              <Field label="Role *">
                <select style={s.input} value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value, space_id: '' }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>

              {form.role === 'space_director' && (
                <Field label="Assigned Space *">
                  <select style={s.input} value={form.space_id}
                    onChange={e => setForm(f => ({ ...f, space_id: e.target.value }))}>
                    <option value="">— Select Space —</option>
                    {spaces.map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.name} ({sp.state})</option>
                    ))}
                  </select>
                </Field>
              )}

              <div style={s.modalNote}>
                {editUser
                  ? '⚠️ Changing a user\'s role takes effect immediately.'
                  : '📧 A confirmation email will be sent to the user to activate their account.'}
              </div>

              <button style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }}
                onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editUser ? '✅ Save Changes' : '✅ Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...s.statCard, borderTop: `3px solid ${color}` }}>
      <p style={{ ...s.statValue, color }}>{value}</p>
      <p style={s.statLabel}>{label}</p>
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

// ── Styles ─────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" },
  topbar: { background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '16px', height: '64px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  topbarCenter: { flex: 1 },
  appTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' },
  appSub: { margin: 0, fontSize: '11px', color: '#93a4d4' },
  addBtn: { padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  body: { padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' },
  statCard: { background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', textAlign: 'center' },
  statValue: { margin: '0 0 4px', fontSize: '28px', fontWeight: 800 },
  statLabel: { margin: 0, fontSize: '12px', color: '#6b7280' },
  filterCard: { background: '#fff', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  filterInput: { padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '13px', flex: '1 1 200px', fontFamily: "'Segoe UI', sans-serif" },
  resultCount: { fontSize: '12px', color: '#6b7280', margin: '8px 0 0' },
  tableCard: { background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 14px', background: '#f8faff', borderBottom: '2px solid #e5e7eb', fontSize: '12px', fontWeight: 700, color: '#374151', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { padding: '12px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 },
  nameText: { fontWeight: 600, color: '#111827' },
  emailText: { fontSize: '12px', color: '#6b7280' },
  roleBadge: { padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' },
  spaceTag: { fontSize: '12px', background: '#eef0ff', color: '#3C3B6E', padding: '3px 8px', borderRadius: '20px' },
  actionBtns: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  editBtn: { padding: '5px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  deactivateBtn: { padding: '5px 12px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  reactivateBtn: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHeader: { background: '#1a1f3a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, color: '#fff', fontSize: '16px', fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '20px', overflowY: 'auto' },
  modalNote: { background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#374151', marginBottom: '14px' },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', sans-serif" },
  submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  empty: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
}