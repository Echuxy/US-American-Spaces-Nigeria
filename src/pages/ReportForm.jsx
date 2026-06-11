import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  PILLARS,
  STRATEGIC_PRIORITIES,
  AI_WORD_LIMITS,
} from '../lib/programmeData'

const EMPTY_FORM = {
  space_id: '',
  activity_date: '',
  programme_title: '',
  pillar: '',
  programme_category: '',
  strategic_priorities: [],
  priority_alignment: '',
  facilitators: '',
  attendance: '',
  resources_utilised: '',
  amount_spent: '',
  challenges: '',
  prospects: '',
  activity_description: '',
  ai_word_limit: 300,
}

export default function ReportForm() {
  const { profile, isAdmin, isCoordinator, isSpecialist, isPAO } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY_FORM)
  const [spaces, setSpaces] = useState([])
  const [photos, setPhotos] = useState([null, null, null])
  const [photoPreviews, setPhotoPreviews] = useState([null, null, null])
  const [aiNarrative, setAiNarrative] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canSelectAnySpace = isAdmin || isCoordinator || isSpecialist || isPAO
  const selectedPillar = PILLARS.find(p => p.label === form.pillar)
  const categories = selectedPillar?.categories ?? []

  useEffect(() => {
    loadSpaces()
    if (!canSelectAnySpace && profile?.space_id) {
      setForm(f => ({ ...f, space_id: profile.space_id }))
    }
  }, [profile])

  async function loadSpaces() {
    const { data } = await supabase
      .from('american_spaces')
      .select('id, name, state')
      .eq('active', true)
      .order('name')
    setSpaces(data ?? [])
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    if (field === 'pillar') setForm(f => ({ ...f, pillar: value, programme_category: '' }))
  }

  function togglePriority(p) {
    setForm(f => ({
      ...f,
      strategic_priorities: f.strategic_priorities.includes(p)
        ? f.strategic_priorities.filter(x => x !== p)
        : [...f.strategic_priorities, p],
    }))
  }

  function handlePhoto(idx, file) {
    if (!file) return
    const updated = [...photos]
    updated[idx] = file
    setPhotos(updated)
    const previews = [...photoPreviews]
    previews[idx] = URL.createObjectURL(file)
    setPhotoPreviews(previews)
  }

  function removePhoto(idx) {
    const updated = [...photos]
    updated[idx] = null
    setPhotos(updated)
    const previews = [...photoPreviews]
    previews[idx] = null
    setPhotoPreviews(previews)
  }

  async function uploadPhoto(file, reportId, idx) {
    if (!file) return null
    const ext = file.name.split('.').pop()
    const path = `${reportId}/photo_${idx + 1}.${ext}`
    const { error } = await supabase.storage
      .from('report-photos')
      .upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('report-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function generateAINarrative() {
    if (!form.activity_description.trim()) {
      setError('Please fill in the activity description before generating AI narrative.')
      return
    }
    setAiLoading(true)
    setError('')
    try {
      const prompt = `You are a professional report writer for the U.S. Embassy Public Diplomacy Section in Nigeria.

Based on the following American Space activity data, write a polished, professional narrative report in exactly ${form.ai_word_limit} words or less.

Activity Details:
- Space: ${spaces.find(s => s.id === form.space_id)?.name ?? ''}
- Date: ${form.activity_date}
- Programme Title: ${form.programme_title}
- Programming Pillar: ${form.pillar}
- Category: ${form.programme_category}
- Strategic Priorities: ${form.strategic_priorities.join(', ')}
- How it aligns: ${form.priority_alignment}
- Facilitator(s): ${form.facilitators}
- Attendance: ${form.attendance}
- Resources Utilised: ${form.resources_utilised}
- Amount Spent: ₦${form.amount_spent}
- Description: ${form.activity_description}
- Challenges: ${form.challenges}
- Prospects: ${form.prospects}

Write in third person, professional diplomatic tone. Highlight alignment with U.S. strategic priorities. Stay within ${form.ai_word_limit} words.`

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
      setAiNarrative(text)
    } catch (e) {
      setError('AI narrative generation failed. Please try again.')
    }
    setAiLoading(false)
  }

  async function saveOrSubmit(submitNow) {
    setError('')
    if (!form.space_id) return setError('Please select an American Space.')
    if (!form.activity_date) return setError('Please enter the activity date.')
    if (!form.programme_title.trim()) return setError('Please enter the programme title.')
    if (!form.pillar) return setError('Please select a programming pillar.')
    if (!form.programme_category) return setError('Please select a programme category.')
    if (form.strategic_priorities.length === 0) return setError('Select at least one strategic priority.')
    if (!form.activity_description.trim()) return setError('Please fill in the activity description.')

    submitNow ? setSubmitting(true) : setSaving(true)

    try {
      // Insert report
      const { data: report, error: insertErr } = await supabase
        .from('reports')
        .insert({
          space_id: form.space_id,
          submitted_by: profile.id,
          activity_date: form.activity_date,
          programme_title: form.programme_title,
          pillar: form.pillar,
          programme_category: form.programme_category,
          strategic_priorities: form.strategic_priorities,
          priority_alignment: form.priority_alignment,
          facilitators: form.facilitators,
          attendance: parseInt(form.attendance) || 0,
          resources_utilised: form.resources_utilised,
          amount_spent: parseFloat(form.amount_spent) || 0,
          challenges: form.challenges,
          prospects: form.prospects,
          activity_description: form.activity_description,
          ai_narrative: aiNarrative,
          ai_word_limit: form.ai_word_limit,
          status: submitNow ? 'submitted' : 'draft',
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      // Upload photos
      const photoUrls = await Promise.all(
        photos.map((f, i) => uploadPhoto(f, report.id, i))
      )

      await supabase
        .from('reports')
        .update({
          photo_1_url: photoUrls[0],
          photo_2_url: photoUrls[1],
          photo_3_url: photoUrls[2],
        })
        .eq('id', report.id)

      setSuccess(submitNow
        ? '✅ Report submitted successfully and forwarded to the Coordinator.'
        : '✅ Report saved as draft.')
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (e) {
      setError(e.message ?? 'An error occurred. Please try again.')
    }

    setSaving(false)
    setSubmitting(false)
  }

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Page Header */}
        <div style={s.pageHeader}>
          <h2 style={s.pageTitle}>📝 New Activity Report</h2>
          <p style={s.pageSub}>Submit a daily activity report for your American Space</p>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* ── SECTION 1: Space & Date ── */}
        <Section title="1. Space & Activity Details">
          <Row>
            <Field label="American Space *">
              {canSelectAnySpace ? (
                <select style={s.input} value={form.space_id} onChange={e => set('space_id', e.target.value)}>
                  <option value="">— Select Space —</option>
                  {spaces.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name} ({sp.state})</option>
                  ))}
                </select>
              ) : (
                <input style={{ ...s.input, background: '#f3f4f6' }}
                  value={spaces.find(s => s.id === form.space_id)?.name ?? 'Loading...'}
                  readOnly />
              )}
            </Field>
            <Field label="Date of Activity *">
              <input style={s.input} type="date" value={form.activity_date}
                onChange={e => set('activity_date', e.target.value)} />
            </Field>
          </Row>
          <Field label="Programme / Activity Title *">
            <input style={s.input} type="text" placeholder="Enter programme title"
              value={form.programme_title} onChange={e => set('programme_title', e.target.value)} />
          </Field>
        </Section>

        {/* ── SECTION 2: Programming Pillar & Category ── */}
        <Section title="2. Programming Pillar & Category">
          <Row>
            <Field label="Programming Pillar *">
              <select style={s.input} value={form.pillar}
                onChange={e => { set('pillar', e.target.value) }}>
                <option value="">— Select Pillar —</option>
                {PILLARS.map(p => (
                  <option key={p.id} value={p.label}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Programme Category *">
              <select style={s.input} value={form.programme_category}
                onChange={e => set('programme_category', e.target.value)}
                disabled={!form.pillar}>
                <option value="">— Select Category —</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </Row>
        </Section>

        {/* ── SECTION 3: Strategic Priorities ── */}
        <Section title="3. U.S. Government Strategic Priorities">
          <p style={s.hint}>Select all that apply</p>
          <div style={s.priorityGrid}>
            {STRATEGIC_PRIORITIES.map(p => {
              const active = form.strategic_priorities.includes(p)
              return (
                <button key={p} style={{ ...s.priorityBtn, ...(active ? s.priorityActive : {}) }}
                  onClick={() => togglePriority(p)}>
                  {active ? '✅' : '⬜'} {p}
                </button>
              )
            })}
          </div>
          <Field label="How does this activity align with the selected priorities? *">
            <textarea style={{ ...s.input, ...s.textarea }} rows={3}
              placeholder="Explain the alignment..."
              value={form.priority_alignment}
              onChange={e => set('priority_alignment', e.target.value)} />
          </Field>
        </Section>

        {/* ── SECTION 4: Programme Details ── */}
        <Section title="4. Programme Details">
          <Row>
            <Field label="Facilitator(s)">
              <input style={s.input} type="text" placeholder="Names of facilitators"
                value={form.facilitators} onChange={e => set('facilitators', e.target.value)} />
            </Field>
            <Field label="Attendance (number)">
              <input style={s.input} type="number" min="0" placeholder="0"
                value={form.attendance} onChange={e => set('attendance', e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Resources Utilised">
              <input style={s.input} type="text" placeholder="e.g. Projector, handouts, Zoom..."
                value={form.resources_utilised} onChange={e => set('resources_utilised', e.target.value)} />
            </Field>
            <Field label="Amount Spent (₦)">
              <input style={s.input} type="number" min="0" placeholder="0.00"
                value={form.amount_spent} onChange={e => set('amount_spent', e.target.value)} />
            </Field>
          </Row>
          <Field label="Activity Description *">
            <textarea style={{ ...s.input, ...s.textarea }} rows={5}
              placeholder="Provide a detailed description of the activity..."
              value={form.activity_description}
              onChange={e => set('activity_description', e.target.value)} />
          </Field>
          <Row>
            <Field label="Challenges Encountered">
              <textarea style={{ ...s.input, ...s.textarea }} rows={3}
                placeholder="Any challenges faced..."
                value={form.challenges}
                onChange={e => set('challenges', e.target.value)} />
            </Field>
            <Field label="Prospects / Follow-up">
              <textarea style={{ ...s.input, ...s.textarea }} rows={3}
                placeholder="Future plans or follow-up actions..."
                value={form.prospects}
                onChange={e => set('prospects', e.target.value)} />
            </Field>
          </Row>
        </Section>

        {/* ── SECTION 5: Photographs ── */}
        <Section title="5. Programme Photographs (up to 3)">
          <div style={s.photoGrid}>
            {[0, 1, 2].map(idx => (
              <div key={idx} style={s.photoBox}>
                {photoPreviews[idx] ? (
                  <div style={s.photoPreviewWrap}>
                    <img src={photoPreviews[idx]} alt={`Photo ${idx + 1}`} style={s.photoImg} />
                    <button style={s.removePhotoBtn} onClick={() => removePhoto(idx)}>✕ Remove</button>
                  </div>
                ) : (
                  <label style={s.photoLabel}>
                    <span style={s.photoIcon}>📷</span>
                    <span style={s.photoText}>Photo {idx + 1}</span>
                    <span style={s.photoHint}>Click to upload</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handlePhoto(idx, e.target.files[0])} />
                  </label>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ── SECTION 6: AI Narrative ── */}
        <Section title="6. AI-Generated Narrative">
          <div style={s.aiRow}>
            <Field label="Word Limit">
              <select style={{ ...s.input, maxWidth: '160px' }}
                value={form.ai_word_limit}
                onChange={e => set('ai_word_limit', parseInt(e.target.value))}>
                {AI_WORD_LIMITS.map(w => (
                  <option key={w} value={w}>{w} words</option>
                ))}
              </select>
            </Field>
            <button style={{ ...s.aiBtn, opacity: aiLoading ? 0.7 : 1 }}
              onClick={generateAINarrative} disabled={aiLoading}>
              {aiLoading ? '⏳ Generating...' : '✨ Generate AI Narrative'}
            </button>
          </div>
          {aiNarrative && (
            <div style={s.narrativeBox}>
              <div style={s.narrativeHeader}>
                <span style={s.narrativeLabel}>AI-Generated Narrative</span>
                <span style={s.wordCount}>{aiNarrative.split(/\s+/).length} words</span>
              </div>
              <textarea style={{ ...s.input, ...s.textarea, background: '#f8faff' }}
                rows={8} value={aiNarrative}
                onChange={e => setAiNarrative(e.target.value)} />
              <p style={s.hint}>You may edit the narrative above before saving.</p>
            </div>
          )}
        </Section>

        {/* ── ACTION BUTTONS ── */}
        <div style={s.actions}>
          <button style={s.draftBtn} onClick={() => saveOrSubmit(false)} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save as Draft'}
          </button>
          <button style={s.submitBtn} onClick={() => saveOrSubmit(true)} disabled={submitting}>
            {submitting ? 'Submitting...' : '📤 Submit to Coordinator'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={s.section}>
      <h3 style={s.sectionTitle}>{title}</h3>
      <div style={s.sectionBody}>{children}</div>
    </div>
  )
}

function Row({ children }) {
  return <div style={s.row}>{children}</div>
}

function Field({ label, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: '#f1f5f9',
    padding: '24px 16px',
    fontFamily: "'Segoe UI', sans-serif",
  },
  container: {
    maxWidth: '860px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  pageHeader: {
    background: 'linear-gradient(135deg, #1a1f3a, #2d3561)',
    borderRadius: '12px',
    padding: '24px',
    color: '#fff',
  },
  pageTitle: { margin: 0, fontSize: '22px', fontWeight: 700 },
  pageSub: { margin: '6px 0 0', color: '#93a4d4', fontSize: '14px' },
  section: {
    background: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  },
  sectionTitle: {
    background: '#f8faff',
    borderBottom: '1px solid #e5e7eb',
    margin: 0,
    padding: '14px 20px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#1a1f3a',
    letterSpacing: '0.2px',
  },
  sectionBody: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '12px', fontWeight: 600, color: '#374151' },
  input: {
    padding: '10px 12px',
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Segoe UI', sans-serif",
  },
  textarea: { resize: 'vertical', lineHeight: 1.6 },
  hint: { fontSize: '12px', color: '#6b7280', margin: 0 },
  priorityGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  priorityBtn: {
    padding: '12px 14px',
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
  priorityActive: {
    border: '1.5px solid #3C3B6E',
    background: '#eef0ff',
    color: '#1a1f3a',
    fontWeight: 600,
  },
  photoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' },
  photoBox: {
    border: '2px dashed #d1d5db',
    borderRadius: '10px',
    aspectRatio: '4/3',
    overflow: 'hidden',
  },
  photoLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    cursor: 'pointer',
    gap: '6px',
  },
  photoIcon: { fontSize: '28px' },
  photoText: { fontSize: '13px', fontWeight: 600, color: '#374151' },
  photoHint: { fontSize: '11px', color: '#9ca3af' },
  photoPreviewWrap: { position: 'relative', height: '100%' },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  removePhotoBtn: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  aiRow: { display: 'flex', alignItems: 'flex-end', gap: '14px' },
  aiBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #B22234, #3C3B6E)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  narrativeBox: {
    background: '#f8faff',
    border: '1px solid #c7d2fe',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  narrativeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  narrativeLabel: { fontSize: '13px', fontWeight: 700, color: '#1a1f3a' },
  wordCount: {
    fontSize: '12px',
    background: '#3C3B6E',
    color: '#fff',
    padding: '2px 10px',
    borderRadius: '20px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '4px 0 24px',
  },
  draftBtn: {
    padding: '12px 24px',
    background: '#fff',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    color: '#374151',
  },
  submitBtn: {
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #B22234, #3C3B6E)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
  },
  successBox: {
    background: '#f0fdf4',
    border: '1px solid #86efac',
    color: '#16a34a',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
  },
}