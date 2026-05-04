// Hero.jsx — Blacksea Padel full-bleed hero section
const Hero = ({ onNavigate }) => {
  return (
    <section style={heroStyles.root}>
      {/* Deep ocean background layers */}
      <div style={heroStyles.bgBase}></div>
      <div style={heroStyles.bgWaves}></div>
      <div style={heroStyles.bgVignette}></div>

      {/* Content */}
      <div style={heroStyles.content}>
        {/* Eyebrow */}
        <div style={heroStyles.eyebrow}>
          <span style={heroStyles.eyebrowLine}></span>
          <span style={heroStyles.eyebrowText}>Odesa • Ukraine</span>
          <span style={heroStyles.eyebrowLine}></span>
        </div>

        {/* Headline */}
        <h1 style={heroStyles.headline}>
          <span style={heroStyles.headlineGold}>Blacksea</span>
          <br />
          <span style={heroStyles.headlineWhite}>Padel</span>
        </h1>

        {/* Tagline */}
        <p style={heroStyles.tagline}>
          Where the sea meets the sport.<br />
          Odesa's premier padel destination.
        </p>

        {/* CTA row */}
        <div style={heroStyles.ctaRow}>
          <button style={heroStyles.ctaPrimary} onClick={() => onNavigate('booking')}>
            Book a Court
          </button>
          <button style={heroStyles.ctaSecondary} onClick={() => onNavigate('courts')}>
            Explore Courts
          </button>
        </div>

        {/* Stats row */}
        <div style={heroStyles.stats}>
          {[
            { value: '3', label: 'Pro Courts' },
            { value: '200+', label: 'Members' },
            { value: '7 days', label: 'Open weekly' },
          ].map((s, i) => (
            <div key={i} style={heroStyles.stat}>
              <div style={heroStyles.statValue}>{s.value}</div>
              <div style={heroStyles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Logo watermark */}
      <div style={heroStyles.logoWrap}>
        <img src="../../assets/logo.jpg" alt="" style={heroStyles.logoWatermark} />
      </div>

      {/* Bottom wave divider */}
      <div style={heroStyles.waveDivider}>
        <svg viewBox="0 0 1280 60" preserveAspectRatio="none" style={{width:'100%',height:60,display:'block'}}>
          <path d="M0,40 C320,0 960,60 1280,20 L1280,60 L0,60 Z" fill="#0D1B2E" />
        </svg>
      </div>
    </section>
  );
};

const heroStyles = {
  root: {
    position: 'relative', overflow: 'hidden',
    minHeight: 600, display: 'flex',
    alignItems: 'center',
  },
  bgBase: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(160deg, #0D1B2E 0%, #1A2F4A 50%, #0D1B2E 100%)',
  },
  bgWaves: {
    position: 'absolute', inset: 0,
    background: `
      radial-gradient(ellipse 80% 60% at 70% 50%, rgba(42,100,150,0.25) 0%, transparent 70%),
      radial-gradient(ellipse 40% 40% at 20% 80%, rgba(26,47,74,0.4) 0%, transparent 60%)
    `,
  },
  bgVignette: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(13,27,46,0.7) 100%)',
  },
  content: {
    position: 'relative', zIndex: 2,
    maxWidth: 1280, margin: '0 auto',
    padding: '80px 32px 100px',
    flex: 1,
  },
  eyebrow: {
    display: 'flex', alignItems: 'center', gap: 12,
    marginBottom: 24,
  },
  eyebrowLine: {
    height: 1, width: 40,
    background: 'linear-gradient(90deg, transparent, #C9A84C)',
    display: 'block',
  },
  eyebrowText: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 11, fontWeight: 600,
    letterSpacing: '0.25em', textTransform: 'uppercase',
    color: '#C9A84C',
  },
  headline: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontWeight: 900, lineHeight: 1.0,
    marginBottom: 24, textTransform: 'uppercase',
  },
  headlineGold: {
    fontSize: 'clamp(56px, 8vw, 96px)',
    color: '#C9A84C',
    display: 'block',
    textShadow: '0 0 40px rgba(201,168,76,0.3)',
  },
  headlineWhite: {
    fontSize: 'clamp(40px, 6vw, 72px)',
    color: '#F5F0E8',
    display: 'block',
    letterSpacing: '0.2em',
  },
  tagline: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 18, fontWeight: 300,
    color: '#B8C8D8', lineHeight: 1.7,
    marginBottom: 36, maxWidth: 480,
  },
  ctaRow: {
    display: 'flex', gap: 14, flexWrap: 'wrap',
    marginBottom: 56,
  },
  ctaPrimary: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    background: 'linear-gradient(135deg, #C9A84C, #9B7A2E)',
    color: '#0D1B2E', border: 'none',
    borderRadius: 4, padding: '14px 32px',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 20px rgba(201,168,76,0.25)',
    transition: 'all 200ms',
  },
  ctaSecondary: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    background: 'transparent',
    color: '#F5F0E8',
    border: '1.5px solid rgba(245,240,232,0.3)',
    borderRadius: 4, padding: '14px 32px',
    cursor: 'pointer',
    transition: 'all 200ms',
  },
  stats: {
    display: 'flex', gap: 40, flexWrap: 'wrap',
  },
  stat: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  statValue: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontSize: 32, fontWeight: 700,
    color: '#C9A84C', lineHeight: 1,
  },
  statLabel: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 11, fontWeight: 600,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#8FA3B8',
  },
  logoWrap: {
    position: 'absolute', right: 40, top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 1, opacity: 0.12,
    pointerEvents: 'none',
  },
  logoWatermark: {
    width: 380, height: 380,
    borderRadius: '50%',
  },
  waveDivider: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 3,
  },
};

Object.assign(window, { Hero });
