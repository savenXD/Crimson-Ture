# SAANS: Slide design prompts

How to use: paste the **Global Design System** block first, in Gamma, Canva Magic Design, Beautiful.ai, v0 or any AI slide tool. Then paste one slide prompt at a time. If you build the slides by hand in Figma, Canva or Google Slides, follow the same specs.

---

## 0. GLOBAL DESIGN SYSTEM (paste this first, every time)

```
Create a premium, minimal, modern 16:9 presentation. Think "Linear / Vercel / Stripe keynote" style, calm and clean, with lots of whitespace. No stock photos, no 3D renders, no gradient blobs, no glossy AI-art, no clipart.

COLORS
- Background: warm off-white #FAFAF7
- Primary text (ink): #111111; secondary text: #6B6B6B; hairlines/borders: #E6E4DF
- Accent (brand "crimson"): #E11D48, used sparingly for one key word or number per slide
- Signature element: a thin 6px AQI gradient bar
  #22C55E → #A3E635 → #FACC15 → #F97316 → #EF4444 → #7F1D1D
  Use it at the bottom of the title slide and as a small 48px-wide underline under every slide title.
- Cards: white #FFFFFF, 1px border #E6E4DF, radius 16px, very soft shadow (0 1px 2px rgba(0,0,0,0.04))

TYPOGRAPHY (soft, rounded, friendly but professional)
- Headings: "Plus Jakarta Sans" SemiBold (fallback: Manrope / DM Sans)
- Body: "Inter" Regular, 16–20pt, line-height 1.5
- Technical labels, numbers, code: "JetBrains Mono" Medium, 11–13pt
- Title size 40–44pt, letter-spacing -1%. Never use more than 2 font sizes for body text.

CONSISTENT SLIDE HEADER (every content slide, top-left)
- Eyebrow: "0X / SECTION NAME" in JetBrains Mono, 12pt, uppercase, letter-spacing 12%, color #E11D48
- Title below it: Plus Jakarta Sans SemiBold 40pt, #111111
- The 48px AQI gradient underline below the title

CONSISTENT FOOTER (every slide)
- Left: "SAANS · Team Crimson" in JetBrains Mono 11pt #6B6B6B
- Right: page number "0X / 05" in the same style
- 1px hairline #E6E4DF above the footer

ILLUSTRATIONS
- Only hand-drawn, black-and-white line-art people in the "Open Peeps" style (by Pablo Stanley, openpeeps.com): simple, cartoonish, slightly imperfect strokes, flat, no shading, no color except at most one crimson accent detail.
- They must look human-drawn, NOT AI-generated: no glossy look, no gradients, no realistic faces.
- Icons: Lucide / Phosphor line icons, 1.5px stroke, #111111.

LAYOUT
- 12-column grid, 80px outer margins, generous whitespace
- Max ~40 visible words per slide (the title slide is an exception)
- Left-aligned text. Never center paragraphs.
```

---

## SLIDE 1: Title + Team

```
Slide 1: Title slide. Use the global design system.

LAYOUT: two columns (60/40).

LEFT COLUMN (vertically centered):
- Small pill tag at top: "AI-Powered Neighborhood-Level Air Pollution Prediction" in JetBrains Mono 11pt, 1px border #E6E4DF, radius 999px, padding 6x12
- Huge wordmark: "SAANS" in Plus Jakarta Sans Bold 96pt, #111111. Make the second "A" #E11D48.
- Subtitle: "Making Diwali breathable." in Plus Jakarta Sans Medium 28pt, #111111
- One line below in Inter 16pt #6B6B6B: "Predict → Plan → Protect, neighborhood by neighborhood."
- Tiny caption in JetBrains Mono 11pt #6B6B6B: "saans (साँस) = breath"

RIGHT COLUMN:
- An Open Peeps-style black-and-white line-art illustration: a family (parent and child) standing on a balcony at night watching faint firecrackers, the child wearing a simple mask. The background is a minimal line-drawn city skyline with 3–4 thin hexagon outlines floating in the sky (a hint of the hex grid). One crimson accent: a single firework spark.

BOTTOM STRIP (above the footer): a "Team Crimson" row of 4 minimal member cards (white, 1px border, radius 12px), each with a small circular line-art avatar (Open Peeps head), name in Plus Jakarta Sans SemiBold 15pt, role in JetBrains Mono 11pt #6B6B6B:
1. Devansh Chaudhary: Team Lead · ML & Architecture (add a small crimson "LEAD" pill)
2. Hardik Dhawan: Backend & APIs
3. Vijul Goyal: Frontend & UX
4. Himanshu: Data & Research

Full-width 6px AQI gradient bar at the very bottom edge of the slide.
```
*(Change the roles if they don't match your team.)*

---

## SLIDE 2: The Idea

```
Slide 2: The idea. Use the global design system.

HEADER: eyebrow "01 / THE IDEA", title "Everyone predicts the AQI. We decide what to do about it."

LAYOUT: top row = problem strip, bottom row = 3 pillar cards.

TOP ROW: "THE PROBLEM", 3 compact stat blocks side by side, separated by thin vertical hairlines:
- "16×" (JetBrains Mono 40pt, #E11D48) + "PM2.5 rise on Diwali night in Delhi" (Inter 14pt #6B6B6B) + tiny source "IIT Delhi study"
- "6" (40pt, #111) + "continuous air monitors for all of Punjab"
- "0" (40pt, #111) + "Diwali spike visible in global forecast models", source "our analysis, CAMS 2022–24"

BOTTOM ROW: "OUR IDEA", 3 equal white cards connected left to right by thin arrows (→):
Card 1 icon: crystal ball / chart-line (Lucide)
  Title "Predict" (Plus Jakarta Sans SemiBold 22pt)
  Text: "72-hour air forecast for every ~0.7 km² neighborhood, with the cause: crackers, stubble, trapped air, traffic."
Card 2 icon: calendar-clock
  Title "Plan"
  Text: "A nightly 'Breathing Budget' turned into GRAP-stage and hotspot actions for officials."
Card 3 icon: shield-heart
  Title "Protect"
  Text: "Pollution × vulnerable people → Hindi/Punjabi alerts to schools, ASHA workers and NGOs."
Each card has a tiny Open Peeps line-art figure in its bottom-right corner:
  card 1: a person looking at a phone map
  card 2: an officer pointing at a board
  card 3: a health worker handing a mask to an elderly person

BOTTOM CENTER statement in Plus Jakarta Sans Medium 24pt:
"We don't cancel Diwali. We make it " + "breathable." (that last word in #E11D48)
```

---

## SLIDE 3: Technical Approach (system design diagram)

```
Slide 3: Technical architecture. Use the global design system.

HEADER: eyebrow "02 / TECHNICAL APPROACH", title "From public data to street-level decisions"

MAIN ELEMENT: a large "canvas window" taking ~75% of the slide, styled like a design-tool or IDE window:
- Window frame: white, 1px border #E6E4DF, radius 16px, soft shadow
- Title bar: 36px tall, three small circles at left (#FF5F57, #FEBC2E, #28C840), center label "saans / system-architecture.drawio" in JetBrains Mono 11pt #6B6B6B
- Canvas background: DOTTED GRID, dots #D4D2CC, 1.5px, every 16px, on #FAFAF7

DIAGRAM (left → right, 5 columns, system-design style):
Nodes = white rounded rectangles (radius 10px, 1px border #111111), each with a small Lucide icon at left, a bold label (Inter SemiBold 12pt), and a mono sub-label (JetBrains Mono 10pt #6B6B6B).
Group containers = dashed 1px rounded outlines (#B5B3AD) with a small mono label on the top-left of the border.
Connectors = 1.5px #111111 orthogonal (right-angle) lines with small arrowheads, with edge labels in JetBrains Mono 9pt sitting on a #FAFAF7 pill. Use dashed connectors for "validation" flows.

[GROUP "DATA SOURCES" (column 1, stacked vertically)]
  - "CPCB Stations" / "PM2.5 · PM10 · hourly"              icon: radio-tower
  - "Open-Meteo" / "wind · mixing height · temp"            icon: cloud-sun
  - "NASA FIRMS" / "farm-fire satellite counts"             icon: flame
  - "OpenStreetMap" / "roads · land use · schools"          icon: map
  - "Diwali Calendar" / "lunar dates 2015–2026"             icon: calendar

[COLUMN 2]
  - Node "Ingestion Jobs" / "Python · hourly cron"           icon: refresh-cw
  - below it, cylinder-shaped node "Feature Store" / "Parquet → PostGIS"  icon: database
  Edge from all sources → Ingestion: label "REST / CSV"
  Edge Ingestion → Feature Store: label "station × hour"

[GROUP "AI CORE" (column 3, crimson 1px dashed outline #E11D48, the visual focus)]
  - "Baseline Model" / "LightGBM · air without Diwali"       icon: brain
  - "Diwali-Excess Model" / "LightGBM · cracker effect"      icon: sparkles
  - "Explainer" / "SHAP · cause split"                       icon: pie-chart
  - "Spatial Layer" / "regression kriging → H3 hexes"        icon: hexagon
  Edge Feature Store → AI Core: label "features"
  Internal edges: Baseline + Excess → Explainer; Baseline + Excess → Spatial Layer: label "P10 · P50 · P90"

[GROUP "DECISION LAYER" (column 4)]
  - "Predict" / "72-h hex forecast"                          icon: line-chart
  - "Plan" / "Breathing Budget · GRAP · hotspots"            icon: clipboard-list
  - "Protect" / "risk = PM × vulnerability"                  icon: shield
  Edge Spatial Layer → Decision Layer: label "~3,500 hexes"

[COLUMN 5]
  - "FastAPI" / "/forecast /explain /grap /risk"             icon: server
  - two nodes to its right, stacked:
    "Web App" / "React · MapLibre · mobile"                  icon: smartphone
    "Alerts" / "WhatsApp · Hindi/Punjabi"                    icon: message-circle
  Edge Decision Layer → FastAPI: label "JSON"
  Edges FastAPI → Web App: "REST"; FastAPI → Alerts: "webhook"

[VALIDATION NODE: small, bottom of canvas, under AI Core]
  - "Validation" / "held-out Diwali · hide-a-station · AirDelhi street sensors"   icon: check-circle
  Dashed connector to AI Core, label "eval"

BELOW THE WINDOW: one line in Inter 14pt #6B6B6B with a tiny line-chart thumbnail at left:
"Early finding (real data): global models show no Diwali spike, and air ventilation drops to ~0 every night."

Keep the diagram crisp, aligned to the grid, with equal spacing and no overlapping lines. It should look like a senior engineer's system-design diagram (Excalidraw-clean but with straight lines).
```
*Tip: if your AI tool can't draw this cleanly, build it in **Eraser.io**, **Excalidraw** (turn off sloppiness) or **Figma**, then export a PNG and drop it into the window. The node list above is the spec.*

---

## SLIDE 4: Feasibility & Viability

```
Slide 4: Feasibility & viability. Use the global design system.

HEADER: eyebrow "03 / FEASIBILITY & VIABILITY", title "Built on data that exists, for systems that already run."

LAYOUT: 3 equal columns as white cards. Each card has a mono uppercase label at top with a small icon.

CARD 1: label "✓ ALREADY WORKING" (green #22C55E check icon)
  - "Live weather + air-model data pulled (no API keys)"
  - "API contract + map UI skeleton running"
  - Big number at bottom: "₹0" (JetBrains Mono 40pt) + caption "data cost · runs on one small server"

CARD 2: label "RISK → MITIGATION" (icon: alert-triangle, #F97316)
  Three rows, each as "risk" (#6B6B6B, strikethrough-free) → "mitigation" (#111):
  - "No free traffic data" → "Road-density × time proxy, stated openly"
  - "Areas without sensors" → "Show a range, not a fake number"
  - "Is it accurate?" → "3-level validation (see below)"

CARD 3: label "VIABLE BEYOND THE HACKATHON" (icon: trending-up)
  - "Plugs into GRAP: CAQM can act on forecasts in advance"
  - "Targets Delhi's 13 official pollution hotspots"
  - "Free for citizens · NGO / CSR / govt dashboards fund it"
  - "New city = config change → Ludhiana, Amritsar, any CPCB city"

BOTTOM STRIP (full width, thin card): "VALIDATION PIPELINE", 3 steps as small pills joined by arrows:
"Held-out Diwali year" → "Hide-a-station test" → "Street-level check: AirDelhi bus sensors, Diwali 2020"
At the right end: "Must beat: persistence + CAMS global model" in JetBrains Mono 11pt.

ILLUSTRATION: a small Open Peeps line-art figure at bottom-right holding a magnifying glass up to a chart.
```

---

## SLIDE 5: Impact & Benefits

```
Slide 5: Impact & benefits. Use the global design system.

HEADER: eyebrow "04 / IMPACT", title "From 'AQI is 450' to what to do, where, and for whom."
(Render "what to do, where, and for whom" in #E11D48.)

LAYOUT: 2×2 grid of user cards on the left (65%), a vertical impact panel on the right (35%).

USER CARDS (white, radius 16px). Each has an Open Peeps line-art character at the top-left (black & white), a name, and a one-line benefit:
1. Character: a mother with a child checking a phone
   "Citizens": "Your street's air, 3 days ahead, plus the safest hours to step out."
2. Character: an official at a desk with a map
   "Officials · CAQM / DPCC / PPCB": "Act before 'Severe': GRAP stage plus the top-10 hotspots for sprinklers and patrols."
3. Character: an ASHA / NGO worker handing a mask to an elderly man
   "NGOs & ASHA workers": "Know where masks and purifiers protect the most vulnerable."
4. Character: a teacher with kids
   "Schools & RWAs": "WhatsApp alert: 'Severe 9 PM–1 AM, keep children indoors.'"

RIGHT PANEL (light card, #F3F2EE background):
  Mono label "WHAT WE'LL MEASURE"
  - "Exposure-hours avoided"
  - "Alerts delivered per ward"
  - "Resources sent to the right hotspots"
  Divider hairline
  Mono label "PRINCIPLES"
  - "Respects the festival"
  - "No blame on farmers"
  - "Protects the most vulnerable first"
  Divider hairline
  Three small outlined pills: "SDG 3 · Health", "SDG 11 · Cities", "SDG 13 · Climate"

BOTTOM: the full-width 6px AQI gradient bar (mirroring the title slide), with a closing line above it in Plus Jakarta Sans Medium 22pt:
"We don't cancel Diwali. We make it breathable."
```

---

## Asset checklist (so nothing looks AI-generated)
| Asset | Where to get it |
|---|---|
| Line-art people | **Open Peeps** (openpeeps.com, free, CC0) or **Humaaans** (humaaans.com). Recolor to black, one crimson accent max. |
| Icons | **Lucide** (lucide.dev) or **Phosphor** (phosphoricons.com), 1.5px stroke |
| Fonts | Google Fonts: Plus Jakarta Sans, Inter, JetBrains Mono |
| Architecture diagram | Eraser.io / Excalidraw / Figma, from the slide 3 spec |
| Evidence chart | `docs/img/diwali_eda.png` (restyle colors to match if time allows) |
| Dotted background | Figma: fill pattern; or CSS `radial-gradient(#D4D2CC 1.5px, transparent 1.5px) 0 0/16px 16px` |
