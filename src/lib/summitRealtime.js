const CHANNEL_NAME = 'summit-2026-live'
const STORAGE_KEY = 'summit2026-live-events'
const MAX_EVENTS = 100

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function readEvents() {
  if (typeof window === 'undefined') return []
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(events) ? events : []
  } catch {
    return []
  }
}

function rememberEvents(events) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)))
  } catch {
    // Local persistence is best-effort in prototype mode.
  }
}

export function createSummitRealtime() {
  let channel = null
  const listeners = new Set()
  const seenIds = new Set()

  const deliver = (message) => {
    if (!message?.id || seenIds.has(message.id)) return
    seenIds.add(message.id)
    if (seenIds.size > MAX_EVENTS * 2) {
      const oldest = seenIds.values().next().value
      if (oldest) seenIds.delete(oldest)
    }
    listeners.forEach((listener) => listener(message))
  }

  const receive = (event) => {
    const message = event?.data
    if (!message || message.channel !== CHANNEL_NAME) return
    deliver(message)
  }

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.addEventListener('message', receive)
  }

  const publish = (type, payload = {}) => {
    if (typeof window === 'undefined') return null
    const message = { channel: CHANNEL_NAME, id: makeId(), type, payload, at: new Date().toISOString() }
    if (channel) channel.postMessage(message)
    rememberEvents([...readEvents(), message])
    deliver(message)
    return message
  }

  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const getRecent = () => readEvents()

  const close = () => {
    if (channel) channel.close()
    listeners.clear()
    seenIds.clear()
  }

  return { publish, subscribe, getRecent, close }
}

export const summitEventTypes = {
  SESSION_CHANGED: 'session_changed',
  SLIDE_CHANGED: 'slide_changed',
  ANNOUNCEMENT: 'announcement',
  POLL_PUBLISHED: 'poll_published',
  POLL_CLOSED: 'poll_closed',
  PARKING_POST: 'parking_post',
  PARKING_MODERATION: 'parking_moderation',
}
