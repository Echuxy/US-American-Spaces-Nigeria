import { getSummitDeviceId, summitSupabase } from './summitSupabase'

const CHANNEL_NAME = 'summit-2026-live'
const STORAGE_KEY = 'summit2026-live-events'
const MAX_EVENTS = 100

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function readEvents() {
  if (typeof window === 'undefined') return []
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(events) ? events : []
  } catch { return [] }
}

function rememberEvents(events) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS))) } catch {}
}

export function createSummitRealtime() {
  let channel = null
  let channelReady = false
  let closed = false
  let heartbeat = null
  const listeners = new Set()
  const seenIds = new Set()
  const pending = []

  const deliver = (message) => {
    if (!message?.id || seenIds.has(message.id)) return
    seenIds.add(message.id)
    if (seenIds.size > MAX_EVENTS * 2) {
      const oldest = seenIds.values().next().value
      if (oldest) seenIds.delete(oldest)
    }
    listeners.forEach((listener) => listener(message))
  }

  const persistLocal = (message) => rememberEvents([...readEvents(), message])

  const sendSupabase = async (message) => {
    if (!channel || closed) return
    if (!channelReady) { pending.push(message); return }
    const { error } = await channel.send({ type: 'broadcast', event: 'summit-event', payload: message })
    if (error) console.error('Summit Realtime send failed', error)
  }

  const persistDatabase = async (message) => {
    if (!summitSupabase) return
    try {
      if (message.type === summitEventTypes.PARKING_POST && message.payload?.post) {
        const p = message.payload.post
        const { error } = await summitSupabase.from('parking_lot_posts').insert({ day_id:p.dayId, text:p.text, display_name:p.name||'Participant', anonymous:p.name==='Anonymous', device_id:p.deviceId||null, votes:Number(p.votes||0), visible:p.visible!==false })
        if (error) console.error('Summit Parking Lot persistence failed', error)
      }
      if (message.type === summitEventTypes.POLL_RESPONSE && message.payload) {
        const p = message.payload
        const { error } = await summitSupabase.from('poll_responses').insert({ poll_id:p.pollId, option:p.option, display_name:p.name||'Participant', anonymous:p.name==='Anonymous', device_id:p.deviceId||null })
        if (error) console.error('Summit poll response persistence failed', error)
      }
      if (message.type === summitEventTypes.POLL_PUBLISHED && message.payload) {
        const p = message.payload
        const pollId = p.pollId || message.id
        const { error } = await summitSupabase.from('polls').insert({ id:pollId, question:p.question, options:p.options||[], status:'open' })
        if (error) console.error('Summit poll persistence failed', error)
      }
      if (message.type === summitEventTypes.ANNOUNCEMENT && message.payload?.text) {
        const { error } = await summitSupabase.from('announcements').insert({ text:message.payload.text })
        if (error) console.error('Summit announcement persistence failed', error)
      }
    } catch (error) { console.error('Summit database persistence failed', error) }
  }

  const touchParticipant = async () => {
    if (!summitSupabase || closed || typeof window === 'undefined' || !localStorage.getItem('summit2026-name')) return
    const { error } = await summitSupabase.rpc('touch_summit_participant', { p_device_id:getSummitDeviceId() })
    if (error) console.error('Summit participant heartbeat failed', error)
  }

  if (summitSupabase) {
    channel = summitSupabase.channel(CHANNEL_NAME, { config:{ broadcast:{ self:false, ack:true } } })
    channel.on('broadcast',{event:'summit-event'},event=>{ const message=event?.payload; if(message?.id) deliver(message) }).subscribe((status,error)=>{
      if(status==='SUBSCRIBED'){
        channelReady=true
        while(pending.length) void sendSupabase(pending.shift())
        void touchParticipant()
      } else if(error) console.error('Summit Realtime channel error',status,error)
    })
    heartbeat = window.setInterval(touchParticipant, 2 * 60 * 1000)
    Promise.all([
      summitSupabase.from('parking_lot_posts').select('id,day_id,text,display_name,anonymous,votes,visible,pinned,created_at').eq('visible',true).order('created_at',{ascending:true}),
      summitSupabase.from('polls').select('id,question,options,created_at').eq('status','open').order('created_at',{ascending:false}).limit(1),
      summitSupabase.from('announcements').select('id,text,created_at').order('created_at',{ascending:false}).limit(5),
    ]).then(([parkingResult,pollResult,announcementResult])=>{
      if(closed) return
      for(const p of parkingResult.data||[]) deliver({id:`db-parking-${p.id}`,type:summitEventTypes.PARKING_POST,payload:{post:{id:p.id,dayId:p.day_id,text:p.text,name:p.anonymous?'Anonymous':p.display_name,time:new Date(p.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),votes:p.votes,visible:p.visible,pinned:p.pinned}},at:p.created_at})
      const poll=pollResult.data?.[0]
      if(poll) deliver({id:`db-poll-${poll.id}`,type:summitEventTypes.POLL_PUBLISHED,payload:{id:poll.id,pollId:poll.id,question:poll.question,options:poll.options||[]},at:poll.created_at})
      for(const a of (announcementResult.data||[]).reverse()) deliver({id:`db-announcement-${a.id}`,type:summitEventTypes.ANNOUNCEMENT,payload:{text:a.text},at:a.created_at})
    }).catch(error=>console.error('Summit bootstrap failed',error))
  }

  const publish = (type,payload={}) => {
    if(typeof window==='undefined') return null
    const message={channel:CHANNEL_NAME,id:makeId(),type,payload,at:new Date().toISOString()}
    persistLocal(message); deliver(message); void sendSupabase(message); void persistDatabase(message); return message
  }
  const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
  const getRecent = () => readEvents()
  const close = () => { closed=true; if(heartbeat) window.clearInterval(heartbeat); if(channel&&summitSupabase) summitSupabase.removeChannel(channel); listeners.clear(); seenIds.clear(); pending.length=0 }
  return {publish,subscribe,getRecent,close,backendEnabled:Boolean(summitSupabase)}
}

export const summitEventTypes={SESSION_CHANGED:'session_changed',SLIDE_CHANGED:'slide_changed',ANNOUNCEMENT:'announcement',POLL_PUBLISHED:'poll_published',POLL_RESPONSE:'poll_response',POLL_CLOSED:'poll_closed',PARKING_POST:'parking_post',PARKING_MODERATION:'parking_moderation'}
