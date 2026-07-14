/* ============================================================
   BLACKSEA PADEL · House Crest renderer
   ------------------------------------------------------------
   The single, standardized achievement visual: a heater-shield
   maritime crest on a navy field with a gold edge, a wave swell
   that carries the category colour, and a cresting ornament
   (gold ball when earned, padlock chip when locked).

   One pure function renders BOTH states:

       BSPCrest.houseCrest({ icon, glyph, cat, locked })

   No DOM, no dependencies — returns an SVG string. Safe to call
   anywhere (innerHTML, template literals, server-side strings).
   ============================================================ */
(function (root) {
  'use strict';

  /* Lucide-style 24×24 stroke glyphs (path data only) */
  var ICONS = {
    trophy:   '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    cup:      '<path d="M6 4h12v3a6 6 0 0 1-12 0V4Z"/><path d="M6 6H4a2 2 0 0 0 0 4h2.5"/><path d="M18 6h2a2 2 0 0 1 0 4h-2.5"/><path d="M12 13v3"/><path d="M8.5 20h7l-.7-4H9.2z"/>',
    crown:    '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z"/><path d="M5 21h14"/>',
    medal:    '<circle cx="12" cy="8.5" r="6"/><path d="M15.5 13.4 17 22l-5-3-5 3 1.5-8.6"/>',
    star:     '<path d="M11.52 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56L12.99 19a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .29-.91l5.17-.76a2.12 2.12 0 0 0 1.6-1.16z"/>',
    flame:    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>',
    zap:      '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    users:    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    racket:   '<ellipse cx="10" cy="8.7" rx="6" ry="7"/><path d="M13.8 13.5 19.4 19a1.4 1.4 0 1 1-2 2L11.9 15.6"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/><path d="m9 16 2 2 4-4"/>',
    swords:   '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m3 19 2 2"/><path d="m3 21 2-2"/>',
    anchor:   '<path d="M12 22V8"/><circle cx="12" cy="5" r="3"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>'
  };

  /* Category palettes — colour rides the wave swell */
  var CAT = {
    gold:  { hi: '#F4E4AE', mid: '#C9A84C', lo: '#9B7A2E' },
    sea:   { hi: '#6AADD3', mid: '#2A6496', lo: '#1A4B72' },
    red:   { hi: '#E8806F', mid: '#C0392B', lo: '#7E241A' },
    green: { hi: '#5FD08E', mid: '#2E8B57', lo: '#1C5E3A' }
  };

  /* Shield geometry (viewBox 0 0 140 168) */
  var HEATER = 'M70 26 L120 40 L120 86 C120 126 70 150 70 150 C70 150 20 126 20 86 L20 40 Z';
  var FLOOR  = 'M20 114 q12.5 -8 25 0 t25 0 t25 0 t25 0 L120 156 L20 156 Z';
  var WAVE_A = 'M26 110 q11 -7 22 0 t22 0 t22 0 t22 0';
  var WAVE_B = 'M34 120 q9 -6 18 0 t18 0 t18 0';

  var UID = 0;

  function iconNode(name, cx, cy, size, color, sw) {
    sw = sw || 2;
    var x = cx - size / 2, y = cy - size / 2;
    return '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[name] || '') + '</svg>';
  }

  /**
   * Render the house crest in either state.
   * @param {Object} o
   * @param {string} [o.icon]   icon key (see ICONS) — used when no glyph
   * @param {string} [o.glyph]  short text mark (e.g. "C+", "7") drawn instead of an icon
   * @param {string} [o.cat]    category colour: 'gold' | 'sea' | 'red' | 'green'
   * @param {boolean}[o.locked] locked (desaturated + padlock) vs earned (full colour + ball)
   * @returns {string} SVG markup
   */
  function houseCrest(o) {
    o = o || {};
    var icon = o.icon, glyph = o.glyph;
    var cat = o.cat || 'gold';
    var locked = !!o.locked;
    var id = ++UID;
    var c = CAT[cat] || CAT.gold;

    var edge     = locked ? '#46566b' : '#C9A84C';
    var fieldTop = locked ? '#2a3647' : '#22456c';
    var fieldBot = locked ? '#141b26' : '#0d1f33';
    var markCol  = locked ? '#46566b' : '#F6E6B0';
    var waveCol  = locked ? '#3a4a5e' : c.mid;
    var floorCol = locked ? '#1c2735' : c.lo;
    var floorTop = locked ? '#26323f' : c.mid;

    var mark = glyph
      ? '<text x="70" y="95" text-anchor="middle" font-family="\'Unbounded\', \'Golos Text\', sans-serif" font-weight="700" font-size="34" fill="' + markCol + '">' + glyph + '</text>'
      : iconNode(icon, 70, 82, 46, markCol, 2);

    var top = locked
      ? '<g>' +
          '<circle cx="70" cy="26" r="9" fill="#1c2532" stroke="#46566b" stroke-width="1.5"/>' +
          '<rect x="65.5" y="25" width="9" height="7" rx="1.4" fill="none" stroke="#8fa3b8" stroke-width="1.3"/>' +
          '<path d="M67 25 v-1.6 a3 3 0 0 1 6 0 V25" fill="none" stroke="#8fa3b8" stroke-width="1.3"/>' +
        '</g>'
      : '<circle cx="70" cy="26" r="6.4" fill="url(#gd' + id + ')" stroke="#8A6A24" stroke-width="1"/>' +
        '<circle cx="68" cy="24" r="1.6" fill="rgba(255,255,255,.6)"/>';

    return '<svg viewBox="0 0 140 168" class="crest-svg" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="nv' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + fieldTop + '"/><stop offset="1" stop-color="' + fieldBot + '"/></linearGradient>' +
        '<linearGradient id="gd' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8ECBE"/><stop offset=".5" stop-color="#D9B85C"/><stop offset="1" stop-color="#8A6A24"/></linearGradient>' +
        '<linearGradient id="fl' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + floorTop + '"/><stop offset="1" stop-color="' + floorCol + '"/></linearGradient>' +
        '<clipPath id="cl' + id + '"><path d="' + HEATER + '"/></clipPath>' +
      '</defs>' +
      top +
      '<path d="' + HEATER + '" fill="url(#nv' + id + ')" stroke="' + edge + '" stroke-width="3.2"/>' +
      '<g clip-path="url(#cl' + id + ')">' +
        '<path d="M10 20 H130 V64 Q70 50 10 64 Z" fill="rgba(255,255,255,' + (locked ? 0.03 : 0.07) + ')"/>' +
        '<path d="' + FLOOR + '" fill="url(#fl' + id + ')" opacity="' + (locked ? 0.4 : 0.6) + '"/>' +
        '<path d="' + WAVE_A + '" fill="none" stroke="' + waveCol + '" stroke-width="2.2" stroke-linecap="round" opacity="' + (locked ? 0.5 : 0.9) + '"/>' +
        '<path d="' + WAVE_B + '" fill="none" stroke="' + waveCol + '" stroke-width="2.2" stroke-linecap="round" opacity="' + (locked ? 0.3 : 0.55) + '"/>' +
      '</g>' +
      mark +
    '</svg>';
  }

  root.BSPCrest = {
    houseCrest: houseCrest,
    ICONS: ICONS,
    CATEGORIES: CAT
  };
})(typeof window !== 'undefined' ? window : this);
