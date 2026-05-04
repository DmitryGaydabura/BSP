// Header.jsx — Blacksea Padel website navigation
const Header = ({ activePage, onNavigate }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const links = [
    { key: 'home', label: 'Home' },
    { key: 'courts', label: 'Courts' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'membership', label: 'Membership' },
    { key: 'about', label: 'About' },
  ];

  return (
    <header style={headerStyles.root}>
      <div style={headerStyles.inner}>
        {/* Logo */}
        <div style={headerStyles.logo} onClick={() => onNavigate('home')}>
          <img src="../../assets/logo.jpg" alt="Blacksea Padel" style={headerStyles.logoImg} />
          <div style={headerStyles.logoText}>
            <span style={headerStyles.logoName}>Blacksea Padel</span>
            <span style={headerStyles.logoSub}>★ Odesa ★</span>
          </div>
        </div>

        {/* Desktop links */}
        <nav style={headerStyles.nav}>
          {links.map(l => (
            <a
              key={l.key}
              style={{
                ...headerStyles.link,
                ...(activePage === l.key ? headerStyles.linkActive : {})
              }}
              onClick={() => onNavigate(l.key)}
              href="#"
            >
              {l.label}
              {activePage === l.key && <span style={headerStyles.linkDot}></span>}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <button style={headerStyles.cta} onClick={() => onNavigate('booking')}>
          Book a Court
        </button>
      </div>
    </header>
  );
};

const headerStyles = {
  root: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(13,27,46,0.96)',
    borderBottom: '1px solid rgba(201,168,76,0.2)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  inner: {
    maxWidth: 1280, margin: '0 auto',
    padding: '0 32px',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    height: 68,
    gap: 24,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 12,
    cursor: 'pointer', flexShrink: 0,
  },
  logoImg: {
    width: 42, height: 42, borderRadius: '50%',
    border: '1.5px solid rgba(201,168,76,0.5)',
    objectFit: 'cover',
  },
  logoText: {
    display: 'flex', flexDirection: 'column', gap: 1,
  },
  logoName: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontSize: 16, fontWeight: 700,
    color: '#C9A84C', letterSpacing: '0.06em',
    textTransform: 'uppercase', lineHeight: 1,
  },
  logoSub: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 9, fontWeight: 600,
    color: '#8FA3B8', letterSpacing: '0.2em',
    textTransform: 'uppercase',
  },
  nav: {
    display: 'flex', alignItems: 'center', gap: 28, flex: 1, justifyContent: 'center',
  },
  link: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 12, fontWeight: 600,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    color: '#B8C8D8', textDecoration: 'none',
    cursor: 'pointer', position: 'relative',
    paddingBottom: 2,
    transition: 'color 200ms',
  },
  linkActive: {
    color: '#C9A84C',
  },
  linkDot: {
    position: 'absolute', bottom: -6, left: '50%',
    transform: 'translateX(-50%)',
    width: 4, height: 4, borderRadius: '50%',
    background: '#C9A84C',
    display: 'block',
  },
  cta: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 12, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    background: 'linear-gradient(135deg, #C9A84C, #9B7A2E)',
    color: '#0D1B2E', border: 'none',
    borderRadius: 4, padding: '10px 22px',
    cursor: 'pointer', flexShrink: 0,
    boxShadow: '0 2px 12px rgba(201,168,76,0.25)',
    transition: 'all 200ms',
  },
};

Object.assign(window, { Header });
