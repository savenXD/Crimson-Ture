# Architecture

## Data flow

```mermaid
sequenceDiagram
  participant S as Sources (CPCB, Open-Meteo, CAMS, FIRMS, OSM)
  participant I as Ingestion (ml/ingest)
  participant F as Feature store (Parquet)
  participant M as Models (LightGBM P10/P50/P90)
  participant A as FastAPI
  participant U as React dashboard

  I->>S: hourly pulls (historical backfill + forecast)
  I->>F: station × hour rows; static hex covariates
  F->>M: build features → train (temporal + LOSO validation)
  M->>F: hex × hour predictions + SHAP values (batch, every 1-3 h)
  U->>A: /hexes?t, /forecast/{h3}, /explain/{h3}, /scenario
  A->>F: read precomputed predictions
  A->>M: on-demand re-predict for scenarios
  A-->>U: JSON → hex heatmap, charts, advisories
```

## Neighborhood (spatial) strategy

1. **Unit:** H3 resolution 8 (~0.74 km²), about 3.5k hexes over Delhi NCT. Each hex can be mapped to an MCD ward for officials.
2. **Station model:** a global LightGBM is trained at the station locations with time-varying features (weather, event, fires, lags).
3. **Hexes with no station:** we drop the station-specific lags and use **static covariates** (road density, industrial and green fraction, markets, population, distance to highways) plus spatially interpolated neighbor lags (inverse-distance weighting of the nearest stations). This is land-use regression combined with gradient boosting.
4. **Proof:** leave-one-station-out CV error is reported next to the error at stations that have sensors.

## Diwali (event) strategy

- `hours_from_diwali` follows the lunar calendar ([ml/config.py](../ml/config.py)), so one model learns from Diwalis that fall anywhere between Oct 19 and Nov 14.
- `is_cracker_window` × hour captures the night burst. The ventilation index (wind × boundary-layer height) controls how fast it clears afterwards.
- Stubble: FIRMS fire counts lagged 1–3 days × NW-wind flag.
- Phases (before / during / after) are reported separately in the metrics.

## Scenario engine

The cracker and traffic features are scaled by user factors and the model predicts again (a counterfactual). The result is shown as the change in AQI per hex and the city-wide mean. Example: "green crackers only (×0.3) → mean PM2.5 −35% on Diwali night".

## API contract

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | status, model version |
| GET | `/hexes?t=` | `[ {h3, pm25, aqi, category} ]` for all hexes at hour `t` |
| GET | `/forecast/{h3}` | series `[ {t, p10, p50, p90, aqi, category} ]` from D−7 to D+7 |
| GET | `/explain/{h3}?t=` | drivers `[ {source, ug_m3, share} ]` |
| POST | `/scenario` | `{t, cracker_factor, traffic_factor}` → per-hex change + city mean before/after |
| GET | `/advisory/{h3}?t=` | AQI now, health advice, safest hours in the next 24 h |

`t` = hours relative to Diwali night 20:00 IST.
