/* ============================================================
   BLACKSEA PADEL · Achievement system
   ------------------------------------------------------------
   • CATALOG          — the full achievement set (5 groups, 20 items)
   • computeStats()   — derives a player's numbers from tournaments + ratings
   • evaluate()       — turns stats into earned / progress per achievement
   • renderGrid()     — builds the profile achievement grid (locked + earned)
   • playUnlock()     — celebration reveal (crest flip + gleam + particles)
   • revealStagger()  — entrance animation when the grid first appears

   Depends on: bsp-crest.js  (window.BSPCrest.houseCrest)
   Exposes:    window.BSPAchievements
   ============================================================ */
(function (root) {
  'use strict';

  var crest = function (o) { return root.BSPCrest.houseCrest(o); };

  /* ---- skill-level ladder (low → high). 'C−' uses the minus sign ---- */
  var LEVEL_ORDER = ['E', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A', 'A+'];
  function normLevel(l) { return String(l || '').replace('−', '-').trim(); }
  function levelIndex(l) { var i = LEVEL_ORDER.indexOf(normLevel(l)); return i < 0 ? 0 : i; }
  function levelAtLeast(l, min) { return levelIndex(l) >= levelIndex(min); }

  /* ============================================================
     CATALOG
     Each item: id, name, req (both Ukrainian), icon|glyph, cat,
       target  — goal for the progress bar (omit/1 ⇒ binary, no bar)
       value(s)— current numeric value from the stats object
       earned  — optional override; defaults to value >= target
     ============================================================ */
  var GROUPS = [
    {
      group: 'Турнірні перемоги',
      items: [
        { id: 'first_win',   name: 'Перша перемога', req: 'Виграй свій перший турнір', icon: 'star',   cat: 'gold', target: 1, value: function (s) { return s.wins; } },
        { id: 'champion',    name: 'Чемпіон',        req: 'Посідь 1 місце в турнірі',  icon: 'trophy', cat: 'gold', target: 1, value: function (s) { return s.wins; } },
        { id: 'cup_winner',  name: 'Володар Кубка',  req: 'Перемога в Кубку клубу',    icon: 'cup',    cat: 'gold', target: 1, value: function (s) { return s.cupWins; } },
        { id: 'season_champ',name: 'Чемпіон сезону', req: '№1 у рейтингу за сезон',    icon: 'crown',  cat: 'gold', target: 1, value: function (s) { return s.rank === 1 ? 1 : 0; } },
        { id: 'podium',      name: 'Подіум',         req: 'Фініш у топ-3 турніру',     icon: 'medal',  cat: 'sea',  target: 1, value: function (s) { return s.podiums; } },
        { id: 'flawless',    name: 'Бездоганний',    req: 'Виграй турнір без поразок', icon: 'star',   cat: 'sea',  target: 1, value: function (s) { return s.flawlessWins; } }
      ]
    },
    {
      group: 'Серії та форма',
      items: [
        { id: 'hat_trick',   name: 'Хет-трик',      req: '3 перемоги поспіль', icon: 'swords', cat: 'red', target: 3,  value: function (s) { return Math.min(s.bestStreak, 3); } },
        { id: 'fire_streak', name: 'Вогняна серія', req: '5 перемог поспіль',  icon: 'flame',  cat: 'red', target: 5,  value: function (s) { return Math.min(s.bestStreak, 5); } },
        { id: 'unstoppable', name: 'Незупинний',    req: '10 перемог поспіль', icon: 'flame',  cat: 'red', target: 10, value: function (s) { return Math.min(s.bestStreak, 10); } }
      ]
    },
    {
      group: 'Участь та активність',
      items: [
        { id: 'debut',          name: 'Дебютант',      req: 'Зіграй перший турнір',      icon: 'racket',   cat: 'sea',   target: 1,  value: function (s) { return s.played; } },
        { id: 'regular',        name: 'Завсідник',     req: '25 турнірів зіграно',       icon: 'racket',   cat: 'sea',   target: 25, value: function (s) { return s.played; } },
        { id: 'veteran',        name: 'Ветеран',       req: '50 турнірів зіграно',       icon: 'anchor',   cat: 'sea',   target: 50, value: function (s) { return s.played; } },
        { id: 'player_month',   name: 'Гравець місяця',req: 'Лідер активності місяця',   icon: 'zap',      cat: 'green', target: 1,  value: function (s) { return s.isMonthLeader ? 1 : 0; } },
        { id: 'iron_will',      name: 'Залізна воля',  req: 'Грай кожен місяць пів року', icon: 'calendar', cat: 'green', target: 6,  value: function (s) { return Math.min(s.monthsStreak, 6); } },
        { id: 'club_soul',      name: 'Душа клубу',    req: 'Зіграй з 15 партнерами',    icon: 'users',    cat: 'green', target: 15, value: function (s) { return s.partners; } }
      ]
    },
    {
      group: 'Рівні майстерності',
      items: [
        { id: 'level_dplus', name: 'Рівень D+', req: 'Досягни рівня D+',     glyph: 'D+', cat: 'sea',  target: 1, value: function (s) { return levelAtLeast(s.level, 'D+') ? 1 : 0; } },
        { id: 'level_cminus',name: 'Рівень C−', req: 'Досягни рівня C−',     glyph: 'C−', cat: 'gold', target: 1, value: function (s) { return levelAtLeast(s.level, 'C-') ? 1 : 0; } },
        { id: 'level_c',     name: 'Рівень C',  req: 'Увійди в топ-20% клубу', glyph: 'C',  cat: 'gold', target: 1, value: function (s) { return levelAtLeast(s.level, 'C') ? 1 : 0; } }
      ]
    },
    {
      group: 'Особливі',
      items: [
        { id: 'lucky',       name: 'Щасливчик',   req: '7 місце × 3 рази (Lucky!)', glyph: '7', cat: 'green', target: 3, value: function (s) { return Math.min(s.seventhPlaces, 3); } },
        { id: 'grandmaster', name: 'Гросмейстер', req: 'Утримуй топ-3 рейтингу',    icon: 'trophy', cat: 'gold', target: 1, value: function (s) { return (s.rank >= 1 && s.rank <= 3) ? 1 : 0; } }
      ]
    }
  ];

  var FLAT = GROUPS.reduce(function (acc, g) { return acc.concat(g.items); }, []);

  /* ============================================================
     STATS — derive a player's numbers from raw app data
     ------------------------------------------------------------
     opts = {
       playerId, playerName,
       tournaments,           // [{ date, name, category, results:[{pos, players|pair, ...}] }]
       level,                 // current skill level string, e.g. 'C', 'D+'
       rank,                  // 1-based position in the rating (0/undefined = unknown)
       isMonthLeader          // boolean — activity leader this month (backend/derived)
     }
     ============================================================ */
  function rowHasPlayer(r, id, name) {
    var ps = r.players || (r.pair || []).map(function (n) { return { name: n }; });
    return ps.some(function (p) {
      return (id != null && String(p.id) === String(id)) || (p.name && name && p.name === name);
    });
  }
  function partnersInRow(r, id, name) {
    var ps = r.players || (r.pair || []).map(function (n) { return { name: n }; });
    return ps.filter(function (p) {
      return !((id != null && String(p.id) === String(id)) || (p.name && name && p.name === name));
    }).map(function (p) { return p.name; }).filter(Boolean);
  }
  function ym(d) { var x = new Date(d); return x.getFullYear() * 12 + x.getMonth(); }

  function computeStats(opts) {
    opts = opts || {};
    var id = opts.playerId, name = opts.playerName;
    var tournaments = (opts.tournaments || []).slice();

    // tournaments this player appeared in, oldest → newest
    var mine = tournaments
      .filter(function (t) { return (t.results || []).some(function (r) { return rowHasPlayer(r, id, name); }); })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });

    var played = mine.length;
    var wins = 0, podiums = 0, cupWins = 0, seventhPlaces = 0;
    var partnerSet = {}, monthSet = {};
    var streak = 0, bestStreak = 0;

    mine.forEach(function (t) {
      var row = (t.results || []).find(function (r) { return rowHasPlayer(r, id, name); });
      if (!row) return;
      var pos = row.pos;
      monthSet[ym(t.date)] = true;
      partnersInRow(row, id, name).forEach(function (n) { partnerSet[n] = true; });

      if (pos === 1) {
        wins++; streak++; if (streak > bestStreak) bestStreak = streak;
        var label = ((t.name || '') + ' ' + (t.categoryLabel || t.category || '')).toLowerCase();
        if (label.indexOf('cup') > -1 || label.indexOf('кубок') > -1 || label.indexOf('кубк') > -1) cupWins++;
      } else {
        streak = 0;
      }
      if (pos >= 1 && pos <= 3) podiums++;
      if (pos === 7) seventhPlaces++;
    });

    // longest run of consecutive calendar months with activity
    var months = Object.keys(monthSet).map(Number).sort(function (a, b) { return a - b; });
    var monthsStreak = months.length ? 1 : 0, run = months.length ? 1 : 0;
    for (var i = 1; i < months.length; i++) {
      run = (months[i] === months[i - 1] + 1) ? run + 1 : 1;
      if (run > monthsStreak) monthsStreak = run;
    }

    return {
      played: played,
      wins: wins,
      podiums: podiums,
      cupWins: cupWins,
      flawlessWins: wins,                 // ← approximation; refine when per-match data exists
      seventhPlaces: seventhPlaces,
      bestStreak: bestStreak,
      partners: Object.keys(partnerSet).length,
      monthsStreak: monthsStreak,
      level: opts.level || 'E',
      rank: opts.rank || 0,
      isMonthLeader: !!opts.isMonthLeader
    };
  }

  /* ============================================================
     EVALUATE — stats → per-achievement state
     overrides: optional { id: { earned, value } } from backend
     ============================================================ */
  function evaluate(def, stats, overrides) {
    var ov = (overrides && overrides[def.id]) || null;
    var target = def.target || 1;
    var value = ov && typeof ov.value === 'number' ? ov.value : (def.value ? def.value(stats) : 0);
    var earned = ov && typeof ov.earned === 'boolean' ? ov.earned : (value >= target);
    var showProgress = target > 1 && !earned;
    return { def: def, value: Math.max(0, value), target: target, earned: earned, showProgress: showProgress };
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function progressBar(value, target) {
    var pctVal = Math.max(0, Math.min(100, Math.round((value / target) * 100)));
    return '<div class="bsp-ach-prog">' +
      '<div class="bsp-ach-prog-track"><span class="bsp-ach-prog-bar" style="width:' + pctVal + '%"></span></div>' +
      '<span class="bsp-ach-prog-num">' + value + '/' + target + '</span>' +
    '</div>';
  }

  function card(ev, idx) {
    var d = ev.def;
    var art = crest({ icon: d.icon, glyph: d.glyph, cat: d.cat, locked: !ev.earned });
    var cls = 'bsp-ach' + (ev.earned ? ' is-earned' : ' is-locked');
    return '<figure class="' + cls + '" data-ach-id="' + d.id + '" data-cat="' + d.cat + '" data-earned="' + ev.earned + '" style="--i:' + idx + '">' +
      '<div class="bsp-ach-crest">' + art + '<span class="bsp-ach-gleam"></span></div>' +
      '<figcaption class="bsp-ach-cap">' +
        '<span class="bsp-ach-name">' + d.name + '</span>' +
        '<span class="bsp-ach-req">' + d.req + '</span>' +
      '</figcaption>' +
      (ev.earned ? '<span class="bsp-ach-done">✓ Виконано</span>' : (ev.showProgress ? progressBar(ev.value, ev.target) : '')) +
    '</figure>';
  }

  /**
   * Build the achievements grid markup.
   * @param {Object} stats      output of computeStats()
   * @param {Object} [opts]
   * @param {Object} [opts.overrides]  { id: { earned, value } } backend overrides
   * @param {boolean}[opts.showSummary] render the "earned / total" header (default true)
   * @returns {string} HTML
   */
  function renderGrid(stats, opts) {
    opts = opts || {};
    var overrides = opts.overrides;
    var idx = 0, totalEarned = 0;

    var sections = GROUPS.map(function (g, gi) {
      var evs = g.items.map(function (d) { return evaluate(d, stats, overrides); });
      var earnedHere = evs.filter(function (e) { return e.earned; }).length;
      totalEarned += earnedHere;
      var cards = evs.map(function (e) { return card(e, idx++); }).join('');
      return '<section class="bsp-ach-section">' +
        '<div class="bsp-ach-head">' +
          '<span class="bsp-ach-num">' + String(gi + 1).padStart(2, '0') + '</span>' +
          '<h3 class="bsp-ach-group">' + g.group + '</h3>' +
          '<span class="bsp-ach-count">' + earnedHere + '/' + g.items.length + '</span>' +
        '</div>' +
        '<div class="bsp-ach-divider"></div>' +
        '<div class="bsp-ach-grid">' + cards + '</div>' +
      '</section>';
    }).join('');

    var summary = (opts.showSummary === false) ? '' :
      '<div class="bsp-ach-summary">' +
        '<span class="bsp-ach-summary-big">' + totalEarned + '</span>' +
        '<span class="bsp-ach-summary-sub">з ' + FLAT.length + ' досягнень</span>' +
      '</div>';

    return '<div class="bsp-achievements">' + summary + sections + '</div>';
  }

  /* ============================================================
     ANIMATIONS
     ============================================================ */
  // Entrance: play the staggered rise once, then drop the class so cards
  // rest in their visible base state (self-heals if a frame is throttled).
  function revealStagger(container) {
    if (!container) return;
    var node = container.classList && container.classList.contains('bsp-achievements')
      ? container : container.querySelector('.bsp-achievements');
    if (!node) return;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    var n = node.querySelectorAll('.bsp-ach').length;
    node.classList.add('bsp-stagger');
    setTimeout(function () { node.classList.remove('bsp-stagger'); }, n * 45 + 700);
  }

  var PARTICLES = ['★', '✦', '·', '◆', '✦', '★', '·', '◆', '✦', '★'];
  function burst(el) {
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height * 0.42;
    PARTICLES.forEach(function (ch, i) {
      var angle = (360 / PARTICLES.length) * i + (Math.random() * 20 - 10);
      var dist = 42 + Math.random() * 34;
      var p = document.createElement('div');
      p.className = 'bsp-ach-particle';
      p.textContent = ch;
      p.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;' +
        '--dx:' + (Math.cos(angle * Math.PI / 180) * dist).toFixed(1) + 'px;' +
        '--dy:' + (Math.sin(angle * Math.PI / 180) * dist).toFixed(1) + 'px;' +
        '--rot:' + (Math.random() * 360).toFixed(0) + 'deg';
      document.body.appendChild(p);
      setTimeout(function () { p.remove(); }, 760);
    });
  }

  /**
   * Play the unlock celebration on a card: flip the crest locked → earned,
   * sweep the gleam, and burst particles.
   * @param {HTMLElement} cardEl   a .bsp-ach element
   * @param {Object} def           its catalog definition (defaults to lookup by data-ach-id)
   */
  function playUnlock(cardEl, def) {
    if (!cardEl) return;
    if (!def) def = FLAT.find(function (d) { return d.id === cardEl.getAttribute('data-ach-id'); });
    var wrap = cardEl.querySelector('.bsp-ach-crest');
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function commit() {
      if (def && wrap) {
        var gleam = wrap.querySelector('.bsp-ach-gleam');
        wrap.innerHTML = crest({ icon: def.icon, glyph: def.glyph, cat: def.cat, locked: false }) +
          (gleam ? gleam.outerHTML : '<span class="bsp-ach-gleam"></span>');
      }
      cardEl.classList.remove('is-locked');
      cardEl.classList.add('is-earned');
      // ensure the "earned" tag is present (replace a progress bar, or add one)
      var prog = cardEl.querySelector('.bsp-ach-prog');
      if (!cardEl.querySelector('.bsp-ach-done')) {
        var tag = document.createElement('span');
        tag.className = 'bsp-ach-done';
        tag.textContent = '✓ Виконано';
        if (prog) prog.replaceWith(tag);
        else cardEl.appendChild(tag);
      } else if (prog) {
        prog.remove();
      }
    }

    if (reduce) { commit(); return; }

    cardEl.classList.add('is-unlocking');
    // mid-flip: swap the crest while the card is edge-on
    setTimeout(commit, 260);
    setTimeout(function () { burst(cardEl); }, 320);
    setTimeout(function () { cardEl.classList.remove('is-unlocking'); }, 1100);
  }

  root.BSPAchievements = {
    GROUPS: GROUPS,
    CATALOG: FLAT,
    LEVEL_ORDER: LEVEL_ORDER,
    computeStats: computeStats,
    evaluate: evaluate,
    renderGrid: renderGrid,
    revealStagger: revealStagger,
    playUnlock: playUnlock
  };
})(typeof window !== 'undefined' ? window : this);
