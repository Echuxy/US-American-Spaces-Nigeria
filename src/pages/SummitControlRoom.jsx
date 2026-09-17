import { useEffect, useMemo, useState } from 'react'
import { createSummitRealtime, summitEventTypes } from '../lib/summitRealtime'
import { summitSupabase } from '../lib/summitSupabase'

const fallbackSessions = [
  ['DAY 1','09:00','Arrival, Registration and Hall Setup'],['DAY 1','11:00','Setting the Stage'],['DAY 1','13:00','Opening and Welcome Remarks (+ Photo Opportunity)'],['DAY 1','14:00','Overview: The AI Revolution and U.S. Public Diplomacy Priorities'],['DAY 1','15:00','Current use cases of AI by American Spaces in Nigeria'],['DAY 1','15:30','Topic to be decided'],
  ['DAY 2','08:00','Ice Breaker'],['DAY 2','08:05','Hands-On Session: AI-Assisted Program Planning'],['DAY 2','09:15','AI Assisted Flyer and Graphic Designs'],['DAY 2','13:00','AI for Audience Engagement and Presentation'],['DAY 2','14:00','Use of Gemini NotebookLM'],['DAY 2','15:00','Mapping ICS Goals to Achieving High Impacting American Spaces Programming'],['DAY 2','16:00','Programming American Spaces using ICS Goals'],['DAY 2','16:45','Parking Lot and Day 2 Wrap-Up'],
  ['DAY 3','08:00','Ice Breaker'],['DAY 3','08:10','American Spaces Nigeria Strategic Plan: Review FY2026 and Plan FY2027'],['DAY 3','09:10','Introduction to Vibe Coding'],['DAY 3','10:25','Introduction to Vibe Coding continued'],['DAY 3','13:00','Financial matters and Looking Ahead'],['DAY 3','13:30','Practice Session'],['DAY 3','14:40','Summit Evaluation'],['DAY 3','15:40','Closing Ceremony, Certificate Presentation, and Group Photo'],['DAY 3','16:30','Parking Lot and Day 3 Wrap-Up'],
]

const fallback = fallbackSessions.map(([day,time,title],index)=>({id:`fallback-${index}`,day_id:day.toLowerCase().replace(' ','').replace('day','day'),sort_order:index,start_time:time,title,facilitator:''}))

export default function SummitControlRoom() {
  const realtime = useMemo(() => createSummitRealtime(), [])
  const [sessions,setSessions] = useState(fallback)
  const [selected,setSelected] = useState(0)
  const [slide,setSlide] = useState(1)
  const [content,setContent] = useState({session:null,resources:[]})
  const [loading,setLoading] = useState(true)
  const [announcement,setAnnouncement] = useState('')
  const [announcements,setAnnouncements] = useState([])
  const [pollQuestion,setPollQuestion] = useState('')
  const [pollOptions,setPollOptions] = useState('')
  const [pollOpen,setPollOpen] = useState(false)
  const [pollResponses,setPollResponses] = useState({})
  const [parking,setParking] = useState([])
  const [moderationMode,setModerationMode] = useState(true)

  const session = sessions[selected] || null
  const currentDayId = session?.day_id || 'day1'

  const loadSessions = async () => {
    if (!summitSupabase) { setLoading(false); return }
    const { data, error } = await summitSupabase
      .from('sessions')
      .select('id,day_id,sort_order,start_time,title,facilitator,facilitator_bio,facilitator_headshot_url')
      .order('day_id')
      .order('sort_order')
    if (!error && data?.length) setSessions(data)
    setLoading(false)
  }

  const loadContent = async (sessionId) => {
    if (!summitSupabase || !sessionId || String(sessionId).startsWith('fallback-')) {
      setContent({session:null,resources:[]})
      return
    }
    const [profileResult,resourceResult] = await Promise.all([
      summitSupabase.from('sessions').select('id,facilitator,facilitator_bio,facilitator_headshot_url').eq('id',sessionId).maybeSingle(),
      summitSupabase.from('session_resources').select('id,title,resource_url,resource_type,sort_order').eq('session_id',sessionId).order('sort_order',{ascending:true}),
    ])
    setContent({session:profileResult.data||null,resources:resourceResult.data||[]})
  }

  const loadLiveData = async () => {
    if (!summitSupabase) return
    const [parkingResult,pollResult,announcementResult] = await Promise.all([
      summitSupabase.from('parking_lot_posts').select('id,day_id,text,display_name,anonymous,votes,visible,pinned,created_at').order('created_at',{ascending:false}).limit(100),
      summitSupabase.from('polls').select('id,question,options,status,created_at').eq('status','open').order('created_at',{ascending:false}).limit(1),
      summitSupabase.from('announcements').select('id,text,created_at').order('created_at',{ascending:false}).limit(10),
    ])
    if (parkingResult.data) setParking(parkingResult.data.map(p=>({id:p.id,dayId:p.day_id,text:p.text,name:p.anonymous?'Anonymous':p.display_name||'Participant',votes:p.votes||0,visible:p.visible!==false,pinned:p.pinned,time:new Date(p.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})})))
    if (announcementResult.data) setAnnouncements(announcementResult.data)
    const poll = pollResult.data?.[0]
    if (poll) {
      setPollOpen(true)
      setPollQuestion(poll.question)
      setPollOptions((poll.options||[]).join(', '))
      const responseResult = await summitSupabase.from('poll_responses').select('option').eq('poll_id',poll.id)
      const counts = Object.fromEntries((poll.options||[]).map(option=>[option,0]))
      ;(responseResult.data||[]).forEach(row=>{counts[row.option]=(counts[row.option]||0)+1})
      setPollResponses(counts)
    }
  }

  useEffect(() => { void loadSessions(); void loadLiveData(); return () => realtime.close() }, [realtime])

  useEffect(() => {
    if (session?.id) void loadContent(session.id)
  }, [session?.id])

  useEffect(() => realtime.subscribe(event => {
    const {type,payload={}} = event
    if (type === summitEventTypes.SESSION_CHANGED && payload.dayId) {
      const target = sessions.findIndex(item => item.day_id === payload.dayId && item.sort_order === Number(payload.sessionIndex))
      if (target >= 0) { setSelected(target); setSlide(1) }
    }
    if (type === summitEventTypes.SLIDE_CHANGED && Number.isInteger(payload.slide)) setSlide(payload.slide)
    if (type === summitEventTypes.PARKING_POST && payload.post) setParking(items => items.some(item=>item.id===payload.post.id) ? items : [payload.post,...items])
    if (type === summitEventTypes.PARKING_MODERATION && payload.id) setParking(items => items.map(item=>item.id===payload.id?{...item,visible:payload.visible!==false}:item))
    if (type === summitEventTypes.ANNOUNCEMENT && payload.text) setAnnouncements(items=>[{id:event.id,text:payload.text,created_at:event.at},...items].slice(0,10))
    if (type === summitEventTypes.POLL_PUBLISHED) {
      const options=payload.options||[]
      setPollOpen(true); setPollQuestion(payload.question||''); setPollOptions(options.join(', ')); setPollResponses(Object.fromEntries(options.map(option=>[option,0])))
    }
    if (type === summitEventTypes.POLL_RESPONSE && payload.option) setPollResponses(current=>({...current,[payload.option]:(current[payload.option]||0)+1}))
    if (type === summitEventTypes.POLL_CLOSED) setPollOpen(false)
  }), [realtime,sessions])

  const selectSession = index => {
    setSelected(index); setSlide(1)
    const item=sessions[index]
    if(item) realtime.publish(summitEventTypes.SESSION_CHANGED,{dayId:item.day_id,sessionIndex:item.sort_order})
  }
  const changeSlide = nextSlide => { const value=Math.max(1,nextSlide); setSlide(value); realtime.publish(summitEventTypes.SLIDE_CHANGED,{slide:value}) }
  const sendAnnouncement = () => { const text=announcement.trim(); if(!text)return; realtime.publish(summitEventTypes.ANNOUNCEMENT,{text}); setAnnouncement(''); void loadLiveData() }
  const publishPoll = () => { const question=pollQuestion.trim(); const options=pollOptions.split(',').map(x=>x.trim()).filter(Boolean); if(!question||options.length<2)return; const pollId=crypto?.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`; setPollOpen(true); setPollResponses(Object.fromEntries(options.map(option=>[option,0]))); realtime.publish(summitEventTypes.POLL_PUBLISHED,{pollId,sessionId:session?.id,dayId:currentDayId,question,options}); }
  const closePoll = () => { setPollOpen(false); realtime.publish(summitEventTypes.POLL_CLOSED,{}) }
  const toggleParking = id => setParking(items=>items.map(item=>{if(item.id!==id)return item;const visible=!item.visible;realtime.publish(summitEventTypes.PARKING_MODERATION,{dayId:item.dayId,id,visible});return {...item,visible}}))

  const registrationUrl = typeof window!=='undefined' ? `${window.location.origin}/summit-2026/register` : '/summit-2026/register'
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(registrationUrl)}`
  const facilitator=content.session?.facilitator || session?.facilitator || '[FACILITATOR / HOST TO BE CONFIRMED]'
  const bio=content.session?.facilitator_bio || session?.facilitator_bio || 'Facilitator biography will appear here when supplied by the programme team.'
  const headshot=content.session?.facilitator_headshot_url || session?.facilitator_headshot_url
  const resources=content.resources||[]
  const totalResponses=Object.values(pollResponses).reduce((sum,value)=>sum+value,0)
  const days=useMemo(()=>['day1','day2','day3'].map(id=>({id,items:sessions.filter(item=>item.day_id===id)})),[sessions])

  return <div className="control-room"><style>{`
  .control-room{min-height:100vh;background:#f3f6fa;color:#172337;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.cr-head{background:#102f56;color:#fff;padding:22px 28px}.cr-wrap{max-width:1500px;margin:auto}.cr-head h1{margin:5px 0;font-size:30px}.cr-head p{margin:0;color:#d9e3ef;font-size:13px}.cr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.cr-action{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:1px solid rgba(255,255,255,.35);border-radius:8px;padding:8px 11px;background:rgba(255,255,255,.1);color:#fff;font-size:11px;font-weight:700}.cr-action.primary{background:#fff;color:#173b68;border-color:#fff}.cr-grid{max-width:1500px;margin:18px auto;padding:0 20px;display:grid;grid-template-columns:290px minmax(0,1fr) 350px;gap:15px}.cr-card{background:#fff;border:1px solid #dce4ed;border-radius:14px;overflow:hidden}.cr-card h2{font-size:14px;color:#173b68;margin:0}.cr-title{padding:13px 15px;border-bottom:1px solid #e6ebf0;display:flex;justify-content:space-between;gap:8px;align-items:center}.cr-body{padding:14px}.session-list{max-height:calc(100vh - 250px);overflow:auto}.session{padding:10px 12px;border-bottom:1px solid #edf1f5;cursor:pointer}.session.active{background:#edf3f9;border-left:3px solid #173b68;padding-left:9px}.session b{font-size:11px;color:#173b68}.session div{font-size:12px;line-height:1.35;margin-top:3px}.small{font-size:11px;color:#718096}.input,.textarea{width:100%;box-sizing:border-box;border:1px solid #ccd6e1;border-radius:8px;padding:9px;font:inherit;font-size:12px}.textarea{min-height:82px;resize:vertical}.btn{border:1px solid #cfd9e4;border-radius:8px;padding:8px 11px;background:#fff;color:#20334b;font-size:11px;cursor:pointer}.btn.primary{background:#173b68;color:#fff;border-color:#173b68}.btn.danger{background:#fff0f0;border-color:#e1b5b5}.row{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.notice{padding:9px;border-radius:8px;background:#f7f0df;border:1px solid #e1cfa4;font-size:11px;margin-top:9px}.metric{padding:12px 0;border-bottom:1px solid #e8edf2}.metric strong{display:block;font-size:22px;color:#173b68}.label{font-size:10px;color:#78869a;text-transform:uppercase;letter-spacing:.08em}.status{display:inline-block;padding:5px 8px;border-radius:999px;background:#eaf3ea;color:#2f6838;font-size:10px;font-weight:700}.status.blue{background:#eaf1f8;color:#173b68}.profile{display:flex;gap:12px;align-items:flex-start;background:#f4f6f9;border-radius:10px;padding:12px;margin:12px 0}.headshot{width:72px;height:72px;border-radius:9px;background:#dfe6ef;display:flex;align-items:center;justify-content:center;color:#6a788b;font-weight:800;flex:none;overflow:hidden}.headshot img{width:100%;height:100%;object-fit:cover}.bio{font-size:11px;color:#5e6d80;line-height:1.5;margin-top:5px}.resource{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid #e1e7ee;border-radius:8px;padding:9px 10px;margin-top:7px}.resource strong{font-size:11px;color:#173b68}.resource span{display:block;font-size:9px;color:#718096;margin-top:2px}.resource a{font-size:10px;color:#173b68;font-weight:700}.pdf-frame{width:100%;height:560px;border:0;display:block;border-radius:8px}.slide-box{margin-top:12px;border:1px solid #dce3ec;border-radius:10px;overflow:hidden}.slide-head{padding:9px 11px;background:#f5f7fa;display:flex;justify-content:space-between;align-items:center;gap:10px}.parking-item{padding:10px 0;border-bottom:1px solid #edf1f5}.parking-item.hidden{opacity:.45}.parking-item p{font-size:12px;line-height:1.4;margin:5px 0}.pollbox{background:#f7f9fc;border:1px solid #e2e8ef;border-radius:10px;padding:10px;margin-top:10px}.poll-result-line{display:flex;justify-content:space-between;gap:10px;font-size:11px;margin:6px 0}.poll-bar{height:6px;background:#e4e9ef;border-radius:999px;overflow:hidden}.poll-bar span{display:block;height:100%;background:#173b68}.qr{width:120px;height:120px;border:1px solid #dce4ed;border-radius:8px;display:block;margin:8px 0}.link{font-size:10px;word-break:break-all;color:#52647a}@media(max-width:1150px){.cr-grid{grid-template-columns:1fr 1fr}.cr-grid>.cr-card:first-child{grid-column:1/-1}.session-list{max-height:330px}}@media(max-width:700px){.cr-grid{grid-template-columns:1fr;padding:0 12px}.cr-head{padding:18px 15px}}
  `}</style>
  <header className="cr-head"><div className="cr-wrap"><div className="small" style={{color:'#b9c9da'}}>SUMMIT OF AMERICAN SPACES IN NIGERIA 2026 · COORDINATOR</div><h1>Control Room</h1><p>Live operations workspace for sessions, announcements, polls, participant access and Parking Lot moderation.</p><nav className="cr-actions"><a className="cr-action primary" href="/summit-2026/control-room/content">Manage Presentations & Facilitator Profiles</a><a className="cr-action" href="/summit-2026/control-room/participants">Participant Management</a></nav></div></header>
  <main className="cr-grid">
    <section className="cr-card"><div className="cr-title"><h2>Programme</h2><span className="status">{loading?'LOADING':'LIVE DATABASE'}</span></div><div className="session-list">{days.map(day=><div key={day.id}>{day.items.map((item,index)=><button className={`session ${sessions.indexOf(item)===selected?'active':''}`} style={{display:'block',width:'100%',textAlign:'left',border:0}} key={item.id} onClick={()=>selectSession(sessions.indexOf(item))}><b>{day.id.replace('day','DAY ')} · {item.start_time}</b><div>{item.title}</div></button>)}</div>)}</div></section>

    <section>
      <div className="cr-card"><div className="cr-title"><h2>Live Session</h2><span className="status">{summitSupabase?'LIVE BACKEND':'LOCAL MODE'}</span></div><div className="cr-body">
        <div className="label">Selected session</div><h2 style={{fontSize:22,margin:'5px 0',color:'#173b68'}}>{session?.title||'No session selected'}</h2><div className="small">{session?.day_id?.toUpperCase()} · {session?.start_time}</div>
        <div className="profile"><div className="headshot">{headshot?<img src={headshot} alt={`${facilitator} headshot`}/>:<span>PHOTO</span>}</div><div><div className="label">Facilitator</div><strong style={{fontSize:14}}>{facilitator}</strong><div className="bio">{bio}</div></div></div>
        <div className="metric"><div className="label">Coordinator slide</div><strong style={{fontSize:15}}>Slide {slide}</strong></div><div className="row"><button className="btn" onClick={()=>changeSlide(slide-1)}>Previous Slide</button><button className="btn primary" onClick={()=>changeSlide(slide+1)}>Next Slide</button><button className="btn" onClick={()=>changeSlide(1)}>Reset Slides</button></div>
        {resources.length>0&&<div className="slide-box"><div className="slide-head"><strong style={{fontSize:11}}>Session presentation</strong><span className="status blue">{resources.length} FILE{resources.length===1?'':'S'}</span></div>{resources.map(resource=>resource.resource_type==='presentation_pdf'?<div key={resource.id}><iframe className="pdf-frame" src={resource.resource_url} title={resource.title}/><div className="cr-body" style={{paddingTop:0}}><a className="btn" href={resource.resource_url} target="_blank" rel="noreferrer">Open PDF</a></div></div>:<div className="resource" key={resource.id}><div><strong>{resource.title}</strong><span>PowerPoint source</span></div><a href={resource.resource_url} target="_blank" rel="noreferrer">Open / Download</a></div>)}</div>}
        {resources.length===0&&<div className="notice">No presentation is attached to this session yet. Add one through Manage Presentations & Facilitator Profiles.</div>}
      </div></div>

      <div className="cr-card" style={{marginTop:15}}><div className="cr-title"><h2>Live Poll</h2><span className="small">Participant devices</span></div><div className="cr-body"><input className="input" value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="Poll question"/><input className="input" style={{marginTop:7}} value={pollOptions} onChange={e=>setPollOptions(e.target.value)} placeholder="Options separated by commas"/><div className="row"><button className="btn primary" onClick={publishPoll}>Publish Poll</button><button className="btn" onClick={closePoll}>Close Poll</button></div>{pollOpen&&<div className="pollbox"><b>{pollQuestion}</b><div className="small" style={{marginTop:5}}>Responses received: {totalResponses}</div>{Object.entries(pollResponses).map(([option,count])=>{const percent=totalResponses?Math.round(count/totalResponses*100):0;return <div key={option}><div className="poll-result-line"><span>{option}</span><span>{count} · {percent}%</span></div><div className="poll-bar"><span style={{width:`${percent}%`}}/></div></div>})}<span className="status" style={{marginTop:8}}>LIVE</span></div>}</div></div>
    </section>

    <aside>
      <div className="cr-card"><div className="cr-title"><h2>Participant Access</h2><span className="small">QR</span></div><div className="cr-body"><img className="qr" src={qr} alt="Participant registration QR code"/><div className="small">Scan to register and open the participant experience.</div><div className="link">{registrationUrl}</div></div></div>
      <div className="cr-card" style={{marginTop:15}}><div className="cr-title"><h2>Summit Pulse</h2></div><div className="cr-body"><div className="metric"><div className="label">Programme items</div><strong>{sessions.length}</strong></div>{days.map(day=><div className="metric" key={day.id}><div className="label">{day.id.replace('day','DAY ')}</div><strong>{day.items.length}</strong></div>)}<div className="metric"><div className="label">Departure</div><strong style={{fontSize:15}}>September 24</strong></div></div></div>
      <div className="cr-card" style={{marginTop:15}}><div className="cr-title"><h2>Broadcast Announcement</h2></div><div className="cr-body"><textarea className="textarea" value={announcement} onChange={e=>setAnnouncement(e.target.value)} placeholder="Message to all participant devices..."/><div className="row"><button className="btn primary" onClick={sendAnnouncement}>Broadcast</button></div>{announcements.map(item=><div className="notice" key={item.id}>{item.text}</div>)}</div></div>
      <div className="cr-card" style={{marginTop:15}}><div className="cr-title"><h2>Parking Lot Moderation</h2><button className={`btn ${moderationMode?'primary':''}`} onClick={()=>setModerationMode(v=>!v)}>{moderationMode?'MODERATION ON':'MODERATION OFF'}</button></div><div className="cr-body">{parking.length===0?<div className="small">No Parking Lot posts yet.</div>:parking.map(item=><div className={`parking-item ${item.visible?'':'hidden'}`} key={item.id}><div className="small">{item.name} · {item.votes} upvotes {item.pinned?'· PINNED':''}</div><p>{item.text}</p><button className={`btn ${item.visible?'danger':''}`} onClick={()=>toggleParking(item.id)} disabled={!moderationMode}>{item.visible?'Remove from display':'Restore to display'}</button></div>)}</div></div>
    </aside>
  </main></div>
}
