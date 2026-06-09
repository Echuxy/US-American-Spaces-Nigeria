import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PILLARS, STRATEGIC_PRIORITIES } from '../lib/programmeData'

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const QUARTERS = { Q1:[0,1,2], Q2:[3,4,5], Q3:[6,7,8], Q4:[9,10,11] }
const YEARS = [2024,2025,2026,2027,2028]

export default function AnalyticsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const today = new Date()
  const [reportType, setReportType] = useState('monthly')
  const [selYear, setSelYear] = useState(today.getFullYear())
  const [selMonth, setSelMonth] = useState(today.getMonth())
  const [selQuarter, setSelQuarter] = useState('Q2')
  const [filterSpace, setFilterSpace] = useState('')

  const [spaces, setSpaces] = useState([])
  const [reports, setReports] = useState([])
  const [eodNotes, setEodNotes] = useState([])
  const [proposals, setProposals] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadSpaces() }, [])

  async function loadSpaces() {
    const { data } = await supabase.from('american_spaces')
      .select('id,name,state').eq('active', true).order('name')
    setSpaces(data ?? [])
  }

  // ── Date range from report type ───────────────────────────
  function getDateRange() {
    if (reportType === 'monthly') {
      const start = `${selYear}-${String(selMonth+1).padStart(2,'0')}-01`
      const end = `${selYear}-${String(selMonth+1).padStart(2,'0')}-31`
      return { start, end, label: `${MONTHS[selMonth]} ${selYear}` }
    }
    if (reportType === 'quarterly') {
      const months = QUARTERS[selQuarter]
      const start = `${selYear}-${String(months[0]+1).padStart(2,'0')}-01`
      const end = `${selYear}-${String(months[2]+1).padStart(2,'0')}-31`
      return { start, end, label: `${selQuarter} ${selYear}` }
    }
    if (reportType === 'annual') {
      return { start: `${selYear}-01-01`, end: `${selYear}-12-31`, label: `Annual ${selYear}` }
    }
    // Executive summary = quarterly
    const months = QUARTERS[selQuarter]
    const start = `${selYear}-${String(months[0]+1).padStart(2,'0')}-01`
    const end = `${selYear}-${String(months[2]+1).padStart(2,'0')}-31`
    return { start, end, label: `Executive Summary — ${selQuarter} ${selYear}` }
  }

  async function loadData() {
    setLoading(true)
    setLoaded(false)
    setAiSummary('')
    setError('')
    const { start, end } = getDateRange()

    let rq = supabase.from('reports')
      .select(`*, american_spaces(name,state)`)
      .gte('activity_date', start).lte('activity_date', end)
      .eq('status', 'approved')
    if (filterSpace) rq = rq.eq('space_id', filterSpace)
    const { data: r } = await rq
    setReports(r ?? [])

    let eq = supabase.from('eod_notes')
      .select(`*, american_spaces(name,state)`)
      .gte('note_date', start).lte('note_date', end)
    if (filterSpace) eq = eq.eq('space_id', filterSpace)
    const { data: e } = await eq
    setEodNotes(e ?? [])

    let pq = supabase.from('programme_proposals')
      .select(`*, american_spaces(name,state)`)
      .gte('created_at', start).lte('created_at', end)
      .eq('status', 'approved')
    if (filterSpace) pq = pq.eq('space_id', filterSpace)
    const { data: p } = await pq
    setProposals(p ?? [])

    let aq = supabase.from('assets').select(`*, american_spaces(name)`)
      .eq('is_deleted', false)
    if (filterSpace) aq = aq.eq('space_id', filterSpace)
    const { data: a } = await aq
    setAssets(a ?? [])

    setLoaded(true)
    setLoading(false)
  }

  // ── Computed stats ────────────────────────────────────────
  const totalReports = reports.length
  const totalAttendance = reports.reduce((s,r) => s+(r.attendance??0), 0)
  const totalSpent = reports.reduce((s,r) => s+Number(r.amount_spent??0), 0)
  const totalVisitors = eodNotes.reduce((s,n) => s+(n.visitor_count??0), 0)
  const approvedProposals = proposals.length
  const totalAssets = assets.length
  const assetValue = assets.reduce((s,a) => s+Number(a.estimated_value??0), 0)

  const byPillar = PILLARS.map(p => ({
    label: p.label,
    count: reports.filter(r => r.pillar === p.label).length,
    attendance: reports.filter(r => r.pillar === p.label).reduce((s,r)=>s+(r.attendance??0),0),
  })).filter(p => p.count > 0).sort((a,b) => b.count-a.count)

  const byPriority = STRATEGIC_PRIORITIES.map(p => ({
    label: p,
    count: reports.filter(r => (r.strategic_priorities??[]).includes(p)).length,
  }))

  const bySpace = spaces.map(sp => ({
    name: sp.name.replace('American Corner ','').replace('American Center ','AC '),
    count: reports.filter(r => r.space_id === sp.id).length,
    attendance: reports.filter(r => r.space_id === sp.id).reduce((s,r)=>s+(r.attendance??0),0),
    spent: reports.filter(r => r.space_id === sp.id).reduce((s,r)=>s+Number(r.amount_spent??0),0),
  })).filter(sp => sp.count > 0).sort((a,b) => b.count-a.count)

  const maxBarCount = Math.max(...byPillar.map(p=>p.count), 1)

  // ── AI Executive Summary ──────────────────────────────────
  async function generateSummary() {
    setAiLoading(true)
    setError('')
    const { label } = getDateRange()

    const dataSnapshot = `
REPORT PERIOD: ${label}
SCOPE: ${filterSpace ? spaces.find(s=>s.id===filterSpace)?.name : 'All American Spaces Nigeria'}

ACTIVITY REPORTS:
- Total approved reports: ${totalReports}
- Total attendance: ${totalAttendance.toLocaleString()}
- Total programme expenditure: ₦${totalSpent.toLocaleString()}
- EOD notes filed: ${eodNotes.length}
- Total patron visits: ${totalVisitors.toLocaleString()}

PROGRAMME PROPOSALS:
- Approved proposals: ${approvedProposals}

PILLAR BREAKDOWN:
${byPillar.map(p => `- ${p.label}: ${p.count} programmes, ${p.attendance} attendees`).join('\n')}

STRATEGIC PRIORITY ALIGNMENT:
${byPriority.map(p => `- ${p.label}: ${p.count} programmes`).join('\n')}

TOP PERFORMING SPACES:
${bySpace.slice(0,5).map((s,i) => `${i+1}. ${s.name}: ${s.count} reports, ${s.attendance} attendees`).join('\n')}

INVENTORY:
- Total assets on record: ${totalAssets}
- Estimated total asset value: ₦${assetValue.toLocaleString()}
`

    const prompt = `You are a senior Public Diplomacy officer writing an executive summary report for the U.S. Mission Nigeria American Spaces Programme.

Based on the following data, write a professional executive summary report for ${label}.

DATA:
${dataSnapshot}

Write the executive summary in the following structure:
1. OVERVIEW (2 paragraphs — scope, key highlights)
2. PROGRAMME PERFORMANCE (key metrics, pillar analysis)
3. STRATEGIC ALIGNMENT (how activities align with USG priorities)
4. SPACE PERFORMANCE HIGHLIGHTS (top performers)
5. CHALLENGES & RECOMMENDATIONS (if any patterns suggest issues)
6. CONCLUSION (forward-looking, 1 paragraph)

Use formal diplomatic language. Be specific with numbers. Write approximately 600-800 words total.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      setAiSummary(text)
    } catch {
      setError('AI summary generation failed. Please try again.')
    }
    setAiLoading(false)
  }

  // ── Excel Export ──────────────────────────────────────────
  async function exportExcel() {
    setExporting(true)
    const { label } = getDateRange()

    // Build CSV content for each sheet (we'll combine as multi-section CSV)
    const rows = [
      ['AMERICAN SPACES NIGERIA — ' + label.toUpperCase()],
      ['Generated:', new Date().toLocaleString('en-NG')],
      [''],
      ['=== SUMMARY ==='],
      ['Metric', 'Value'],
      ['Total Reports', totalReports],
      ['Total Attendance', totalAttendance],
      ['Total Expenditure (₦)', totalSpent],
      ['EOD Notes Filed', eodNotes.length],
      ['Total Patron Visits', totalVisitors],
      ['Approved Proposals', approvedProposals],
      [''],
      ['=== REPORTS BY PILLAR ==='],
      ['Pillar', 'Reports', 'Attendance'],
      ...byPillar.map(p => [p.label, p.count, p.attendance]),
      [''],
      ['=== STRATEGIC PRIORITY ALIGNMENT ==='],
      ['Priority', 'Reports'],
      ...byPriority.map(p => [p.label, p.count]),
      [''],
      ['=== SPACE PERFORMANCE ==='],
      ['Space', 'Reports', 'Attendance', 'Expenditure (₦)'],
      ...bySpace.map(s => [s.name, s.count, s.attendance, s.spent]),
      [''],
      ['=== ALL REPORTS ==='],
      ['Date', 'Space', 'Programme Title', 'Pillar', 'Category', 'Attendance', 'Amount Spent (₦)', 'Facilitators', 'Status'],
      ...reports.map(r => [
        r.activity_date,
        r.american_spaces?.name,
        r.programme_title,
        r.pillar,
        r.programme_category,
        r.attendance,
        r.amount_spent,
        r.facilitators,
        r.status,
      ]),
      [''],
      ['=== END-OF-DAY NOTES ==='],
      ['Date', 'Space', 'Visitor Count', 'Highlights (excerpt)'],
      ...eodNotes.map(n => [
        n.note_date,
        n.american_spaces?.name,
        n.visitor_count,
        (n.highlights ?? '').slice(0,100),
      ]),
    ]

    const csv = rows.map(row =>
      row.map(cell => `"${String(cell ?? '').replace(/"/g,'""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AmericanSpacesNigeria_${label.replace(/\s+/g,'_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setSuccess('✅ Excel/CSV exported successfully.')
    setExporting(false)
  }

  // ── PDF Export ────────────────────────────────────────────
  async function exportPDF() {
    setExporting(true)
    const { label } = getDateRange()

    const content = `
      <html>
      <head>
        <title>American Spaces Nigeria — ${label}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; padding: 40px; }
          h1 { color: #1a1f3a; border-bottom: 3px solid #B22234; padding-bottom: 10px; }
          h2 { color: #1a1f3a; margin-top: 30px; font-size: 16px; border-left: 4px solid #B22234; padding-left: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          th { background: #1a1f3a; color: #fff; padding: 8px 10px; text-align: left; }
          td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) td { background: #f9fafb; }
          .stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin: 16px 0; }
          .stat-box { background: #f3f4f6; border-radius: 8px; padding: 14px; text-align: center; }
          .stat-val { font-size: 24px; font-weight: 800; color: #1a1f3a; }
          .stat-lab { font-size: 11px; color: #6b7280; margin-top: 4px; }
          .flag { height: 8px; background: linear-gradient(90deg, #B22234 33%, #fff 33%, #fff 66%, #3C3B6E 66%); margin-bottom: 20px; border-radius: 4px; }
          .ai-box { background: #f8faff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 16px; margin-top: 12px; white-space: pre-wrap; font-size: 13px; line-height: 1.7; }
          .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="flag"></div>
        <h1>🇺🇸 American Spaces Nigeria</h1>
        <p style="color:#6b7280;margin-top:-10px">Report Period: <strong>${label}</strong> &nbsp;·&nbsp; Generated: ${new Date().toLocaleString('en-NG')}</p>

        <h2>Summary Statistics</h2>
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-val">${totalReports}</div><div class="stat-lab">Total Reports</div></div>
          <div class="stat-box"><div class="stat-val">${totalAttendance.toLocaleString()}</div><div class="stat-lab">Total Attendance</div></div>
          <div class="stat-box"><div class="stat-val">₦${totalSpent.toLocaleString()}</div><div class="stat-lab">Total Expenditure</div></div>
          <div class="stat-box"><div class="stat-val">${totalVisitors.toLocaleString()}</div><div class="stat-lab">Patron Visits</div></div>
        </div>

        <h2>Reports by Programming Pillar</h2>
        <table>
          <tr><th>Pillar</th><th>Reports</th><th>Attendance</th></tr>
          ${byPillar.map(p => `<tr><td>${p.label}</td><td>${p.count}</td><td>${p.attendance}</td></tr>`).join('')}
        </table>

        <h2>Strategic Priority Alignment</h2>
        <table>
          <tr><th>Priority</th><th>Reports</th></tr>
          ${byPriority.map(p => `<tr><td>${p.label}</td><td>${p.count}</td></tr>`).join('')}
        </table>

        <h2>Space Performance League Table</h2>
        <table>
          <tr><th>Rank</th><th>Space</th><th>Reports</th><th>Attendance</th><th>Expenditure (₦)</th></tr>
          ${bySpace.map((s,i) => `<tr><td>${i+1}</td><td>${s.name}</td><td>${s.count}</td><td>${s.attendance}</td><td>${s.spent.toLocaleString()}</td></tr>`).join('')}
        </table>

        <h2>All Activity Reports</h2>
        <table>
          <tr><th>Date</th><th>Space</th><th>Programme</th><th>Pillar</th><th>Attendance</th><th>Spent (₦)</th></tr>
          ${reports.map(r => `<tr><td>${r.activity_date}</td><td>${r.american_spaces?.name??''}</td><td>${r.programme_title}</td><td>${r.pillar}</td><td>${r.attendance}</td><td>${Number(r.amount_spent).toLocaleString()}</td></tr>`).join('')}
        </table>

        ${aiSummary ? `<h2>AI Executive Summary</h2><div class="ai-box">${aiSummary}</div>` : ''}

        <div class="footer">U.S. Embassy & Consulates in Nigeria — Public Diplomacy Section — American Spaces Programme<br>This report is automatically generated by the American Spaces Nigeria Reporting Platform.</div>
      </body>
      </html>
    `

    const win = window.open('', '_blank')
    win.document.write(content)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); }, 500)
    setSuccess('✅ PDF report opened. Use your browser\'s Print → Save as PDF.')
    setExporting(false)
  }

  const { label } = getDateRange()

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div style={s.topbarCenter}>
          <h1 style={s.appTitle}>📊 Analytics & Reports</h1>
          <p style={s.appSub}>American Spaces Nigeria</p>
        </div>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* ── Report Builder ── */}
        <div style={s.builderCard}>
          <h3 style={s.builderTitle}>⚙️ Report Builder</h3>
          <div style={s.builderRow}>
            {/* Report type */}
            <div style={s.typeGrid}>
              {[
                { key: 'monthly', label: '📅 Monthly' },
                { key: 'quarterly', label: '🗓️ Quarterly' },
                { key: 'annual', label: '📆 Annual' },
                { key: 'executive', label: '📋 Executive Summary' },
              ].map(t => (
                <button key={t.key}
                  style={{ ...s.typeBtn, ...(reportType === t.key ? s.typeBtnActive : {}) }}
                  onClick={() => setReportType(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Period selectors */}
            <div style={s.periodRow}>
              <select style={s.sel} value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              {reportType === 'monthly' && (
                <select style={s.sel} value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))}>
                  {MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              )}

              {(reportType === 'quarterly' || reportType === 'executive') && (
                <select style={s.sel} value={selQuarter} onChange={e => setSelQuarter(e.target.value)}>
                  {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              )}

              <select style={s.sel} value={filterSpace} onChange={e => setFilterSpace(e.target.value)}>
                <option value="">🌍 All Spaces</option>
                {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.name.replace('American Corner ','').replace('American Center ','AC ')}</option>)}
              </select>

              <button style={{ ...s.generateBtn, opacity: loading ? 0.7 : 1 }}
                onClick={loadData} disabled={loading}>
                {loading ? '⏳ Loading...' : '▶ Generate Report'}
              </button>
            </div>
          </div>
        </div>

        {loaded && (
          <>
            {/* ── Period Header ── */}
            <div style={s.periodHeader}>
              <div>
                <h2 style={s.periodTitle}>{label}</h2>
                <p style={s.periodSub}>
                  {filterSpace ? spaces.find(s=>s.id===filterSpace)?.name : 'All American Spaces Nigeria'}
                </p>
              </div>
              <div style={s.exportBtns}>
                <button style={{ ...s.exportBtn, opacity: exporting ? 0.7 : 1 }}
                  onClick={exportExcel} disabled={exporting}>
                  📊 Export Excel/CSV
                </button>
                <button style={{ ...s.exportBtn, background: '#B22234', opacity: exporting ? 0.7 : 1 }}
                  onClick={exportPDF} disabled={exporting}>
                  📄 Export PDF
                </button>
              </div>
            </div>

            {/* ── Stat cards ── */}
            <div style={s.statGrid}>
              <StatCard icon="📋" label="Approved Reports" value={totalReports} color="#3C3B6E" />
              <StatCard icon="👥" label="Total Attendance" value={totalAttendance.toLocaleString()} color="#B22234" />
              <StatCard icon="💰" label="Total Expenditure" value={`₦${totalSpent.toLocaleString()}`} color="#0369a1" />
              <StatCard icon="📓" label="EOD Notes" value={eodNotes.length} color="#d97706" />
              <StatCard icon="🚶" label="Patron Visits" value={totalVisitors.toLocaleString()} color="#16a34a" />
              <StatCard icon="🎯" label="Approved Proposals" value={approvedProposals} color="#7c3aed" />
            </div>

            <div style={s.chartsRow}>
              {/* Pillar breakdown */}
              <div style={s.chartCard}>
                <h3 style={s.chartTitle}>📊 Reports by Programming Pillar</h3>
                {byPillar.length === 0
                  ? <p style={s.empty}>No data.</p>
                  : byPillar.map(p => (
                    <div key={p.label} style={s.barRow}>
                      <span style={s.barLabel} title={p.label}>{p.label}</span>
                      <div style={s.barTrack}>
                        <div style={{ ...s.barFill, width: `${(p.count/maxBarCount)*100}%` }} />
                      </div>
                      <span style={s.barCount}>{p.count}</span>
                      <span style={s.barAttend}>👥{p.attendance}</span>
                    </div>
                  ))
                }
              </div>

              {/* Priority alignment */}
              <div style={s.chartCard}>
                <h3 style={s.chartTitle}>🎯 Strategic Priority Alignment</h3>
                {byPriority.map((p,i) => {
                  const colors = ['#B22234','#3C3B6E','#0369a1','#16a34a']
                  const total = byPriority.reduce((s,x)=>s+x.count,0)||1
                  const pct = Math.round((p.count/total)*100)
                  return (
                    <div key={p.label} style={s.priorityRow}>
                      <div style={{ ...s.priorityDot, background: colors[i] }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                          <span style={s.priorityLabel}>{p.label.replace('Making America ','').replace('Celebrating American ','')}</span>
                          <span style={{ fontSize:'12px', fontWeight:700, color: colors[i] }}>{p.count}</span>
                        </div>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width:`${pct}%`, background: colors[i] }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Space League Table */}
            <div style={s.tableCard}>
              <h3 style={s.chartTitle}>🏆 Space Performance League Table</h3>
              {bySpace.length === 0
                ? <p style={s.empty}>No data for this period.</p>
                : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          {['Rank','Space','Reports','Attendance','Expenditure (₦)','Avg Attendance'].map(h=>(
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bySpace.map((sp,i) => (
                          <tr key={sp.name} style={{ background: i%2===0?'#fff':'#f9fafb' }}>
                            <td style={s.td}>
                              <span style={{ ...s.rankBadge, background: i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'#f3f4f6', color: i<3?'#1a1f3a':'#6b7280' }}>
                                #{i+1}
                              </span>
                            </td>
                            <td style={{ ...s.td, fontWeight:600 }}>{sp.name}</td>
                            <td style={s.td}>{sp.count}</td>
                            <td style={s.td}>{sp.attendance.toLocaleString()}</td>
                            <td style={s.td}>₦{sp.spent.toLocaleString()}</td>
                            <td style={s.td}>{sp.count>0?Math.round(sp.attendance/sp.count):0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>

            {/* AI Executive Summary */}
            <div style={s.aiCard}>
              <div style={s.aiCardHeader}>
                <div>
                  <h3 style={s.chartTitle}>✨ AI Executive Summary</h3>
                  <p style={s.aiHint}>Claude generates a formal diplomatic narrative based on the report data above.</p>
                </div>
                <button style={{ ...s.aiBtn, opacity: aiLoading ? 0.7 : 1 }}
                  onClick={generateSummary} disabled={aiLoading}>
                  {aiLoading ? '⏳ Generating...' : aiSummary ? '🔄 Regenerate' : '✨ Generate Summary'}
                </button>
              </div>
              {aiSummary && (
                <div style={s.summaryBox}>
                  <div style={s.summaryHeader}>
                    <span style={s.summaryLabel}>Executive Summary — {label}</span>
                    <span style={s.wordCount}>{aiSummary.split(/\s+/).length} words</span>
                  </div>
                  <div style={s.summaryText}>
                    {aiSummary.split('\n').map((line, i) => (
                      line.trim() ? (
                        <p key={i} style={{
                          margin: '0 0 10px',
                          fontWeight: line.match(/^\d\./) ? 700 : 400,
                          color: line.match(/^\d\./) ? '#1a1f3a' : '#374151',
                        }}>{line}</p>
                      ) : <br key={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!loaded && !loading && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>📊</div>
            <h3 style={s.emptyTitle}>Select report parameters above</h3>
            <p style={s.emptyText}>Choose your report type, period, and scope, then click Generate Report.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statIcon, background: color+'18' }}>{icon}</div>
      <div>
        <p style={s.statValue}>{value}</p>
        <p style={s.statLabel}>{label}</p>
      </div>
      <div style={{ ...s.statAccent, background: color }} />
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'#f1f5f9', fontFamily:"'Segoe UI', sans-serif" },
  topbar: { background:'linear-gradient(135deg, #1a1f3a, #2d3561)', padding:'0 20px', display:'flex', alignItems:'center', gap:'16px', height:'64px', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(0,0,0,0.3)' },
  backBtn: { background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', padding:'7px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' },
  topbarCenter: { flex:1 },
  appTitle: { margin:0, fontSize:'16px', fontWeight:700, color:'#fff' },
  appSub: { margin:0, fontSize:'11px', color:'#93a4d4' },
  body: { padding:'24px', maxWidth:'1200px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'20px' },
  builderCard: { background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' },
  builderTitle: { margin:'0 0 14px', fontSize:'14px', fontWeight:700, color:'#1a1f3a' },
  builderRow: { display:'flex', flexDirection:'column', gap:'12px' },
  typeGrid: { display:'flex', gap:'8px', flexWrap:'wrap' },
  typeBtn: { padding:'9px 18px', background:'#f3f4f6', border:'1.5px solid #e5e7eb', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:600, color:'#6b7280' },
  typeBtnActive: { background:'#1a1f3a', border:'1.5px solid #1a1f3a', color:'#fff' },
  periodRow: { display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center' },
  sel: { padding:'9px 12px', border:'1.5px solid #d1d5db', borderRadius:'8px', fontSize:'13px', fontFamily:"'Segoe UI', sans-serif" },
  generateBtn: { padding:'10px 24px', background:'linear-gradient(135deg, #B22234, #3C3B6E)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:'pointer' },
  periodHeader: { background:'linear-gradient(135deg, #1a1f3a, #2d3561)', borderRadius:'12px', padding:'20px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' },
  periodTitle: { margin:0, fontSize:'22px', fontWeight:800, color:'#fff' },
  periodSub: { margin:'4px 0 0', color:'#93a4d4', fontSize:'13px' },
  exportBtns: { display:'flex', gap:'10px' },
  exportBtn: { padding:'10px 18px', background:'#16a34a', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer' },
  statGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:'14px' },
  statCard: { background:'#fff', borderRadius:'12px', padding:'16px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', position:'relative', overflow:'hidden' },
  statIcon: { width:'42px', height:'42px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 },
  statValue: { margin:0, fontSize:'20px', fontWeight:800, color:'#111827' },
  statLabel: { margin:0, fontSize:'12px', color:'#6b7280' },
  statAccent: { position:'absolute', right:0, top:0, bottom:0, width:'4px' },
  chartsRow: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' },
  chartCard: { background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' },
  chartTitle: { margin:'0 0 16px', fontSize:'14px', fontWeight:700, color:'#1a1f3a' },
  barRow: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' },
  barLabel: { fontSize:'11px', color:'#374151', width:'140px', flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  barTrack: { flex:1, height:'8px', background:'#f3f4f6', borderRadius:'4px', overflow:'hidden' },
  barFill: { height:'100%', background:'linear-gradient(90deg, #3C3B6E, #B22234)', borderRadius:'4px', transition:'width 0.4s ease' },
  barCount: { fontSize:'12px', fontWeight:700, color:'#374151', width:'24px', textAlign:'right' },
  barAttend: { fontSize:'11px', color:'#6b7280', width:'50px' },
  priorityRow: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' },
  priorityDot: { width:'10px', height:'10px', borderRadius:'50%', flexShrink:0 },
  priorityLabel: { fontSize:'12px', color:'#374151' },
  tableCard: { background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' },
  tableWrap: { overflowX:'auto', marginTop:'8px' },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { padding:'10px 12px', background:'#f8faff', borderBottom:'2px solid #e5e7eb', fontSize:'12px', fontWeight:700, color:'#374151', textAlign:'left', whiteSpace:'nowrap' },
  td: { padding:'10px 12px', fontSize:'13px', color:'#374151', borderBottom:'1px solid #f3f4f6' },
  rankBadge: { padding:'3px 8px', borderRadius:'20px', fontSize:'12px', fontWeight:800 },
  aiCard: { background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' },
  aiCardHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'4px' },
  aiHint: { fontSize:'12px', color:'#6b7280', margin:'4px 0 0' },
  aiBtn: { padding:'10px 20px', background:'linear-gradient(135deg, #B22234, #3C3B6E)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' },
  summaryBox: { background:'#f8faff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'18px', marginTop:'14px' },
  summaryHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' },
  summaryLabel: { fontSize:'13px', fontWeight:700, color:'#1a1f3a' },
  wordCount: { background:'#3C3B6E', color:'#fff', padding:'2px 10px', borderRadius:'20px', fontSize:'11px' },
  summaryText: { fontSize:'14px', lineHeight:1.8 },
  emptyState: { background:'#fff', borderRadius:'12px', padding:'60px 40px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' },
  emptyIcon: { fontSize:'48px', marginBottom:'16px' },
  emptyTitle: { margin:'0 0 8px', fontSize:'18px', fontWeight:700, color:'#1a1f3a' },
  emptyText: { margin:0, fontSize:'14px', color:'#6b7280' },
  empty: { padding:'30px', textAlign:'center', color:'#9ca3af', fontSize:'14px' },
  errorBox: { background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', padding:'12px 16px', borderRadius:'8px', fontSize:'14px' },
  successBox: { background:'#f0fdf4', border:'1px solid #86efac', color:'#16a34a', padding:'12px 16px', borderRadius:'8px', fontSize:'14px' },
}