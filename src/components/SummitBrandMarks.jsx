const LOGOS = {
  mission: 'https://static.wixstatic.com/media/ac90b5_0c0b47ec81f24849a8f343933ac455e2~mv2.png/v1/fill/w_604%2Ch_604%2Cal_c/usm-nigeria-seal.png',
  spaces: 'https://norteamericano.cl/img/americanspaces.png',
  freedom250: 'https://freedom250.org/logo-color.png',
}

export default function SummitBrandMarks({ compact = false, light = false }) {
  return (
    <div className={`summit-brand-marks ${compact ? 'compact' : ''} ${light ? 'light' : ''}`}>
      <div className="brand-mark mission">
        <img src={LOGOS.mission} alt="United States Mission Nigeria" />
        {!compact && <span>UNITED STATES<br />MISSION NIGERIA</span>}
      </div>
      <div className="brand-divider" />
      <div className="brand-mark spaces">
        <img src={LOGOS.spaces} alt="American Spaces" />
        {!compact && <span>AMERICAN SPACES<br />NIGERIA</span>}
      </div>
      <div className="brand-divider" />
      <div className="brand-mark freedom">
        <img src={LOGOS.freedom250} alt="Freedom 250" />
        {!compact && <span>FREEDOM 250<br />2026</span>}
      </div>
    </div>
  )
}
