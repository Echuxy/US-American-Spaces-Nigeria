import { useMemo, useState } from 'react'

const sessions = [
  ['DAY 1', '09:00', 'Arrival, Registration and Hall Setup'],
  ['DAY 1', '11:00', 'Setting the Stage'],
  ['DAY 1', '13:00', 'Opening and Welcome Remarks (+ Photo Opportunity)'],
  ['DAY 1', '14:00', 'Overview: The AI Revolution and U.S. Public Diplomacy Priorities'],
  ['DAY 1', '15:00', 'Current use cases of AI by American Spaces in Nigeria'],
  ['DAY 1', '15:30', 'Topic to be decided'],
  ['DAY 2', '08:00', 'Ice Breaker'],
  ['DAY 2', '08:05', 'Hands-On Session: AI-Assisted Program Planning'],
  ['DAY 2', '09:15', 'Hands-On Session: AI Assisted Flyer and Graphic Designs'],
  ['DAY 2', '13:00', 'Hands-On Session: AI for Audience Engagement and Presentation'],
  ['DAY 2', '14:00', 'Hands-On Session: Use of Gemini NotebookLM'],
  ['DAY 2', '15:00', 'Mapping ICS Goals to Achieving High Impacting American Spaces Programming'],
  ['DAY 2', '16:00', 'Hands-On Session: Programming American Spaces using ICS Goals'],
  ['DAY 2', '16:45', 'Parking Lot and Day 2 Wrap-Up'],
  ['DAY 3', '08:00', 'Ice Breaker'],
  ['DAY 3', '08:10', 'American Spaces Nigeria Strategic Plan: Review FY2026 and Plan FY2027'],
  ['DAY 3', '09:10', 'Hands On Session: Introduction to Vibe Coding'],
  ['DAY 3', '10:25', 'Hands On Session: Introduction to Vibe Coding continued'],
  ['DAY 3', '13:00', 'Financial matters and Looking Ahead'],
  ['DAY 3', '13:30', 'Practice Session'],
  ['DAY 3', '14:40', 'Summit Evaluation'],
  ['DAY 3', '15:40', 'Closing Ceremony, Certificate Presentation, and Group Photo'],
  ['DAY 3', '16:30', 'Parking Lot and Day 3 Wrap-Up'],
]

export default function SummitControlRoom() {
  const [selected, setSelected] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [announcements, setAnnouncements] = useState([])
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState('')
  const [pollOpen, setPollOpen] = useState(false)
  const [moderationMode, setModerationMode] = useState(true)
  const [parking, setParking] = useState([
    { id: 1, text: 'How will we measure AI adoption after the Summit?', name: 'Participant', votes: 4, visible: true },
    { id: 2, text: 'Can we share the programme-planning prompts after the session?', name: 'Anonymous', votes: 2, visible: true },
  ])

  const session = sessions[selected]
  const dayCounts = useMemo(() => ({
    'DAY 1': sessions.filter((item) => item[0] === 'DAY 1').length,
    'DAY 2': sessions.filter((item) => item[0] === 'DAY 2').length,
    'DAY 3': sessions.filter((item) => item[0] === 'DAY 3').length,
  }), [])

  const sendAnnouncement = () => {
    const text = announcement.trim()
    if (!text) return
    setAnnouncements((items) => [{ id: Date.now(), text }, ...items])
    setAnnouncement('')
  }

  const publishPoll = () => {
    if (!pollQuestion.trim() || !pollOptions.trim()) return
    setPollOpen(true)
  }

  const toggleParking = (id) => setParking((items) => items.map((item) => item.id === id ? { ...item, visible: !item.visible } : item))

  return (
    <div className="control-room">
      <style>{`
        .control-room{min-height:100vh;background:#f3f6fa;color:#172337;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.cr-head{background:#102f56;color:#fff;padding:22px 28px}.cr-wrap{max-width:1450px;margin:auto}.cr-head h1{margin:5px 0;font-size:30px}.cr-head p{margin:0;color:#d9e3ef;font-size:13px}.cr-grid{max-width:1450px;margin:18px auto;padding:0 20px;display:grid;grid-template-columns:270px minmax(0,1fr) 330px;gap:15px}.cr-card{background:#fff;border:1px solid #dce4ed;border-radius:14px;overflow:hidden}.cr-card h2{font-size:14px;color:#173b68;margin:0}.cr-title{padding:13px 15px;border-bottom:1px solid #e6ebf0;display:flex;justify-content:space-between;gap:8px}.cr-body{padding:14px}.session{padding:10px 12px;border-bottom:1px solid #edf1f5;cursor:pointer}.session.active{background:#edf3f9;border-left:3px solid #173b68;padding-left:9px}.session b{font-size:11px;color:#173b68}.session div{font-size:12px;line-height:1.35;margin-top:3px}.small{font-size:11px;color:#718096}.metric{padding:12px 0;border-bottom:1px solid #e8edf2}.metric strong{display:block;font-size:22px;color:#173b68}.label{font-size:10px;color:#78869a;text-transform:uppercase;letter-spacing:.08em}.input,.textarea{width:100%;box-sizing:border-box;border:1px solid #ccd6e1;border-radius:8px;padding:9px;font:inherit;font-size:12px}.textarea{min-height:82px;resize:vertical}.btn{border:1px solid #cfd9e4;border-radius:8px;padding:8px 11px;background:#fff;color:#20334b;font-size:11px;cursor:pointer}.primary{background:#173b68;color:#fff;border-color:#173b68}.danger{background:#fff0f0;border-color:#e1b5b5}.row{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.notice{padding:9px;border-radius:8px;background:#f7f0df;border:1px solid #e1cfa4;font-size:11px;margin-top:9px}.parking-item{padding:10px 0;border-bottom:1px solid #edf1f5}.parking-item.hidden{opacity:.45}.parking-item p{font-size:12px;line-height:1.4;margin:5px 0}.pollbox{background:#f7f9fc;border:1px solid #e2e8ef;border-radius:10px;padding:10px;margin-top:10px}.status{display:inline-block;padding:5px 8px;border-radius:999px;background:#eaf3ea;color:#2f6838;font-size:10px;font-weight:700}.tab{font-size:10px;font-weight:700;border:0;background:#eef3f8;padding:6px 9px;border-radius:7px;margin:2px}.tab.active{background:#173b68;color:#fff}@media(max-width:1100px){.cr-grid{grid-template-columns:1fr 1fr}.cr-grid>.cr-card:first-child{grid-column:1/-1}}@media(max-width:700px){.cr-grid{grid-template-columns:1fr;padding:0 12px}.cr-head{padding:18px 15px}}
      `}</style>
      <header className="cr-head"><div className="cr-wrap"><div className="small" style={{color:'#b9c9da'}}>SUMMIT OF AMERICAN SPACES IN NIGERIA 2026 · COORDINATOR</div><h1>Control Room</h1><p>Live operations workspace for sessions, announcements, polls and Parking Lot moderation.</p></div></header>
      <main className="cr-grid">
        <section className="cr-card"><div className="cr-title"><h2>Programme</h2><span className="status">COORDINATOR</span></div><div>{sessions.map((item, index) => <button className={`session ${index === selected ? 'active' : ''}`} style={{display:'block',width:'100%',textAlign:'left',border:0}} key={`${item[0]}-${item[1]}`} onClick={() => setSelected(index)}><b>{item[0]} · {item[1]}</b><div>{item[2]}</div></button>)}</div></section>
        <section>
          <div className="cr-card"><div className="cr-title"><h2>Live Session</h2><span className="small">Slide sync: ready</span></div><div className="cr-body"><div className="label">Selected session</div><h2 style={{fontSize:22,margin:'5px 0',color:'#173b68'}}>{session[2]}</h2><div className="small">{session[0]} · {session[1]}</div><div className="metric"><div className="label">Facilitator</div><strong style={{fontSize:15}}>[BIO + HEADSHOT TO BE SUPPLIED]</strong></div><div className="metric"><div className="label">Presenter control</div><strong style={{fontSize:15}}>Coordinator Override Available</strong></div><div className="row"><button className="btn primary" onClick={() => alert('Production slide override will synchronize through the realtime backend.')}>Take Slide Control</button><button className="btn" onClick={() => alert('Session advanced in the production realtime engine.')}>Advance Session</button></div><div className="notice">Prototype mode: controls are local until the dedicated Summit backend and realtime policies are connected.</div></div></div>
          <div className="cr-card" style={{marginTop:15}}><div className="cr-title"><h2>Live Poll</h2><span className="small">Participant devices</span></div><div className="cr-body"><input className="input" value={pollQuestion} onChange={(e)=>setPollQuestion(e.target.value)} placeholder="Poll question"/><input className="input" style={{marginTop:7}} value={pollOptions} onChange={(e)=>setPollOptions(e.target.value)} placeholder="Options separated by commas"/><div className="row"><button className="btn primary" onClick={publishPoll}>Publish Poll</button><button className="btn" onClick={()=>setPollOpen(false)}>Close Poll</button></div>{pollOpen && <div className="pollbox"><b>{pollQuestion}</b><div className="small" style={{marginTop:5}}>{pollOptions.split(',').map((o)=>o.trim()).filter(Boolean).join(' · ')}</div><span className="status" style={{marginTop:8}}>LIVE</span></div>}</div></div>
        </section>
        <aside>
          <div className="cr-card"><div className="cr-title"><h2>Summit Pulse</h2></div><div className="cr-body"><div className="metric"><div className="label">Programme items</div><strong>33</strong></div>{Object.entries(dayCounts).map(([day,count])=><div className="metric" key={day}><div className="label">{day}</div><strong>{count}</strong></div>)}<div className="metric"><div className="label">Departure</div><strong style={{fontSize:15}}>September 24</strong></div></div></div>
          <div className="cr-card" style={{marginTop:15}}><div className="cr-title"><h2>Broadcast Announcement</h2></div><div className="cr-body"><textarea className="textarea" value={announcement} onChange={(e)=>setAnnouncement(e.target.value)} placeholder="Message to all participant devices..."/><div className="row"><button className="btn primary" onClick={sendAnnouncement}>Broadcast</button></div>{announcements.map((item)=><div className="notice" key={item.id}>{item.text}</div>)}</div></div>
          <div className="cr-card" style={{marginTop:15}}><div className="cr-title"><h2>Parking Lot Moderation</h2><button className="tab active" onClick={()=>setModerationMode(!moderationMode)}>{moderationMode?'MODERATION ON':'MODERATION OFF'}</button></div><div className="cr-body">{parking.map((item)=><div className={`parking-item ${item.visible?'':'hidden'}`} key={item.id}><div className="small">{item.name} · {item.votes} upvotes</div><p>{item.text}</p><button className={`btn ${item.visible?'danger':''}`} onClick={()=>toggleParking(item.id)}>{item.visible?'Remove from display':'Restore to display'}</button></div>)}</div></div>
        </aside>
      </main>
    </div>
  )
}
