import { useMemo, useState } from 'react'

const days = [
  {
    id: 'day1',
    label: 'DAY 1',
    date: 'Monday, September 21',
    sessions: [
      ['09:00', 'Arrival, Registration and Hall Setup', ''],
      ['11:00', 'Setting the Stage', 'Specialists'],
      ['12:00', 'Lunch', ''],
      ['13:00', 'Opening and Welcome Remarks (+ Photo Opportunity)', 'CG Lagos'],
      ['14:00', 'Overview: The AI Revolution and U.S. Public Diplomacy Priorities', 'Julia McKay (PAO, Lagos)'],
      ['14:30', 'Review of American Spaces: Reach, Challenges, Opportunities to advance U.S. foreign policy priorities. (Pre-Summit Survey)', 'Specialists / Directors'],
      ['15:00', 'Current use cases of AI by American Spaces in Nigeria', 'All Directors'],
      ['15:30', 'Topic to be decided', 'Des Williamson'],
      ['16:30', 'Wrap-Up and Closing', ''],
    ],
  },
  {
    id: 'day2',
    label: 'DAY 2',
    date: 'Tuesday, September 22',
    sessions: [
      ['08:00', 'Ice Breaker', 'Josephine'],
      ['08:05', 'Hands-On Session: AI-Assisted Program Planning', 'Dr. Aondoana Orlu'],
      ['09:15', 'Hands-On Session: AI Assisted Flyer and Graphic Designs', 'Samuel Eyitayo'],
      ['11:00', 'Tea Break', ''],
      ['11:15', 'Hands-On Session: AI Flyer and Graphic Design', 'All Directors'],
      ['12:00', 'Group Lunch', ''],
      ['13:00', 'Hands-On Session: AI for Audience Engagement and Presentation', 'Samuel Edeh and Grace Lamon'],
      ['14:00', 'Hands-On Session: Use of Gemini NotebookLM', 'Hannah Fitter, (REPS, Accra)'],
      ['15:00', 'Mapping ICS Goals to Achieving High Impacting American Spaces Programming', 'Julia McKay (PAO, Lagos) and Bill Couch (Public Engagement Officer, Abuja)'],
      ['16:00', 'Hands-On Session: Programming American Spaces using ICS Goals', 'All Directors'],
      ['16:45', 'Parking Lot and Day 2 Wrap-Up', 'Samuel Eyitayo'],
      ['18:00', 'Networking Event – Casual Wear: Trivia Night at the hotel (Popcorn + Soda)', 'All Participants'],
    ],
  },
  {
    id: 'day3',
    label: 'DAY 3',
    date: 'Wednesday, September 23',
    sessions: [
      ['08:00', 'Ice Breaker', 'Josephine'],
      ['08:10', 'American Spaces Nigeria Strategic Plan: Review FY2026 and Plan FY2027', 'Bill Couch (Public Engagement Officer, Abuja)'],
      ['09:10', 'Hands On Session: Introduction to Vibe Coding', 'Elijah Moses-Iyajini (YALI)'],
      ['10:10', 'Tea Break', ''],
      ['10:25', 'Hands On Session: Introduction to Vibe Coding continued', 'Elijah Moses-Iyajini (YALI)'],
      ['12:00', 'Group Lunch', ''],
      ['13:00', 'Financial matters and Looking Ahead', 'Julia McKay (PAO, Lagos)'],
      ['13:30', 'Practice Session', 'All Directors'],
      ['14:40', 'Summit Evaluation', 'All Directors'],
      ['15:40', 'Closing Ceremony, Certificate Presentation, and Group Photo', 'Bill Couch (Public Engagement Officer, Abuja)'],
      ['16:30', 'Parking Lot and Day 3 Wrap-Up', 'Specialists'],
      ['18:00', 'Representation event (Venue: GQ)', ''],
    ],
  },
]

const placeholderBio = 'Facilitator biography and professional headshot will appear here when supplied by the programme team.'

export default function Summit2026() {
  const [dayIndex, setDayIndex] = useState(0)
  const [selected, setSelected] = useState(0)
  const [slide, setSlide] = useState(1)
  const [parkingInput, setParkingInput] = useState('')
  const [parking, setParking] = useState({ day1: [], day2: [], day3: [] })
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [showPoll, setShowPoll] = useState(false)
  const [pollAnswer, setPollAnswer] = useState('')
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)

  const day = days[dayIndex]
  const session = day.sessions[selected]
  const next = day.sessions[selected + 1]
  const posts = parking[day.id]

  const facilitator = useMemo(() => session[2] || '[FACILITATOR / HOST TO BE CONFIRMED]', [session])

  const chooseSession = (index) => {
    setSelected(index)
    setSlide(1)
    setShowPoll(false)
  }

  const postParking = () => {
    const text = parkingInput.trim()
    if (!text) return
    setParking((current) => ({
      ...current,
      [day.id]: [
        ...current[day.id],
        { id: crypto.randomUUID(), text, name: 'Participant', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), votes: 0 },
      ],
    }))
    setParkingInput('')
  }

  const vote = (id) => {
    setParking((current) => ({
      ...current,
      [day.id]: current[day.id].map((item) => item.id === id ? { ...item, votes: item.votes + 1 } : item),
    }))
  }

  const changeDay = (index) => {
    setDayIndex(index)
    setSelected(0)
    setSlide(1)
    setShowPoll(false)
  }

  const formatTimer = () => `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`

  return (
    <div className="summit-shell">
      <style>{`
        .summit-shell{min-height:100vh;background:#f5f7fb;color:#162235;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left}
        .summit-top{background:#102f56;color:#fff;padding:28px clamp(18px,4vw,48px)}
        .summit-inner{max-width:1400px;margin:0 auto}
        .summit-kicker{font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;opacity:.72}
        .summit-title{font-size:clamp(27px,4vw,46px);line-height:1.05;font-weight:750;margin:8px 0 10px;letter-spacing:-.03em}
        .summit-theme{font-size:15px;max-width:920px;line-height:1.5;opacity:.9}
        .summit-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.summit-meta span{border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:7px 11px;font-size:12px;background:rgba(255,255,255,.06)}
        .summit-main{max-width:1400px;margin:0 auto;padding:18px clamp(14px,3vw,34px) 40px}
        .day-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:15px}.day-tab{min-width:160px;border:1px solid #d6dee8;background:#fff;border-radius:12px;padding:11px 14px;text-align:left;cursor:pointer}.day-tab strong{display:block;color:#173b68;font-size:13px}.day-tab span{font-size:11px;color:#6a788b}.day-tab.active{background:#eaf1f8;border-color:#173b68}
        .grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,.8fr);gap:15px}.card{background:#fff;border:1px solid #dce3ec;border-radius:15px;overflow:hidden}.card-head{padding:13px 16px;border-bottom:1px solid #e5eaf0;display:flex;align-items:center;justify-content:space-between;gap:12px}.card-head h2{font-size:15px;margin:0;color:#173b68;font-weight:750}.muted{color:#718096;font-size:12px}
        .session-body{padding:17px}.live{font-size:11px;text-transform:uppercase;font-weight:800;letter-spacing:.09em;color:#8c3131;display:flex;gap:7px;align-items:center}.live i{display:block;width:7px;height:7px;border-radius:50%;background:#b74343}.session-title{font-size:clamp(21px,3vw,31px);line-height:1.12;color:#173b68;margin:6px 0 7px;font-weight:760}.desc{font-size:13px;line-height:1.55;color:#4e5f74}
        .profile{display:flex;gap:12px;align-items:center;background:#f4f6f9;border-radius:12px;padding:12px;margin:15px 0}.headshot{width:60px;height:60px;border-radius:50%;background:#dfe6ef;display:flex;align-items:center;justify-content:center;color:#6a788b;font-weight:800;flex:none}.profile strong{font-size:13px}.bio{font-size:11px;color:#6a788b;margin-top:3px;line-height:1.4}
        .slide{margin:0 0 12px;background:#0e2b4d;color:#fff;border-radius:12px;min-height:280px;padding:28px;display:flex;flex-direction:column;justify-content:center}.slide small{opacity:.65;text-transform:uppercase;letter-spacing:.1em}.slide h3{font-size:clamp(22px,3vw,34px);line-height:1.15;margin:10px 0}.slide p{max-width:720px;line-height:1.55;font-size:14px;opacity:.9}.slidebar{display:flex;align-items:center;justify-content:space-between;gap:10px}.buttons{display:flex;gap:7px;flex-wrap:wrap}.btn{border:1px solid #d4dce7;background:#fff;color:#24364d;border-radius:8px;padding:9px 12px;font-size:12px;cursor:pointer}.btn.primary{background:#173b68;border-color:#173b68;color:#fff}.btn.gold{background:#f6efdf;border-color:#dcc58f}.btn:focus-visible,.day-tab:focus-visible,textarea:focus-visible{outline:3px solid #9db8d5;outline-offset:2px}
        .timeline{max-height:470px;overflow:auto}.timeline-row{padding:11px 14px;border-bottom:1px solid #edf0f4;cursor:pointer}.timeline-row.active{background:#edf3f9;border-left:3px solid #173b68;padding-left:11px}.time{font-size:11px;font-weight:800;color:#173b68}.row-title{font-size:12px;font-weight:650;line-height:1.35;margin-top:2px}.fac{font-size:10px;color:#758297;margin-top:3px}
        .side-section{padding:14px}.metric-label{font-size:10px;color:#77859a;text-transform:uppercase;letter-spacing:.08em}.metric-value{font-size:14px;font-weight:700;color:#173b68;margin:3px 0 13px;line-height:1.35}.timer{font-size:30px;font-weight:800;color:#173b68;margin:4px 0 10px;font-variant-numeric:tabular-nums}.rule{border:0;border-top:1px solid #e4e9ef;margin:15px 0}
        .parking{margin-top:15px}.parking-form{padding:14px}.parking-form textarea{width:100%;min-height:78px;border:1px solid #d5dde7;border-radius:9px;padding:10px;resize:vertical;font-size:13px}.parking-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px}.post{padding:11px 14px;border-top:1px solid #e8edf2}.post-meta{display:flex;justify-content:space-between;color:#718096;font-size:10px}.post-text{font-size:13px;line-height:1.45;margin:5px 0 7px}.vote{border:1px solid #d5dde7;background:#fff;border-radius:7px;padding:5px 8px;font-size:11px;cursor:pointer}
        .notes{margin-top:15px}.notes textarea{width:100%;min-height:140px;border:1px solid #d5dde7;border-radius:9px;padding:10px;resize:vertical}.poll{padding:14px;background:#f8fafc;border-top:1px solid #e4e9ef}.poll label{display:block;font-size:12px;margin:7px 0}.announcement{padding:10px 12px;background:#f6efdf;border:1px solid #e1cfa4;border-radius:9px;font-size:12px;color:#5d4a20}
        @media(max-width:850px){.grid{grid-template-columns:1fr}.timeline{max-height:none}.summit-top{padding:22px 16px}.summit-main{padding:14px 12px 30px}}
      `}</style>

      <header className="summit-top">
        <div className="summit-inner">
          <div className="summit-kicker">U.S. Diplomatic Mission in Nigeria · Public Diplomacy Section</div>
          <div className="summit-title">Summit of American Spaces in Nigeria 2026</div>
          <div className="summit-theme">Built on American AI: Equipping American Spaces Nigeria to Showcase the U.S. AI Stack</div>
          <div className="summit-meta"><span>September 21–23 · Programme</span><span>September 24 · Departure</span><span>Black Diamond Suites · Victoria Island, Lagos</span></div>
        </div>
      </header>

      <main className="summit-main">
        <div className="day-tabs" role="tablist" aria-label="Summit days">
          {days.map((item, index) => <button type="button" key={item.id} className={`day-tab ${index === dayIndex ? 'active' : ''}`} onClick={() => changeDay(index)}><strong>{item.label}</strong><span>{item.date}</span></button>)}
        </div>

        <div className="grid">
          <section>
            <div className="card">
              <div className="card-head"><h2>{day.label} · {day.date}</h2><span className="muted">{day.sessions.length} programme items</span></div>
              <div className="session-body">
                <div className="live"><i /> Live session</div>
                <div className="session-title">{session[1]}</div>
                <div className="desc">{session[1].includes('Setting the Stage') ? 'Summit instructions · Distribution into groups · Choose daily a bell ringer · More on Appendix A.' : session[1].includes('Vibe Coding') ? 'Using AI to write functional code through natural language prompts. Real-world use cases include an automated programme registration form, an attendance/reporting dashboard, and a WhatsApp auto-response bot.' : 'Facilitator presentation area. The production version will display the facilitator’s uploaded PPTX, PDF or connected Google Slides deck here.'}</div>

                <div className="profile"><div className="headshot" aria-label="Facilitator headshot placeholder">{facilitator.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').slice(0, 2) || 'F'}</div><div><strong>{facilitator}</strong><div className="bio">{placeholderBio}</div></div></div>

                <div className="slide"><small>Slide {slide} · Presentation placeholder</small><h3>{slide === 1 ? session[1] : 'Interactive session content'}</h3><p>{slide === 1 ? 'Facilitator slides will appear here. PPTX, PDF and Google Slides are planned as supported presentation sources.' : 'Reserved for facilitator content, demonstration, exercise, poll, quiz, reflection or group activity.'}</p></div>
                <div className="slidebar"><span className="muted">{slide} / 12</span><div className="buttons"><button type="button" className="btn" onClick={() => setSlide((value) => Math.max(1, value - 1))}>Previous</button><button type="button" className="btn primary" onClick={() => setSlide((value) => Math.min(12, value + 1))}>Next</button><button type="button" className="btn gold" onClick={() => setShowPoll((value) => !value)}>Interactive Poll</button></div></div>
              </div>
              {showPoll && <div className="poll"><strong style={{ fontSize: 13 }}>Demo live poll</strong><div className="muted" style={{ marginTop: 3 }}>How are you currently using AI in your American Space?</div>{['Programming', 'Graphic design', 'Communications', 'Research', 'Administration', 'Not currently using AI'].map((option) => <label key={option}><input type="radio" name="demo-poll" value={option} checked={pollAnswer === option} onChange={(event) => setPollAnswer(event.target.value)} /> {option}</label>)}{pollAnswer && <div className="announcement" style={{ marginTop: 8 }}>Response recorded in this prototype: <strong>{pollAnswer}</strong></div>}</div>}
            </div>

            <div className="card" style={{ marginTop: 15 }}>
              <div className="card-head"><h2>Programme Timeline</h2><span className="muted">Select a session</span></div>
              <div className="timeline">{day.sessions.map((item, index) => <div key={`${item[0]}-${item[1]}`} className={`timeline-row ${index === selected ? 'active' : ''}`} onClick={() => chooseSession(index)}><div className="time">{item[0]}</div><div className="row-title">{item[1]}</div><div className="fac">{item[2] || '—'}</div></div>)}</div>
            </div>

            <div className="card parking">
              <div className="card-head"><h2>{day.label} Parking Lot</h2><span className="muted">{posts.length} post{posts.length === 1 ? '' : 's'}</span></div>
              <div className="parking-form"><textarea value={parkingInput} onChange={(event) => setParkingInput(event.target.value)} placeholder="Post a question, idea, issue, or topic to revisit..." aria-label="Parking Lot contribution" /><div className="parking-actions"><span className="muted">Prototype: posts are local to this session.</span><button type="button" className="btn primary" onClick={postParking}>Post to Parking Lot</button></div></div>
              {posts.length === 0 ? <div className="post"><span className="muted">No contributions yet. Start the Parking Lot with a question or idea.</span></div> : [...posts].reverse().map((item) => <article className="post" key={item.id}><div className="post-meta"><span>{item.name}</span><span>{item.time}</span></div><div className="post-text">{item.text}</div><button type="button" className="vote" onClick={() => vote(item.id)}>▲ Upvote {item.votes}</button></article>)}
            </div>
          </section>

          <aside>
            <div className="card">
              <div className="card-head"><h2>Run of Show</h2><span className="muted">Coordinator view</span></div>
              <div className="side-section">
                <div className="metric-label">Current session</div><div className="metric-value">{session[0]} · {session[1]}</div>
                <div className="metric-label">Next</div><div className="metric-value">{next ? `${next[0]} · ${next[1]}` : 'End of programme day'}</div>
                <div className="metric-label">Session timer</div><div className="timer">{formatTimer()}</div>
                <div className="buttons"><button type="button" className="btn primary" onClick={() => setTimerRunning((value) => !value)}>{timerRunning ? 'Pause' : 'Start'}</button><button type="button" className="btn" onClick={() => { setTimerRunning(false); setTimerSeconds(0) }}>Reset</button></div>
                <hr className="rule" />
                <div className="metric-label">Coordinator controls</div><div className="muted" style={{ lineHeight: 1.5, marginTop: 5 }}>Production controls will include slide override, Parking Lot moderation, announcements, poll management and role-based access.</div>
                <hr className="rule" />
                <div className="buttons"><button type="button" className="btn gold" onClick={() => setShowNotes((value) => !value)}>My Notes</button><button type="button" className="btn" onClick={() => alert('Announcement channel is ready for backend integration.')}>Announcement</button></div>
                {showNotes && <div className="notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Private summit notes..." /></div>}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
