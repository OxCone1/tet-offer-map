# Data Extractor (Overpass → Tet Offer Scraper)

Live Demo (frontend consuming this output): https://oxcone.com/tet-map/

This folder contains a headless scraper that takes OpenStreetMap (OSM) address features from an exported GeoJSON (`export.geojson`) and queries Tet availability (https://www.tet.lv/pieejamiba). It enriches each feature with offer data and writes incremental NDJSON output so you can resume if it crashes.

## Current State
Stable for batch runs, but tightly coupled to Tet's current frontend (shadow DOM selectors in `index.js`). If Tet changes markup, selectors will need updates. Data collection is resilient: successful results stream to `tet_offers.ndjson`; failures stream to `tet_errors.ndjson`; processed IDs stored in `progress.json` allow restarts without re-fetching everything.

## 1. Prepare Input Data with Overpass Turbo
We use https://overpass-turbo.eu/ to export address + street network inside a bounding box you control.

### Steps
1. Open https://overpass-turbo.eu/
2. Pan/zoom to the exact area you want to scrape (keep it reasonably small to avoid rate limits; you can run multiple batches later). 
3. Click the Wizard button (or directly paste a query) and replace everything with the query below.
4. Press Run.
5. When results load, click Export → Download → GeoJSON and save as `export.geojson` into this `data-extractor` folder (overwriting the existing placeholder if present).

### Recommended Query
Copy/paste this EXACT query (it already includes timeout + JSON + address + highway coverage):

```text
[out:json][timeout:60];
(
   // Streets with names
   way["highway"]["name"]({{bbox}});
  
   // Addresses: can be nodes or ways with addr tags
   node["addr:housenumber"]({{bbox}});
   way["addr:housenumber"]({{bbox}});
   relation["addr:housenumber"]({{bbox}});
);
out body;
>;
out skel qt;
```

### Picking a Bounding Box
Use a rectangle in Overpass Turbo that tightly wraps the target settlement / district. Smaller areas reduce the risk of hitting Overpass rate limits and keep scraping time manageable. For large regions, split into multiple adjacent boxes and run sequentially—append outputs (the script will skip already processed IDs if `progress.json` is kept between runs).

## 2. Run the Scraper (API First, Puppeteer Fallback)
Two implementations now exist:

1. Fast API mode (`api.js`) – hits Tet's public JSON endpoints directly. MUCH faster & lighter.
2. Legacy Puppeteer browser mode (`index.js`) – full page automation, only needed if the API gets rate‑limited or changes.

Scripts (see `package.json`):

| Command | What it does |
|---------|---------------|
| `npm run api` | Run fast API scraper (recommended default). |
| `npm run api:validate` | Reprocess only previously failed addresses (error recovery) using API mode. |
| `npm run puppeteer` | Run browser (slower) scraper. |
| `npm run puppeteer:validate` | Recovery pass with Puppeteer for failed items. |

Install dependencies once, then prefer API:

```powershell
npm install          # first time only
npm run api          # fastest path – streams tet_offers.ndjson
```

If you start hitting API rate limits (many 429 / gateway failures), pause a bit or fall back:

```powershell
npm run puppeteer    # slower but different request pattern; can bypass temporary API throttling
```

Validation / recovery only (process entries that previously failed):

```powershell
npm run api:validate
# or
npm run puppeteer:validate
```

While running you will see progress. Stop any time (Ctrl+C) and restart; processed IDs are remembered across BOTH modes because they share `progress.json`.

## 3. Output Files (Shared Between API & Puppeteer)
| File | Purpose |
|------|---------|
| `tet_offers.ndjson` | One JSON object per line: original minimal OSM props + geometry + fetched offers. |
| `tet_errors.ndjson` | One line per failed item (with reason) so you can inspect / retry manually. |
| `progress.json` | Array / map of processed feature IDs for resume logic. |

All are append-friendly; you can tail them while scraping.

## 4. Address Normalisation
Address strings are composed from these tags when present: `addr:street`, `addr:housenumber`, `addr:city`, `addr:subdistrict`, `addr:district`. Latvian administrative suffixes are abbreviated (`pagasts` → `pag.`, `novads` → `nov.`) to better match Tet search behaviour.

## 5. Restart / Resume
If the script crashes, fix the cause (selectors, network, etc.) and run `npm start` again. Already processed IDs (those in `progress.json`) will be skipped. To force a full re-run, delete `progress.json` and (optionally) the output NDJSON files first.

## 6. Common Issues (API vs Browser)
| Issue | Hint |
|-------|------|
| Empty results | Inspect address formatting; verify the feature actually exists on Tet's site. |
| Many rapid failures (API) | Temporary throttling – reduce batch (`--batch=2`) or switch to Puppeteer fallback. |
| Many rapid failures (Puppeteer) | Tet layout / shadow DOM change: update selectors in `index.js`. |
| Overpass export too large | Split the area into smaller bounding boxes and merge NDJSON outputs later. |
| Memory usage grows | Run in smaller batches; archive older NDJSON lines. |
| Puppeteer Chrome not found / download error | See "Puppeteer troubleshooting" below. |

## 7. Consuming the Output
The frontend expects `tet_offers.ndjson` at build/deploy time. After scraping, copy or symlink this file into the frontend's `public` (or wherever it's being served) before building the production bundle.

## 8. Updating Selectors (If Tet Changes)
Open dev tools on Tet availability page, locate the nested shadow roots used to display address and offers, and update the query logic in `index.js`. Keep selectors as narrow as possible to avoid false matches.

## 9. Safety / Rate Limits
API Mode:
- Default concurrency is a modest batch size (see `DEFAULT_BATCH` in `api.js`). Override with `--batch=<n>` or `BATCH_SIZE` env var.
- If you begin to see repeated errors (timeouts, 429s), lower batch or pause 1–2 minutes.

Puppeteer Mode:
- Heavier; keep multiple parallel browser sessions to a minimum.
- You can still tune internal pacing if needed (not exposed yet – see TODO section).

## 10. Next Improvements (To‑Do)
- Unified CLI wrapper selecting API → fallback automatically
- Smarter dynamic backoff when API rate‑limited
- Automatic selector fallback heuristics (Puppeteer)
- Optional CSV / Parquet export
- CLI flags for bounding box filtering

## Puppeteer troubleshooting

When running the scraper Puppeteer may fail to locate or download a matching Chromium/Chrome binary. A common error looks like:

```
Error: Could not find Chrome (ver. 139.0.7258.68). This can occur if either
 1. you did not perform an installation before running the script (e.g. `npx puppeteer browsers install chrome`) or
 2. your cache path is incorrectly configured.
```

Try these steps in order:

1. Ensure the environment variable `PUPPETEER_SKIP_DOWNLOAD` is set to `false` before installing or running the scraper. On Windows PowerShell you can run:

```powershell
setx PUPPETEER_SKIP_DOWNLOAD false
```

2. If step 1 didn't help, explicitly install the Chrome browser package used by Puppeteer:

```powershell
npx puppeteer browsers install chrome
```

3. If installation still fails, inspect or clear Puppeteer's cache directory (shown in the error, e.g. `C:\Users\%userprofile%\.cache\puppeteer`) and retry step 2. You can remove the cache folder and re-run the install command.

4. As a last resort, set `PUPPETEER_EXECUTABLE_PATH` to a system-installed Chrome/Chromium binary path so Puppeteer uses the local browser instead of downloading.

These steps should resolve most Chrome download / detection issues when running the scraper.

---
Need a new batch? Just create a fresh bounding box in Overpass Turbo, export, replace `export.geojson`, run again.

Happy scraping (API first, browser only when needed).
