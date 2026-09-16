const CHANNEL_NAME = 'summit-2026-live'
const STORAGE_KEY = 'summit2026-live-events'

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createSummitRealtime() {
  let channel = null
  const listeners = new Set()

  const receive = (event) => {
    const message = event?.data
    if (!message || message.channel !== CHANNEL_NAME) return
    listeners.forEach((listener) => listener(message))
  }

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.addEventListener('message', receive)
  }

  const publish = (type, payload = {}) => {
    if (typeof window === 'undefined') return null
    const message = { channel: CHANNEL_NAME, id: makeId(), type, payload, at: new Date().toISOString() }
    if (channel) channel.postMessage(message)
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing.slice(-49), message]))
    } catch {
      // Local persistence is best-effort in prototype mode.
    }
    listeners.forEach((listener) => listener(message))
    return message
  }

  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const getRecent = () => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  }

  const close = () => {
    if (channel) channel.close()
    listeners.clear()
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
