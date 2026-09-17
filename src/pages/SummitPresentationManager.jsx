import { useEffect, useState } from 'react'
import { summitSupabase } from '../lib/summitSupabase'

const ACCEPT = '.pdf,.pptx,.ppt'
const MAX_MB = 50
const bucket = 'summit-presentations'

function storagePath(url) {
  const marker = `/${bucket}/`
  if (!url?.includes(marker)) return null
  return decodeURIComponent(url.split(marker)[1].split('?')[0])
}

export default function SummitPresentationManager({ session, onResourceChange }) {
  const [resources, setResources] = useState([])
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [replacingId, setReplacingId] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!summitSupabase || !session?.id) return
    const { data, error: loadError } = await summitSupabase
      .from('session_resources')
      .select('id,title,resource_url,resource_type,sort_order')
      .eq('session_id', session.id)
      .order('sort_order', { ascending: true })
    if (loadError) setError(loadError.message)
    else setResources(data || [])
  }

  useEffect(() => { setFile(null); setTitle(''); setMessage(''); setError(''); void load() }, [session?.id])

  const upload = async () => {
    setError(''); setMessage('')
    if (!summitSupabase) return setError('Summit backend is not configured.')
    if (!session?.id) return setError('This programme item is not linked to the Summit database yet.')
    if (!file) return setError('Choose a PDF or PowerPoint file first.')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File is larger than ${MAX_MB} MB.`)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf','pptx','ppt'].includes(ext)) return setError('Only PDF, PPTX and PPT files are supported.')
    setUploading(true)
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-')
      const path = `${session.day_id}/${session.id}/${Date.now()}-${safe}`
      const { error: uploadError } = await summitSupabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false })
      if (uploadError) throw uploadError
      const { data: urlData } = summitSupabase.storage.from(bucket).getPublicUrl(path)
      const nextOrder = resources.length ? Math.max(...resources.map(r => Number(r.sort_order || 0))) + 1 : 0
      const resourceTitle = title.trim() || file.name.replace(/\.(pdf|pptx|ppt)$/i, '')
      const { error: insertError } = await summitSupabase.from('session_resources').insert({ session_id: session.id, title: resourceTitle, resource_url: urlData.publicUrl, resource_type: ext === 'pdf' ? 'presentation_pdf' : 'presentation_source', sort_order: nextOrder })
      if (insertError) {
        await summitSupabase.storage.from(bucket).remove([path])
        throw insertError
      }
      setFile(null); setTitle(''); setMessage('Presentation uploaded and attached to this session.'); await load(); onResourceChange?.()
    } catch (error) {
      setError(error.message || 'Unable to upload presentation.')
    } finally {
      setUploading(false)
    }
  }

  const replace = async (resource, nextFile) => {
    if (!nextFile || !summitSupabase) return
    setError(''); setMessage('')
    if (nextFile.size > MAX_MB * 1024 * 1024) return setError(`File is larger than ${MAX_MB} MB.`)
    const ext = nextFile.name.split('.').pop()?.toLowerCase()
    if (!['pdf','pptx','ppt'].includes(ext)) return setError('Only PDF, PPTX and PPT files are supported.')
    setReplacingId(resource.id)
    try {
      const safe = nextFile.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-')
      const path = `${session.day_id}/${session.id}/${Date.now()}-${safe}`
      const { error: uploadError } = await summitSupabase.storage.from(bucket).upload(path, nextFile, { contentType: nextFile.type || undefined, upsert: false })
      if (uploadError) throw uploadError
      const { data: urlData } = summitSupabase.storage.from(bucket).getPublicUrl(path)
      const { error: dbError } = await summitSupabase.from('session_resources').update({ resource_url: urlData.publicUrl, resource_type: ext === 'pdf' ? 'presentation_pdf' : 'presentation_source' }).eq('id', resource.id)
      if (dbError) {
        await summitSupabase.storage.from(bucket).remove([path])
        throw dbError
      }
      const oldPath = storagePath(resource.resource_url)
      if (oldPath) await summitSupabase.storage.from(bucket).remove([oldPath])
      setMessage(`${resource.title} replaced successfully.`)
      await load(); onResourceChange?.()
    } catch (error) {
      setError(error.message || 'Unable to replace presentation.')
    } finally {
      setReplacingId(null)
    }
  }

  const remove = async resource => {
    if (!summitSupabase) return
    setError(''); setMessage('')
    if (!window.confirm(`Remove “${resource.title}” from this session?`)) return
    setReplacingId(resource.id)
    try {
      const { error: dbError } = await summitSupabase.from('session_resources').delete().eq('id', resource.id)
      if (dbError) throw dbError
      const path = storagePath(resource.resource_url)
      if (path) await summitSupabase.storage.from(bucket).remove([path])
      setMessage(`${resource.title} removed.`)
      await load(); onResourceChange?.()
    } catch (error) {
      setError(error.message || 'Unable to remove presentation.')
    } finally {
      setReplacingId(null)
    }
  }

  if (!session) return null

  return <div className="presentation-manager">
    <div className="pm-head"><div><div className="pm-kicker">PRESENTATION & RESOURCES</div><strong>{session.title}</strong><div className="pm-muted">{session.day_id} · {session.start_time}</div></div></div>
    <div className="pm-upload">
      <label>Presentation file<input type="file" accept={ACCEPT} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <label>Display title (optional)<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. AI-Assisted Program Planning" /></label>
      <button className="pm-btn pm-primary" disabled={uploading} onClick={upload}>{uploading ? 'Uploading…' : 'Upload & Attach'}</button>
      <div className="pm-muted">PDF is the live presentation format. PPT/PPTX can be stored as the original downloadable source. Maximum file size: {MAX_MB} MB.</div>
      {file && <div className="pm-selected">Selected: <strong>{file.name}</strong></div>}
      {message && <div className="pm-success">{message}</div>}
      {error && <div className="pm-error">{error}</div>}
    </div>
    <div className="pm-list"><div className="pm-kicker">ATTACHED RESOURCES</div>{resources.length === 0 && <div className="pm-muted">No presentation or resource has been uploaded for this session.</div>}{resources.map(r => <div className="pm-resource" key={r.id}><div className="pm-resource-main"><strong>{r.title}</strong><div className="pm-muted">{r.resource_type === 'presentation_pdf' ? 'LIVE PDF PRESENTATION' : 'DOWNLOADABLE POWERPOINT SOURCE'}</div><a href={r.resource_url} target="_blank" rel="noreferrer" className="pm-open">Open current file</a></div><div className="pm-actions"><label className="pm-replace">{replacingId === r.id ? 'Replacing…' : 'Replace'}<input type="file" accept={ACCEPT} disabled={replacingId === r.id} onChange={e => { const f=e.target.files?.[0]; e.target.value=''; if(f) void replace(r,f) }} /></label><button className="pm-btn pm-remove" disabled={replacingId === r.id} onClick={() => void remove(r)}>{replacingId === r.id ? 'Working…' : 'Remove'}</button></div></div>)}</div>
    <style>{`.presentation-manager{border-top:1px solid #e2e8ef;background:#fbfcfe}.pm-head{padding:13px 16px;border-bottom:1px solid #e5eaf0}.pm-kicker{font-size:9px;letter-spacing:.1em;font-weight:800;color:#6f7e91;margin-bottom:4px}.pm-muted{font-size:10px;color:#718096;line-height:1.45}.pm-upload{padding:14px 16px;border-bottom:1px solid #e5eaf0;display:grid;gap:8px}.pm-upload label{font-size:10px;font-weight:700;color:#40536b}.pm-upload input[type=file],.pm-upload input:not([type]){display:block;width:100%;box-sizing:border-box;margin-top:5px;border:1px solid #d0d9e4;border-radius:7px;padding:8px;background:#fff;font-size:11px}.pm-btn{border:1px solid #ccd6e1;border-radius:7px;background:#fff;padding:7px 10px;font-size:10px;cursor:pointer}.pm-primary{background:#173b68;color:#fff;border-color:#173b68}.pm-primary:disabled,.pm-btn:disabled{opacity:.6}.pm-selected{font-size:10px;color:#506176}.pm-success,.pm-error{padding:8px;border-radius:7px;font-size:10px}.pm-success{background:#edf7ee;color:#286333}.pm-error{background:#fff0f0;color:#8a3030}.pm-list{padding:14px 16px}.pm-resource{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #e8edf2}.pm-resource-main{min-width:0}.pm-resource strong{font-size:11px}.pm-open{display:inline-block;margin-top:5px;font-size:10px;color:#173b68}.pm-actions{display:flex;gap:6px;align-items:center;flex-shrink:0}.pm-replace{position:relative;overflow:hidden;border:1px solid #ccd6e1;border-radius:7px;background:#fff;color:#20334b;padding:7px 10px;font-size:10px;font-weight:600;cursor:pointer}.pm-replace input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.pm-remove{color:#8a3030;border-color:#e1b5b5;background:#fff0f0}@media(max-width:650px){.pm-resource{align-items:flex-start;flex-direction:column}.pm-actions{width:100%}}`}</style>
  </div>
}
