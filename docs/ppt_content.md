# SAANS: Round 1 deck content (5 slides)

Design rules (D, the judging expert): at most ~40 words of visible text per slide, one visual per slide, big numbers, dark theme with an AQI-colour accent (green → maroon). Details go in the speaker notes, not on the slide.

---

## Slide 1: Title + Team
**Visual:** dark Delhi-at-night smog background with a faint hexagon grid overlay.

> # SAANS
> ### Making Diwali Breathable
> Neighborhood-level AI that predicts Diwali air pollution, plans around it, and protects people at risk
>
> **Team Crimson**
> [Name]: ML & Data · [Name]: Backend · [Name]: Frontend · [Name]: Research & Pitch
> PS: AI-Powered Neighborhood-Level Air Pollution Prediction System

**Speaker note (10 s):** "SAANS means breath. We're Team Crimson, and our roles cover ML, backend, frontend and research."

---

## Slide 2: The Idea
**Visual:** left = problem in 3 icons; right = Predict → Plan → Protect as three linked cards.

> **The problem**
> - Delhi PM2.5 rose **16×** on Diwali night (IIT Delhi study)
> - ~40 monitors for ~1,500 km²; **Punjab has only 6** continuous stations
> - Global models **miss the cracker spike**; alerts come *after* the damage
>
> **Our idea: Predict → Plan → Protect**
> 🔮 **Predict:** 72-h forecast for every ~0.7 km² neighborhood, with *why* (crackers / stubble / trapped air / traffic)
> 🗓️ **Plan:** nightly **"Breathing Budget"** → GRAP-stage and hotspot actions for officials
> 🛡️ **Protect:** pollution × vulnerable people → targeted Hindi/Punjabi alerts to schools, ASHA workers and NGOs
>
> ### *We don't cancel Diwali. We make it breathable.*

**Speaker note:** "Everyone can show an AQI map. We answer the next question: what to do, where, when, and for whom."

---

## Slide 3: Technical Approach
**Visual:** one horizontal architecture diagram (6 boxes) plus the real-data chart thumbnail.

> **Data (all free)** → CPCB stations · Open-Meteo weather (incl. mixing height) · NASA FIRMS farm fires · OpenStreetMap roads/land use · Diwali lunar calendar
> ↓
> **Features**: hours-from-Diwali · ventilation index (wind × mixing height) · fire smoke transport · road density
> ↓
> **Two-part AI model** (LightGBM, low/likely/high range)
> ① Baseline: "air *without* Diwali" ② Diwali excess: the cracker effect → **cause split** (SHAP)
> ↓
> **Spatial layer**: regression kriging → ~3,500 neighborhood hexagons (H3)
> ↓
> **Decision layer**: GRAP forecast · hotspot ranking · Breathing Budget · risk map
> ↓
> **FastAPI → React map app** (mobile) · WhatsApp alerts
>
> 📈 *Our early finding (real data):* the global CAMS model shows **no Diwali spike**, and air ventilation **drops to ~0 every night**.

**Speaker note:** "Why trees, not LSTM: about 10 Diwalis is small tabular data, and boosted trees are fast, give ranges and are explainable. Why kriging: a Delhi study found it beat deep learning for spatial mapping."

---

## Slide 4: Feasibility & Viability
**Visual:** 3 columns: ✅ Proven · ⚠️ Risks → Mitigation · 💰 Sustainability.

> **✅ Already working**
> - Weather + global AQ data pulled live (no API keys)
> - Repo, API contract and map UI skeleton running
> - Data cost: **₹0**; runs on a single small server
>
> **⚠️ Risk → Mitigation**
> - No free traffic data → road-density × time proxy (stated openly)
> - Areas without sensors → show a **range**, not a fake-precise number
> - Accuracy claims → **3-level validation**: held-out Diwali year · hide-a-station test · **street-level bus-sensor data from Diwali 2020** (IIT Delhi AirDelhi)
>
> **💰 Viable beyond the hackathon**
> - Plugs into **existing** processes: GRAP (CAQM can act in advance on forecasts), Delhi's 13 hotspots, ASHA/RWA networks
> - Free for citizens; NGO/CSR and government dashboards fund it
> - New city = config change (Delhi → Ludhiana, Amritsar, any CPCB city)

**Speaker note:** "We beat two baselines: 'same as yesterday' and the CAMS global model. No '95% accuracy' claims. We'll show real error numbers."

---

## Slide 5: Impact & Benefits
**Visual:** 4 user cards with icons, plus an SDG strip at the bottom.

> | Who | Benefit |
> |---|---|
> | 👨‍👩‍👧 **Citizens** | Know *their* street's air 3 days ahead, plus the safest hours to step out |
> | 🏛️ **Officials (CAQM / DPCC / PPCB)** | Act *before* Severe: GRAP stage and the top-10 hotspots to send sprinklers, anti-smog guns and patrols to first |
> | 🤝 **NGOs & ASHA workers** | Priority list of where masks and purifiers protect the most vulnerable people |
> | 🏫 **Schools & RWAs** | Hindi/Punjabi WhatsApp alerts: "Severe 9 PM–1 AM, keep children indoors" |
>
> **What we'll measure:** exposure-hours avoided · alerts delivered · resources sent to the right wards
> **Respects the festival · doesn't blame farmers · protects the vulnerable**
> SDG 3 (Health) · SDG 11 (Sustainable Cities) · SDG 13 (Climate)
>
> ### *From "the AQI is 450" → "here's what to do, where, and for whom."*

**Speaker note:** "We're shifting from reacting after the AQI hits Severe to acting a day before, in the right place, for the right people."

---

## What NOT to put on slides (all four agree)
- No "95% accuracy", GNN + LLM + blockchain buzzwords, or long paragraphs
- No unverified news numbers (Diwali 2025 averages, Punjab AQI). Keep those for spoken Q&A only, with a caveat
- No farmer-blaming or anti-Diwali visuals
