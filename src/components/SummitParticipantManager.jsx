import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSummitDeviceId, summitSupabase } from '../lib/summitSupabase'

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function csvEscape(value) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export default function SummitParticipantManager() {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadParticipants = useCallback(async () => {
    if (!summitSupabase) return
    setError('')
    const [{ data, error: queryError }, { data: attendanceRows, error: attendanceError }] = await Promise.all([
      summitSupabase.from('participants')
        .select('id,display_name,anonymous_parking,device_id,registered_at,last_seen_at')
        .order('registered_at', { ascending: false }),
      summitSupabase.from('participant_attendance')
        .select('participant_id,day_id,first_seen_at,last_seen_at')
        .order('first_seen_at', { ascending: false }),
    ])
    if (queryError) {
      setError(queryError.message)
    } else {
      setParticipants(data || [])
      setAttendance(attendanceError ? [] : (attendanceRows || []))
      if (attendanceError) setError(attendanceError.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadParticipants()
    if (!summitSupabase) return undefined

    const channel = summitSupabase
      .channel('summit-participant-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => loadParticipants())
      .subscribe()

    return () => {
      summitSupabase.removeChannel(channel)
    }
  }, [loadParticipants])

  const stats = useMemo(() => {
    const now = Date.now()
    const activeWindow = 15 * 60 * 1000
    const active = participants.filter(p => p.last_seen_at && now - new Date(p.last_seen_at).getTime() <= activeWindow).length
    const named = participants.filter(p => !p.anonymous_parking).length
    const anonymous = participants.filter(p => p.anonymous_parking).length
    const dayAttendance = new Set(attendance.filter(a => a.day_id === attendanceDay).map(a => a.participant_id)).size
    return { active, named, anonymous, dayAttendance }
  }, [participants])

  const exportCsv = () => {
    const header = ['Participant Name', 'Registered At', 'Last Seen', 'Parking Lot Display', 'Device ID']
    const rows = participants.map(p => [
      p.display_name,
      formatDate(p.registered_at),
      formatDate(p.last_seen_at),
      p.anonymous_parking ? 'Anonymous' : 'Named',
      p.device_id,
    ])
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'Summit-2026-Participant-Register.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const deleteParticipant = async participant => {
    if (!summitSupabase || !participant?.id) return
    const name = participant.display_name || 'this participant'
    if (!window.confirm(`Delete ${name} from the Summit participant register? This will also remove the participant's saved notes.`)) return

    setDeletingId(participant.id)
    setError('')
    setMessage('')
    try {
      // Remove dependent notes first because notes reference the participant record.
      const { error: notesError } = await summitSupabase.from('notes').delete().eq('participant_id', participant.id)
      if (notesError) throw notesError

      const { error: deleteError } = await summitSupabase.from('participants').delete().eq('id', participant.id)
      if (deleteError) throw deleteError

      setParticipants(items => items.filter(item => item.id !== participant.id))
      setMessage(`${name} was removed from the Summit participant register.`)
    } catch (err) {
      setError(err.message || 'Unable to delete participant.')
    } finally {
      setDeletingId('')
    }
  }

  const refreshLastSeen = async () => {
    if (!summitSupabase) return
    await summitSupabase.rpc('touch_summit_participant', { p_device_id: getSummitDeviceId() })
  }

  return (
    <div className="participant-manager">
      <style>{`.participant-manager{border-top:1px solid #e6ebf0}.pm-head{padding:13px 15px;border-bottom:1px solid #e6ebf0;display:flex;justify-content:space-between;gap:12px;align-items:center}.pm-head h2{font-size:14px;color:#173b68;margin:0}.pm-actions{display:flex;gap:7px;flex-wrap:wrap}.pm-btn{border:1px solid #cfd9e4;border-radius:8px;padding:7px 10px;background:#fff;color:#20334b;font-size:10px;font-weight:700;cursor:pointer}.pm-btn.primary{background:#173b68;color:#fff;border-color:#173b68}.pm-btn.danger{background:#fff0f0;color:#8a3030;border-color:#e1b5b5}.pm-btn:disabled{opacity:.55;cursor:not-allowed}.pm-body{padding:14px}.pm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:13px}.pm-stat{background:#f7f9fc;border:1px solid #e2e8ef;border-radius:9px;padding:10px}.pm-stat strong{display:block;font-size:20px;color:#173b68}.pm-stat span{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:.07em}.pm-table-wrap{overflow:auto;border:1px solid #e1e7ef;border-radius:9px}.pm-table{width:100%;border-collapse:collapse;min-width:820px}.pm-table th,.pm-table td{padding:8px 9px;border-bottom:1px solid #edf1f5;text-align:left;font-size:10px;white-space:nowrap}.pm-table th{background:#f7f9fc;color:#607087;text-transform:uppercase;letter-spacing:.05em;font-size:9px}.pm-table tr:last-child td{border-bottom:0}.pm-status{display:inline-block;padding:3px 6px;border-radius:999px;font-size:9px;font-weight:700}.pm-status.active{background:#eaf3ea;color:#2f6838}.pm-status.idle{background:#f0f2f5;color:#718096}.pm-delete{border:1px solid #e1b5b5;border-radius:6px;padding:5px 8px;background:#fff0f0;color:#8a3030;font-size:9px;font-weight:800;cursor:pointer}.pm-delete:disabled{opacity:.55;cursor:not-allowed}.pm-note{font-size:10px;line-height:1.45;color:#718096;margin-top:10px}.pm-error{margin-bottom:10px;padding:8px;border-radius:8px;background:#fff1f1;border:1px solid #e6bcbc;color:#8c3030;font-size:10px}.pm-message{margin-bottom:10px;padding:8px;border-radius:8px;background:#edf7ee;border:1px solid #bfd8c2;color:#286333;font-size:10px}.pm-empty{padding:18px;text-align:center;color:#718096;font-size:11px}@media(max-width:700px){.pm-stats{grid-template-columns:repeat(2,1fr)}}`}</style>
      <div className="pm-head"><h2>Participant Management</h2><div className="pm-actions"><select className="pm-btn" value={attendanceDay} onChange={e=>setAttendanceDay(e.target.value)}><option value="day1">Day 1</option><option value="day2">Day 2</option><option value="day3">Day 3</option></select><button className="pm-btn" onClick={loadParticipants}>Refresh</button><button className="pm-btn primary" onClick={exportCsv} disabled={!participants.length}>Export CSV</button></div></div>
      <div className="pm-body">
        {error && <div className="pm-error">{error}</div>}
        {message && <div className="pm-message">{message}</div>}
        <div className="pm-stats">
          <div className="pm-stat"><strong>{participants.length}</strong><span>Registered</span></div>
          <div className="pm-stat"><strong>{stats.active}</strong><span>Active ≤15 min</span></div>
          <div className="pm-stat"><strong>{stats.named}</strong><span>Named Parking</span></div>
          <div className="pm-stat"><strong>{stats.anonymous}</strong><span>Anonymous Parking</span></div>
          <div className="pm-stat"><strong>{stats.dayAttendance}</strong><span>Attendance · {attendanceDay.toUpperCase()}</span></div>
        </div>
        {loading ? <div className="pm-empty">Loading participant registrations…</div> : participants.length === 0 ? <div className="pm-empty">No participant registrations yet.</div> : <div className="pm-table-wrap"><table className="pm-table"><thead><tr><th>Participant</th><th>Registered</th><th>Last Seen</th><th>Attendance</th><th>Parking Lot</th><th>Action</th></tr></thead><tbody>{participants.map(p => { const active = p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() <= 15*60*1000; return <tr key={p.id}><td><strong>{p.display_name || 'Unnamed'}</strong></td><td>{formatDate(p.registered_at)}</td><td>{formatDate(p.last_seen_at)}</td><td><span className={`pm-status ${attendance.some(a=>a.participant_id===p.id && a.day_id===attendanceDay)?'active':'idle'}`}>{attendance.some(a=>a.participant_id===p.id && a.day_id===attendanceDay)?'ATTENDED':'NOT RECORDED'}</span></td><td>{p.anonymous_parking?'Anonymous':'Named'}</td><td><button className="pm-delete" disabled={deletingId===p.id} onClick={() => void deleteParticipant(p)}>{deletingId===p.id?'Deleting…':'Delete'}</button></td></tr> })}</tbody></table></div>}
        <div className="pm-note">Attendance is recorded automatically by the Summit heartbeat against the day currently on air. The dashboard also shows the current last-seen status separately.  Deleting a participant removes the registration and that participant's saved notes. It does not delete Summit programme content, presentations, Parking Lot posts, polls or announcements.</div>
      </div>
    </div>
  )
}
