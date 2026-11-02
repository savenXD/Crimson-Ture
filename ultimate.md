# NOₓ: full project context (ultimate.md)

Written for: teammates and future Claude sessions picking this project up. Everything here was checked against the code and the data as of 1 Nov 2026 (the Diwali 2026 date is 8 Nov).

> `context.md` is older and describes an earlier idea ("SAANS", Predict/Plan/Protect). This file reflects what was actually built.

---

## 1. What this is

**Problem (hackathon):** AI-powered neighbourhood-level air pollution prediction around Diwali.

**Positioning for judges:** most places in India, and nearly all rural areas, have no air monitor, so nobody knows the air quality there. NOₓ estimates **PM2.5 for every ~0.7 km² hexagon, hour by hour**, using conditions (weather, farm-fire smoke, Diwali timing, local land use) instead of a nearby sensor, so it works where there is no sensor.

**Scope actually built:** **Delhi only**. Delhi is the test bed because it has real sensors to check against. Villages / Punjab / Haryana are the stated next step and are **not built**.

**What it predicts, exactly:**
- **PM2.5** in µg/m³ for each hexagon and hour, for 144 hours (**6–12 Nov 2026**, Diwali −2 days to +3 days).
- Shown on the map as the **Indian AQI computed from hourly PM2.5** (likely value). It is *not* the official CPCB daily AQI (which averages 24 h and takes the worst pollutant). It does not predict PM10, NO₂, ozone.
- Each prediction has a low / likely / high range (P10 / P50 / P90).

---

## 2. How the whole thing fits together

```
Data downloads  →  features  →  LightGBM (3 models)  →  forecast for 1,940 hexagons × 144 h
                                                              │
                          FastAPI  ←──── saved files ─────────┘
                             │
              React + MapLibre website (served by the same server)
```

Everything runs on one laptop CPU. No GPU, no cloud service.

### Data (all real)
| Data | Source | Notes |
|---|---|---|
| Station PM2.5 (2022+) | OpenAQ v3 API (needs key) | Government feed only starts Feb 2025 for most Delhi stations; older years have little |
| Station PM2.5 (2015–2020) | Kaggle "Air Quality Data in India" `station_hour.csv` | ~893k readings; no coordinates, so matched to OpenAQ stations **by name** |
| Weather (history) | Open-Meteo ERA5, 9 points over Delhi | wind, temperature, humidity, rain, pressure, **boundary-layer (mixing) height** |
| Weather (forecast) | Open-Meteo forecast API | 16 days |
| Farm fires | NASA FIRMS VIIRS, Punjab+Haryana box | 721k detections 2015–2026. **FIRMS allows max 5 days per request** (a bug here once made the first run silently fail) |
| Local features | OpenStreetMap via Overpass | roads, industry, parks, residential, schools, hospitals, markets per hexagon |
| Hexagon grid | H3 resolution 8 over Delhi's boundary | **1,940 hexagons** |

Keys live in `.env` (OPENAQ_API_KEY, FIRMS_MAP_KEY). `.env` is git-ignored.

### Model
- **LightGBM** gradient-boosted trees, v4.7.0. Three quantile models (P10, P50, P90) on `log(1+PM2.5)`; 400 trees each = **1,200 trees**. 31 input features.
- Trained on **694,978 station-hours, 101 stations, 12 seasons** (Sep 15 – Jan 15 of each year, 2015–2026).
- Inputs per hexagon-hour: hour of day, day of week, **hours from Diwali night** (clipped to −72…+120 so it can't memorise which year a date belongs to), cracker window flag, lat/lon, weather (6 variables + wind components), **ventilation = wind × mixing height**, NW-wind flag, **farm-fire counts lagged 1–3 days** and fire × NW wind, and the hexagon's static OSM features.
- **It has no memory.** It does not use yesterday's PM2.5 or neighbouring sensors' readings. Each hour is predicted independently from conditions. That is why it works anywhere on the map, and also why it can't correct itself from fresh sensor data.
- "Why" panel: SHAP contributions of the P50 model, grouped into Crackers / Farm-fire smoke / Weather & trapped air / Local sources (positive pushes only, shown as shares).
- Future farm-fire counts are unknown: the forecast **assumes the last 7 observed days persist**.

### Results (all real, from `ml/models/metrics.json` and `proof.json`)
**Hide-a-station test** (5-fold, whole stations held out):
| | Avg. error | R² |
|---|---|---|
| NOₓ model | **44.8 µg/m³** | 0.63 |
| Copy nearest real sensor | 46.1 | 0.56 |
| CAMS global model (on rows where it exists) | 59.9 vs our **38.0** on the same rows | 0.21 vs 0.64 |

Caveat: this test is optimistic for forecasting, because the hidden station's neighbours are in training at the same hours. The "copy nearest" baseline also peeks at real same-hour readings, which a forecast can't.

**Unseen Diwali season** (train without it, test ±4 days): R² **0.20 (2017), 0.32 (2019), 0.27 (2025)**. 2022 skipped (too little data).

**Replay for the website** (`ml/proof.py`, trained without the season, ±5 days, city-average):
- **2025:** avg error 51.6, 69% of real readings inside the predicted range (target 80%), **real city peak 558 vs model 251** (model ~half and ~4 h late).
- **2019:** avg error 73.0, 68% inside range, real peak 600 vs model 493.

**Honest conclusion:** the model beats the global model clearly, beats "copy the nearest sensor" only slightly, and **under-calls the sharpest Diwali-night peak**. The current forecast (city-average peak ≈ **375 µg/m³ around 9 PM on 8 Nov**) should be treated as a **floor, not a ceiling**. The site says this.

### Bugs found and fixed (worth knowing)
1. **Half-hour timing bug:** India is UTC+5:30, so forecast hours landed on :30 while weather sits on the hour. The join silently matched nothing and the whole forecast ran with **all weather inputs missing**. Fixed (`FIRST_HOUR` in `ml/predict.py`) and a guard now stops the forecast if any weather input is missing. Training was never affected.
2. **FIRMS 5-day limit** silently returned nothing for 10-day requests.
3. **MapLibre v6 worker** failed to load under Vite until the worker URL was set explicitly.
4. A model that leaned on `days_from_diwali` memorised each year; that feature was removed and `hours_from_diwali` clipped.

---

## 3. The website

Served from the same server as the API at **http://localhost:8000** (or the next free port). React + TypeScript + Vite, MapLibre GL (Carto Positron basemap, no key), h3-js, Recharts. White, minimal, subtle animation. Note: another Claude session redesigned most of the frontend; my additions live in separate files.

### Screens and features
- **Progress screen** while the pipeline isn't finished: live checklist and percentage from `/api/status`, shows training progress lines and, once tests finish, the accuracy numbers. **No demo or placeholder data exists anywhere**; if the model hasn't run, the API returns 503 and the site says so.
- **Map:** coloured hexagons for the hour on the timeline; hover shows AQI and distance to the nearest sensor; click opens the area panel. 3D mode (key **3**), my-location button, zoom.
- **Real stations on the map:** circles coloured by each station's **latest real reading** (63 of 64 have one). Hover shows name, reading, time; **click opens the public OpenAQ page** to check it. The "ⓘ" button in the toolbar explains hexagon vs circle **on hover only**.
- **Timeline:** play/pause, speed, scrub; keys: Space play, ←/→ hour, Shift+←/→ day, **D** jump to Diwali night, **3** 3D, **A** API panel, **?** shortcuts, Esc close.
- **Overview tab:** city average, phase (before / Diwali night / after), worst-hit areas (clickable).
- **Area panel** (click a hexagon): AQI with category, low–high range, distance to the nearest real sensor, 6-day chart, cause split (crackers / farm fires / weather / local), health advice, and an **English/Hindi village-alert preview** (a template; Hindi written by me, should be checked by a native speaker).
- **Model accuracy tab:**
  - hide-a-station and unseen-Diwali charts and tables;
  - **"Proof it's real":** replay of Diwali 2025 / 2019 (real sensors vs model, per station or average), **latest real readings with OpenAQ links**, and **SHA-256 fingerprints** of the model and forecast files;
  - **"What exactly does it predict?"**, **"What is running"** (LightGBM, 1,200 trees, file sizes and hashes, settings), **"Machine"** (CPU, cores, RAM, software), **"Run it live"** (pick an area and hour; the server builds the inputs and runs all three models now: shows every input, its push up/down, timing ≈ 49 ms, and whether it equals the saved forecast), "How a forecast is made", **"How fresh the data is"**, known limits.
- **Backend API panel:** toolbar button `{ }` or key **A** shows/hides it. Lists all endpoints, "Send request" with status / time / size / response (long arrays shortened), copy-as-`curl`, **"Test all endpoints"**, link to Swagger at `/docs`. Open/closed state is remembered.

### API endpoints (`backend/app/main.py`)
| Endpoint | Returns |
|---|---|
| `/api/health` | up, ready, hexagon count, forecast file age |
| `/api/meta` | city, window, Diwali hour, **stations with latest real reading + OpenAQ link** |
| `/api/hexes?t=` | PM2.5, AQI, distance for all hexagons at hour `t` |
| `/api/hex/{h3}?t=` | range, 144-hour series, causes, advice, alert text |
| `/api/hotspots?t=` | worst-hit areas |
| `/api/model` | model, settings, machine, freshness, sources |
| `/api/model/live?h3=&t=` | runs the real models now, with inputs, pushes, timing, match check |
| `/api/metrics` | test results |
| `/api/proof` | replay, latest readings, fingerprints |
| `/api/status` | pipeline progress |

Time axis: `t` = hours from 6 Nov 2026 00:00 IST; forecast hour 0 is 00:30 IST (UTC-hour aligned). Diwali night (20:00 IST) ≈ `t` 68.

---

## 4. Files

```
nox                      launcher: setup | run | forecast | verify | refresh
.env / .env.example      API keys (.env is git-ignored)
requirements.txt
ml/config.py             constants, Diwali dates 2015–2026
ml/ingest/               stations, sensors, aq (OpenAQ), kaggle, weather, fires, osm
ml/features.py           feature builder (shared by train / predict / live)
ml/train.py              training + all evaluation → ml/models/{q10,q50,q90}.txt, metrics.json
ml/predict.py            forecast for every hexagon → predictions.parquet (also reused for live runs)
ml/proof.py              replay + latest readings + fingerprints → proof.json, stations_latest.json
ml/verify.py             independent re-check (./nox verify)
ml/pipeline.py           runs every step once; skips what's cached
backend/app/             main.py (API), modelinfo.py (model facts + live run), status.py (progress)
frontend/src/            App.tsx, components/ (MapView, Overview, DetailView, Timeline, ModelView,
                         ModelLive, ProofPanel, ApiConsole, MapKey, Loading, charts, ui), hooks, api
docs/                    older pitch/architecture notes
ml/data/raw/kaggle/      the five Kaggle CSVs (large, not for git)
```

Small build outputs (model, forecast, proof, grid, station lists, ~8 MB) are allowed into git so a fresh clone opens instantly. Large raw downloads are ignored.

---

## 5. Commands

```bash
./nox setup      # once: venv, packages, npm install, asks for the two API keys
./nox run        # opens the site in seconds once built (skips finished steps)
./nox forecast   # new weather forecast only, ~3 min; run right before presenting
./nox verify     # ~20 s: file fingerprints, weather completeness, 200 random re-runs, live OpenAQ comparison
./nox refresh    # re-pull the current season, retrain, re-forecast (10–25 min, do it early)
```

First full build took roughly 25–40 minutes (OpenAQ's 60-requests-per-minute limit dominates). `./nox verify` last run: **all checks passed** (5 stations matched OpenAQ exactly).

---

## 6. Honest limits

- Delhi only. Rural villages are the pitch, not the build.
- Few Diwali seasons; unseen-Diwali R² is only 0.20–0.32; the sharpest peak is under-called.
- Weather a week out can change; fire counts after the last observed day are assumed constant.
- No traffic data: road density stands in.
- Interval coverage is below target (69% vs 80%) in the replay.
- "Latest real readings" are from the evening of 31 Oct (end of downloaded data); run `./nox refresh` to update.
- One station's coordinates (East Arjun Nagar) are approximate (training only); a few map dots are just over the Delhi border.
- The advice and alert texts are rule-based templates, not model output.
- I could not view the final UI in a real browser (headless Chrome can't draw the map); the build, types and every API were checked.
- Git: nothing from this rebuild is committed yet (last commit is the old Round-1 skeleton).

---

## 7. Judge cheat sheet

**Pitch (30 s):** "Most places in India have no air monitor. We estimate PM2.5 for every 0.7 km² hexagon, hourly, around Diwali, from weather, farm-fire smoke, Diwali timing and local land use, so it works where there's no sensor. Built and tested on Delhi; the method extends to villages."

**Numbers:** 695k real readings, 101 stations, 12 seasons; 1,940 hexagons × 144 h = 279,360 forecasts; hidden-sensor error 38 vs 60 µg/m³ for the global model (about 37% lower); slightly better than copying the nearest sensor; unseen Diwali R² 0.20–0.32.

**Demo (2 min):** map → press **D** → click a far-from-sensor hexagon → Model accuracy → "Proof it's real" replay → click a station circle to open OpenAQ → press **A** → "Test all endpoints".

**Q&A:** *Real or fake?* Replay of a season we trained without, station links to the public source, `./nox verify`. *How accurate?* Give the numbers, say it under-calls peaks, treat the peak as a floor. *Why not copy the nearest sensor?* In a village it may be 30 km away, and a forecast has no future readings to copy. *Rural?* Delhi is the test bed; the method needs weather, fire data and a few stations; not built yet.

**Never say:** "95% accurate"; that it predicts all pollutants; that villages are built.


---

## 8. Update: phone app, alerts, timeline (added after the sections above)

**Mobile-first user app** (`frontend/src/mobile/MobileApp.tsx`, `Root.tsx`). Screens ≤ 860 px wide get this layout automatically; `?app=1` forces it on a laptop, `?app=0` forces the dashboard. Bottom tabs:
- **Home:** onboarding (use my location / choose area), then time chips (Day before / Diwali night / Next morning) with a scrub slider, big AQI + category + range + distance to the nearest real sensor, "What to do" (English/Hindi) with a WhatsApp share button, best and worst time to go out (6 AM-10 PM), a tappable next-24-hours strip, the cause split, and an alerts shortcut.
- **Map:** full-screen hexagon map with real-sensor circles, a mini card for the selected area, hour slider and a Diwali-night jump.
- **Forecast:** 6-day chart and a day-by-day list of the daily peak.
- **Alerts:** switch, language, three rule toggles, "what we will send" with real times and text, share on WhatsApp, send-me-this-now, install hints.
- **Trust:** the accuracy, replay, proof and live-model view.
Deep links: `/?area=<h3>&t=<hour>&tab=<home|map|forecast|alerts|trust>`.

**Push alerts** (`backend/app/push.py`, `frontend/src/push.ts`, `public/sw.js`). Real Web Push with server keys in `.nox/` (git-ignored). A background thread checks the real clock every minute and sends: day-before summary (8 AM the day before Diwali), heads-up (3 h before the air first turns Very Poor around Diwali), and Severe-now. Endpoints: `/api/push/key|preview|subscribe|unsubscribe|send`. English/Hindi text. Tapping a notification opens the area. **Verified:** keys, message text, schedule, subscribe/unsubscribe storage. **Not verified:** delivery to a real phone (needs https).

**Browsers only allow install and push on https or localhost.** On a plain-http Wi-Fi link the phone shows the app as a normal web page; the Alerts tab then shows exactly what would be sent and offers WhatsApp sharing instead. An https tunnel (for example `ssh -R 80:localhost:8000 nokey@localhost.run`) was blocked by the permission system and not run; it would also expose the laptop's app to anyone with the URL.

**Timeline footer:** rebuilt as a ruler (hour / 6-hour / midnight ticks), draggable from anywhere on the strip, starts at the sidebar's edge, labels kept inside the footer. **Phone link:** toolbar phone icon shows a QR code and the LAN address; `./nox run` prints it and listens on the network.
