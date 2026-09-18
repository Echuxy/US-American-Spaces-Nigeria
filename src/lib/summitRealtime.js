import { getSummitDeviceId, summitSupabase } from './summitSupabase'

const STORAGE_KEY = 'summit2026-live-events'
const MAX_EVENTS = 100
const LIVE_STATE_ID = 1

function readEvents() {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function rememberEvents(events) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS))) } catch {}
}

const asParkingPost = row => ({
  id: row.id,
  dayId: row.day_id,
  text: row.text,
  name: row.anonymous ? 'Anonymous' : row.display_name || 'Participant',
  time: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  votes: row.votes || 0,
  visible: row.visible !== false,
  pinned: row.pinned === true,
})

export function createSummitRealtime() {
  let channel = null
  let closed = false
  let heartbeat = null
  let liveStatePoller = null
  let subscribed = false
  let lastLiveState = null
  const listeners = new Set()
  const seenIds = new Set()

  const persistLocal = message => rememberEvents([...readEvents(), message])

  const deliver = message => {
    if (!message?.id || seenIds.has(message.id)) return
    seenIds.add(message.id)
    if (seenIds.size > MAX_EVENTS * 2) {
      const oldest = seenIds.values().next().value
      if (oldest) seenIds.delete(oldest)
    }
    persistLocal(message)
    listeners.forEach(listener => listener(message))
  }

  const emitLiveState = row => {
    if (!row) return
    const state = {
      dayId: row.day_id,
      sessionIndex: Number(row.session_index),
      slide: Number(row.slide || 1),
      displayMode: row.display_mode || 'program',
      emergencyMessage: row.emergency_message || '',
      onAir: row.on_air !== false,
      updatedAt: row.updated_at,
    }
    const previous = lastLiveState
    lastLiveState = state

    deliver({ id: `live-state-${row.updated_at}`, type: summitEventTypes.LIVE_STATE_CHANGED, payload: state, at: row.updated_at })

    // Preserve the legacy event contract used by the existing Summit participant
    // and coordinator views while the database row remains the single source of truth.
    if (!previous || previous.dayId !== state.dayId || previous.sessionIndex !== state.sessionIndex) {
      deliver({
        id: `session-${row.updated_at}`,
        type: summitEventTypes.SESSION_CHANGED,
        payload: { dayId: state.dayId, sessionIndex: state.sessionIndex },
        at: row.updated_at,
      })
    }
    if (!previous || previous.slide !== state.slide || previous.dayId !== state.dayId || previous.sessionIndex !== state.sessionIndex) {
      deliver({
        id: `slide-${row.updated_at}`,
        type: summitEventTypes.SLIDE_CHANGED,
        payload: { dayId: state.dayId, sessionIndex: state.sessionIndex, slide: state.slide },
        at: row.updated_at,
      })
    }
  }

  const loadBootstrap = async () => {
    if (!summitSupabase || closed) return
    const [stateResult, parkingResult, pollResult, announcementResult] = await Promise.all([
      summitSupabase.from('summit_live_state').select('id,day_id,session_index,slide,display_mode,emergency_message,on_air,updated_at').eq('id', LIVE_STATE_ID).maybeSingle(),
      summitSupabase.from('parking_lot_posts').select('id,day_id,text,display_name,anonymous,votes,visible,pinned,created_at').eq('visible', true).order('created_at', { ascending: true }).limit(500),
      summitSupabase.from('polls').select('id,day_id,session_id,question,options,created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(1),
      summitSupabase.from('announcements').select('id,text,created_at').order('created_at', { ascending: false }).limit(5),
    ])

    if (stateResult.data) emitLiveState(stateResult.data)
    for (const row of parkingResult.data || []) {
      deliver({ id: `db-parking-${row.id}`, type: summitEventTypes.PARKING_POST, payload: { post: asParkingPost(row) }, at: row.created_at })
    }
    const poll = pollResult.data?.[0]
    if (poll) {
      deliver({ id: `db-poll-${poll.id}`, type: summitEventTypes.POLL_PUBLISHED, payload: { id: poll.id, pollId: poll.id, dayId: poll.day_id, sessionId: poll.session_id, question: poll.question, options: poll.options || [] }, at: poll.created_at })
    }
    for (const row of (announcementResult.data || []).reverse()) {
      deliver({ id: `db-announcement-${row.id}`, type: summitEventTypes.ANNOUNCEMENT, payload: { text: row.text }, at: row.created_at })
    }
  }

  const touchParticipant = async () => {
    if (!summitSupabase || closed || typeof window === 'undefined' || !localStorage.getItem('summit2026-name')) return
    const { error } = await summitSupabase.rpc('touch_summit_participant', { p_device_id: getSummitDeviceId() })
    if (error) console.error('Summit participant heartbeat failed', error)
  }

  const publish = async (type, payload = {}) => {
    if (typeof window === 'undefined' || closed) return { error: new Error('Summit realtime is closed') }
    if (!summitSupabase) return { error: new Error('Summit backend is not configured') }

    const deviceId = getSummitDeviceId()
    let result = null

    try {
      if (type === summitEventTypes.SESSION_CHANGED) {
        result = await summitSupabase.rpc('summit_coordinator_set_live_state', {
          p_day_id: payload.dayId,
          p_session_index: Number(payload.sessionIndex),
          p_slide: 1,
        })
      } else if (type === summitEventTypes.SLIDE_CHANGED) {
        const { data: current, error: currentError } = await summitSupabase.from('summit_live_state').select('day_id,session_index').eq('id', LIVE_STATE_ID).maybeSingle()
        if (currentError) return { error: currentError }
        result = await summitSupabase.rpc('summit_coordinator_set_live_state', {
          p_day_id: current?.day_id,
          p_session_index: Number(current?.session_index),
          p_slide: Math.max(1, Number(payload.slide) || 1),
        })
      } else if (type === summitEventTypes.DISPLAY_MODE_CHANGED) {
        result = await summitSupabase.rpc('summit_coordinator_set_display_mode', {
          p_mode: payload.mode,
          p_message: payload.message || null,
        })
      } else if (type === summitEventTypes.ANNOUNCEMENT) {
        result = await summitSupabase.rpc('summit_coordinator_publish_announcement', { p_text: payload.text })
      } else if (type === summitEventTypes.POLL_PUBLISHED) {
        result = await summitSupabase.rpc('summit_coordinator_publish_poll', {
          p_day_id: payload.dayId,
          p_session_id: payload.sessionId || null,
          p_question: payload.question,
          p_options: payload.options || [],
        })
      } else if (type === summitEventTypes.POLL_CLOSED) {
        result = await summitSupabase.rpc('summit_coordinator_close_poll', { p_poll_id: payload.pollId || payload.id || null })
      } else if (type === summitEventTypes.PARKING_MODERATION) {
        result = await summitSupabase.rpc('summit_coordinator_moderate_parking', {
          p_post_id: payload.id,
          p_visible: payload.visible !== false,
          p_pinned: payload.pinned ?? null,
        })
      } else if (type === summitEventTypes.PARKING_POST) {
        const post = payload.post || {}
        result = await summitSupabase.rpc('summit_submit_parking_post', {
          p_device_id: deviceId,
          p_day_id: post.dayId,
          p_text: post.text,
        })
      } else if (type === summitEventTypes.POLL_RESPONSE) {
        result = await summitSupabase.rpc('summit_submit_poll_response', {
          p_poll_id: payload.pollId,
          p_option: payload.option,
          p_device_id: deviceId,
        })
      } else {
        return { error: new Error(`Unsupported Summit event: ${type}`) }
      }

      if (result?.error) {
        console.error(`Summit ${type} failed`, result.error)
        return result
      }

      return result || { data: true, error: null }
    } catch (error) {
      console.error(`Summit ${type} failed`, error)
      return { error }
    }
  }

  if (summitSupabase) {
    channel = summitSupabase.channel('summit-live-db')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'summit_live_state',
        filter: 'id=eq.1',
      }, payload => emitLiveState(payload.new))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'parking_lot_posts',
      }, payload => {
        const row = payload.new
        if (row?.visible !== false) deliver({ id: `parking-${row.id}`, type: summitEventTypes.PARKING_POST, payload: { post: asParkingPost(row) }, at: row.created_at })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'parking_lot_posts',
      }, payload => {
        const row = payload.new
        deliver({ id: `parking-update-${row.id}-${row.visible}-${row.pinned}`, type: summitEventTypes.PARKING_MODERATION, payload: { id: row.id, visible: row.visible, pinned: row.pinned }, at: row.created_at })
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'announcements',
      }, payload => deliver({ id: `announcement-${payload.new.id}`, type: summitEventTypes.ANNOUNCEMENT, payload: { text: payload.new.text }, at: payload.new.created_at }))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'polls',
      }, payload => {
        if (payload.eventType === 'INSERT' && payload.new.status === 'open') {
          deliver({ id: `poll-${payload.new.id}`, type: summitEventTypes.POLL_PUBLISHED, payload: { id: payload.new.id, pollId: payload.new.id, dayId: payload.new.day_id, sessionId: payload.new.session_id, question: payload.new.question, options: payload.new.options || [] }, at: payload.new.created_at })
        }
        if (payload.eventType === 'UPDATE' && payload.new.status === 'closed') {
          deliver({ id: `poll-close-${payload.new.id}-${payload.new.closed_at}`, type: summitEventTypes.POLL_CLOSED, payload: { pollId: payload.new.id }, at: payload.new.closed_at })
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'poll_responses',
      }, payload => {
        // RLS exposes poll responses only to the authenticated coordinator.
        deliver({ id: `poll-response-${payload.new.id}`, type: summitEventTypes.POLL_RESPONSE, payload: { pollId: payload.new.poll_id, option: payload.new.option, responseId: payload.new.id }, at: payload.new.created_at })
      })
      .subscribe((status, error) => {
        subscribed = status === 'SUBSCRIBED'
        if (error) console.error('Summit Realtime subscription error', status, error)
        if (subscribed) void touchParticipant()
      })

    heartbeat = window.setInterval(touchParticipant, 2 * 60 * 1000)
    liveStatePoller = window.setInterval(async () => {
      if (closed) return
      const { data, error } = await summitSupabase.from('summit_live_state').select('id,day_id,session_index,slide,updated_at').eq('id', LIVE_STATE_ID).maybeSingle()
      if (!error && data) emitLiveState(data)
    }, 5000)

    void loadBootstrap()
  }

  const subscribe = listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const getRecent = () => readEvents()

  const close = () => {
    closed = true
    if (heartbeat) window.clearInterval(heartbeat)
    if (liveStatePoller) window.clearInterval(liveStatePoller)
    if (channel && summitSupabase) void summitSupabase.removeChannel(channel)
    listeners.clear()
    seenIds.clear()
  }

  return { publish, subscribe, getRecent, close, backendEnabled: Boolean(summitSupabase), realtimeConnected: () => subscribed }
}

export const summitEventTypes = {
  LIVE_STATE_CHANGED: 'live_state_changed',
  SESSION_CHANGED: 'session_changed',
  SLIDE_CHANGED: 'slide_changed',
  ANNOUNCEMENT: 'announcement',
  POLL_PUBLISHED: 'poll_published',
  POLL_RESPONSE: 'poll_response',
  POLL_CLOSED: 'poll_closed',
  DISPLAY_MODE_CHANGED: 'display_mode_changed',
  PARKING_POST: 'parking_post',
  PARKING_MODERATION: 'parking_moderation',
}
