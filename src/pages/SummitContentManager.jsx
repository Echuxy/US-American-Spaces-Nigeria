import { useEffect, useMemo, useState } from 'react'
import { summitSupabase } from '../lib/summitSupabase'
import SummitPresentationManager from './SummitPresentationManager'

const MAX_HEADSHOT_MB = 5
const bucket = 'summit-presentations'

function storagePath(url) {
  const marker = `/${bucket}/`
  if (!url?.includes(marker)) return null
  return decodeURIComponent(url.split(marker)[1].split('?')[0])
}

export default function SummitContentManager() {
  const [sessions, setSessions] = useState([])
  const [resources, setResources] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [bio, setBio] = useState('')
  const [headshot, setHeadshot] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [removingHeadshot, setRemovingHeadshot] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')

  const loadSessions = async () => {
    if (!summitSupabase) { setLoading(false); return }
    const [{ data, error }, { data: resourceData, error: resourceError }] = await Promise.all([
      summitSupabase.from('sessions').select('id,day_id,sort_order,start_time,title,facilitator,facilitator_bio,facilitator_headshot_url').order('day_id').order('sort_order'),
      summitSupabase.from('session_resources').select('id,session_id,title,resource_type,resource_url,sort_order').order('sort_order')
    ])
    if (error) {
      setProfileError(error.message)
      setLoading(false)
      return
    }
    if (resourceError) setProfileError(resourceError.message)
    setSessions(data || [])
    setResources(resourceData || [])
    setSelectedId(current => current || data?.[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => { void loadSessions() }, [])

  const session = sessions.find(s => s.id === selectedId)
  const sessionResources = useMemo(() => resources.filter(r => r.session_id === selectedId), [resources, selectedId])
  const uploadedSessions = useMemo(() => {
    return sessions.map(s => ({ ...s, resources: resources.filter(r => r.session_id === s.id) })).filter(s => s.resources.length > 0)
  }, [sessions, resources])

  useEffect(() => {
    if (!session) return
    setBio(session.facilitator_bio || '')
    setHeadshot(null)
    setProfileMessage('')
    setProfileError('')
  }, [session?.id])

  const refreshContent = async () => {
    await loadSessions()
  }

  const saveProfile = async () => {
    setProfileMessage('')
    setProfileError('')
    if (!summitSupabase) return setProfileError('Summit backend is not configured.')
    if (!session?.id) return setProfileError('Select a programme session first.')

    setSavingProfile(true)
    try {
      let headshotUrl = session.facilitator_headshot_url || null
      if (headshot) {
        if (headshot.size > MAX_HEADSHOT_MB * 1024 * 1024) throw new Error(`Headshot is larger than ${MAX_HEADSHOT_MB} MB.`)
        if (!headshot.type.startsWith('image/')) throw new Error('Headshot must be an image file.')
        const safe = headshot.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-')
        const path = `facilitators/${session.day_id}/${session.id}/${Date.now()}-${safe}`
        const { error: uploadError } = await summitSupabase.storage.from(bucket).upload(path, headshot, { contentType: headshot.type, upsert: false })
        if (uploadError) throw uploadError
        headshotUrl = summitSupabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
      }

      const { error } = await summitSupabase.from('sessions').update({
        facilitator_bio: bio.trim() || null,
        facilitator_headshot_url: headshotUrl,
      }).eq('id', session.id)
      if (error) throw error

      setSessions(items => items.map(item => item.id === session.id
        ? { ...item, facilitator_bio: bio.trim() || null, facilitator_headshot_url: headshotUrl }
        : item))
      setHeadshot(null)
      setProfileMessage('Facilitator profile saved and published to the participant experience.')
    } catch (error) {
      setProfileError(error.message || 'Unable to save facilitator profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const removeHeadshot = async () => {
    if (!session?.facilitator_headshot_url || !summitSupabase) return
    setProfileMessage('')
    setProfileError('')
    setRemovingHeadshot(true)
    try {
      const path = storagePath(session.facilitator_headshot_url)
      const { error } = await summitSupabase.from('sessions').update({ facilitator_headshot_url: null }).eq('id', session.id)
      if (error) throw error
      if (path) await summitSupabase.storage.from(bucket).remove([path])
      setSessions(items => items.map(item => item.id === session.id ? { ...item, facilitator_headshot_url: null } : item))
      setProfileMessage('Facilitator headshot removed from the participant experience.')
    } catch (error) {
      setProfileError(error.message || 'Unable to remove headshot.')
    } finally {
      setRemovingHeadshot(false)
    }
  }

  return <div style={{minHeight:'100vh',background:'#f3f6fa',fontFamily:'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',color:'#172337'}}>
    <header style={{background:'#102f56',color:'#fff',padding:'24px 30px'}}>
      <div style={{maxWidth:1100,margin:'auto'}}>
        <div style={{fontSize:10,letterSpacing:'.12em',opacity:.75}}>SUMMIT OF AMERICAN SPACES IN NIGERIA 2026 · COORDINATOR</div>
        <h1 style={{margin:'6px 0',fontSize:30}}>Presentation & Content Manager</h1>
        <p style={{margin:0,fontSize:13,color:'#d9e3ef'}}>Manage facilitator bios, headshots, presentations and downloadable resources for each Summit session.</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
          <a href="/summit-2026/control-room" style={{color:'#173b68',background:'#fff',padding:'8px 11px',borderRadius:8,textDecoration:'none',fontSize:11,fontWeight:700}}>← Back to Control Room</a>
          <a href="/summit-2026/control-room/participants" style={{color:'#fff',border:'1px solid rgba(255,255,255,.35)',padding:'8px 11px',borderRadius:8,textDecoration:'none',fontSize:11,fontWeight:700}}>Participant Management</a>
        </div>
      </div>
    </header>

    <main style={{maxWidth:1100,margin:'20px auto',padding:'0 16px'}}>
      <div style={{background:'#fff',border:'1px solid #dce4ed',borderRadius:14,padding:18}}>
        <label style={{fontSize:11,fontWeight:800,color:'#40536b'}}>SELECT PROGRAMME SESSION</label>
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} style={{display:'block',width:'100%',marginTop:7,padding:11,border:'1px solid #ccd6e1',borderRadius:8,fontSize:13}}>
          {loading&&<option>Loading programme…</option>}
          {sessions.map(s=><option key={s.id} value={s.id}>{s.day_id.toUpperCase()} · {s.start_time} · {s.title}</option>)}
        </select>
      </div>

      <section style={{marginTop:15,background:'#fff',border:'2px solid #173b68',borderRadius:14,overflow:'hidden'}}>
        <div style={{padding:'14px 16px',background:'#edf3f9',borderBottom:'1px solid #d6e0ea',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:10,letterSpacing:'.1em',fontWeight:800,color:'#173b68'}}>CURRENT UPLOADS</div>
            <strong style={{fontSize:16,color:'#173b68'}}>Find, replace or remove uploaded presentations</strong>
            <div style={{fontSize:11,color:'#5f7085',marginTop:3}}>Select a session above. Its uploaded files appear below with <strong>Open current file</strong>, <strong>Replace</strong> and <strong>Remove</strong> controls.</div>
          </div>
          <div style={{background:'#173b68',color:'#fff',borderRadius:999,padding:'7px 10px',fontSize:10,fontWeight:800}}>{resources.length} uploaded file{resources.length===1?'':'s'}</div>
        </div>
        <div style={{padding:'12px 16px',background:'#fffaf0',borderBottom:'1px solid #eadfca',fontSize:11,color:'#705d35'}}>
          <strong>How to delete or replace:</strong> choose the session containing the file → scroll to <strong>ATTACHED RESOURCES</strong> → use <strong>Replace</strong> to upload the corrected file, or <strong>Remove</strong> to permanently detach it from the session.
        </div>
        {uploadedSessions.length > 0
          ? <div style={{padding:12,display:'grid',gap:7}}>{uploadedSessions.map(s=><button key={s.id} onClick={()=>setSelectedId(s.id)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,textAlign:'left',width:'100%',border:'1px solid #dce4ed',background:s.id===selectedId?'#edf3f9':'#fff',borderRadius:9,padding:'9px 11px',cursor:'pointer'}}><span><strong style={{fontSize:11,color:'#173b68'}}>{s.day_id.toUpperCase()} · {s.start_time}</strong><span style={{display:'block',fontSize:11,color:'#24364d',marginTop:2}}>{s.title}</span></span><span style={{fontSize:10,fontWeight:800,color:'#173b68',whiteSpace:'nowrap'}}>{s.resources.length} file{s.resources.length===1?'':'s'} →</span></button>)}</div>
          : <div style={{padding:14,fontSize:11,color:'#718096'}}>No uploaded presentations or resources are currently recorded in the Summit database.</div>}
      </section>

      {session && <>
        <section style={{marginTop:15,background:'#fff',border:'1px solid #dce4ed',borderRadius:14,overflow:'hidden'}}>
          <div style={{padding:'13px 16px',borderBottom:'1px solid #e5eaf0'}}>
            <div style={{fontSize:9,letterSpacing:'.1em',fontWeight:800,color:'#6f7e91'}}>FACILITATOR PROFILE</div>
            <strong style={{fontSize:14,color:'#173b68'}}>{session.facilitator || '[FACILITATOR NAME TO BE SUPPLIED]'}</strong>
            <div style={{fontSize:10,color:'#718096',marginTop:3}}>{session.day_id} · {session.start_time} · {session.title}</div>
          </div>
          <div style={{padding:16,display:'grid',gridTemplateColumns:'minmax(0,1fr) 240px',gap:16}}>
            <div>
              <label style={{display:'block',fontSize:10,fontWeight:700,color:'#40536b'}}>FACILITATOR BIO</label>
              <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Enter the facilitator's approved biography…" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,minHeight:150,resize:'vertical',border:'1px solid #ccd6e1',borderRadius:8,padding:10,font:'inherit',fontSize:12,lineHeight:1.5}} />
              <label style={{display:'block',marginTop:12,fontSize:10,fontWeight:700,color:'#40536b'}}>FACILITATOR HEADSHOT</label>
              <input type="file" accept="image/*" onChange={e=>setHeadshot(e.target.files?.[0] || null)} style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,border:'1px solid #d0d9e4',borderRadius:7,padding:8,background:'#fff',fontSize:11}} />
              <div style={{fontSize:10,color:'#718096',marginTop:5}}>JPG, PNG or other standard image format. Maximum file size: {MAX_HEADSHOT_MB} MB.</div>
              {headshot && <div style={{fontSize:10,color:'#506176',marginTop:6}}>Selected: <strong>{headshot.name}</strong></div>}
              <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:12}}>
                <button onClick={saveProfile} disabled={savingProfile||removingHeadshot} style={{border:0,borderRadius:8,padding:'9px 13px',background:'#173b68',color:'#fff',fontSize:11,fontWeight:700,cursor:savingProfile?'wait':'pointer',opacity:savingProfile?.6:1}}>{savingProfile?'Saving…':'Save Facilitator Profile'}</button>
                {session.facilitator_headshot_url && <button onClick={removeHeadshot} disabled={savingProfile||removingHeadshot} style={{border:'1px solid #e1b5b5',borderRadius:8,padding:'9px 13px',background:'#fff0f0',color:'#8a3030',fontSize:11,fontWeight:700}}>{removingHeadshot?'Removing…':'Remove Headshot'}</button>}
              </div>
              {profileMessage&&<div style={{marginTop:9,padding:8,borderRadius:7,background:'#edf7ee',color:'#286333',fontSize:10}}>{profileMessage}</div>}
              {profileError&&<div style={{marginTop:9,padding:8,borderRadius:7,background:'#fff0f0',color:'#8a3030',fontSize:10}}>{profileError}</div>}
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#40536b'}}>CURRENT HEADSHOT</div>
              {session.facilitator_headshot_url
                ? <><img src={session.facilitator_headshot_url} alt={session.facilitator || 'Facilitator'} style={{display:'block',width:'100%',aspectRatio:'1 / 1',objectFit:'cover',borderRadius:10,marginTop:7,border:'1px solid #dce4ed'}}/><div style={{fontSize:10,color:'#286333',marginTop:7,fontWeight:700}}>Published and visible to participants</div></>
                : <div style={{marginTop:7,aspectRatio:'1 / 1',display:'grid',placeItems:'center',border:'1px dashed #ccd6e1',borderRadius:10,color:'#7a899b',fontSize:11,textAlign:'center',padding:12,boxSizing:'border-box'}}>No headshot uploaded yet.</div>}
            </div>
          </div>
        </section>

        <div style={{marginTop:15}}><SummitPresentationManager session={session} onResourceChange={refreshContent}/></div>
        {sessionResources.length > 0 && <div style={{marginTop:8,padding:'8px 12px',fontSize:10,color:'#286333',background:'#edf7ee',border:'1px solid #cce4cf',borderRadius:8}}>This session currently has {sessionResources.length} uploaded file{sessionResources.length===1?'':'s'}. The controls above apply directly to these files.</div>}
      </>}

      <div style={{marginTop:15,padding:14,background:'#fff',border:'1px solid #dce4ed',borderRadius:14,fontSize:11,color:'#63748a',lineHeight:1.6}}><strong>Content workflow:</strong> select a session, update the approved facilitator bio/headshot, then manage the session presentation below. PDF files are the live presentation format; PPT/PPTX files are retained as downloadable source files.</div>
    </main>
  </div>
}