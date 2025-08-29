# Data Extractor (Overpass → Tet Offer Scraper)

Live Demo (frontend visualising outputs): https://oxcone.com/tet-map/

This folder hosts the API‑first Tet availability scraper and legacy Puppeteer fallback. The architecture now supports MULTIPLE import GeoJSONs and produces PARTITIONED per‑area NDJSON exports with a discoverable `pointer.json` index.

## Current State
API mode (`api.js`) is primary. Each raw import file placed in `imports/` is hashed (12 hex, shake256 6 bytes) → renamed to `_<hash>.geojson` and enriched in‑place with:

```jsonc
{
   "type": "FeatureCollection",
   "features": [...],
   "progress": ["way/123", "relation/456"],   // successful IDs
   "errors": ["way/789"]                       // failed IDs (retryable)
}
```

Offers are routed into per‑area NDJSON inside `exports/` (naming rules in section 4). A `pointer.json` file summarizes all exports (counts, extremes, outline polygon, updatedAt).

## 1. Prepare Input Data (Overpass Turbo)
Use https://overpass-turbo.eu/ to export address + street features. You can create MULTIPLE exports (adjacent bounding boxes) and drop them all into `imports/`.

### Steps
1. Open https://overpass-turbo.eu/
2. Pan/zoom to the exact area you want to scrape (keep it reasonably small to avoid rate limits; you can run multiple batches later). 
3. Click the Wizard button (or directly paste a query) and replace everything with the query below.
4. Press Run.
5. When results load, click Export → Download → GeoJSON and save into `data-extractor/imports/` (any filename). Repeat for other regions as needed.

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
Two implementations:

1. API mode (`api.js`) – direct JSON endpoints (fast, low overhead).
2. Legacy Puppeteer mode (`index.js`) – only if API changes or heavy throttling.

Scripts (see `package.json`):

| Command | What it does |
|---------|---------------|
| `npm run api` | Process all imports → per-area exports + incremental pointer updates. |
| `npm run api -- --update` | Rebuild `pointer.json` ONLY (no scraping). |
| `npm run api:validate` | Retry only failed IDs across imports (API mode). |
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

While running you will see per‑import progress. Stop any time (Ctrl+C) and restart; processed IDs are remembered per import file (`progress` array). Errors can later be retried with `api:validate`.

## 3. Output Files
| File / Pattern | Purpose |
|----------------|---------|
| `imports/_<hash>.geojson` | Source FeatureCollection with embedded `progress` + `errors`. |
| `exports/city_subdistrict_country.ndjson` | Offers for that subdistrict. |
| `exports/neighborhood_riga_lv.ndjson` | Riga neighborhood partition (auto‑classified). |
| `exports/city_country.ndjson` | City‑level fallback (no subdistrict). |
| `exports/pointer.json` | Index array: name, count, furthestPoints, outline polygon, updatedAt. |

All NDJSON files contain one object per successful offer location; duplicates are avoided per file.

## 4. Export File Naming & Address Normalisation
Rules:
1. `addr:city` + `addr:subdistrict` → `city_subdistrict_country.ndjson`
2. Riga special case: if city is Riga and neither subdistrict nor district set, attempt neighborhood polygon match (`riga_neighborhoods.geojson`) → `neighborhood_riga_lv.ndjson`
3. Otherwise `city_country.ndjson`

Normalisation: lowercase, strip diacritics, punctuation & spaces → `_`, trim leading/trailing underscores. Latvian suffix abbreviation: `pagasts`→`pag.`, `novads`→`nov.` for better API search matching.

## 5. Restart / Resume
Per import file resume: progress is stored inline. To reprocess an import from scratch remove its `_hash.geojson` (or delete `progress` / `errors` arrays inside) then rerun.

## 6. Common Issues
| Issue | Hint |
|-------|------|
| Empty results | Check normalized address string; compare in Tet site manually. |
| API 429 / timeouts | Lower batch (`--batch=3`) or pause; fallback to Puppeteer. |
| All Riga points go to `riga_lv` | Ensure `riga_neighborhoods.geojson` exists & contains polygons. |
| Large import slow | Split imports—parallel hashing okay; scraping still respects concurrency cap. |
| Pointer missing file | Ensure at least one offer with non-empty `offers` array was written for that area. |
| Puppeteer Chrome errors | See troubleshooting section below. |

## 7. Consuming the Output
Preferred: frontend reads `exports/pointer.json` then lazily fetches selected per‑area NDJSON files. Legacy: concatenate exports into one large file if pointer flow not yet integrated.

## 8. Updating Selectors (If Tet Changes – Puppeteer Only)
Open dev tools on Tet availability page, locate the nested shadow roots used to display address and offers, and update the query logic in `index.js`. Keep selectors as narrow as possible to avoid false matches.

## 9. Concurrency / Rate Limits
Specify batch with `--batch=<n>` (default tuned for moderate throughput). On sustained errors lower value. Puppeteer mode inherently slower—avoid parallel browsers.

## 10. Next Improvements (To‑Do)
- Frontend pointer integration (if not merged)
- Dynamic backoff when API throttled
- Optional CSV / Parquet export
- Concave hull outlines (current = convex)
- Bounding box filter flag per import

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

Data publishing tip: copy `exports/` (including `pointer.json`) to an external repo for CDN distribution (see root README for link).

Happy scraping (API first, browser only when needed).
