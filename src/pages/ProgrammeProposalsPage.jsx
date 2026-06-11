import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PILLARS } from '../lib/programmeData'

// ── Strategic Plan Rubric (built-in) ─────────────────────────
const STRATEGIC_PLAN = `
U.S. MISSION NIGERIA — AMERICAN SPACES STRATEGIC PLAN 2024-2026

PRIORITY 1: MAKING AMERICA GREATER (25 points)
- Promotes American values, democratic principles, and rule of law
- Engages Nigerian audiences on U.S. history, culture, and institutions
- Builds understanding of U.S. foreign policy and global leadership
- Facilitates people-to-people connections between Americans and Nigerians
- Highlights American innovation, technology, and creative industries

PRIORITY 2: MAKING AMERICA STRONGER (25 points)
- Strengthens bilateral security cooperation and resilience
- Counters disinformation, misinformation, and extremist narratives
- Promotes media literacy, critical thinking, and information integrity
- Supports anti-corruption, transparency, and good governance initiatives
- Engages security-sector audiences on democratic norms

PRIORITY 3: MAKING AMERICA MORE PROSPEROUS (25 points)
- Promotes trade, investment, and economic opportunities with the U.S.
- Supports entrepreneurship, employability, and workforce development
- Highlights EducationUSA pathways and exchange program opportunities
- Facilitates technology transfer, digital skills, and STEM education
- Engages young Nigerians in economic empowerment and financial literacy

PRIORITY 4: CELEBRATING AMERICAN EXCELLENCE (25 points)
- Showcases American arts, literature, film, music, and cultural heritage
- Promotes diversity, equity, and inclusion as American strengths
- Highlights American athletes, artists, and cultural icons
- Celebrates U.S. achievements in science, medicine, and exploration
- Engages communities through cultural diplomacy and creative expression
`

const THRESHOLD = 75

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#6b7280' },
  submitted: { label: 'Submitted', color: '#f59e0b' },
  coordinator_reviewed: { label: 'Coordinator Reviewed', color: '#3b82f6' },
  approved: { label: '✅ Approved', color: '#10b981' },
  rejected: { label: '🚫 Rejected', color: '#dc2626' },
}

const EMPTY_FORM = {
  title: '', description: '', proposed_date: '',
  proposed_end_date: '', pillar: '',
}

export default function ProgrammeProposalsPage() {
  const { profile, isAdmin, isPAO, isSpecialist, isCoordinator } = useAuth()
  const navigate = useNavigate()
  const canReview = isAdmin || isPAO || isSpecialist || isCoordinator
  const isDirector = profile?.role === 'space_director' || profile?.role === 'admin'

  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [docFile, setDocFile] = useState(null)
  const [docText, setDocText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [scores, setScores] = useState(null)
  const [aiReview, setAiReview] = useState('')
  const [saving, setSaving] = useState(false)

  // Review state
  const [activeProposal, setActiveProposal] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewAction, setReviewAction] = useState('approve')
  const [submittingReview, setSubmittingReview] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    let q = supabase.from('programme_proposals')
      .select(`*, american_spaces(name,state), profiles!submitted_by(full_name)`)
      .order('created_at', { ascending: false })
    if (isDirector) q = q.eq('space_id', profile.space_id)
    const { data } = await q
    setProposals(data ?? [])
    setLoading(false)
  }

  // ── Extract text from uploaded file using FileReader ─────
  async function handleFileUpload(file) {
    if (!file) return
    setDocFile(file)
    setExtracting(true)
    setDocText('')
    setScores(null)
    setAiReview('')

    // For text-based extraction we read as text (works for .txt embedded in docx/pdf)
    // For production, a server-side parser (mammoth for docx, pdf.js) would be used.
    // Here we use the file name + description as context for the AI scoring.
    const reader = new FileReader()
    reader.onload = (e) => {
      // Try to extract readable text; fallback gracefully
      try {
        const text = e.target.result
        const cleaned = typeof text === 'string'
          ? text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)
          : ''
        setDocText(cleaned || `[File: ${file.name}]`)
      } catch {
        setDocText(`[File: ${file.name}]`)
      }
      setExtracting(false)
    }
    reader.onerror = () => { setDocText(`[File: ${file.name}]`); setExtracting(false) }
    reader.readAsText(file)
  }

  // ── AI Scoring ────────────────────────────────────────────
  async function runAIScoring() {
    if (!form.title.trim()) return setError('Please enter the programme title before scoring.')
    setScoring(true)
    setError('')

    const context = `
Programme Title: ${form.title}
Description: ${form.description}
Proposed Date: ${form.proposed_date}
Programming Pillar: ${form.pillar}
${docText ? `Document Content (excerpt):\n${docText}` : ''}
`.trim()

    const prompt = `You are an expert evaluator for the U.S. Mission Nigeria American Spaces programme.

Your task is to score the following programme proposal against the U.S. Mission Strategic Plan.

STRATEGIC PLAN:
${STRATEGIC_PLAN}

PROGRAMME PROPOSAL:
${context}

INSTRUCTIONS:
Score the proposal on each of the 4 priority areas on a scale of 0-25.
Be rigorous and fair. A score of 20+ per priority requires strong, explicit alignment.
The composite score is the sum of all 4 scores (maximum 100).
A composite score of ${THRESHOLD} or above qualifies for approval.

Respond ONLY with a valid JSON object in this exact format (no preamble, no markdown):
{
  "score_greater": <number 0-25>,
  "score_stronger": <number 0-25>,
  "score_prosperous": <number 0-25>,
  "score_excellence": <number 0-25>,
  "composite_score": <number 0-100>,
  "meets_threshold": <true|false>,
  "review": "<2-3 paragraph professional assessment explaining the scores, what the programme does well, and specific recommendations for improvement if it falls below threshold>"
}`

    try {
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.find(b => b.type === 'text')?.text ?? ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setScores({
        score_greater: parsed.score_greater,
        score_stronger: parsed.score_stronger,
        score_prosperous: parsed.score_prosperous,
        score_excellence: parsed.score_excellence,
        composite_score: parsed.composite_score,
        meets_threshold: parsed.meets_threshold,
      })
      setAiReview(parsed.review)
    } catch (e) {
      setError('AI scoring failed. Please try again.')
    }
    setScoring(false)
  }

  // ── Upload document to Supabase Storage ──────────────────
  async function uploadDocument(file, proposalId) {
    if (!file) return null
    const ext = file.name.split('.').pop()
    const path = `${proposalId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('proposal-docs').upload(path, file)
    if (upErr) return null
    const { data } = supabase.storage.from('proposal-docs').getPublicUrl(path)
    return data.publicUrl
  }

  // ── Submit proposal ───────────────────────────────────────
  async function handleSubmit(asDraft = false) {
    setError('')
    if (!form.title.trim()) return setError('Programme title is required.')
    if (!form.proposed_date) return setError('Proposed date is required.')
    if (!scores && !asDraft) return setError('Please run AI scoring before submitting.')
    setSaving(true)

    const { data: prop, error: insErr } = await supabase
      .from('programme_proposals').insert({
        space_id: profile.space_id,
        submitted_by: profile.id,
        title: form.title,
        description: form.description,
        proposed_date: form.proposed_date,
        proposed_end_date: form.proposed_end_date || null,
        pillar: form.pillar,
        document_name: docFile?.name ?? null,
        score_greater: scores?.score_greater ?? 0,
        score_stronger: scores?.score_stronger ?? 0,
        score_prosperous: scores?.score_prosperous ?? 0,
        score_excellence: scores?.score_excellence ?? 0,
        composite_score: scores?.composite_score ?? 0,
        ai_review: aiReview,
        meets_threshold: scores?.meets_threshold ?? false,
        status: asDraft ? 'draft' : 'submitted',
      }).select().single()

    if (insErr) { setError(insErr.message); setSaving(false); return }

    // Upload document
    if (docFile) {
      const url = await uploadDocument(docFile, prop.id)
      if (url) await supabase.from('programme_proposals')
        .update({ document_url: url }).eq('id', prop.id)
    }

    setSuccess(asDraft
      ? '💾 Proposal saved as draft.'
      : '📤 Proposal submitted to Coordinator for review.')
    setShowForm(false)
    resetForm()
    await loadData()
    setSaving(false)
  }

  // ── Submit review ─────────────────────────────────────────
  async function handleReview() {
    if (!reviewComment.trim()) return setError('Please add a review comment.')
    setSubmittingReview(true)
    setError('')

    const p = activeProposal
    let nextStatus = p.status

    if (reviewAction === 'approve') {
      if (isCoordinator && p.status === 'submitted') nextStatus = 'coordinator_reviewed'
      else if ((isSpecialist || isAdmin) && p.status === 'coordinator_reviewed') nextStatus = 'approved'
      else if (isAdmin) nextStatus = 'approved'
    } else {
      nextStatus = 'rejected'
    }

    const update = {
      status: nextStatus,
      ...(isCoordinator ? { coordinator_comment: reviewComment } : {}),
      ...((isSpecialist || isAdmin) && reviewAction === 'approve' ? {
        specialist_comment: reviewComment,
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      } : {}),
      ...(reviewAction === 'reject' ? { rejected_reason: reviewComment } : {}),
    }

    await supabase.from('programme_proposals').update(update).eq('id', p.id)

    // If approved by specialist/admin and meets threshold → create calendar event
    if (nextStatus === 'approved' && p.meets_threshold) {
      await supabase.from('calendar_events').insert({
        space_id: p.space_id,
        proposal_id: p.id,
        title: p.title,
        description: p.description,
        pillar: p.pillar,
        event_date: p.proposed_date,
        end_date: p.proposed_end_date,
        created_by: profile.id,
      })

      // Notify PAO (insert a notification announcement)
      if (!isPAO) {
        await supabase.from('announcements').insert({
          title: `📅 New Programme Approved: ${p.title}`,
          body: `A programme proposal from ${p.american_spaces?.name ?? 'an American Space'} has been approved and added to the calendar.\n\nProgramme: ${p.title}\nDate: ${p.proposed_date}\nComposite Score: ${p.composite_score}/100`,
          posted_by: profile.id,
          approved_by: profile.id,
          status: 'approved',
          target_space_id: null,
        })
      }
    }

    setSuccess(reviewAction === 'approve'
      ? nextStatus === 'approved'
        ? '✅ Programme approved! Calendar event created and PAO notified.'
        : '✅ Review submitted. Forwarded to Specialist for final approval.'
      : '🚫 Proposal rejected.')
    setActiveProposal(null)
    setReviewComment('')
    await loadData()
    setSubmittingReview(false)
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setDocFile(null)
    setDocText('')
    setScores(null)
    setAiReview('')
  }

  // ── Filter tabs ───────────────────────────────────────────
  const tabFiltered = proposals.filter(p => {
    if (tab === 'all') return true
    if (tab === 'pending') return ['submitted', 'coordinator_reviewed'].includes(p.status)
    if (tab === 'approved') return p.status === 'approved'
    if (tab === 'draft') return p.status === 'draft'
    return true
  })

  const pendingCount = proposals.filter(p =>
    (isCoordinator && p.status === 'submitted') ||
    ((isSpecialist || isAdmin) && p.status === 'coordinator_reviewed')
  ).length

  // ── Score bar component ───────────────────────────────────
  const ScoreBar = ({ label, score, max = 25 }) => {
    const pct = Math.round((score / max) * 100)
    const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: '#374151' }}>{label}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color }}>{score}/{max}</span>
        </div>
        <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div style={s.topbarCenter}>
          <h1 style={s.appTitle}>🎯 Programme Proposals & AI Review</h1>
          <p style={s.appSub}>American Spaces Nigeria</p>
        </div>
        <div style={s.topbarRight}>
          {isDirector && (
            <button style={s.addBtn} onClick={() => { setShowForm(true); resetForm(); setError('') }}>
              + Submit Proposal
            </button>
          )}
          <button style={s.calBtn} onClick={() => navigate('/calendar')}>
            📅 View Calendar
          </button>
        </div>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* Tabs */}
        <div style={s.tabs}>
          {[
            { key: 'all', label: `All (${proposals.length})` },
            { key: 'draft', label: `Drafts (${proposals.filter(p => p.status === 'draft').length})` },
            { key: 'pending', label: `Pending Review`, badge: pendingCount },
            { key: 'approved', label: `Approved (${proposals.filter(p => p.status === 'approved').length})` },
          ].map(t => (
            <button key={t.key}
              style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
              onClick={() => setTab(t.key)}>
              {t.label}
              {t.badge > 0 && <span style={s.badge}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Proposal cards */}
        {loading ? <p style={s.empty}>Loading proposals...</p>
          : tabFiltered.length === 0 ? <p style={s.empty}>No proposals in this category.</p>
          : (
            <div style={s.cardGrid}>
              {tabFiltered.map(p => {
                const st = STATUS_CONFIG[p.status]
                const needsMyReview =
                  (isCoordinator && p.status === 'submitted') ||
                  ((isSpecialist || isAdmin) && p.status === 'coordinator_reviewed')
                return (
                  <div key={p.id} style={{
                    ...s.propCard,
                    borderTop: `3px solid ${st.color}`,
                    boxShadow: needsMyReview ? '0 0 0 2px #f59e0b44' : '0 1px 4px rgba(0,0,0,0.07)',
                  }}>
                    <div style={s.propHeader}>
                      <div>
                        <h3 style={s.propTitle}>{p.title}</h3>
                        <p style={s.propSpace}>{p.american_spaces?.name}</p>
                      </div>
                      <span style={{ ...s.statusBadge, background: st.color }}>{st.label}</span>
                    </div>

                    <div style={s.propMeta}>
                      {p.pillar && <span style={s.pillarTag}>{p.pillar}</span>}
                      <span style={s.metaChip}>📅 {p.proposed_date}</span>
                      <span style={s.metaChip}>👤 {p.profiles?.full_name}</span>
                    </div>

                    {p.composite_score > 0 && (
                      <div style={s.scoreRow}>
                        <div style={s.compositeScore}>
                          <span style={{
                            ...s.compositeNum,
                            color: p.composite_score >= THRESHOLD ? '#16a34a' : '#dc2626',
                          }}>
                            {p.composite_score}
                          </span>
                          <span style={s.compositeLabel}>/100</span>
                        </div>
                        <div style={s.thresholdInfo}>
                          {p.meets_threshold
                            ? <span style={s.passTag}>✅ Meets threshold ({THRESHOLD}+)</span>
                            : <span style={s.failTag}>⚠️ Below threshold ({THRESHOLD})</span>}
                        </div>
                      </div>
                    )}

                    {p.description && (
                      <p style={s.propDesc}>{p.description.slice(0, 120)}{p.description.length > 120 ? '...' : ''}</p>
                    )}

                    <div style={s.propActions}>
                      <button style={{
                        ...s.reviewBtn,
                        ...(needsMyReview ? s.reviewBtnUrgent : {}),
                      }} onClick={() => { setActiveProposal(p); setReviewComment(''); setReviewAction('approve'); setError('') }}>
                        {needsMyReview ? '✍️ Review Now' : '👁 View Details'}
                      </button>
                      {p.document_url && (
                        <a href={p.document_url} target="_blank" rel="noopener noreferrer" style={s.docLink}>
                          📄 Document
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {/* ── SUBMIT PROPOSAL MODAL ── */}
      {showForm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '640px' }}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>🎯 Submit Programme Proposal</h3>
              <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {error && <div style={s.errorBox}>{error}</div>}

              <Field label="Programme Title *">
                <input style={s.input} value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Digital Skills Bootcamp 2026" />
              </Field>

              <Field label="Description">
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Briefly describe the programme objectives and activities..." />
              </Field>

              <div style={s.row}>
                <Field label="Proposed Start Date *">
                  <input style={s.input} type="date" value={form.proposed_date}
                    onChange={e => setForm(f => ({ ...f, proposed_date: e.target.value }))} />
                </Field>
                <Field label="Proposed End Date">
                  <input style={s.input} type="date" value={form.proposed_end_date}
                    onChange={e => setForm(f => ({ ...f, proposed_end_date: e.target.value }))} />
                </Field>
              </div>

              <Field label="Programming Pillar">
                <select style={s.input} value={form.pillar}
                  onChange={e => setForm(f => ({ ...f, pillar: e.target.value }))}>
                  <option value="">— Select Pillar —</option>
                  {PILLARS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                </select>
              </Field>

              <Field label="Upload Programme Document (PDF, DOCX, PPTX)">
                {docFile ? (
                  <div style={s.fileRow}>
                    <span style={s.fileName}>📄 {docFile.name}</span>
                    <button style={s.removeFile} onClick={() => { setDocFile(null); setDocText(''); setScores(null); setAiReview('') }}>✕ Remove</button>
                  </div>
                ) : (
                  <label style={s.uploadLabel}>
                    📎 Click to upload document
                    <input type="file" accept=".pdf,.docx,.pptx,.doc,.txt"
                      style={{ display: 'none' }}
                      onChange={e => handleFileUpload(e.target.files[0])} />
                  </label>
                )}
                {extracting && <p style={s.hint}>⏳ Reading document...</p>}
              </Field>

              {/* AI Scoring */}
              <div style={s.scoringBox}>
                <div style={s.scoringHeader}>
                  <span style={s.scoringTitle}>🤖 AI Strategic Assessment</span>
                  <button style={{ ...s.scoreBtn, opacity: scoring ? 0.7 : 1 }}
                    onClick={runAIScoring} disabled={scoring}>
                    {scoring ? '⏳ Scoring...' : scores ? '🔄 Re-score' : '▶ Run AI Scoring'}
                  </button>
                </div>
                <p style={s.hint}>AI will score your proposal against the 4 USG Strategic Priorities. Proposals scoring {THRESHOLD}+ are eligible for approval.</p>

                {scores && (
                  <div style={s.scoresPanel}>
                    <ScoreBar label="Making America Greater" score={scores.score_greater} />
                    <ScoreBar label="Making America Stronger" score={scores.score_stronger} />
                    <ScoreBar label="Making America More Prosperous" score={scores.score_prosperous} />
                    <ScoreBar label="Celebrating American Excellence" score={scores.score_excellence} />
                    <div style={s.compositeRow}>
                      <span style={s.compositeRowLabel}>Composite Score</span>
                      <span style={{
                        ...s.compositeRowScore,
                        color: scores.meets_threshold ? '#16a34a' : '#dc2626',
                        background: scores.meets_threshold ? '#f0fdf4' : '#fef2f2',
                      }}>
                        {scores.composite_score}/100 {scores.meets_threshold ? '✅ Qualifies' : `⚠️ Below ${THRESHOLD}`}
                      </span>
                    </div>
                    {aiReview && (
                      <div style={s.reviewBox}>
                        <p style={{ ...s.hint, fontWeight: 600, marginBottom: '6px' }}>AI Assessment:</p>
                        <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, margin: 0 }}>{aiReview}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={s.formActions}>
                <button style={{ ...s.draftBtn, opacity: saving ? 0.7 : 1 }}
                  onClick={() => handleSubmit(true)} disabled={saving}>
                  💾 Save Draft
                </button>
                <button style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }}
                  onClick={() => handleSubmit(false)} disabled={saving}>
                  {saving ? 'Submitting...' : '📤 Submit for Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REVIEW / VIEW MODAL ── */}
      {activeProposal && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '640px' }}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>📋 {activeProposal.title}</h3>
              <button style={s.closeBtn} onClick={() => setActiveProposal(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {error && <div style={s.errorBox}>{error}</div>}

              {/* Proposal details */}
              <div style={s.detailGrid}>
                <Detail label="Space" value={activeProposal.american_spaces?.name} />
                <Detail label="Status" value={STATUS_CONFIG[activeProposal.status]?.label} />
                <Detail label="Proposed Date" value={activeProposal.proposed_date} />
                <Detail label="Pillar" value={activeProposal.pillar} />
                <Detail label="Submitted by" value={activeProposal.profiles?.full_name} />
              </div>

              {activeProposal.description && (
                <div style={s.detailSection}>
                  <p style={s.detailLabel}>Description</p>
                  <p style={s.detailText}>{activeProposal.description}</p>
                </div>
              )}

              {/* AI Scores */}
              {activeProposal.composite_score > 0 && (
                <div style={s.scoresPanel}>
                  <p style={{ ...s.scoringTitle, marginBottom: '12px' }}>🤖 AI Strategic Assessment</p>
                  <ScoreBar label="Making America Greater" score={activeProposal.score_greater} />
                  <ScoreBar label="Making America Stronger" score={activeProposal.score_stronger} />
                  <ScoreBar label="Making America More Prosperous" score={activeProposal.score_prosperous} />
                  <ScoreBar label="Celebrating American Excellence" score={activeProposal.score_excellence} />
                  <div style={s.compositeRow}>
                    <span style={s.compositeRowLabel}>Composite Score</span>
                    <span style={{
                      ...s.compositeRowScore,
                      color: activeProposal.meets_threshold ? '#16a34a' : '#dc2626',
                      background: activeProposal.meets_threshold ? '#f0fdf4' : '#fef2f2',
                    }}>
                      {activeProposal.composite_score}/100 {activeProposal.meets_threshold ? '✅ Qualifies' : `⚠️ Below ${THRESHOLD}`}
                    </span>
                  </div>
                  {activeProposal.ai_review && (
                    <div style={s.reviewBox}>
                      <p style={{ ...s.hint, fontWeight: 600, marginBottom: '6px' }}>AI Assessment:</p>
                      <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, margin: 0 }}>{activeProposal.ai_review}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Prior review comments */}
              {activeProposal.coordinator_comment && (
                <div style={{ ...s.reviewBox, marginTop: '12px' }}>
                  <p style={{ ...s.hint, fontWeight: 600 }}>Coordinator Comment:</p>
                  <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{activeProposal.coordinator_comment}</p>
                </div>
              )}
              {activeProposal.specialist_comment && (
                <div style={{ ...s.reviewBox, marginTop: '8px' }}>
                  <p style={{ ...s.hint, fontWeight: 600 }}>Specialist Comment:</p>
                  <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{activeProposal.specialist_comment}</p>
                </div>
              )}
              {activeProposal.rejected_reason && (
                <div style={{ ...s.reviewBox, background: '#fef2f2', border: '1px solid #fca5a5', marginTop: '8px' }}>
                  <p style={{ ...s.hint, fontWeight: 600, color: '#dc2626' }}>Rejection Reason:</p>
                  <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{activeProposal.rejected_reason}</p>
                </div>
              )}

              {/* Review action panel */}
              {canReview && ['submitted', 'coordinator_reviewed'].includes(activeProposal.status) && (
                ((isCoordinator && activeProposal.status === 'submitted') ||
                 ((isSpecialist || isAdmin) && activeProposal.status === 'coordinator_reviewed')) && (
                  <div style={s.reviewPanel}>
                    <p style={s.scoringTitle}>✍️ Your Review</p>
                    <div style={s.actionToggle}>
                      <button style={{ ...s.toggleBtn, ...(reviewAction === 'approve' ? s.toggleActive : {}) }}
                        onClick={() => setReviewAction('approve')}>
                        ✅ Approve {isCoordinator ? '& Forward' : '& Create Event'}
                      </button>
                      <button style={{ ...s.toggleBtn, ...(reviewAction === 'reject' ? s.toggleReject : {}) }}
                        onClick={() => setReviewAction('reject')}>
                        🚫 Reject
                      </button>
                    </div>
                    <Field label="Comment *">
                      <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                        placeholder="Enter your review comment..."
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)} />
                    </Field>
                    <button style={{ ...s.submitBtn, opacity: submittingReview ? 0.7 : 1 }}
                      onClick={handleReview} disabled={submittingReview}>
                      {submittingReview ? 'Submitting...' : '📨 Submit Review'}
                    </button>
                  </div>
                )
              )}
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

// ── Styles ─────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" },
  topbar: { background: 'linear-gradient(135deg, #1a1f3a, #2d3561)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '16px', height: '64px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  topbarCenter: { flex: 1 },
  appTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' },
  appSub: { margin: 0, fontSize: '11px', color: '#93a4d4' },
  topbarRight: { display: 'flex', gap: '10px' },
  addBtn: { padding: '8px 16px', background: '#B22234', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  calBtn: { padding: '8px 14px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  body: { padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  tabs: { display: 'flex', gap: '8px', background: '#fff', padding: '8px', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', flexWrap: 'wrap' },
  tab: { flex: 1, padding: '10px 14px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#6b7280', position: 'relative', whiteSpace: 'nowrap' },
  tabActive: { background: '#1a1f3a', color: '#fff' },
  badge: { position: 'absolute', top: '6px', right: '4px', background: '#B22234', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 5px', borderRadius: '20px' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  propCard: { background: '#fff', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  propHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' },
  propTitle: { margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' },
  propSpace: { margin: '3px 0 0', fontSize: '12px', color: '#6b7280' },
  statusBadge: { padding: '4px 10px', borderRadius: '20px', color: '#fff', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' },
  propMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  pillarTag: { fontSize: '11px', background: '#eef0ff', color: '#3C3B6E', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 },
  metaChip: { fontSize: '11px', background: '#f3f4f6', color: '#6b7280', padding: '3px 8px', borderRadius: '20px' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  compositeScore: { display: 'flex', alignItems: 'baseline', gap: '2px' },
  compositeNum: { fontSize: '28px', fontWeight: 800 },
  compositeLabel: { fontSize: '14px', color: '#9ca3af' },
  thresholdInfo: { flex: 1 },
  passTag: { fontSize: '12px', background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 },
  failTag: { fontSize: '12px', background: '#fffbeb', color: '#d97706', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 },
  propDesc: { fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.5 },
  propActions: { display: 'flex', gap: '8px', marginTop: '4px' },
  reviewBtn: { flex: 1, padding: '8px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#374151' },
  reviewBtnUrgent: { background: 'linear-gradient(135deg, #B22234, #3C3B6E)', color: '#fff', border: 'none' },
  docLink: { padding: '8px 12px', background: '#eef0ff', borderRadius: '8px', fontSize: '12px', color: '#3C3B6E', fontWeight: 600, textDecoration: 'none' },
  scoringBox: { background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '16px', marginBottom: '12px' },
  scoringHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  scoringTitle: { fontSize: '13px', fontWeight: 700, color: '#1a1f3a', margin: 0 },
  scoreBtn: { padding: '8px 16px', background: 'linear-gradient(135deg, #3C3B6E, #1a1f3a)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  scoresPanel: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginTop: '10px' },
  compositeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' },
  compositeRowLabel: { fontSize: '13px', fontWeight: 700, color: '#1a1f3a' },
  compositeRowScore: { fontSize: '13px', fontWeight: 800, padding: '4px 12px', borderRadius: '20px' },
  reviewBox: { background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '12px', marginTop: '10px' },
  reviewPanel: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '16px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  actionToggle: { display: 'flex', gap: '8px' },
  toggleBtn: { flex: 1, padding: '10px', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151' },
  toggleActive: { background: '#f0fdf4', border: '1.5px solid #86efac', color: '#16a34a' },
  toggleReject: { background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#dc2626' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '12px' },
  detailSection: { marginBottom: '12px' },
  detailLabel: { fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px' },
  detailText: { fontSize: '13px', color: '#374151', lineHeight: 1.6, margin: 0 },
  fileRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' },
  fileName: { fontSize: '13px', color: '#16a34a', fontWeight: 600, flex: 1 },
  removeFile: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  uploadLabel: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', border: '2px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#6b7280', gap: '8px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  formActions: { display: 'flex', gap: '10px', marginTop: '4px' },
  draftBtn: { flex: 1, padding: '12px', background: '#fff', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', color: '#374151' },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'Segoe UI', sans-serif" },
  submitBtn: { flex: 1, padding: '12px', background: 'linear-gradient(135deg, #B22234, #3C3B6E)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  hint: { fontSize: '12px', color: '#6b7280', margin: '4px 0 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHeader: { background: '#1a1f3a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, color: '#fff', fontSize: '15px', fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '20px', overflowY: 'auto' },
  empty: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' },
}