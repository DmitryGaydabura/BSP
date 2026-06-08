# Blacksea Padel — Achievement System (implementation package)

Drop-in achievement system for the BSP app: the standardized **house crest**
(heater shield · navy field · gold edge · wave swell), the full **20-achievement
catalog**, automatic earned/locked computation from existing tournament + rating
data, a polished profile **grid**, and the **unlock celebration** + entrance
animations.

## Files

```
export/
├── js/
│   ├── bsp-crest.js          # houseCrest({icon,glyph,cat,locked}) → SVG string. No deps.
│   └── bsp-achievements.js    # catalog · computeStats · evaluate · renderGrid · playUnlock · revealStagger
├── css/
│   └── bsp-achievements.css   # namespaced (.bsp-* / --bsp-*) grid + states + animations
├── demo.html                  # standalone preview (sample data, unlock + replay buttons)
├── CLAUDE_CODE_PROMPT.md      # paste into Claude Code to wire this into the app
└── README.md                  # this file
```

## Public API (`window`)

```js
// bsp-crest.js
BSPCrest.houseCrest({ icon|glyph, cat:'gold'|'sea'|'red'|'green', locked:boolean }) → SVG string

// bsp-achievements.js
BSPAchievements.computeStats({ playerId, playerName, tournaments, level, rank, isMonthLeader }) → stats
BSPAchievements.renderGrid(stats, { overrides?, showSummary? }) → HTML string
BSPAchievements.revealStagger(containerEl)        // entrance animation
BSPAchievements.playUnlock(cardEl[, def])          // unlock celebration on one card
BSPAchievements.CATALOG / .GROUPS / .evaluate / .LEVEL_ORDER
```

## Load order

`bsp-crest.js` → `bsp-achievements.js` → (your code that calls them).
`bsp-achievements.css` after the app stylesheet. Fonts (Playfair Display,
Montserrat, Courier Prime) are already loaded by the app; the CSS falls back to
system fonts otherwise.

## Quick start

```js
const stats = BSPAchievements.computeStats({
  playerId, playerName,
  tournaments,          // [{ date, name, category, results:[{pos, players|pair}] }]
  level: 'C-', rank: 5, isMonthLeader: false
});
el.innerHTML = BSPAchievements.renderGrid(stats);
BSPAchievements.revealStagger(el);
```

See **demo.html** for a full working example and **CLAUDE_CODE_PROMPT.md** for the
exact app integration (file-by-file).
