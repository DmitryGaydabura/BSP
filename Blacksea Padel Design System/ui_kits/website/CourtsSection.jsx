// CourtsSection.jsx — Courts grid with availability
const COURTS = [
  {
    id: 1,
    name: 'Court 1 — Championship',
    type: 'Indoor Glass',
    features: ['Full glass walls', 'LED lighting', 'Climate control'],
    status: 'available',
    badge: '★ Premium',
    times: ['08:00', '10:00', '14:00', '18:00', '20:00'],
    bookedTimes: ['10:00', '18:00'],
  },
  {
    id: 2,
    name: 'Court 2 — Panoramic',
    type: 'Indoor Glass',
    features: ['Sea view', 'LED lighting', 'Glass back wall'],
    status: 'available',
    badge: 'Indoor',
    times: ['08:00', '10:00', '12:00', '16:00', '18:00', '20:00'],
    bookedTimes: ['12:00', '16:00', '20:00'],
  },
  {
    id: 3,
    name: 'Court 3 — Outdoor',
    type: 'Outdoor',
    features: ['Open air', 'Floodlights', 'Sea breeze'],
    status: 'limited',
    badge: 'Outdoor',
    times: ['08:00', '10:00', '12:00', '14:00', '16:00'],
    bookedTimes: ['08:00', '10:00', '14:00'],
  },
];

const TimeSlot = ({ time, booked }) => (
  <div style={{
    ...csStyles.timeSlot,
    ...(booked ? csStyles.timeSlotBooked : csStyles.timeSlotFree),
  }}>
    {time}
  </div>
);

const CourtCard = ({ court, onBook }) => {
  const statusColors = {
    available: { dot: '#3BAA6A', text: '#3BAA6A', label: 'Available' },
    limited:   { dot: '#C9A84C', text: '#C9A84C', label: 'Limited slots' },
    booked:    { dot: '#E05545', text: '#E05545', label: 'Fully booked' },
  };
  const sc = statusColors[court.status];

  return (
    <div style={csStyles.card}>
      {/* Card header */}
      <div style={csStyles.cardHeader}>
        <div>
          <div style={csStyles.cardBadge}>{court.badge}</div>
          <div style={csStyles.cardName}>{court.name}</div>
          <div style={csStyles.cardType}>{court.type}</div>
        </div>
        <div style={{...csStyles.statusDot, background: sc.dot, boxShadow: `0 0 8px ${sc.dot}`}}></div>
      </div>

      {/* Features */}
      <div style={csStyles.features}>
        {court.features.map(f => (
          <span key={f} style={csStyles.feature}>• {f}</span>
        ))}
      </div>

      {/* Time slots */}
      <div style={csStyles.timesLabel}>Today's availability</div>
      <div style={csStyles.times}>
        {court.times.map(t => (
          <TimeSlot key={t} time={t} booked={court.bookedTimes.includes(t)} />
        ))}
      </div>

      {/* Status + CTA */}
      <div style={csStyles.cardFooter}>
        <span style={{...csStyles.statusText, color: sc.text}}>
          <span style={{...csStyles.statusDotSmall, background: sc.dot}}></span>
          {sc.label}
        </span>
        <button style={csStyles.bookBtn} onClick={() => onBook(court)}>
          Book Court {court.id}
        </button>
      </div>
    </div>
  );
};

const CourtsSection = ({ onBook }) => (
  <section style={csStyles.root}>
    <div style={csStyles.inner}>
      {/* Section header */}
      <div style={csStyles.sectionHeader}>
        <div style={csStyles.eyebrow}>Our Courts</div>
        <h2 style={csStyles.heading}>World-Class Surfaces</h2>
        <p style={csStyles.subheading}>
          Three professional courts — indoor glass and outdoor — built to international standards.
        </p>
      </div>

      {/* Courts grid */}
      <div style={csStyles.grid}>
        {COURTS.map(c => (
          <CourtCard key={c.id} court={c} onBook={onBook} />
        ))}
      </div>
    </div>
  </section>
);

const csStyles = {
  root: {
    background: '#0D1B2E',
    padding: '80px 0 60px',
  },
  inner: {
    maxWidth: 1280, margin: '0 auto', padding: '0 32px',
  },
  sectionHeader: {
    textAlign: 'center', marginBottom: 56,
  },
  eyebrow: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 11, fontWeight: 700,
    letterSpacing: '0.25em', textTransform: 'uppercase',
    color: '#C9A84C', marginBottom: 12,
  },
  heading: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontSize: 40, fontWeight: 700,
    color: '#F5F0E8', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: 16,
  },
  subheading: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 16, fontWeight: 300,
    color: '#8FA3B8', maxWidth: 500,
    margin: '0 auto', lineHeight: 1.7,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 24,
  },
  card: {
    background: '#1A2F4A',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 8,
    padding: 28,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    display: 'flex', flexDirection: 'column', gap: 16,
    transition: 'border-color 200ms, box-shadow 200ms',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardBadge: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10, fontWeight: 700,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#C9A84C', marginBottom: 6,
  },
  cardName: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontSize: 17, fontWeight: 600,
    color: '#F5F0E8', marginBottom: 3,
  },
  cardType: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 12, color: '#8FA3B8',
  },
  statusDot: {
    width: 10, height: 10, borderRadius: '50%',
    flexShrink: 0, marginTop: 4,
  },
  features: {
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  feature: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, color: '#B8C8D8',
  },
  timesLabel: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10, fontWeight: 700,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#8FA3B8',
  },
  times: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  timeSlot: {
    fontFamily: "'Courier Prime', monospace",
    fontSize: 12, fontWeight: 700,
    borderRadius: 3, padding: '4px 8px',
    cursor: 'pointer',
  },
  timeSlotFree: {
    background: 'rgba(46,139,87,0.15)',
    color: '#3BAA6A',
    border: '1px solid rgba(46,139,87,0.3)',
  },
  timeSlotBooked: {
    background: 'rgba(74,96,112,0.15)',
    color: '#4A6070',
    border: '1px solid rgba(74,96,112,0.2)',
    textDecoration: 'line-through',
  },
  cardFooter: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 4,
    paddingTop: 16,
    borderTop: '1px solid rgba(143,163,184,0.1)',
  },
  statusText: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  statusDotSmall: {
    width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
  },
  bookBtn: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 11, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    background: 'linear-gradient(135deg, #C9A84C, #9B7A2E)',
    color: '#0D1B2E', border: 'none',
    borderRadius: 4, padding: '8px 16px',
    cursor: 'pointer',
  },
};

Object.assign(window, { CourtsSection, COURTS });
