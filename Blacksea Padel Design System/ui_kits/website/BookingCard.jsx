// BookingCard.jsx — Court booking form
const TIME_SLOTS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

const BookingCard = ({ selectedCourt, onSuccess }) => {
  const [court, setCourt] = React.useState(selectedCourt ? selectedCourt.id.toString() : '1');
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [players, setPlayers] = React.useState('2');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && date && time) {
      setSubmitted(true);
      setTimeout(() => onSuccess && onSuccess(), 2000);
    }
  };

  if (submitted) {
    return (
      <div style={bkStyles.root}>
        <div style={bkStyles.success}>
          <div style={bkStyles.successIcon}>✓</div>
          <div style={bkStyles.successTitle}>Booking Confirmed!</div>
          <div style={bkStyles.successSub}>
            Court {court} · {date} · {time}
          </div>
          <div style={bkStyles.successMsg}>
            We'll send confirmation to your phone. See you on the court!
          </div>
        </div>
      </div>
    );
  }

  const Field = ({ label, children }) => (
    <div style={bkStyles.fieldWrap}>
      <label style={bkStyles.fieldLabel}>{label}</label>
      {children}
    </div>
  );

  const inputStyle = bkStyles.input;

  return (
    <div style={bkStyles.root}>
      <div style={bkStyles.header}>
        <div style={bkStyles.eyebrow}>Reserve Your Session</div>
        <h2 style={bkStyles.title}>Book a Court</h2>
        <p style={bkStyles.subtitle}>Available daily · 08:00–22:00</p>
      </div>

      <form onSubmit={handleSubmit} style={bkStyles.form}>
        <div style={bkStyles.row}>
          <Field label="Select Court">
            <select style={inputStyle} value={court} onChange={e => setCourt(e.target.value)}>
              <option value="1">Court 1 — Championship (Indoor)</option>
              <option value="2">Court 2 — Panoramic (Indoor)</option>
              <option value="3">Court 3 — Outdoor</option>
            </select>
          </Field>
          <Field label="Number of Players">
            <select style={inputStyle} value={players} onChange={e => setPlayers(e.target.value)}>
              <option value="2">2 Players</option>
              <option value="4">4 Players</option>
            </select>
          </Field>
        </div>

        <div style={bkStyles.row}>
          <Field label="Date">
            <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </Field>
          <Field label="Time Slot">
            <div style={bkStyles.timeGrid}>
              {TIME_SLOTS.map(t => (
                <div
                  key={t}
                  style={{
                    ...bkStyles.timeSlot,
                    ...(time === t ? bkStyles.timeSlotSelected : {}),
                  }}
                  onClick={() => setTime(t)}
                >
                  {t}
                </div>
              ))}
            </div>
          </Field>
        </div>

        <div style={bkStyles.divider}></div>

        <div style={bkStyles.row}>
          <Field label="Full Name">
            <input style={inputStyle} type="text" placeholder="Oleksandr Kovalenko" value={name} onChange={e => setName(e.target.value)} required />
          </Field>
          <Field label="Phone Number">
            <input style={inputStyle} type="tel" placeholder="+380 XX XXX XXXX" value={phone} onChange={e => setPhone(e.target.value)} />
          </Field>
        </div>

        {/* Booking summary */}
        {(court && date && time) && (
          <div style={bkStyles.summary}>
            <div style={bkStyles.summaryLabel}>Booking Summary</div>
            <div style={bkStyles.summaryRow}>
              <span style={bkStyles.summaryKey}>Court</span>
              <span style={bkStyles.summaryVal}>Court {court}</span>
            </div>
            <div style={bkStyles.summaryRow}>
              <span style={bkStyles.summaryKey}>Date & Time</span>
              <span style={bkStyles.summaryVal}>{date} · {time}</span>
            </div>
            <div style={bkStyles.summaryRow}>
              <span style={bkStyles.summaryKey}>Duration</span>
              <span style={bkStyles.summaryVal}>90 minutes</span>
            </div>
          </div>
        )}

        <button type="submit" style={bkStyles.submitBtn}>
          Confirm Booking
        </button>

        <p style={bkStyles.note}>
          Free cancellation up to 2 hours before your session.
        </p>
      </form>
    </div>
  );
};

const bkStyles = {
  root: {
    background: '#1A2F4A',
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 8,
    padding: 40,
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    maxWidth: 760, margin: '0 auto',
  },
  header: { marginBottom: 32 },
  eyebrow: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10, fontWeight: 700,
    letterSpacing: '0.25em', textTransform: 'uppercase',
    color: '#C9A84C', marginBottom: 8,
  },
  title: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontSize: 32, fontWeight: 700,
    color: '#F5F0E8', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: 6,
  },
  subtitle: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, color: '#8FA3B8',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  row: { display: 'flex', gap: 20, flexWrap: 'wrap' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 },
  fieldLabel: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10, fontWeight: 700,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#C9A84C',
  },
  input: {
    background: '#0D1B2E',
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 4, color: '#F5F0E8',
    fontFamily: "'Raleway', sans-serif",
    fontSize: 14, padding: '10px 14px',
    outline: 'none', width: '100%',
    boxSizing: 'border-box',
  },
  timeGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  timeSlot: {
    fontFamily: "'Courier Prime', monospace",
    fontSize: 12, fontWeight: 700,
    padding: '6px 12px', borderRadius: 3,
    background: 'rgba(42,100,150,0.1)',
    border: '1px solid rgba(42,100,150,0.3)',
    color: '#6AADD3', cursor: 'pointer',
    transition: 'all 150ms',
  },
  timeSlotSelected: {
    background: 'rgba(201,168,76,0.15)',
    border: '1px solid #C9A84C',
    color: '#C9A84C',
  },
  divider: {
    height: 1, background: 'rgba(143,163,184,0.1)',
  },
  summary: {
    background: 'rgba(13,27,46,0.6)',
    border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 6, padding: '16px 20px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  summaryLabel: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10, fontWeight: 700,
    letterSpacing: '0.2em', textTransform: 'uppercase',
    color: '#8FA3B8', marginBottom: 4,
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between',
  },
  summaryKey: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, color: '#8FA3B8',
  },
  summaryVal: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontSize: 13, color: '#F5F0E8',
  },
  submitBtn: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 14, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    background: 'linear-gradient(135deg, #C9A84C, #9B7A2E)',
    color: '#0D1B2E', border: 'none',
    borderRadius: 4, padding: '16px 32px',
    cursor: 'pointer', width: '100%',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 20px rgba(201,168,76,0.2)',
  },
  note: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 12, color: '#8FA3B8',
    textAlign: 'center',
  },
  success: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12,
    padding: '40px 20px', textAlign: 'center',
  },
  successIcon: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'rgba(46,139,87,0.2)',
    border: '2px solid #3BAA6A',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, color: '#3BAA6A',
  },
  successTitle: {
    fontFamily: "'Cinzel', Georgia, serif",
    fontSize: 24, fontWeight: 700,
    color: '#C9A84C', textTransform: 'uppercase',
  },
  successSub: {
    fontFamily: "'Courier Prime', monospace",
    fontSize: 14, color: '#F5F0E8',
  },
  successMsg: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 14, color: '#8FA3B8',
    maxWidth: 320,
  },
};

Object.assign(window, { BookingCard });
