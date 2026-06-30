# Wazify Design System

> A dark-first design system for Wazify's WhatsApp marketing SaaS platform. Built for South African small businesses. Every decision reinforces trust, clarity, and a WhatsApp-native green identity.

---

## 1. Design Principles

| Principle | Expression |
|-----------|------------|
| **Dark-first** | All surfaces are deep near-black. Light text on dark backgrounds throughout. |
| **Green as identity** | The Wazify green (`#22C55E`) is the single dominant accent — it signals action, success, and brand. |
| **Layered depth** | Three ink levels (`--ink`, `--ink2`, `--ink3`) create elevation without shadows. |
| **Mono for data** | Monospaced type for numbers, code, timestamps, and financial values — precision over decoration. |
| **Restrained motion** | Transitions are 130–200ms. Hover lifts are 1–2px. Never decorative; always purposeful. |
| **SA-aware context** | Payment providers (PayFast, Ozow, Peach, Yoco), ZAR currency, South African bank names, and local business names are first-class citizens. |

---

## 2. Colour

### 2.1 Background / Ink Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--ink` / `--dark` | `#0C0E12` / `#0A0F0D` | Page background — the deepest layer |
| `--ink2` / `--dark2` | `#14181F` / `#111814` | Sidebar, topbar, modal backgrounds |
| `--ink3` / `--card` | `#1C2230` / `#161D1A` | Cards, input fields, secondary surfaces |
| `--card2` | `#1E2922` | Hover states, nested card surfaces |

> **Note:** The billing file skews blue-black (`#0C0E12`) while the marketing page skews green-black (`#0A0F0D`). Both are valid — choose based on whether the surface is data-heavy (blue-black) or brand-facing (green-black).

### 2.2 Brand Green

| Token | Value | Usage |
|-------|-------|-------|
| `--g` / `--green` | `#22C55E` | Primary accent — CTAs, active states, success, links |
| `--g2` / `--green2` | `#15803D` / `#16A34A` | Gradient endpoint, hover darken |
| `--teal` | `#0D9488` | Secondary gradient endpoint (hero, logo mark, badges) |
| `--g3` | `rgba(34,197,94,.10)` | Subtle tinted surfaces (active nav, tags, input focus glow) |
| `--green3` | `#DCFCE7` | Light-mode reserve (not currently used in dark UI) |

**Green gradient (standard):** `linear-gradient(135deg, #22C55E, #15803D)`  
**Green–teal gradient (hero/logo):** `linear-gradient(135deg, #22C55E 0%, #0D9488 100%)`

### 2.3 Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text` | `#E8ECF5` / `#F0F5F2` | Primary body text |
| `--dim2` / `--muted2` | `#B0BCCE` / `#9AB0A2` | Secondary text, descriptions, metadata |
| `--dim` / `--muted` | `#8896B0` / `#6B8070` | Tertiary text, labels, placeholders |

### 2.4 Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `rgba(255,255,255,.07)` | Subtle dividers, card borders |
| `--bord2` / `--border2` | `rgba(255,255,255,.13)` | Default interactive borders |
| `--bord3` | `rgba(255,255,255,.22)` | Hover-state borders |

### 2.5 Semantic / Status

| Token | Value | Meaning |
|-------|-------|---------|
| `--warn` | `#F59E0B` | Warning, pending |
| `--danger` | `#EF4444` | Error, destructive, failed |
| `--blue` | `#3B82F6` | Informational, active badge |
| `--purple` | `#A78BFA` | Supplementary accent, API tags |

### 2.6 Payment Provider Accents (Billing context only)

| Provider | Token | Value |
|----------|-------|-------|
| PayFast | `--pf` | `#00AEEF` |
| Peach Payments | `--pp` | `#E84393` |
| Ozow | `--oz` / `--oz-a` | `#1A1A5E` / `#6C63FF` |
| PayGate | `--pg` | `#E8282B` |
| Yoco | `--yc` | `#FFD200` |

---

## 3. Typography

### 3.1 Font Families

| Role | App (Billing) | Marketing (Landing) | CSS Token |
|------|---------------|---------------------|-----------|
| **Display / Heading** | Bricolage Grotesque | Cabinet Grotesk | `--fh` / `--font-head` |
| **Body** | Lato | Instrument Sans | `--fb` / `--font-body` |
| **Monospace** | Geist Mono | JetBrains Mono | `--fm` / `--font-mono` |

> Both heading families are variable-weight grotesques. Bricolage Grotesque is more editorial; Cabinet Grotesk is slightly tighter and more contemporary. Either may be standardised across both surfaces in future.

### 3.2 Type Scale

| Role | Size | Weight | Family | Notes |
|------|------|--------|--------|-------|
| Hero H1 | `clamp(44px, 6vw, 76px)` | 900 | Display | `letter-spacing: -2px` |
| Section H2 | `clamp(32px, 4vw, 52px)` | 800 | Display | `letter-spacing: -1.5px` |
| Card / Page Title | `17–21px` | 700–800 | Display | `letter-spacing: -.3px` |
| Card Sub-title | `15–18px` | 700 | Display | — |
| Large stat value | `26–48px` | 800–900 | Display | Use mono for financial figures |
| Plan price | `32–48px` | 900 | Display | — |
| Body text | `13–14px` | 400 | Body | `line-height: 1.6–1.65` |
| Small / Meta | `11.5–12.5px` | 400–600 | Body | — |
| Label / Eyebrow | `10–12px` | 700 | Body | `letter-spacing: .07–.1em; text-transform: uppercase` |
| Monospace data | `11–11.5px` | 400–500 | Mono | Numbers, code, refs, rates |

---

## 4. Spacing & Sizing

### 4.1 Base Unit
The system uses an **8px base** with occasional 4px subdivisions.

### 4.2 Common Spacing Values

| Use | Value |
|-----|-------|
| Micro gap (icons, badges) | `4–6px` |
| Component internal padding | `8–14px` |
| Card padding | `16–28px` |
| Section padding (app) | `28px` |
| Section padding (landing) | `60–100px vertical, 48px horizontal` |
| Grid gap (cards) | `14–20px` |
| Sidebar width | `220–240px` |
| Topbar height | `54–64px` |

### 4.3 Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--r8` | `8px` | Buttons, inputs, small badges, icon buttons |
| `--r12` | `12px` | Stat cards, modals inner, code blocks |
| `--r16` | `16px` | Standard cards, provider cards, banners |
| `--r20` | `20px` | Modal container, hero mockup, large feature cards |
| `20px+` | `18–20px` | Landing feature cards, pricing cards |
| `50%` | `50%` | Avatars, circular elements |

---

## 5. Components

### 5.1 Buttons

#### Primary
```css
background: linear-gradient(135deg, #22C55E, #15803D);
color: #fff;
border: none;
border-radius: var(--r8);      /* or 9–12px for larger CTAs */
padding: 9px 20px;             /* standard: 12px 32px for hero */
font-size: 13–16px;
font-weight: 700;
box-shadow: 0 2px 12px rgba(34,197,94,.25);
transition: all .15s;
/* Hover: transform: translateY(-1px); box-shadow increases */
```

#### Ghost / Outline
```css
background: transparent;
border: 1px solid var(--bord2);
color: var(--dim2);
border-radius: var(--r8);
padding: 9px 18px;
/* Hover: border-color → var(--bord3) or var(--g); color → var(--text) or var(--g) */
```

#### Destructive / Danger
```css
background: transparent;
border: 1px solid rgba(239,68,68,.3);
color: var(--danger);
/* Used for delete/cancel actions */
```

#### Icon Button
```css
width: 34px; height: 34px;
border-radius: var(--r8);
background: var(--ink3);
border: 1px solid var(--bord2);
/* Hover: border-color → var(--g) */
```

---

### 5.2 Cards

#### Standard Card
```css
background: var(--ink2);
border: 1px solid var(--bord2);
border-radius: var(--r16);
overflow: hidden;
/* Header: padding 16px 20px; border-bottom: 1px solid var(--border) */
/* Body: padding 20px */
```

#### Stat Card
```css
background: var(--ink2);
border: 1px solid var(--bord2);
border-radius: var(--r12);
padding: 18px;
/* Value: font-family var(--fh); font-size 26px; font-weight 800 */
/* Label: font-size 11.5px; color var(--dim) */
```

#### Feature Card (Landing)
```css
background: var(--card);
border: 1px solid var(--border2);
border-radius: 18px;
padding: 28px;
transition: all .2s;
/* Hover: border-color rgba(34,197,94,.25); transform translateY(-3px) */
/* ::before top accent line: linear-gradient(90deg, transparent, var(--green), transparent) — shows on hover */
```

#### Plan / Pricing Card (Current / Featured)
```css
border-color: rgba(34,197,94,.4);
background: linear-gradient(160deg, var(--ink3), rgba(34,197,94,.06));
box-shadow: 0 0 0 1px rgba(34,197,94,.15);
/* Badge: absolute top:-10–12px; gradient pill */
```

---

### 5.3 Badges & Tags

#### Status Badge (pill)
```css
font-size: 9.5–10px;
font-weight: 700;
padding: 3px 8px;
border-radius: 20px;
font-family: var(--fm);
letter-spacing: .03em;
```

| Variant | Background | Color | Border |
|---------|-----------|-------|--------|
| Recommended / Active | `rgba(34,197,94,.12)` | `var(--g)` | `rgba(34,197,94,.25)` |
| Informational | `rgba(59,130,246,.12)` | `var(--blue)` | `rgba(59,130,246,.25)` |
| Neutral | `rgba(255,255,255,.05)` | `var(--dim)` | `var(--border)` |
| Warning | `rgba(245,158,11,.10)` | `var(--warn)` | `rgba(245,158,11,.20)` |
| Error | `rgba(239,68,68,.10)` | `var(--danger)` | `rgba(239,68,68,.20)` |

#### Inline Tag (square corners)
```css
font-size: 10px;
font-weight: 700;
padding: 2px 8px;
border-radius: 4px;
font-family: var(--fm);
```

#### Nav Badge (count)
```css
background: var(--g);
color: #fff;
font-size: 9px;
font-weight: 700;
padding: 1px 5px;
border-radius: 8px;
min-width: 16px;
text-align: center;
```

---

### 5.4 Forms

#### Input Field
```css
background: var(--ink3);
border: 1px solid var(--bord2);
border-radius: var(--r8);
color: var(--text);
padding: 9–11px 13–14px;
font-size: 13px;
/* Focus: border-color → var(--g); outline none */
```

#### Label
```css
font-size: 12px;
font-weight: 600;
color: var(--dim2);
margin-bottom: 6px;
display: block;
```

#### Form Group
```css
display: flex;
flex-direction: column;
gap: 6px;
margin-bottom: 14–16px;
```

---

### 5.5 Navigation

#### Sidebar Item
```css
display: flex;
align-items: center;
gap: 9px;
padding: 8px 10px;
border-radius: var(--r8);
font-size: 13px;
font-weight: 500;
color: var(--dim2);
transition: all .13s;
/* Hover: background var(--ink3); color var(--text) */
/* Active: background rgba(34,197,94,.10); color var(--g) */
```

#### Section Label
```css
font-size: 10px;
font-weight: 700;
letter-spacing: .1em;
text-transform: uppercase;
color: var(--dim);
padding: 10px 10px 5px;
```

---

### 5.6 Modal

```css
/* Overlay */
background: rgba(0,0,0,.75);
/* Sheet */
background: var(--ink2);
border: 1px solid var(--bord2);
border-radius: var(--r20);
width: 520px;
max-height: 90vh;
box-shadow: 0 24px 80px rgba(0,0,0,.6);
/* Entry: transform translateY(16px) → translateY(0); transition .25s cubic-bezier(.4,0,.2,1) */
```

---

### 5.7 Toast Notification

```css
position: fixed;
bottom: 24px; right: 24px;
background: var(--ink2);
border: 1px solid var(--bord2);
border-radius: var(--r12);
padding: 13px 20px;
box-shadow: 0 8px 40px rgba(0,0,0,.5);
font-size: 13.5px; font-weight: 500;
/* Entry: transform translateY(20px) → translateY(0); opacity 0 → 1 */
/* Success variant: border-color rgba(34,197,94,.3) */
/* Error variant: border-color rgba(239,68,68,.3) */
/* Auto-dismiss: 3500ms */
```

---

### 5.8 Progress / Usage Bars

```css
/* Track */
height: 3–5px;
background: var(--ink3);
border-radius: 4px;
overflow: hidden;

/* Fill */
height: 100%;
border-radius: 4px;
background: linear-gradient(90deg, var(--g2), var(--g));
/* or solid green for small usage meters */
```

---

### 5.9 Tables

```css
/* Header cell */
font-size: 10.5px;
font-weight: 700;
color: var(--dim);
text-transform: uppercase;
letter-spacing: .07em;
border-bottom: 1px solid var(--border);

/* Body cell */
font-size: 13px;
padding: 12px 0;
border-bottom: 1px solid var(--border);

/* Row hover */
background: rgba(255,255,255,.01);
```

---

### 5.10 Code Blocks

```css
background: var(--ink);
border: 1px solid var(--bord2);
border-radius: var(--r12);
font-family: var(--fm);
font-size: 11.5px;
line-height: 1.75;
padding: 18px;
```

**Syntax token colours (Dracula-inspired):**

| Token type | Colour |
|-----------|--------|
| Keywords | `#FF79C6` |
| Strings | `#F1FA8C` |
| Names / identifiers | `#8BE9FD` |
| Comments | `var(--dim)` (italic) |
| Functions | `#50FA7B` |
| URLs | `#BD93F9` |
| Numbers | `#FFB86C` |

---

## 6. Iconography

- Icons are rendered as **emoji** throughout (no icon library dependency).
- Icon sizes: `15–20px` inline; `36px` for hero/banner icons.
- Navigation icons: `15px`, fixed `18px` width container for alignment.
- Feature/card icons: `20px` inside a `44×44px` container (`border-radius: 10–12px; background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.2)`).

---

## 7. Layout System

### 7.1 App Shell (Dashboard)

```
┌────────────────────────────────────────┐
│  Sidebar (220–240px)  │  Main content  │
│  sticky, full-height  │                │
│                       │  ┌─ Topbar ──┐ │
│                       │  │  54–64px  │ │
│                       │  └───────────┘ │
│                       │  ┌─ Content ─┐ │
│                       │  │  padding  │ │
│                       │  │  28px     │ │
│                       │  └───────────┘ │
└────────────────────────────────────────┘
```

Grid: `grid-template-columns: 220px 1fr`

### 7.2 Content Grids

| Pattern | CSS |
|---------|-----|
| 4-column stat strip | `grid-template-columns: repeat(4, 1fr); gap: 14px` |
| 3-column cards | `grid-template-columns: repeat(3, 1fr); gap: 14–16px` |
| 2-col with sidebar panel | `grid-template-columns: 1fr 380px; gap: 20px` |
| 3-col pricing | `grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1000px; margin: auto` |

### 7.3 Landing Page

Full-width sections stacked vertically. Horizontal padding: `48px`. Hero: `padding: 160px 48px 100px`. Feature/pricing sections: `padding: 100px 48px`.

---

## 8. Motion & Animation

| Element | Property | Value |
|---------|----------|-------|
| Nav items, buttons, borders | `transition` | `all .13s` |
| Cards, provider cards | `transition` | `all .18–.20s` |
| Primary button hover | `transform` | `translateY(-1px)` |
| Feature card hover | `transform` | `translateY(-3px)` |
| Modal entry | `transform + transition` | `translateY(16px → 0); .25s cubic-bezier(.4,0,.2,1)` |
| Toast entry | `transform + opacity` | `translateY(20px → 0); opacity 0 → 1; .3s cubic-bezier(.4,0,.2,1)` |
| Pulse dot (live indicator) | `@keyframes` | `opacity 1 → .3 → 1; 2s infinite` |
| Button shadow on hover | `box-shadow` | Increase alpha: `.25 → .35–.45` |

---

## 9. Decorative Patterns

### Radial glow (hero / banner)
```css
background: radial-gradient(ellipse, rgba(34,197,94,.12) 0%, transparent 70%);
/* Centered behind content; pointer-events: none */
```

### Corner radial accent (card)
```css
/* ::before pseudo-element */
position: absolute; right: -40px; top: -40px;
width: 160px; height: 160px; border-radius: 50%;
background: radial-gradient(rgba(34,197,94,.12), transparent 70%);
```

### Top-edge accent line (card hover)
```css
/* ::before pseudo-element */
position: absolute; top: 0; left: 0; right: 0; height: 2px;
background: linear-gradient(90deg, transparent, var(--green), transparent);
opacity: 0; transition: opacity .2s;
/* On card hover: opacity → 1 */
```

### Active provider border glow
```css
border-color: var(--p-color);
box-shadow: 0 0 0 1px var(--p-color), 0 8px 24px rgba(0,0,0,.3);
```

### Navbar backdrop blur
```css
background: rgba(10,15,13,0.85);
backdrop-filter: blur(16px);
```

---

## 10. Scrollbar

```css
::-webkit-scrollbar { width: 4–5px; height: 4px; }
::-webkit-scrollbar-thumb { background: var(--ink3); border-radius: 8–10px; }
```

---

## 11. Status Indicators

### Invoice / Transaction Status
| Status | Background | Color | Dot |
|--------|-----------|-------|-----|
| Paid | `rgba(34,197,94,.1)` | `var(--g)` | `●` |
| Pending | `rgba(245,158,11,.1)` | `var(--warn)` | `●` |
| Failed | `rgba(239,68,68,.1)` | `var(--danger)` | `●` |

### Usage / Delta
- Positive change: `color: var(--g)` — e.g. `+12.4%`
- Negative change: `color: var(--danger)` — e.g. `-3.1%`

### Feature list
- Included: `✓` in `var(--g)`, bold
- Excluded: `✕` in `var(--dim)`

---

## 12. Voice & Copy Patterns

| Context | Pattern | Example |
|---------|---------|---------|
| Success toast | Emoji + past tense | `✅ Payment processed! Growth Plan activated.` |
| Security notice | Lock emoji + comma-separated assurances | `🔒 256-bit SSL encryption · PCI DSS compliant · PayFast secured` |
| Warning callout | ⚠️ prefix, neutral tone | `⚠️ Plan changes take effect on your next billing date.` |
| CTA labels | Action verb + value | `Start free trial →`, `Upgrade to Pro — R 1,999/mo` |
| Plan names | Single word, Title Case | Starter, Growth, Pro |
| Currency | Always ZAR (`R`), no space | `R 799`, `R 1,999/mo` |
| Breadcrumbs | Monospace font | `Dashboard / Billing` |

---

## 13. Quick Reference — CSS Variables

```css
:root {
  /* Backgrounds */
  --ink:    #0C0E12;
  --ink2:   #14181F;
  --ink3:   #1C2230;

  /* Borders */
  --border: rgba(255,255,255,.07);
  --bord2:  rgba(255,255,255,.13);
  --bord3:  rgba(255,255,255,.22);

  /* Text */
  --text:   #E8ECF5;
  --dim:    #8896B0;
  --dim2:   #B0BCCE;

  /* Brand */
  --g:      #22C55E;
  --g2:     #15803D;
  --g3:     rgba(34,197,94,.10);
  --teal:   #0D9488;

  /* Semantic */
  --warn:   #F59E0B;
  --danger: #EF4444;
  --blue:   #3B82F6;
  --purple: #A78BFA;

  /* Typography */
  --fh: 'Bricolage Grotesque', sans-serif;   /* or Cabinet Grotesk */
  --fb: 'Lato', sans-serif;                   /* or Instrument Sans */
  --fm: 'Geist Mono', monospace;              /* or JetBrains Mono */

  /* Radius */
  --r8:  8px;
  --r12: 12px;
  --r16: 16px;
  --r20: 20px;
}
```

---

*Wazify Design System — extracted from `wazify_billing.html` and `wazify_saas_platform.html`*
