import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { WORKFLOW, REPORT_STATUSES, ROLES } from '../lib/programmeData'

export default function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, canReview } = useAuth()

  const [report, setReport] = useState(null)
  const [reviews, setReviews] = useState([])
  const [comment, setComment] = useState('')
  const [action, setAction] = useState('reviewed')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => { loadReport() }, [id])

  async function loadReport() {
    setLoading(true)
    const { data: r } = await supabase
      .from('reports')
      .select(`*, american_spaces(name, state), profiles!submitted_by(full_name, email)`)
      .eq('id', id)
      .single()
    setReport(r)

    const { data: rv } = await supabase
      .from('report_reviews')
      .select(`*, profiles!reviewer_id(full_name, role)`)
      .eq('report_id', id)
      .order('created_at', { ascending: true })
    setReviews(rv ?? [])
    setLoading(false)
  }

  // Determine if current user can act on this report
  function canAct() {
    if (!canReview || !report) return false
    const role = profile.role
    const status = report.status
    if (role === 'coordinator' && status === 'submitted') return true
    if (role === 'specialist' && status === 'coordinator_reviewed') return true
    if ((role === 'pao' || role === 'admin') && status === 'specialist_reviewed') return true
    if (role === 'admin') return true
    return false
  }

  async function submitReview() {
    if (!comment.trim()) return setError('Please enter a comment before submitting.')
    setSubmitting(true)
    setError('')

    const nextStatus = action === 'returned'
      ? 'draft'
      : WORKFLOW[profile.role]?.submitsTo ?? report.status

    const { error: revErr } = await supabase.from('report_reviews').insert({
      report_id: report.id,
      reviewer_id: profile.id,
      reviewer_role: profile.role,
      comment,
      action,
    })

    if (revErr) { setError(revErr.message); setSubmitting(false); return }

    const { error: updErr } = await supabase
      .from('reports')
      .update({ status: nextStatus })
      .eq('id', report.id)

    if (updErr) { setError(updErr.message); setSubmitting(false); return }

    setSuccess(
      action === 'returned'
        ? '↩️ Report returned to Space Director for revision.'
        : `✅ ${WORKFLOW[profile.role]?.label ?? 'Action'} completed successfully.`
    )
    setComment('')
    await loadReport()
    setSubmitting(false)
  }

  if (loading) return <LoadingScreen />
  if (!report) return <div style={s.page}><p style={{ padding: 24 }}>Report not found.</p></div>

  const statusInfo = REPORT_STATUSES[report.status]
  const photos = [report.photo_1_url, report.photo_2_url, report.photo_3_url].filter(Boolean)

  return (
    <div style={s.page}>
      {lightbox && (
        <div style={s.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Photo" style={s.lightboxImg} />
          <p style={s.lightboxHint}>Click anywhere to close</p>
        </div>
      )}

      <div style={s.container}>

        {/* Header */}
        <div style={s.pageHeader}>
          <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Back</button>
          <div>
            <h2 style={s.pageTitle}>{report.programme_title}</h2>
            <p style={s.pageSub}>{report.american_spaces?.name} · {report.activity_date}</p>
          </div>
          <span style={{ ...s.statusBadge, background: statusInfo?.color }}>{statusInfo?.label}</span>
          <button style={s.printBtn} onClick={() => window.print()}>🖨️ Print</button>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        <div style={s.grid}>

          {/* LEFT — Report Details */}
          <div style={s.left}>

            <Card title="📋 Activity Details">
              <InfoRow label="Space" value={`${report.american_spaces?.name} (${report.american_spaces?.state})`} />
              <InfoRow label="Date" value={report.activity_date} />
              <InfoRow label="Submitted by" value={report.profiles?.full_name} />
              <InfoRow label="Pillar" value={report.pillar} />
              <InfoRow label="Category" value={report.programme_category} />
              <InfoRow label="Facilitator(s)" value={report.facilitators} />
              <InfoRow label="Attendance" value={report.attendance} />
              <InfoRow label="Amount Spent" value={`₦${Number(report.amount_spent).toLocaleString()}`} />
              <InfoRow label="Resources" value={report.resources_utilised} />
            </Card>

            <Card title="🎯 Strategic Priorities">
              <div style={s.priorityTags}>
                {(report.strategic_priorities ?? []).map(p => (
                  <span key={p} style={s.priorityTag}>{p}</span>
                ))}
              </div>
              <p style={s.fieldLabel}>Alignment Explanation</p>
              <p style={s.fieldText}>{report.priority_alignment}</p>
            </Card>

            <Card title="📝 Activity Description">
              <p style={s.fieldText}>{report.activity_description}</p>
            </Card>

            {report.challenges && (
              <Card title="⚠️ Challenges Encountered">
                <p style={s.fieldText}>{report.challenges}</p>
              </Card>
            )}

            {report.prospects && (
              <Card title="🔭 Prospects / Follow-up">
                <p style={s.fieldText}>{report.prospects}</p>
              </Card>
            )}

            {report.ai_narrative && (
              <Card title="✨ AI-Generated Narrative">
                <div style={s.narrativeBox}>
                  <div style={s.narrativeHeader}>
                    <span style={s.narrativeLabel}>Polished Narrative</span>
                    <span style={s.wordCount}>
                      {report.ai_narrative.split(/\s+/).length} words
                    </span>
                  </div>
                  <p style={{ ...s.fieldText, fontStyle: 'italic' }}>{report.ai_narrative}</p>
                </div>
              </Card>
            )}

            {photos.length > 0 && (
              <Card title="📷 Programme Photographs">
                <div style={s.photoGrid}>
                  {photos.map((url, i) => (
                    <img key={i} src={url} alt={`Photo ${i + 1}`} style={s.photoThumb}
                      onClick={() => setLightbox(url)} />
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT — Review Trail + Action */}
          <div style={s.right}>

            {/* Workflow Progress */}
            <Card title="🔄 Approval Workflow">
              <div style={s.workflow}>
                {[
                  { key: 'draft', label: 'Draft' },
                  { key: 'submitted', label: 'Submitted' },
                  { key: 'coordinator_reviewed', label: 'Coordinator' },
                  { key: 'specialist_reviewed', label: 'Specialist' },
                  { key: 'approved', label: 'PAO Approved' },
                ].map((step, i, arr) => {
                  const statuses = ['draft', 'submitted', 'coordinator_reviewed', 'specialist_reviewed', 'approved']
                  const currentIdx = statuses.indexOf(report.status)
                  const stepIdx = statuses.indexOf(step.key)
                  const done = stepIdx <= currentIdx
                  return (
                    <div key={step.key} style={s.workflowStep}>
                      <div style={{ ...s.workflowDot, background: done ? '#10b981' : '#d1d5db' }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span style={{ ...s.workflowLabel, fontWeight: done ? 700 : 400 }}>
                        {step.label}
                      </span>
                      {i < arr.length - 1 && (
                        <div style={{ ...s.workflowLine, background: done && stepIdx < currentIdx ? '#10b981' : '#e5e7eb' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Review Trail */}
            <Card title="💬 Review Trail">
              {reviews.length === 0 ? (
                <p style={{ ...s.fieldText, color: '#9ca3af' }}>No reviews yet.</p>
              ) : (
                <div style={s.trail}>
                  {reviews.map(rv => (
                    <div key={rv.id} style={s.trailItem}>
                      <div style={s.trailHeader}>
                        <span style={s.trailName}>{rv.profiles?.full_name}</span>
                        <span style={s.trailRole}>{ROLES[rv.profiles?.role]?.label}</span>
                        <span style={{
                          ...s.trailAction,
                          background: rv.action === 'returned' ? '#fef2f2' : '#f0fdf4',
                          color: rv.action === 'returned' ? '#dc2626' : '#16a34a',
                        }}>
                          {rv.action === 'returned' ? '↩ Returned' : rv.action === 'approved' ? '✅ Approved' : '👁 Reviewed'}
                        </span>
                      </div>
                      <p style={s.trailComment}>{rv.comment}</p>
                      <p style={s.trailDate}>
                        {new Date(rv.created_at).toLocaleString('en-NG', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Action Panel */}
            {canAct() && (
              <Card title={`✍️ Your Review — ${ROLES[profile.role]?.label}`}>
                <label style={s.fieldLabel}>Action</label>
                <select style={s.input} value={action} onChange={e => setAction(e.target.value)}>
                  <option value="reviewed">Mark as Reviewed</option>
                  <option value="approved">{WORKFLOW[profile.role]?.label}</option>
                  <option value="returned">↩ Return to Space Director</option>
                </select>

                <label style={{ ...s.fieldLabel, marginTop: '12px' }}>Comment *</label>
                <textarea style={{ ...s.input, ...s.textarea }} rows={4}
                  placeholder="Enter your review comments..."
                  value={comment}
                  onChange={e => setComment(e.target.value)} />

                <button
                  style={{ ...s.submitBtn, opacity: submitting ? 0.7 : 1, marginTop: '12px' }}
                  onClick={submitReview}
                  disabled={submitting}>
                  {submitting ? 'Submitting...' : '📨 Submit Review'}
                </button>
              </Card>
            )}

            {!canAct() && report.status !== 'approved' && (
              <Card title="ℹ️ Status">
                <p style={{ ...s.fieldText, color: '#6b7280' }}>
                  {report.status === 'draft'
                    ? 'This report is still a draft and has not been submitted yet.'
                    : 'This report is currently awaiting review by the next level in the workflow.'}
                </p>
              </Card>
            )}

            {report.status === 'approved' && (
              <Card title="✅ Final Status">
                <p style={{ ...s.fieldText, color: '#16a34a', fontWeight: 600 }}>
                  This report has received PAO final approval.
                </p>
              </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div style={s.card}>
      <h4 style={s.cardTitle}>{title}</h4>
      <div style={s.cardBody}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={s.infoRow}>
      <span style={s.infoLabel}>{label}</span>
      <span style={s.infoValue}>{value || '—'}</span>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#6b7280', fontSize: '16px' }}>Loading report...</p>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" },
  container: { maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' },
  pageHeader: {
    background: 'linear-gradient(135deg, #1a1f3a, #2d3561)',
    borderRadius: '12px',
    padding: '20px 24px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  printBtn: { padding: '8px 14px', background: '#374151', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  backBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  },
  pageTitle: { margin: 0, fontSize: '18px', fontWeight: 700, flex: 1 },
  pageSub: { margin: '4px 0 0', color: '#93a4d4', fontSize: '13px' },
  statusBadge: {
    padding: '6px 14px',
    borderRadius: '20px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' },
  left: { display: 'flex', flexDirection: 'column', gap: '16px' },
  right: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: {
    background: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  },
  cardTitle: {
    background: '#f8faff',
    borderBottom: '1px solid #e5e7eb',
    margin: 0,
    padding: '12px 18px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#1a1f3a',
  },
  cardBody: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' },
  infoLabel: { fontSize: '12px', color: '#6b7280', fontWeight: 600, minWidth: '110px' },
  infoValue: { fontSize: '13px', color: '#111827', textAlign: 'right' },
  fieldLabel: { fontSize: '12px', fontWeight: 600, color: '#374151', margin: 0 },
  fieldText: { fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: 0 },
  priorityTags: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  priorityTag: {
    background: '#eef0ff',
    color: '#3C3B6E',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
  },
  narrativeBox: { background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '12px' },
  narrativeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  narrativeLabel: { fontSize: '12px', fontWeight: 700, color: '#1a1f3a' },
  wordCount: { background: '#3C3B6E', color: '#fff', padding: '2px 10px', borderRadius: '20px', fontSize: '11px' },
  photoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  photoThumb: { width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', transition: 'opacity 0.2s' },
  workflow: { display: 'flex', flexDirection: 'column', gap: '0' },
  workflowStep: { display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', paddingBottom: '0' },
  workflowDot: {
    width: '28px', height: '28px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: '12px', fontWeight: 700, flexShrink: 0, zIndex: 1,
  },
  workflowLabel: { fontSize: '13px', color: '#374151', flex: 1 },
  workflowLine: { position: 'absolute', left: '13px', top: '28px', width: '2px', height: '24px' },
  trail: { display: 'flex', flexDirection: 'column', gap: '12px' },
  trailItem: { background: '#f9fafb', borderRadius: '8px', padding: '12px', border: '1px solid #e5e7eb' },
  trailHeader: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '6px' },
  trailName: { fontSize: '13px', fontWeight: 700, color: '#111827' },
  trailRole: { fontSize: '11px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '20px' },
  trailAction: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', marginLeft: 'auto' },
  trailComment: { fontSize: '13px', color: '#374151', margin: '0 0 4px', lineHeight: 1.5 },
  trailDate: { fontSize: '11px', color: '#9ca3af', margin: 0 },
  input: {
    padding: '10px 12px', border: '1.5px solid #d1d5db',
    borderRadius: '8px', fontSize: '14px', outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', sans-serif",
  },
  textarea: { resize: 'vertical', lineHeight: 1.6 },
  submitBtn: {
    width: '100%', padding: '12px',
    background: 'linear-gradient(135deg, #B22234, #3C3B6E)',
    color: '#fff', border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
  },
  lightboxOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, cursor: 'pointer', padding: '20px',
  },
  lightboxImg: { maxWidth: '90vw', maxHeight: '80vh', borderRadius: '10px', objectFit: 'contain' },
  lightboxHint: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '14px' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' },
}