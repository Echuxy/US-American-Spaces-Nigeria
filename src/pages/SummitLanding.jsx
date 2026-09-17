import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import '../summit-landing.css'

const LAGOS_IMAGE = 'https://commons.wikimedia.org/wiki/Special:FilePath/Sunset%2C%20Third%20Mainland%20Bridge%2C%20Lagos%2C%20Nigeria.jpg'
const ABUJA_IMAGE = 'https://commons.wikimedia.org/wiki/Special:FilePath/National%20Assembly%20Complex%2C%20Abuja.jpg'
const PEOPLE_IMAGE = 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1400&q=85'
const AI_IMAGE = 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=85'
const WOMAN_IMAGE = 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85'

const days = [
  { id:'day1', label:'DAY 1', date:'Mon, 21 Sept', sessions:[
    ['09:00','Arrival, Registration and Hall Setup',''],
    ['11:00','Setting the Stage','Specialists'],
    ['13:00','Opening and Welcome Remarks (+ Photo Opportunity)','CG Lagos'],
    ['14:00','Overview: The AI Revolution and U.S. Public Diplomacy Priorities','Julia McKay'],
    ['14:30','Review of American Spaces: Reach, Challenges, Opportunities to advance U.S. foreign policy priorities.','Specialists / Directors'],
    ['15:00','Current use cases of AI by American Spaces in Nigeria','All Directors'],
    ['15:30','Topic to be decided','Des Williamson'],
    ['16:30','Wrap-Up and Closing',''],
  ]},
  { id:'day2', label:'DAY 2', date:'Tue, 22 Sept', sessions:[
    ['08:00','Ice Breaker','Josephine'],
    ['08:05','Hands-On Session: AI-Assisted Program Planning','Dr. Aondoana Orlu'],
    ['09:15','Hands-On Session: AI Assisted Flyer and Graphic Designs','Samuel Eyitayo'],
    ['11:15','Hands-On Session: AI Flyer and Graphic Design','All Directors'],
    ['13:00','Hands-On Session: AI for Audience Engagement and Presentation','Samuel Edeh and Grace Lamon'],
    ['14:00','Hands-On Session: Use of Gemini NotebookLM','Hannah Fitter, (REPS, Accra)'],
    ['15:00','Mapping ICS Goals to Achieving High Impacting American Spaces Programming','Julia McKay and Bill Couch'],
    ['16:00','Hands-On Session: Programming American Spaces using ICS Goals','All Directors'],
    ['16:45','Parking Lot and Day 2 Wrap-Up','Samuel Eyitayo'],
    ['18:00','Networking Event – Casual Wear: Trivia Night at the hotel (Popcorn + Soda)','All Participants'],
  ]},
  { id:'day3', label:'DAY 3', date:'Wed, 23 Sept', sessions:[
    ['08:00','Ice Breaker','Josephine'],
    ['08:10','American Spaces Nigeria Strategic Plan: Review FY2026 and Plan FY2027','Bill Couch'],
    ['09:10','Hands On Session: Introduction to Vibe Coding','Elijah Moses-Iyajini (YALI)'],
    ['10:25','Hands On Session: Introduction to Vibe Coding continued','Elijah Moses-Iyajini (YALI)'],
    ['13:00','Financial matters and Looking Ahead','Julia McKay'],
    ['13:30','Practice Session','All Directors'],
    ['14:40','Summit Evaluation','All Directors'],
    ['15:40','Closing Ceremony, Certificate Presentation, and Group Photo','Bill Couch'],
    ['16:30','Parking Lot and Day 3 Wrap-Up','Specialists'],
    ['18:00','Representation event (Venue: GQ)',''],
  ]},
]

function parseTime(value){ const [h,m] = value.split(':').map(Number); return h * 60 + m }
function getSummitStatus(){
  const now = new Date()
  const start = new Date('2026-09-21T00:00:00+01:00')
  const end = new Date('2026-09-24T00:00:00+01:00')
  if(now < start) return { mode:'preview', label:'SUMMIT PREVIEW' }
  if(now >= end) return { mode:'complete', label:'SUMMIT COMPLETE' }
  const dayIndex = Math.min(2, Math.max(0, Math.floor((now - start) / 86400000)))
  const minutes = now.getHours() * 60 + now.getMinutes()
  const day = days[dayIndex]
  let current = null
  let next = null
  day.sessions.forEach((session, index) => {
    const startMin = parseTime(session[0])
    const nextMin = day.sessions[index + 1] ? parseTime(day.sessions[index + 1][0]) : 24 * 60
    if(minutes >= startMin && minutes < nextMin) current = session
    if(!next && minutes < startMin) next = session
  })
  return { mode:'live', label: current ? 'LIVE NOW' : 'UP NEXT', current, next, dayIndex }
}

export default function SummitLanding(){
  const navigate = useNavigate()
  const status = useMemo(getSummitStatus, [])
  const previewSession = days[0].sessions.find(s => s[1].toLowerCase().includes('setting the stage')) || days[0].sessions[0]
  const liveSession = status.current || status.next || previewSession
  const liveFacilitator = liveSession?.[2] || 'Summit Programme'

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' })
  const enterSummit = () => navigate('/summit-2026/register')
  const openLive = () => navigate('/summit-2026/live')

  return <div className="sx">
    <header className="sx-nav">
      <button className="sx-brand" onClick={() => window.scrollTo({top:0, behavior:'smooth'})} aria-label="Summit home">
        <span className="sx-flag" aria-hidden="true"><i /></span>
        <span><b>U.S. MISSION NIGERIA</b><small>PUBLIC DIPLOMACY SECTION</small><em>People&nbsp; | &nbsp;Partnerships&nbsp; | &nbsp;Possibilities</em></span>
      </button>
      <nav>
        <button className="active" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>Home</button>
        <button onClick={() => scrollTo('about')}>About</button>
        <button onClick={() => scrollTo('programme')}>Programme</button>
        <button onClick={() => scrollTo('speakers')}>Speakers</button>
        <button onClick={openLive}>Live</button>
        <button onClick={() => scrollTo('resources')}>Resources</button>
        <button onClick={() => scrollTo('contact')}>Contact</button>
      </nav>
      <div className="sx-motto"><span>ENGAGE</span><span>EDUCATE</span><span>EMPOWER</span><i /></div>
    </header>

    <main>
      <section className="sx-hero" id="about">
        <div className="sx-city sx-lagos"><b>LAGOS</b><span>A CITY OF<br/>OPPORTUNITY</span></div>
        <div className="sx-city sx-abuja"><b>ABUJA</b><span>THE SEAT OF A<br/>BRIGHTER TOMORROW</span></div>
        <div className="sx-hero-image sx-image-lagos" />
        <div className="sx-hero-image sx-image-abuja" />
        <div className="sx-hero-vignette" />
        <div className="sx-hero-grid" />
        <div className="sx-hero-copy">
          <div className="sx-kicker">SUMMIT OF</div>
          <h1>AMERICAN SPACES<br/><span>NIGERIA <em>2026</em></span></h1>
          <div className="sx-rule" />
          <h2>BUILT ON AMERICAN AI</h2>
          <p>Equipping American Spaces Nigeria to Showcase<br className="desktop"/> the U.S. AI Stack.</p>
          <div className="sx-meta"><span>▣ &nbsp; 21 – 23 SEPTEMBER 2026</span><span>⌖ &nbsp; LAGOS, NIGERIA</span></div>
          <button className="sx-primary" onClick={enterSummit}>ENTER SUMMIT <b>→</b></button>
        </div>
        <div className="sx-hero-bottom"><span>Vibrant People. Dynamic Cities.<br/><i>A Stronger, More Connected Nigeria.</i></span><span><i>“Investing in people is the most powerful way<br/>to shape a more prosperous future.”</i><b>— U.S. DEPARTMENT OF STATE</b></span></div>
      </section>

      <section className="sx-pillars">
        <article><b>♟</b><h3>ENGAGE</h3><p>Open Dialogue</p></article>
        <article><b>▤</b><h3>EDUCATE</h3><p>Expand Opportunities</p></article>
        <article><b>♧</b><h3>EMPOWER</h3><p>Build the Future</p></article>
        <div className="sx-pillar-caption">EXPLORE &nbsp;·&nbsp; LEARN &nbsp;·&nbsp; CONNECT &nbsp;·&nbsp; BUILD</div>
      </section>

      <section className="sx-stack" id="speakers">
        <div className="sx-stack-head"><div><span>THE AMERICAN AI STACK</span><small>IDEAS. TOOLS. PEOPLE. IMPACT.</small></div><p>Bringing together innovation, creativity and collaboration<br/>to strengthen communities across Nigeria.</p><button onClick={() => scrollTo('programme')}>LEARN MORE &nbsp;→</button></div>
        <div className="sx-stack-grid">
          <div className="sx-stack-image sx-people"><span>PEOPLE. TECHNOLOGY.<br/>COMMUNITY. GLOBAL OPPORTUNITY.</span></div>
          <div className="sx-live-panel">
            <div className="sx-live-head"><span className={status.mode === 'live' && status.current ? 'live' : ''}>● {status.label}</span><small>{status.mode === 'preview' ? '21 SEPTEMBER' : days[status.dayIndex]?.date || 'SUMMIT'}</small></div>
            <h3>{liveSession[1]}</h3>
            <div className="sx-live-person"><span className="sx-avatar">AI</span><div><b>{liveFacilitator}</b><small>Lead Facilitator / Summit Programme</small></div></div>
            <button className="sx-primary sx-live-button" onClick={openLive}>VIEW LIVE SESSION <b>→</b></button>
            <div className="sx-tool-row"><button onClick={openLive}>◌<span>Parking Lot</span></button><button onClick={openLive}>▥<span>Live Poll</span></button><button onClick={openLive}>▤<span>Resources</span></button><button onClick={openLive}>▢<span>Take Notes</span></button></div>
          </div>
          <div className="sx-stack-image sx-ai"><span>A<br/>BRIGHTER<br/>MORE CONNECTED<br/>NIGERIA</span></div>
        </div>
      </section>

      <section className="sx-programme" id="programme">
        <div className="sx-programme-head"><div><span>▦ &nbsp; SUMMIT PROGRAMME</span><small>Three days of learning, collaboration and innovation.</small></div><a onClick={openLive}>VIEW FULL PROGRAMME &nbsp;→</a></div>
        <div className="sx-day-tabs">{days.map((day,index)=><button key={day.id} className={index === 0 ? 'active' : ''} onClick={() => document.getElementById(`sx-day-${day.id}`)?.scrollIntoView({behavior:'smooth', block:'center'})}><b>{day.label}</b><span>{day.date}</span></button>)}</div>
        <div className="sx-featured-sessions">
          {days[0].sessions.slice(0,4).map((session,index)=><button className="sx-session-card" key={index} onClick={openLive}><time>{session[0]} <small>AM</small></time><b>{session[1]}</b><span>{session[2] || 'Main Hall · Plenary'}</span><i>→</i></button>)}
        </div>
        <div className="sx-full-days">{days.map(day=><div className="sx-day-block" id={`sx-day-${day.id}`} key={day.id}><div><b>{day.label}</b><span>{day.date}</span></div><section>{day.sessions.map((s,i)=><button key={i} onClick={openLive}><time>{s[0]}</time><span><b>{s[1]}</b><small>{s[2] || 'Summit Programme'}</small></span><i>→</i></button>)}</section></div>)}</div>
      </section>

      <section className="sx-connect" id="resources">
        <div><span>JOIN A MOVEMENT OF POSSIBILITY</span><p>Connecting people. Strengthening communities. Building a brighter Nigeria together.</p></div>
        <button onClick={enterSummit}>BE PART OF THE SUMMIT <b>→</b></button>
      </section>
    </main>

    <footer className="sx-footer" id="contact">
      <div className="sx-seal">✦</div><div><b>U.S. DEPARTMENT OF STATE</b><small>UNITED STATES OF AMERICA</small></div>
      <nav><button onClick={() => scrollTo('about')}>About</button><button>Privacy</button><button>Accessibility</button><button onClick={() => scrollTo('contact')}>Contact</button></nav>
      <div className="sx-social">in &nbsp; X &nbsp; ◎ &nbsp; ▶</div><span>#AmericanSpacesNG2026</span>
    </footer>
  </div>
}
