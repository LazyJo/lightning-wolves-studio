import { useState, useEffect, useRef } from 'react'

const ROLES = [
  { id: 'artist', label: '🎵 Artist / Musician' },
  { id: 'photo', label: '📸 Photography' },
  { id: 'video', label: '🎥 Video / Videography' },
  { id: 'design', label: '🎨 Design / Visual Art' },
  { id: 'beats', label: '🎧 Beatmaker / Producer' },
  { id: 'other', label: 'Other' },
]

const PLATFORMS = ['Instagram', 'TikTok', 'Twitter/X', 'YouTube', 'Facebook']
const LW_APPS_KEY = 'lw_applications'

function getApps() { try { return JSON.parse(localStorage.getItem(LW_APPS_KEY)) || [] } catch { return [] } }
function saveApps(apps) { localStorage.setItem(LW_APPS_KEY, JSON.stringify(apps)) }

// ─── Join Page ───────────────────────────────────────────────────────────────
export function JoinPage({ onBack }) {
  const [form, setForm] = useState({
    realName: '', artistName: '', genre: '', roles: [], otherRole: '',
    skills: '', socials: [{ platform: 'Instagram', url: '' }],
    musicLink: '', whyJoin: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState('')

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function toggleRole(id) {
    setForm(f => ({ ...f, roles: f.roles.includes(id) ? f.roles.filter(r => r !== id) : [...f.roles, id] }))
  }

  function setSocial(idx, key, val) {
    setForm(f => {
      const s = [...f.socials]; s[idx] = { ...s[idx], [key]: val }; return { ...f, socials: s }
    })
  }

  function addSocial() {
    if (form.socials.length >= 3) return
    setForm(f => ({ ...f, socials: [...f.socials, { platform: 'Instagram', url: '' }] }))
  }

  function removeSocial(idx) {
    setForm(f => ({ ...f, socials: f.socials.filter((_, i) => i !== idx) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.realName.trim() || !form.artistName.trim() || !form.genre.trim() || !form.roles.length || !form.skills.trim() || !form.whyJoin.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    const app = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...form,
      fileName: fileName || null,
      timestamp: new Date().toISOString(),
      status: 'pending',
      adminNotes: '',
    }

    const apps = getApps()
    apps.unshift(app)
    saveApps(apps)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="join-page">
        <div className="join-success">
          <div className="join-success-icon">⚡</div>
          <h2 className="join-success-title">Application Sent!</h2>
          <p className="join-success-text">We'll review your application and get back to you. The pack is watching. 🐺</p>
          <button className="btn-gold" onClick={onBack}>Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="join-page">
      <header className="join-header">
        <button className="btn-outline btn-sm" onClick={onBack}>← Back</button>
      </header>

      <div className="join-hero">
        <img src="/logo.png" alt="LW" className="join-logo" onError={e => e.target.style.display='none'} />
        <h1 className="join-title">JOIN THE PACK</h1>
        <p className="join-tagline">Think you run with the pack? Show us what you got.</p>
      </div>

      <form className="join-form" onSubmit={handleSubmit}>
        <div className="join-section">
          <div className="join-field">
            <label className="join-label">Real Name *</label>
            <input className="join-input" value={form.realName} onChange={e => set('realName', e.target.value)} placeholder="Your full name" />
          </div>
          <div className="join-field">
            <label className="join-label">Artist Name *</label>
            <input className="join-input" value={form.artistName} onChange={e => set('artistName', e.target.value)} placeholder="Stage name or alias" />
          </div>
          <div className="join-field">
            <label className="join-label">Genre / Style *</label>
            <input className="join-input" value={form.genre} onChange={e => set('genre', e.target.value)} placeholder="e.g. Hip-Hop, R&B, Pop" />
          </div>
        </div>

        <div className="join-section">
          <label className="join-label">Role / What you want to help with *</label>
          <div className="join-roles">
            {ROLES.map(r => (
              <label key={r.id} className={`join-role-chip${form.roles.includes(r.id) ? ' active' : ''}`}>
                <input type="checkbox" checked={form.roles.includes(r.id)} onChange={() => toggleRole(r.id)} />
                {r.label}
              </label>
            ))}
          </div>
          {form.roles.includes('other') && (
            <input className="join-input join-other-input" value={form.otherRole} onChange={e => set('otherRole', e.target.value)} placeholder="Describe your role..." />
          )}
        </div>

        <div className="join-section">
          <div className="join-field">
            <label className="join-label">Your Skills *</label>
            <textarea className="join-textarea" value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="Tell us what you're good at" rows={3} />
          </div>
        </div>

        <div className="join-section">
          <label className="join-label">Social Media Links <span className="join-optional">(up to 3)</span></label>
          {form.socials.map((s, i) => (
            <div key={i} className="join-social-row">
              <select className="join-select" value={s.platform} onChange={e => setSocial(i, 'platform', e.target.value)}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="join-input" value={s.url} onChange={e => setSocial(i, 'url', e.target.value)} placeholder="https://..." />
              {form.socials.length > 1 && <button type="button" className="join-remove-btn" onClick={() => removeSocial(i)}>✕</button>}
            </div>
          ))}
          {form.socials.length < 3 && <button type="button" className="join-add-btn" onClick={addSocial}>+ Add another</button>}
        </div>

        <div className="join-section">
          <div className="join-field">
            <label className="join-label">Music Link <span className="join-optional">(SoundCloud, Spotify, Apple Music...)</span></label>
            <input className="join-input" value={form.musicLink} onChange={e => set('musicLink', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className="join-section">
          <div className="join-field">
            <label className="join-label">Why do you want to join Lightning Wolves? *</label>
            <textarea className="join-textarea" value={form.whyJoin} onChange={e => set('whyJoin', e.target.value)} placeholder="What drives you? What can you bring to the pack?" rows={4} />
          </div>
        </div>

        <div className="join-section">
          <label className="join-label">Upload a work sample <span className="join-optional">(optional — image, video, or audio)</span></label>
          <div className="join-upload-zone" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" hidden onChange={e => { if (e.target.files[0]) setFileName(e.target.files[0].name) }} />
            {fileName ? <span className="join-file-name">✓ {fileName}</span> : <span>Click to upload a file</span>}
          </div>
        </div>

        {error && <div className="join-error">{error}</div>}

        <button type="submit" className="btn-gold join-submit">Send it ⚡</button>
      </form>
    </div>
  )
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
export function AdminDashboard({ onBack }) {
  const [apps, setApps] = useState(() => getApps())
  const [filter, setFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  function updateApp(id, updates) {
    const next = apps.map(a => a.id === id ? { ...a, ...updates } : a)
    setApps(next)
    saveApps(next)
    if (selected?.id === id) setSelected({ ...selected, ...updates })
  }

  const filtered = apps.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false
    if (roleFilter !== 'all' && !(a.roles || []).includes(roleFilter)) return false
    if (search && !a.realName?.toLowerCase().includes(search.toLowerCase()) && !a.artistName?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = { total: apps.length, pending: apps.filter(a => a.status === 'pending').length, approved: apps.filter(a => a.status === 'approved').length, rejected: apps.filter(a => a.status === 'rejected').length }

  if (selected) {
    return (
      <div className="admin-page">
        <header className="admin-header">
          <button className="btn-outline btn-sm" onClick={() => setSelected(null)}>← Back to List</button>
          <span className="admin-header-title">Application Detail</span>
          <div></div>
        </header>
        <div className="admin-detail">
          <div className="admin-detail-top">
            <h2 className="admin-detail-name">{selected.artistName}</h2>
            <span className={`admin-status-badge status-${selected.status}`}>{selected.status}</span>
          </div>
          <div className="admin-detail-grid">
            <div className="admin-detail-field"><span className="admin-detail-label">Real Name</span><span>{selected.realName}</span></div>
            <div className="admin-detail-field"><span className="admin-detail-label">Genre</span><span>{selected.genre}</span></div>
            <div className="admin-detail-field"><span className="admin-detail-label">Roles</span><span>{(selected.roles || []).join(', ')}{selected.otherRole ? ` (${selected.otherRole})` : ''}</span></div>
            <div className="admin-detail-field"><span className="admin-detail-label">Applied</span><span>{new Date(selected.timestamp).toLocaleDateString()}</span></div>
          </div>
          <div className="admin-detail-section"><h4>Skills</h4><p>{selected.skills}</p></div>
          <div className="admin-detail-section"><h4>Why Join</h4><p>{selected.whyJoin}</p></div>
          {selected.musicLink && <div className="admin-detail-section"><h4>Music Link</h4><a href={selected.musicLink} target="_blank" rel="noopener noreferrer">{selected.musicLink}</a></div>}
          {selected.socials?.length > 0 && (
            <div className="admin-detail-section"><h4>Socials</h4>
              {selected.socials.filter(s => s.url).map((s, i) => <div key={i}><strong>{s.platform}:</strong> <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a></div>)}
            </div>
          )}
          {selected.fileName && <div className="admin-detail-section"><h4>Work Sample</h4><span>{selected.fileName}</span></div>}

          <div className="admin-detail-section">
            <h4>Admin Notes</h4>
            <textarea className="admin-notes-textarea" value={selected.adminNotes || ''} onChange={e => updateApp(selected.id, { adminNotes: e.target.value })} placeholder="Add notes..." rows={3} />
          </div>

          <div className="admin-actions">
            <button className="btn-gold btn-sm" onClick={() => updateApp(selected.id, { status: 'approved' })}>✓ Approve</button>
            <button className="btn-outline btn-sm" onClick={() => updateApp(selected.id, { status: 'pending' })}>⏳ Pending</button>
            <button className="btn-ghost btn-sm admin-reject-btn" onClick={() => updateApp(selected.id, { status: 'rejected' })}>✕ Reject</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="btn-outline btn-sm" onClick={onBack}>← Back</button>
        <span className="admin-header-title">Applications</span>
        <div></div>
      </header>

      <div className="admin-body">
        <div className="admin-stats">
          <div className="admin-stat"><span className="admin-stat-num">{counts.total}</span> Total</div>
          <div className="admin-stat"><span className="admin-stat-num admin-stat-pending">{counts.pending}</span> Pending</div>
          <div className="admin-stat"><span className="admin-stat-num admin-stat-approved">{counts.approved}</span> Approved</div>
          <div className="admin-stat"><span className="admin-stat-num admin-stat-rejected">{counts.rejected}</span> Rejected</div>
        </div>

        <div className="admin-filters">
          <select className="admin-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="admin-filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <input className="admin-search" placeholder="Search name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {!filtered.length ? (
          <div className="admin-empty">No applications found.</div>
        ) : (
          <div className="admin-table">
            {filtered.map(app => (
              <div key={app.id} className="admin-row" onClick={() => setSelected(app)}>
                <div className="admin-row-name">
                  <strong>{app.artistName}</strong>
                  <span className="admin-row-real">{app.realName}</span>
                </div>
                <div className="admin-row-roles">{(app.roles || []).join(', ')}</div>
                <div className="admin-row-date">{new Date(app.timestamp).toLocaleDateString()}</div>
                <span className={`admin-status-badge status-${app.status}`}>{app.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
