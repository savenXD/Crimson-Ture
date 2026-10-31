# CONTEXT: Hackathon Project "NOx" (formerly SAANS; repo: crimson)

> **Name update:** the product is now **NOx** (Latin "nox" = night, NOₓ = pollutant). Tagline: "Street-level Diwali air forecasts that tell you why, and what to do." Where this file says SAANS, read NOx.

> Everything decided so far: the problem statement, round structure, idea, research, technical approach, pitch and repo state.
> Read this first before working on the project.

---

## 1. Hackathon details

- **Organisers:** Parayavaran Welfare Society × rootaccess (a college hackathon at a tier-1 college, with strong competition from IIT-level teams)
- **Problem statement (exact):** *AI-Powered Neighborhood-Level Air Pollution Prediction System.* "Develop an AI-powered platform to predict neighborhood-level air pollution before, during, and after Diwali by analysing historical air-quality data, weather conditions, traffic patterns, and other relevant environmental indicators."

### Round structure
| Round | Name | Time | Deliverable | Points |
|---|---|---|---|---|
| 1 | Ideation & Core Setup | Checkpoint 1 (slide says 1:30–2:30 AM; team says 12:30) | Architecture diagram / README + Git repo | 10 |
| 2 | MVP Prototype & Pitch Draft | Checkpoint 2, 6:00–7:00 AM | Working build + 3–4 slide pitch deck draft | 20 |
| 3 | Final Judging & Tech Evaluation | Grand Finale, 8:00–9:00 AM | Live 3-minute pitch + end-to-end working demo | 30 |

- **Round 1 tasks:** finalise the problem, feature scope and system architecture; initialise repos with baseline setup and skeleton code. Mentors judge **uniqueness, feasibility and tech stack**.
- **Round 3 judging criteria:** Uniqueness, Implementation, Scalability, Presentation.
- **Current focus: Round 1 only.** Architecture diagram, README, GitHub repo, and slide 1 (the idea).

### What the problem statement actually asks for (our reading)
| Phrase | Meaning |
|---|---|
| "Neighborhood-level" | The core challenge. Delhi has ~40 official stations for ~1,500 km², and most areas have no sensor. We must estimate pollution where nobody measures it. |
| "Before, during, after Diwali" | Diwali is a predictable event with **three phases that have different causes** (see research). The date follows the lunar calendar and moves each year. |
| "Historical AQ + weather + traffic + other indicators" | Multi-source data fusion. Weather is the biggest driver (trapped air). "Other indicators" points to stubble fires, land use and population. |
| "AI-powered platform" | A usable product (web app), not a notebook. |
| Organiser = welfare society | They care about **impact on people**, not only model accuracy. |

**Not stated in the problem statement (our assumptions):** who the users are, which city to use, and the forecast horizon. We chose Delhi as the primary city with Punjab as the second use case, a 72-hour horizon, and citizens, officials and NGOs as users.

---

## 2. THE IDEA: **SAANS** (Hindi for "breath")

**Tagline:** *"We don't cancel Diwali. We make it breathable."*
**One-liner:** *Diwali's air traffic control: predict it, plan it, protect people from it, neighborhood by neighborhood.*

### Why this idea (debate summary)
Four perspectives were used: a senior MNC engineer (A), an AI researcher (B), a Punjab NGO / social-welfare officer (C) and a hackathon judging expert (D).
- **D:** Every team will build "AQI forecast on a map". That's the problem statement, not an idea, and Google already offers it. The winner answers the next question: *so what do we do, who, where, when?*
- **C:** People will burst crackers anyway. In 2025 the Supreme Court allowed only green crackers in fixed slots, and both rules were widely broken. Anything that says "don't celebrate" is ignored. **Don't blame farmers**, especially in Punjab. Respect the festival and protect the vulnerable. Real actors are school principals, ASHA and anganwadi workers, gurdwara and temple committees, RWAs and ward officers, reached in Hindi or Punjabi on WhatsApp.
- **B:** Concentration ≈ emissions ÷ dilution capacity (wind × mixing height). Our real-data chart shows the ventilation index **drops to ~0 every night**. The same crackers cause different harm depending on night, hours and area. **Caution:** don't overclaim that shifting by an hour helps, since evening ventilation is already low. Gains come from *which slot* (policy input), *where* (open grounds vs dense lanes) and *who is protected*. Always show ranges.
- **A:** All of this is buildable. It's the same forecast model plus scenario runs plus open map data.

### Ideas rejected
| Idea | Why rejected |
|---|---|
| Plain AQI forecast map | Everyone builds it, and Google exists |
| Own IoT sensor network | Not demo-able in a hackathon |
| LLM chatbot | A gimmick, judges have seen it often |
| Crowdsourced cracker reports | Unreliable data |
| Gamification / AR | Low real impact |

### The three pillars: Predict → Plan → Protect
| Pillar | What it does | Users |
|---|---|---|
| **1. PREDICT** (problem statement core) | 72-hour PM2.5/AQI forecast for every ~0.7 km² hexagon, before, during and after Diwali, with a **cause split** (crackers / stubble / trapped air / traffic) and an uncertainty range (P10–P90) | Everyone |
| **2. PLAN: "Breathing Budget"** | Per area and night: how much extra smoke the air can absorb before reaching Severe. Turned into: cracker time-slot evidence and community-ground suggestions, a **GRAP stage forecast** per area 72 hours ahead, and a **hotspot action list** (where sprinklers, anti-smog guns and patrols go first) | CAQM, DPCC, PPCB, MCD ward officers, RWAs, religious committees |
| **3. PROTECT: "Who breathes it"** | Risk = pollution × vulnerable population (schools, hospitals, elderly, slums, outdoor workers). Gives a priority list for mask and purifier distribution, plus Hindi/Punjabi WhatsApp alerts to ASHA workers, schools and RWAs. Also tells citizens the safest outdoor hours. | NGOs, health workers, schools, citizens |

### Slide 1 text (draft)
> **SAANS: Making Diwali Breathable**
> Neighborhood-level AI that predicts Diwali air pollution, plans around it, and protects the people most at risk.
> **Problem:** Every Diwali, Delhi and Punjab cities hit "Severe" within hours. Monitors are sparse (Punjab has just 6 continuous stations), global models miss the cracker spike, and alerts come after the damage.
> **Predict:** 72-hour forecasts for every ~0.7 km² neighborhood, showing what's causing the smog.
> **Plan:** a nightly "Breathing Budget", turned into GRAP and hotspot actions for officials.
> **Protect:** pollution × vulnerable-population risk maps, with WhatsApp alerts in Hindi/Punjabi.
> **We don't cancel Diwali. We make it breathable.**

---

## 3. Research findings (what the design is based on)

1. **The three phases have different causes.** IIT Delhi (Manchanda et al., *Atmospheric Pollution Research*; arXiv 2011.14402): PM2.5 rose **16×** over pre-firework levels on Diwali; fireworks made up **~95% of elemental PM2.5** during Diwali; the cracker effect **fades within ~12 h**; **biomass burning drives the bad air in the days after**.
   → Model the phases separately: before = stubble + weather, during = crackers, after = biomass + stagnant air.
2. **Causal cracker estimate.** Ghei & Sane, *PLOS ONE* 2018 (e0200371): hourly PM2.5 for 2013–2017, the first causal estimate of the Diwali cracker effect. → The basis for our two-part (baseline + excess) model.
3. **Kriging beats deep learning for Delhi spatial mapping.** arXiv 2410.04309 (ACM J. Computing & Sustainable Societies): 28 low-cost sensors plus Space-Time Kriging found **189 hidden monthly hotspots** beyond the 660 detected by the public network. Kriging outperformed deep learning. → Use regression kriging for the spatial layer.
4. **AirDelhi dataset** (IIT Delhi + IIT Gandhinagar, NeurIPS 2023 Datasets track): low-cost PM sensors on public buses in Delhi-NCR, **~Nov 1, 2020 – Jan 31, 2021**, ~12.5M samples. This **covers Diwali 2020 (Nov 14)**. Data: https://www.cse.iitd.ac.in/pollutiondata (page is live); code: github.com/sachin-iitd/DelhiPMDatasetBenchmark. → **Street-level validation**, a unique edge.
5. **GRAP runs on forecasts.** CAQM (Sept 2024 revision): Stages II–IV can be invoked **in advance based on forecasts** if the projected levels are expected to last ~3 days. Stages: I = Poor (201–300), II = Very Poor (301–400), III = Severe (401–450), IV = Severe+ (>450). → The "Plan" pillar plugs into an existing government process.
6. **Delhi ground operations.** 13 official hotspots (Anand Vihar, Jahangirpuri, Narela, Ashok Vihar/Mayapuri, Vivek Vihar, Dwarka, Mundka, Rohini, Wazirpur, Okhla, Bawana, Punjabi Bagh, RK Puram), a Green War Room, and a 2025 plan for **1,000 sprinklers + 140 anti-smog guns**. → Resource-allocation use case.
7. **Punjab.** PPCB has only **6 continuous stations** (Amritsar, Jalandhar, Ludhiana, Khanna, Mandi Gobindgarh, Patiala). After Diwali 2025, Amritsar reached ~450 and Ludhiana ~403 AQI (single news report, unverified). → Neighborhood estimation matters even more there.
8. **Diwali 2025 Delhi.** Reported post-Diwali average PM2.5 of ~488 vs ~156.6 before, with some stations up to ~1,800 µg/m³ (news; check CPCB). The SC allowed green crackers in fixed slots, and the rules were broken.
9. **Stubble share is debated.** Estimates range from ~14% (multi-year average) to 30–40% (peak days). → Present it as a model output with ranges, never as blame.
10. **Model choice evidence.** Gradient-boosted trees generally match or beat LSTM on tabular pollution and weather data, but the Delhi evidence is mixed (one Sci. Reports 2024 study found LSTM/GRU best for PM2.5). → LightGBM is chosen for small data, speed, quantiles and explainability. Say "generally", not "always".
11. **Satellite PM2.5 for India.** Kawano et al., *Science Advances* 2025 (daily, 10 km, ML + satellite); IIT Delhi MDPI 2020 (1 km MAIAC AOD). → Future feature source.
12. **GNNs for unmonitored sites** (GraPhy arXiv 2506.06917; GraphSAGE/Bristol arXiv 2505.05479; Lahore arXiv 2501.11270). → Roadmap only, since ~40 stations is too small a graph for the hackathon.

### Competitors / existing solutions (have this answer ready)
| Existing | What it does | Gap we fill |
|---|---|---|
| Google Air Quality API | Hourly forecasts up to 96 h; index values on a 500 m grid | Generic. Nothing Diwali-specific, no cause split, no actions, closed and paid |
| IITM DSS (Decision Support System) | Delhi forecasts + source contributions + intervention scenarios | 2021 emissions inventory; its GMD paper says it underestimates local sources in severe episodes; reportedly suspended once by CAQM over data reliability (unverified) |
| SAFAR (IITM) | City and region-level forecasts | Not neighborhood-level |
| IQAir / AQI.in / WAQI | Mostly current readings from sensors | No Diwali forecast, no "why", no actions |

**Answer line:** "Google gives generic AQI forecasts; the DSS is coarse and uses a 2021 inventory. We're Diwali-specific, data-driven, explain the cause, and turn forecasts into GRAP, hotspot and protection actions."

---

## 4. TECHNICAL APPROACH (final agreed architecture)

### 4.1 End-to-end flow
```
① DATA (all free)
   CPCB stations (Delhi ~40, Punjab 6) · Open-Meteo weather incl. boundary-layer height
   CAMS global AQ model (baseline + feature) · NASA FIRMS farm fires
   OpenStreetMap roads/land use · WorldPop population · Diwali lunar calendar
   AirDelhi bus-sensor data (validation only)
                 │
② INGESTION  →  Python scripts (cron, hourly) → Parquet "feature store" (→ PostGIS in production)
                 │
③ FEATURES   →  station × hour table: lags, weather, ventilation, fire lags × NW wind,
                 hours-from-Diwali, phase, static area covariates
                 │
④ TWO-PART MODEL (LightGBM quantile P10/P50/P90)
   ├─ Baseline model: "air without Diwali" (trained on non-Diwali days: weather + stubble + traffic + seasonality)
   └─ Diwali-excess model: extra PM on top of baseline during the Diwali window (crackers)
                 │   → a measured cracker effect plus cause split (with SHAP)
⑤ SPATIAL LAYER → regression kriging: model trend from hex covariates + kriged station residuals
                   → every H3 res-8 hexagon (~0.74 km², ~3,466 hexes over Delhi)
                 │
⑥ DECISION LAYER
   ├─ PREDICT: forecast + cause split + uncertainty per hex
   ├─ PLAN:    Breathing Budget, GRAP stage per area (72 h), hotspot action ranking, cracker-slot scenarios
   └─ PROTECT: risk = PM × vulnerable population (OSM schools/hospitals + WorldPop + slums), alerts
                 │
⑦ FastAPI   →  /hexes /forecast /explain /scenario /advisory  (+ /budget /grap /risk to add)
                 │
⑧ CLIENTS   →  React + Vite + MapLibre + h3-js + Recharts web app (mobile-friendly)
                 WhatsApp/SMS alerts in Hindi/Punjabi (Round 3 stretch)
```

### 4.2 How a user sees their location
1. Open the web app on a phone → browser geolocation gives lat/long
2. `h3-js latLngToCell(lat, lng, 8)` gives the hexagon ID
3. `GET /forecast/{h3}` + `/explain/{h3}` + `/advisory/{h3}`
4. Show AQI now and later, the cause split, advice and the safest hours

### 4.3 Data sources
| Signal | Source | Access | Status |
|---|---|---|---|
| Station PM2.5/PM10 (ground truth) | CPCB via Kaggle "Air Quality Data in India 2015–2020"; OpenAQ v3; CPCB / data.gov.in for live | download / free key | **Verify the download** |
| Weather (wind, temperature, RH, rain, **boundary-layer height**) | Open-Meteo Historical (ERA5) + Forecast | no key | ✅ tested, working |
| Global AQ model (CAMS) | Open-Meteo Air-Quality API | no key | ✅ tested, working |
| Stubble fires | NASA FIRMS VIIRS, Punjab+Haryana bbox `73.8,28.4,77.6,32.6` | free MAP_KEY | code written |
| Traffic | **Proxy:** OSM major-road density per hex × hour/weekday profile × festive-shopping days (TomTom live = future) | Overpass API | stub; **be openly honest that it's a proxy** |
| Land use / vulnerable places | OSM (industrial, parks, markets, schools, hospitals), WorldPop population | open | stub |
| Street-level validation | AirDelhi (Nov 2020–Jan 2021, includes Diwali 2020) | IIT Delhi site | page live, data to be checked |
| Diwali dates 2015–2026 | hard-coded in `ml/config.py` | — | ✅ (2026 = Nov 8, verify) |

### 4.4 Features
- **Time:** hour (sin/cos), day of week
- **Event:** `hours_from_diwali` (relative to Diwali night 20:00 IST), `days_from_diwali`, `phase` (before < −24 h, during −24…+36 h, after > +36 h), `is_cracker_window` (−2…+10 h), cracker × hour
- **Weather:** wind u/v, **ventilation index = wind (m/s) × boundary-layer height**, NW-wind flag (270–360°), temperature, RH, rain
- **Transport:** FIRMS fire counts lagged 1–3 days × NW-wind flag (`stubble_transport`)
- **Autoregressive:** PM2.5 lags 1/3/6/24/48/168 h, rolling 6 h and 24 h means
- **Baseline input:** CAMS PM2.5 forecast
- **Static per hex:** major/minor road km, distance to highway, industrial fraction, green fraction, markets, population

### 4.5 Models
- **LightGBM quantile regression** (α = 0.1 / 0.5 / 0.9), one **global** model across stations
- **Two-part design:** baseline model (non-Diwali days) + Diwali-excess model (residual in the Diwali window), inspired by Ghei & Sane's causal approach
- **Explainability:** SHAP values grouped into crackers / stubble / meteorology / traffic / background
- **Spatial:** regression kriging (trend from covariates + kriged residuals), supported by the Delhi kriging study
- **Why not LSTM/GNN:** only ~10 Diwali events and ~40 stations is a small tabular dataset; trees are fast and explainable. GNN is on the roadmap.
- **Target:** hourly PM2.5 → CPCB National AQI (PM2.5 breakpoints 0–30 Good, 31–60 Satisfactory, 61–90 Moderate, 91–120 Poor, 121–250 Very Poor, 250+ Severe). Horizon 1–72 h.

### 4.6 Decision-layer logic
- **Breathing Budget (per hex, per night):** forecast baseline (no-cracker) PM plus the remaining headroom before the Severe threshold, given the forecast ventilation. Shown as "the air can take X more tonight". Computed by scenario runs of the excess model.
- **Cracker-slot scenarios:** shift or scale the cracker-window features → predicted change per hex (gives evidence for SC/CAQM time-slot policy). **Don't overclaim.** Report ranges.
- **GRAP forecast:** map the forecast daily AQI per area to Stage I–IV and flag when Stage II+ is expected for ≥3 days (matches the CAQM proactive rule).
- **Hotspot ranking:** rank hexes and wards by forecast severity × population → top 10 with a suggested action (sprinkler, anti-smog gun, enforcement patrol, school alert).
- **Protect risk score:** forecast PM × (vulnerable population + schools + hospitals + slum density) → mask and purifier distribution priority list plus alert targets.

### 4.7 Validation plan (key to credibility)
1. **Temporal:** train on earlier years and test on a **whole held-out Diwali season**
2. **Spatial:** **leave-one-station-out**, dropping the station's own lags to simulate a hex with no sensor
3. **Street-level:** compare hex predictions with **AirDelhi bus sensors during Diwali 2020**
4. **Baselines to beat:** 24 h persistence and the CAMS global model
5. **Metrics:** RMSE/MAE per phase (before/during/after), AQI-category accuracy, P10–P90 coverage
6. **Honesty:** no "95% accuracy" claims. Report error vs baselines and show ranges.

### 4.8 Tech stack
| Layer | Choice | Reason |
|---|---|---|
| ML | Python, pandas, LightGBM, SHAP, scikit-learn, h3, (pykrige for kriging) | Small data, fast CPU training, quantiles, explainable |
| API | FastAPI + Uvicorn | Typed, auto docs at `/docs` |
| Frontend | React + Vite + TypeScript, MapLibre GL (Carto dark basemap, no key), h3-js, Recharts | Free vector maps, hexes rendered in the browser; the team knows web dev |
| Storage | Parquet now → PostGIS in production | Simple now, clear path to scale |
| Alerts (stretch) | WhatsApp Business API / Twilio SMS | How India reaches people |
| Scale story | City config switch (Delhi → Ludhiana/Amritsar/any CPCB city) | Scalability criterion |

---

## 5. Key evidence we already have (real data)
`python -m ml.eda_diwali` → `docs/img/diwali_eda.png` (Open-Meteo CAMS + ERA5, Diwali 2022/2023/2024, 8 Delhi station locations):
- **The CAMS global model (~40 km) shows NO Diwali-night spike.** PM2.5 even dips around t=0, while ground stations report huge spikes. → Coarse global models miss the cracker effect, which is our gap.
- **The ventilation index drops to ~0 every night**, with daytime peaks of ~3–8 ×1000 m²/s. Crackers are burst exactly when the air can't disperse them.

---

## 6. Pitch lines and mentor Q&A

**Round 1 pitch (30 s):** "Diwali smog is three problems: farm smoke before, crackers during, trapped air after. Global models miss the cracker spike entirely (our chart). SAANS forecasts every neighborhood 72 hours ahead, separates the cracker effect from the baseline, and turns it into GRAP-stage, hotspot and protection actions that officials and NGOs in Delhi and Punjab already use. We validate against street-level sensor data from Diwali 2020. We don't cancel Diwali. We make it breathable."

**Terms to use, with meanings:**
- *Hyperlocal / H3 grid:* the city split into ~0.7 km² hexagons
- *Ventilation index:* wind × boundary-layer height, the air's ability to dilute smoke
- *Stubble transport:* Punjab/Haryana fire smoke reaching Delhi 1–3 days later on NW winds
- *Quantile regression:* predicting a low/likely/high range
- *SHAP:* explains each prediction's drivers
- *Regression kriging:* spreading station forecasts to every hexagon using area features
- *Leave-one-station-out:* proves accuracy where there's no sensor

**Likely questions:**
- *Where's the traffic data?* → No free historical source for Delhi; we use a road-density × time proxy and say so openly.
- *Why not LSTM?* → ~10 Diwali events is small tabular data; boosted trees are generally strong there, fast, and explainable.
- *How accurate?* → Better near stations, wider ranges far from them. We report error vs persistence and CAMS, plus leave-one-station-out and AirDelhi checks.
- *Doesn't Google / SAFAR / DSS do this?* → See the competitor table.
- *Is it practical?* → GRAP already allows forecast-based action; Delhi has 13 hotspots and 1,000 sprinklers to allocate; ASHA and RWA networks already exist.

**What to avoid:** buzzword soup (GNN + LLM + blockchain), fake-precise accuracy claims, blaming farmers, anti-Diwali messaging.

---

## 7. Current repo state (`/home/saven/Codding Projects/crimson`)
```
README.md                 # written BEFORE the SAANS idea (Crimson naming); needs SAANS + Plan/Protect update
context.md                # this file
docs/architecture.md      # sequence diagram, spatial/event strategy, API contract
docs/img/diwali_eda.png   # real-data evidence chart ✅
docs/img/dashboard.png    # FAILED headless screenshot (blank map); delete, don't commit
requirements.txt          # fastapi, uvicorn, pandas, pyarrow, requests, lightgbm, scikit-learn, shap, h3>=4, matplotlib, jupyter
.gitignore
ml/config.py              # Delhi bbox, H3_RES=8, DIWALI_DATES 2015–2026, 8 station coords
ml/aqi.py                 # CPCB NAQI sub-index (PM2.5, PM10)
ml/ingest/weather.py      # Open-Meteo ERA5 ✅ working
ml/ingest/aq.py           # CAMS ✅ working; Kaggle CPCB loader; OpenAQ stub
ml/ingest/fires.py        # NASA FIRMS (needs FIRMS_MAP_KEY)
ml/ingest/osm.py          # H3 grid ✅; Overpass road features TODO
ml/features/build.py      # time/event/met/transport/autoregressive features
ml/models/train.py        # LightGBM quantile, baselines, temporal eval, leave-one-station-out
ml/eda_diwali.py          # evidence chart generator ✅
backend/app/main.py       # FastAPI: /health /hexes /forecast /explain /scenario /advisory ✅ tested
backend/app/mock.py       # deterministic Diwali-shaped mock predictions (until the model is trained)
frontend/                 # Vite React TS: MapLibre hex map, time slider, forecast chart, cause bars, advisory, what-if sliders (builds ✅)
.venv/                    # Python venv (gitignored)
```
- Git: `git init` done, **nothing committed or pushed yet**.
- Dev servers may still be running in the background (uvicorn :8000, vite :5173).
- Run: `uvicorn backend.app.main:app --reload` · `cd frontend && npm run dev` · `python -m ml.eda_diwali`

## 8. Next steps
**Round 1 (now):**
1. Update README to SAANS: idea, Predict/Plan/Protect, final architecture diagram (Mermaid), research references, validation plan
2. Delete `docs/img/dashboard.png`; fill in team names
3. Commit and push to GitHub (repo name and visibility still to be decided)
4. Slide 1 (idea) plus an architecture slide plus the evidence chart

**Round 2 (later):** download CPCB/Kaggle data and verify; train the two-part LightGBM; add kriging; add `/budget`, `/grap`, `/risk` endpoints; wire the frontend to real predictions; draft a 3–4 slide deck.
**Round 3 (later):** Diwali 2026 (Nov 8) forecast "on record", WhatsApp alerts, Punjab city config, polish the 3-minute demo.

## 9. Items to verify before quoting
- Diwali 2026 date (Nov 8)
- Kaggle CPCB dataset availability and coverage
- Diwali 2025 numbers (488 avg, 1,800 peak) and Punjab 2025 AQI (single news reports)
- DSS suspension report; Google AQ API India coverage and forecast resolution
- AirDelhi data download contents
- Checkpoint 1 exact time (slide says 1:30–2:30 AM)

## 10. Sources
- Manchanda et al.: https://arxiv.org/abs/2011.14402v2 · IIT Delhi news: https://news.careers360.com/iit-delhi-study-says-biomass-burning-drives-poor-air-quality-during-diwali
- Ghei & Sane, PLOS ONE 2018: https://pmc.ncbi.nlm.nih.gov/articles/PMC6089419
- AirDelhi: https://proceedings.neurips.cc/paper_files/paper/2023/hash/ee799aff607fcf39c01df6391e96f92c-Abstract.html · data: https://www.cse.iitd.ac.in/pollutiondata · dates: https://arxiv.org/pdf/2603.04431
- Delhi hotspot / kriging study: https://arxiv.org/abs/2410.04309v1
- IITM DSS: https://gmd.copernicus.org/articles/17/2617/2024/gmd-17-2617-2024.pdf · https://vajiramandravi.com/current-affairs/delhis-air-pollution-explained-how-the-dss-tracks-the-real-polluters/
- GNNs: https://arxiv.org/pdf/2505.05479 · https://arxiv.org/html/2506.06917v1 · https://arxiv.org/html/2501.11270v1
- Satellite PM2.5 India: https://southasia-pm2-5.energyandcleanair.org/
- Trees vs LSTM: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12507303/ · https://pure.kfupm.edu.sa/en/publications/temporal-trends-and-predictive-modeling-of-air-pollutants-in-delh/
- GRAP (CAQM): https://caqm.nic.in/WriteReadData/LINKS/CAQM%20PR%2018092024-100abe518ff-0fbf-4c60-ad8a-a91ebba8d1b7.pdf
- Delhi hotspots: https://www.tribuneindia.com/news/delhi/action-plan-to-tackle-pollution-at-13-hotspots-in-capital-launched · sprinklers: https://www.theweek.in/wire-updates/national/2025/05/06/des61-dl-cm-pollution.html
- Google Air Quality API: https://developers.google.com/maps/documentation/air-quality/overview
- Punjab: https://www.tribuneindia.com/news/punjab/air-pollution-down-by-18-this-diwali-334457 · https://www.outlookindia.com/amp/story/national/aqi-in-punjab-haryana-air-quality-deteriorates-post-diwali-despite-lowest-farm-fire-count
- Diwali 2025 Delhi: https://www.thequint.com/climate-change/delhi-wakes-up-to-very-poor-air-a-day-after-diwali
- Stubble share: https://compass.rauias.com/current-affairs/stubble-burning-contributes-14-pm-2-5-delhi/ · https://www.tribuneindia.com/news/delhi/stubble-burning-remains-a-significant-contributor-to-delhis-unbreathable-air-crea-study-443806
