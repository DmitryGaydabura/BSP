# Blacksea Padel Design System

## Overview

**Blacksea Padel** is a padel sports club based in Odesa, Ukraine. The brand is rooted in the identity of the Black Sea coast — maritime, powerful, and prestigious. The club's visual identity blends athletic energy with the heritage and grandeur of Odesa as a historic port city.

### Products / Surfaces
- **Club Website** — Marketing/landing page for the club, schedules, bookings, membership info
- **Mobile App** (potential) — Court booking, match scheduling, leaderboards

### Sources Provided
- `uploads/photo_2026-05-04_22-16-42.jpg` — Primary club logo (640×640 JPEG)

---

## CONTENT FUNDAMENTALS

### Tone & Voice
- **Energetic but refined** — This is a premium sports club, not a casual gym. Copy should feel aspirational and confident.
- **Community-forward** — Padel is a social sport; language should feel inclusive and welcoming.
- **Local pride** — Odesa is central to the identity. References to the sea, the city, the coast are encouraged.

### Casing
- Brand name is always: **Blacksea Padel** (two words, title case, no hyphen)
- City is spelled: **Odesa** (Ukrainian spelling, single 's')
- Headlines: Title Case or ALL CAPS for impact
- CTAs: Short, imperative, energetic — "Book a Court", "Join the Club", "Play Now"

### Language Style
- **"You"-forward** — Address the player directly: "Your game starts here", "Book your court"
- No emoji in formal contexts; stars (★) and bullets (•) are acceptable as decorative elements
- Numbers in stats/scores: always numerals ("3 courts", "200+ members")
- Avoid jargon; padel is still emerging — keep copy accessible

### Examples
- "The sea is our court." 
- "Play where the legends play."
- "Odesa's premier padel destination."
- "Book a court. Meet the community."

---

## VISUAL FOUNDATIONS

### Color System
Primary palette extracted from the logo:

| Token | Value | Usage |
|---|---|---|
| `--navy-deep` | `#0D1B2E` | Primary background, darkest navy |
| `--navy-mid` | `#1A2F4A` | Card backgrounds, elevated surfaces |
| `--navy-light` | `#243D5C` | Borders, dividers, subtle backgrounds |
| `--gold-primary` | `#C9A84C` | Primary brand accent, headlines, CTAs |
| `--gold-light` | `#E8C97A` | Hover states, highlights |
| `--gold-dark` | `#9B7A2E` | Pressed states, shadows |
| `--sea-blue` | `#2A6496` | Secondary accent, links, active states |
| `--sea-light` | `#4A8AB5` | Lighter sea accent |
| `--white` | `#F5F0E8` | Warm white for text on dark |
| `--white-pure` | `#FFFFFF` | Pure white |
| `--text-muted` | `#8FA3B8` | Muted/secondary text |

### Typography

The site is primarily in **Ukrainian (Cyrillic)**, so font choices must support the Ukrainian alphabet.

| Role | Font | Coverage | Notes |
|---|---|---|---|
| Brand name / wordmark | **Cinzel** | Latin only | Used exclusively for "BLACKSEA PADEL" in logo/nav |
| Display & headings (h1–h3) | **Playfair Display** | Ukrainian Cyrillic + Latin | Classical serif, elegant Cyrillic forms |
| Body, UI, labels | **Montserrat** | Ukrainian Cyrillic + Latin | Clean geometric sans, excellent readability |
| Scores, stats, data | **Courier Prime** | Latin + digits | Monospaced, used for scoreboards |

All fonts sourced from Google Fonts. No custom font files were provided — please supply TTF/WOFF2 files if the brand uses proprietary typefaces.

### Backgrounds
- Deep navy (`#0D1B2E`) is the primary background — dark, oceanic, premium
- Textured navy with subtle grain/noise overlay is preferred over flat fills
- Gold gradient accents used for key CTAs and dividers
- Wave motifs (from logo) can be used as decorative SVG backgrounds
- No photography backgrounds on UI surfaces; imagery is kept to hero sections

### Spacing & Layout
- Base unit: `8px`
- Border radius: `4px` (tight) for buttons/inputs; `8px` for cards; `50%` for badges/dots
- Max content width: `1200px`
- Section padding: `80px` vertical, `24px` horizontal (mobile: `40px` / `16px`)

### Shadows & Elevation
- Cards: `0 4px 20px rgba(0,0,0,0.4)` — deep shadow on dark backgrounds
- Gold glow: `0 0 16px rgba(201,168,76,0.3)` — used on hero elements, active states
- No inner shadows

### Borders
- Primary border: `1px solid rgba(201,168,76,0.25)` — subtle gold
- Active/focus border: `2px solid #C9A84C` — full gold

### Animation & Motion
- Easing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` — smooth, slightly sporty
- Duration: `200ms` for hover transitions; `400ms` for page transitions
- No bounces; motion is confident and controlled
- Hover: color brightens (gold lightens, navy brightens)
- Press: slight scale down (`scale(0.97)`) + color darkens

### Corner Radii
- Buttons: `4px`
- Cards/panels: `8px`
- Badges/chips: `20px` (pill)
- Avatar/logo circles: `50%`

### Cards
- Background: `--navy-mid` (`#1A2F4A`)
- Border: `1px solid rgba(201,168,76,0.2)`
- Shadow: `0 4px 20px rgba(0,0,0,0.4)`
- Radius: `8px`
- Padding: `24px`

### Imagery
- Color vibe: **cool, deep blues** — no warm filters; imagery should feel oceanic
- Occasional gold tone-mapping on hero images
- Black & white photography with gold accent overlays is on-brand
- Grain/texture overlays welcome

### Iconography
See ICONOGRAPHY section below.

### Use of Transparency & Blur
- Frosted glass effect acceptable for overlaying navigation on imagery: `backdrop-filter: blur(12px)` + semi-transparent navy
- Overlays: `rgba(13,27,46,0.85)` for modal backdrops

---

## ICONOGRAPHY

### Approach
Blacksea Padel uses a **minimal, line-based icon style** — clean strokes, no fills, consistent weight. This aligns with the upscale athletic positioning.

### Icon System
- **Lucide Icons** (CDN: `https://unpkg.com/lucide@latest`) — recommended system for UI icons. Stroke-based, 24px default.
- No emoji in UI contexts
- Unicode decorative chars: `★` (star), `•` (bullet) used as brand flourishes only

### Key Custom Brand Icons
- Padel racket crossed — from logo (embedded SVG or logo asset)
- Wave motif — from logo (decorative use)
- Laurel wreath — from logo (achievement/award badges)

### Logo Assets
- `assets/logo.jpg` — Primary circular logo (640×640), navy + gold

---

## FILE INDEX

```
README.md                        ← This file; brand overview + guidelines
SKILL.md                         ← Agent skill definition
colors_and_type.css              ← CSS custom properties for colors + typography
assets/
  logo.jpg                       ← Primary club logo (640×640 JPEG)
fonts/                           ← (empty — Google Fonts used via CDN)
preview/                         ← Design system card previews
  colors-primary.html
  colors-semantic.html
  type-display.html
  type-body.html
  type-scale.html
  spacing-tokens.html
  shadows-radii.html
  buttons.html
  cards.html
  badges.html
  inputs.html
  nav.html
ui_kits/
  website/
    README.md
    index.html
    Header.jsx
    Hero.jsx
    CourtsSection.jsx
    BookingCard.jsx
    Footer.jsx
```
