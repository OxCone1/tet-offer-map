# Data Extractor (Overpass → Tet Offer Scraper)

Live Demo (frontend consuming this output): https://tetmap-9195211e7616.herokuapp.com/

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

## 2. Run the Scraper
From this `data-extractor` directory:

```powershell
npm install   # first time only
npm start     # begins processing export.geojson
```

While running you will see progress in the console. You can stop at any time (Ctrl+C) and restart later; processed IDs are remembered.

## 3. Output Files
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

## 6. Common Issues
| Issue | Hint |
|-------|------|
| Empty results | Inspect address formatting; verify the feature actually exists on Tet's site. |
| Many rapid failures | Tet layout change: update selectors in `index.js`. |
| Overpass export too large | Split the area into smaller bounding boxes and merge NDJSON outputs later. |
| Memory usage grows | Run in smaller batches; archive older NDJSON lines. |

## 7. Consuming the Output
The frontend expects `tet_offers.ndjson` at build/deploy time. After scraping, copy or symlink this file into the frontend's `public` (or wherever it's being served) before building the production bundle.

## 8. Updating Selectors (If Tet Changes)
Open dev tools on Tet availability page, locate the nested shadow roots used to display address and offers, and update the query logic in `index.js`. Keep selectors as narrow as possible to avoid false matches.

## 9. Safety / Rate Limits
Be polite: avoid huge bounding boxes; respect delays already in the script (add random jitter if necessary). Consider pausing between batches.

## 10. Next Improvements (To‑Do)
- Configurable concurrency / throttling
- Automatic selector fallback heuristics
- Optional CSV export
- CLI flags for bounding box filtering

---
Need a new batch? Just create a fresh bounding box in Overpass Turbo, export, replace `export.geojson`, run again.

Happy scraping.
