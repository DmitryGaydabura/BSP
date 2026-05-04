// Footer.jsx — Blacksea Padel website footer
const Footer = ({ onNavigate }) => {
  const col1 = [
    { label: 'Courts', key: 'courts' },
    { label: 'Schedule', key: 'schedule' },
    { label: 'Book a Court', key: 'booking' },
  ];
  const col2 = [
    { label: 'Membership', key: 'membership' },
    { label: 'About Us', key: 'about' },
    { label: 'Contact', key: 'contact' },
  ];

  return (
    <footer style={ftStyles.root}>
      <div style={ftStyles.inner}>
        {/* Brand column */}
        <div style={ftStyles.brand}>
          <div style={ftStyles.logoRow}>
            <img src="../../assets/logo.jpg" alt="Blacksea Padel" style={ftStyles.logoImg} />
            <div>
              <div style={ftStyles.brandName}>Blacksea Padel</div>
              <div style={ftStyles.brandSub}>★ Odesa, Ukraine ★</div>
            </div>
          </div>
          <p style={ftStyles.tagline}>
            Where the sea meets the sport. Odesa's premier padel destination since 2023.
          </p>
          <div style={ftStyles.wave}>
            {[8,14,10,18,12,16,9,14,11,17,8,13].map((h,i) => (
              <div key={i} style={{...ftStyles.waveBar, height: h}} />
            ))}
          </div>
        </div>

        {/* Links */}
        <div style={ftStyles.links}>
          <div style={ftStyles.col}>
            <div style={ftStyles.colTitle}>Club</div>
            {col1.map(l => (
              <a key={l.key} style={ftStyles.link} href="#" onClick={() => onNavigate(l.key)}>{l.label}</a>
            ))}
          </div>
          <div style={ftStyles.col}>
            <div style={ftStyles.colTitle}>Info</div>
            {col2.map(l => (
              <a key={l.key} style={ftStyles.link} href="#" onClick={() => onNavigate(l.key)}>{l.label}</a>
            ))}
          </div>
          <div style={ftStyles.col}>
            <div style={ftStyles.colTitle}>Contact</div>
            <div style={ftStyles.contactItem}>📍 Odesa, Ukraine</div>
            <div style={ftStyles.contactItem}>🕐 Daily 07:00–22:00</div>
            <div style={ftStyles.contactItem}>📞 +380 48 XXX XXXX</div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={ftStyles.bottom}>
        <div style={ftStyles.bottomInner}>
          <span style={ftStyles.copyright}>© 2024 Blacksea Padel. All rights reserved.</span>
          <span style={ftStyles.copyright}>Odesa, Ukraine</span>
        </div>
      </div>
    </footer>
  );
};

const ftStyles = {
  root: {
    background: '#0A1525',
    borderTop: '1px solid rgba(201,168,76,0.15)',
    marginTop: 0,
  },
  inner: {
    maxWidth: 1280, margin: '0 auto',
    padding: '60px 32px 40px',
    display: 'flex', gap: 60, flexWrap: 'wrap',
  },
  brand: { flex: 2, minWidth: 240 },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 14,
    marginBottom: 16,
  },
  logoImg: {
    width: 52, height: 52, borderRadius: '50%',
    border: '1.5px solid rgba(201,168,76,0.4)',
    objectFit: 'cover',
  },
  brandName: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontSize: 18, fontWeight: 700,
    color: '#C9A84C', textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  brandSub: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10, fontWeight: 600,
    letterSpacing: '0.2em', color: '#8FA3B8',
  },
  tagline: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, color: '#8FA3B8',
    lineHeight: 1.7, maxWidth: 300,
    marginBottom: 20,
  },
  wave: {
    display: 'flex', gap: 3, alignItems: 'flex-end',
  },
  waveBar: {
    background: 'linear-gradient(180deg, #4A8AB5, #1A4B72)',
    width: 4, borderRadius: 2,
  },
  links: {
    flex: 3, display: 'flex', gap: 40, flexWrap: 'wrap',
  },
  col: {
    display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 120,
  },
  colTitle: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10, fontWeight: 700,
    letterSpacing: '0.2em', textTransform: 'uppercase',
    color: '#C9A84C', marginBottom: 4,
  },
  link: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, color: '#8FA3B8',
    textDecoration: 'none', cursor: 'pointer',
    transition: 'color 200ms',
  },
  contactItem: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, color: '#8FA3B8',
  },
  bottom: {
    borderTop: '1px solid rgba(143,163,184,0.1)',
    padding: '16px 0',
  },
  bottomInner: {
    maxWidth: 1280, margin: '0 auto', padding: '0 32px',
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
  },
  copyright: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 11, color: '#4A6070',
    letterSpacing: '0.05em',
  },
};

Object.assign(window, { Footer });
