import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import '../summit-landing.css'
import SummitBrandMarks from '../components/SummitBrandMarks'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1523731407965-2430cd12f5e4?auto=format&fit=crop&w=2200&q=88'
const AI_IMAGE = 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=88'
const PEOPLE_IMAGE = 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1600&q=88'

const days = [
  { id:'day1', label:'01', date:'21 SEPTEMBER', title:'FOUNDATIONS', sessions:[
    ['09:00','Arrival, Registration and Hall Setup',''],
    ['11:00','Setting the Stage','Specialists'],
    ['13:00','Opening and Welcome Remarks (+ Photo Opportunity)','CG Lagos'],
    ['14:00','The AI Revolution and U.S. Public Diplomacy Priorities','Julia McKay'],
    ['14:30','Review of American Spaces: Reach, Challenges and Opportunities','Specialists / Directors'],
    ['15:00','Current use cases of AI by American Spaces in Nigeria','All Directors'],
    ['15:30','Topic to be decided','Des Williamson'],
    ['16:30','Wrap-Up and Closing',''],
  ]},
  { id:'day2', label:'02', date:'22 SEPTEMBER', title:'BUILD', sessions:[
    ['08:00','Ice Breaker','Josephine'],
    ['08:05','AI-Assisted Program Planning','Dr. Aondoana Orlu'],
    ['09:15','AI Assisted Flyer and Graphic Designs','Samuel Eyitayo'],
    ['11:15','AI Flyer and Graphic Design','All Directors'],
    ['13:00','AI for Audience Engagement and Presentation','Samuel Edeh and Grace Lamon'],
    ['14:00','Use of Gemini NotebookLM','Hannah Fitter, (REPS, Accra)'],
    ['15:00','Mapping ICS Goals to High-Impact Programming','Julia McKay and Bill Couch'],
    ['16:00','Programming American Spaces using ICS Goals','All Directors'],
    ['16:45','Parking Lot and Day 2 Wrap-Up','Samuel Eyitayo'],
    ['18:00','Networking Event – Trivia Night','All Participants'],
  ]},
  { id:'day3', label:'03', date:'23 SEPTEMBER', title:'ACTIVATE', sessions:[
    ['08:00','Ice Breaker','Josephine'],
    ['08:10','American Spaces Nigeria Strategic Plan: Review FY2026 and Plan FY2027','Bill Couch'],
    ['09:10','Introduction to Vibe Coding','Elijah Moses-Iyajini (YALI)'],
    ['10:25','Introduction to Vibe Coding continued','Elijah Moses-Iyajini (YALI)'],
    ['13:00','Financial matters and Looking Ahead','Julia McKay'],
    ['13:30','Practice Session','All Directors'],
    ['14:40','Summit Evaluation','All Directors'],
    ['15:40','Closing Ceremony, Certificate Presentation, and Group Photo','Bill Couch'],
    ['16:30','Parking Lot and Day 3 Wrap-Up','Specialists'],
    ['18:00','Representation event (Venue: GQ)',''],
  ]},
]

const groupRotation = {
  '21 SEPTEMBER': [['1','Lagos (AmCenter) · Abuja · Kano · Enugu · Osogbo'],['2','Calabar · Ikeja · Ibadan · Keffi · Yola'],['3','Bauchi · Maiduguri · OgunTechHub · Katsina · Abeokuta'],['4','Abuja (AmCenter) · Benin City · Zaria · Lekki'],['5','Minna · Jos · Uyo · Gombe · UNILAG'],['6','Sokoto · Awka · Markurdi · Port Harcourt · Dutse']],
  '22 SEPTEMBER': [['1','Calabar · Katsina · Sokoto · Gombe · Port Harcourt'],['2','Lagos (AmCenter) · Maiduguri · Lekki · Minna · Dutse'],['3','Abuja · Ikeja · Benin City · Markurdi · UNILAG'],['4','OgunTechHub · Jos · Uyo · Bauchi'],['5','Enugu · Keffi · Zaria · Ibadan · Awka'],['6','Kano · Osogbo · Yola · Abeokuta · Abuja (AmCenter)']],
  '23 SEPTEMBER': [['1','Maiduguri · Zaria · Lekki · Port Harcourt · Ibadan'],['2','Abuja (AmCenter) · Osogbo · Bauchi · Katsina · Abeokuta'],['3','Enugu · Calabar · Yola · Minna · Dutse'],['4','Lagos (AmCenter) · Keffi · Sokoto · UNILAG'],['5','Markurdi · Ikeja · OgunTechHub · Awka · Uyo'],['6','Kano · Abuja · Benin City · Jos · Gombe']],
}

function parseTime(value){ const [h,m]=value.split(':').map(Number); return h*60+m }
function getStatus(){
  const now=new Date(), start=new Date('2026-09-21T00:00:00+01:00'), end=new Date('2026-09-24T00:00:00+01:00')
  if(now<start) return {mode:'preview',day:0,label:'SUMMIT PREVIEW'}
  if(now>=end) return {mode:'complete',day:2,label:'SUMMIT COMPLETE'}
  const day=Math.min(2,Math.max(0,Math.floor((now-start)/86400000))), minutes=now.getHours()*60+now.getMinutes()
  let current=null,next=null
  days[day].sessions.forEach((s,i)=>{const a=parseTime(s[0]),b=days[day].sessions[i+1]?parseTime(days[day].sessions[i+1][0]):1440;if(minutes>=a&&minutes<b)current=s;if(!next&&minutes<a)next=s})
  return {mode:'live',day,label:current?'LIVE NOW':'UP NEXT',current,next}
}

export default function SummitLanding(){
  const navigate=useNavigate(), status=useMemo(getStatus,[]), day=days[status.day]||days[0], featured=status.current||status.next||day.sessions[0]
  return <div className="sx2">
    <header className="sx2-nav">
      <div className="sx2-header-left"><button className="sx2-brand" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><img className="sx2-brand-logo" src="https://norteamericano.cl/img/americanspaces.png" alt="American Spaces" /><span><b>AMERICAN SPACES</b><small>NIGERIA · 2026</small></span></button><SummitBrandMarks compact light includeSpaces /></div>
      <nav><button onClick={()=>document.getElementById('sx2-about')?.scrollIntoView({behavior:'smooth'})}>About</button><button onClick={()=>document.getElementById('sx2-programme')?.scrollIntoView({behavior:'smooth'})}>Programme</button><button onClick={()=>document.getElementById('sx2-groups')?.scrollIntoView({behavior:'smooth'})}>Groups</button><button onClick={()=>navigate('/summit-2026/live')}>Live</button></nav>
      <button className="sx2-nav-cta" onClick={()=>navigate('/summit-2026/register')}>ENTER SUMMIT <span>↗</span></button>
    </header>
    <main>
      <section className="sx2-hero">
        <div className="sx2-hero-image"/><div className="sx2-hero-glow"/><div className="sx2-grid"/>
        <div className="sx2-hero-content"><div className="sx2-overline"><span className="pulse"/> SUMMIT OF AMERICAN SPACES IN NIGERIA <b>2026</b></div><h1>BUILT<br/><em>ON AMERICAN AI.</em></h1><p>Equipping American Spaces Nigeria to showcase the U.S. AI Stack through people, programming, creativity and practical innovation.</p><div className="sx2-actions"><button className="sx2-main-cta" onClick={()=>navigate('/summit-2026/register')}>JOIN THE SUMMIT <span>→</span></button><button className="sx2-ghost-cta" onClick={()=>navigate('/summit-2026/live')}><span className="play">▶</span> ENTER LIVE SCREEN</button></div></div>
        <div className="sx2-hero-index"><span>01</span><i/><span>03</span></div>
        <div className="sx2-hero-bottom"><div><span>21—23</span><small>SEPTEMBER 2026</small></div><div><span>BLACK DIAMOND SUITES</span><small>VICTORIA ISLAND · LAGOS</small></div><div><span>ENGAGE · EDUCATE · EMPOWER</span><small>PUBLIC DIPLOMACY · NIGERIA</small></div></div>
      </section>
      <section className="sx2-intro" id="sx2-about"><div className="sx2-section-no">01 / <span>THE SUMMIT</span></div><div className="sx2-intro-copy"><div className="sx2-eyebrow">A PRACTICAL AI SUMMIT FOR AMERICAN SPACES NIGERIA</div><h2>From <em>possibility</em><br/>to programme.</h2><p>This three-day working summit brings American Spaces leaders and specialists together to explore practical AI workflows, strengthen programming, build digital capacity and translate ideas into action.</p><div className="sx2-stat-row"><div><b>03</b><span>DAYS</span></div><div><b>30</b><span>AMERICAN SPACES</span></div><div><b>06</b><span>ROTATING GROUPS</span></div><div><b>01</b><span>SHARED MISSION</span></div></div></div><div className="sx2-intro-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="core">AI<span>×</span>NG</div><small>PEOPLE / TECHNOLOGY / IMPACT</small></div></section>
      <section className="sx2-live"><div className="sx2-live-image"/><div className="sx2-live-card"><div className="sx2-live-top"><span className="live-dot"/> {status.label}<small>DAY {String(status.day+1).padStart(2,'0')} · {day.date}</small></div><div className="sx2-live-kicker">NOW / NEXT</div><h2>{featured[1]}</h2><p>{featured[2]||'Summit Programme'}</p><div className="sx2-live-actions"><button onClick={()=>navigate('/summit-2026/live')}>OPEN LIVE EXPERIENCE <span>→</span></button><button onClick={()=>navigate('/summit-2026')}>PARTICIPANT VIEW</button></div><div className="sx2-live-tools"><span>● REAL-TIME</span><span>↗ PARKING LOT</span><span>▣ LIVE POLLS</span><span>◌ RESOURCES</span></div></div></section>
      <section className="sx2-programme" id="sx2-programme"><div className="sx2-section-heading"><div><div className="sx2-section-no">02 / <span>THE PROGRAMME</span></div><h2>Three days.<br/><em>One trajectory.</em></h2></div><p>Learning, experimentation, collaboration and implementation — sequenced to move from foundations to activation.</p></div><div className="sx2-day-selector">{days.map((d,i)=><button key={d.id} className={i===status.day?'active':''} onClick={()=>document.getElementById('sx2-'+d.id)?.scrollIntoView({behavior:'smooth',block:'center'})}><span>{d.label}</span><b>{d.title}</b><small>{d.date}</small></button>)}</div>{days.map((d)=><div className="sx2-day" id={'sx2-'+d.id} key={d.id}><div className="sx2-day-head"><span>DAY {d.label}</span><b>{d.title}</b><small>{d.date}</small></div><div className="sx2-sessions">{d.sessions.map((s,j)=><button key={j} onClick={()=>navigate('/summit-2026/live')}><time>{s[0]}</time><span><b>{s[1]}</b><small>{s[2]||'Summit Programme'}</small></span><i>↗</i></button>)}</div></div>)}</section>
      <section className="sx2-groups" id="sx2-groups"><div className="sx2-section-no">03 / <span>GROUP ROTATION</span></div><div className="sx2-groups-head"><h2>Six groups.<br/><em>Three rotations.</em></h2><p>Your American Space determines your daily group. The rotation is designed to create fresh combinations of expertise, location, gender and years of service throughout the Summit.</p></div><div className="sx2-rotation">{Object.entries(groupRotation).map(([date,groups],di)=><article key={date}><header><b>DAY {di+1}</b><span>{date}</span></header>{groups.map(g=><div key={g[0]}><strong>{g[0]}</strong><span>{g[1]}</span></div>)}</article>)}</div><button className="sx2-outline" onClick={()=>navigate('/summit-2026/register')}>REGISTER & VIEW YOUR GROUP <span>→</span></button></section>
      <section className="sx2-ai"><div className="sx2-ai-image"/><div className="sx2-ai-copy"><div className="sx2-section-no">04 / <span>THE AI STACK</span></div><h2>Use AI.<br/><em>Build capacity.</em></h2><p>Explore AI-assisted programme planning, visual design, audience engagement, research, presentation, strategic planning and vibe coding — with hands-on application throughout.</p><div className="sx2-stack-tags"><span>PROGRAMME DESIGN</span><span>VISUAL CONTENT</span><span>AUDIENCE ENGAGEMENT</span><span>RESEARCH</span><span>VIBE CODING</span><span>ICS ALIGNMENT</span></div></div></section>
      <section className="sx2-final"><div className="sx2-final-grid"/><div className="sx2-section-no">05 / <span>READY</span></div><h2>THE NEXT<br/><em>SESSION IS YOURS.</em></h2><p>Register once. Join the live experience. Participate from your device. Stay connected across all three days.</p><button className="sx2-main-cta" onClick={()=>navigate('/summit-2026/register')}>ENTER SUMMIT <span>↗</span></button></section>
    </main>
    <footer className="sx2-footer"><div className="sx2-footer-brand"><span className="sx2-mark"><i/><i/><i/></span><div><b>AMERICAN SPACES NIGERIA</b><small>SUMMIT 2026 · PUBLIC DIPLOMACY</small></div></div><div className="sx2-footer-meta"><span>21—23 SEPTEMBER 2026</span><span>BLACK DIAMOND SUITES · LAGOS</span><span>#AmericanSpacesNG2026</span></div><button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>BACK TO TOP ↑</button></footer>
  </div>
}
