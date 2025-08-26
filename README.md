# Tet Offer Map – Monorepo

Live Demo: https://oxcone.com/tet-map/

Full workflow to extract Latvian Tet internet availability data and visualize it on an interactive web map with optional user‑provided connectivity layers.

## Contents
| Folder | Purpose |
|--------|---------|
| [`data-extractor/`](data-extractor/README.md) | Puppeteer scraper: enriches OSM address features with Tet offers → NDJSON output. |
| [`frontend/`](frontend/README.md) | React + Vite application (Leaflet map, search, filters, sectors, uploads). |

## High‑Level Flow
1. Use Overpass Turbo to export OSM address + street features to `data-extractor/export.geojson`.
2. Run the scraper → generates / updates `data-extractor/tet_offers.ndjson` (and errors/progress files).
3. Copy the produced `tet_offers.ndjson` into `frontend/public/`.
4. Build / run the frontend → map fetches `/tet_offers.ndjson` once at load.

## 1. Prerequisites
- Node.js >= 18 (frontend uses ES modules; scraper uses Puppeteer which benefits from modern Node).
- Git, PowerShell (Windows) or any shell.

## 2. Generate Input GeoJSON (Overpass Turbo)
Open https://overpass-turbo.eu/ and zoom to your target bounding box. Paste this query:

```
[out:json][timeout:60];
(
  way["highway"]["name"]({{bbox}});
  node["addr:housenumber"]({{bbox}});
  way["addr:housenumber"]({{bbox}});
  relation["addr:housenumber"]({{bbox}});
);
out body;
>;
out skel qt;
```

Export → Download → GeoJSON → save as `data-extractor/export.geojson`.

## 3. Run Scraper
```powershell
cd data-extractor
npm install          # first time
npm start            # writes tet_offers.ndjson incrementally
```
Outputs:
- `tet_offers.ndjson` – one JSON object per line (properties + offers + geometry)
- `tet_errors.ndjson` – failed items
- `progress.json` – processed IDs (for resume)

You can stop and restart; already processed IDs are skipped. To reprocess from scratch delete `progress.json` (and optionally the NDJSON files).

## 4. Prepare Frontend
Copy latest dataset:
```powershell
copy data-extractor\tet_offers.ndjson frontend\public\tet_offers.ndjson
```
Install & run:
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 (default Vite port) or whatever is printed.

Build production bundle:
```powershell
npm run build
npm run preview   # optional local preview
```

## 5. Deployment (Example: Heroku / Any Static Host)
Frontend build produces `frontend/dist/`. Serve it with any static server (Express example):
```js
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_,res)=>res.sendFile(path.join(__dirname,'dist','index.html')));
```
Ensure you copy `tet_offers.ndjson` into the deployed `dist/` (or keep it beside an upstream CDN path referenced at fetch time).

## 6. Technology Stack
| Area | Tech | Notes |
|------|------|-------|
| Scraper | Node.js, Puppeteer, node-fetch, YAML | Shadow DOM traversal for Tet availability page. |
| Frontend Core | React 19, Vite, TypeScript (partial) | Fast dev + modern JSX runtime. |
| Styling | Tailwind CSS 4, shadcn/ui patterns (Radix primitives + class-variance-authority + tailwind-merge + lucide-react icons) | Utility-first styling with composable accessible components. |
| Map | Leaflet, custom clustering (DBSCAN + convex hull) | No heavyweight server; client clustering. |
| Search | Fuse.js fuzzy search | Boosted house number relevance. |
| Storage | localforage (IndexedDB wrapper) | Persistent user uploaded datasets. |
| Intl | Simple context + translation hook | Lightweight language switching. |
| Server (deploy) | Express 5 (optional) | Static file + SPA fallback; not required for static hosts. |

## 7. Data Contracts
Minimal Tet offer object (one line in NDJSON):
```json
{
  "id": "123456",
  "address": "Street 12, Riga",
  "geometry": { "type": "Point", "coordinates": [24.123, 56.95] },
  "offers": [ { "connectionType": "Fiber", "speed": { "minMbit": 300, "maxMbit": 1000 }, "pricePerMonth": "19.99" } ],
  "scrapedAt": "2025-08-17T12:34:56.000Z",
  "source": "tet"
}
```
User uploaded Feature requirement:
```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [24.12, 56.95] },
  "properties": { "address": "User St 5", "connection_type": "fiber" }
}
```

## 8. Common Tasks
| Goal | Commands |
|------|----------|
| Fresh scrape + run frontend | `npm --prefix data-extractor start` → copy file → `npm --prefix frontend run dev` |
| Clean & rescrape | Delete `data-extractor/progress.json` then rerun scraper |
| Update dataset in running dev server | Re-copy NDJSON into `frontend/public/` and refresh browser |

## 9. Troubleshooting
| Symptom | Fix |
|---------|-----|
| 404 `/tet_offers.ndjson` | File not copied into `frontend/public/` before build. |
| Infinite fetch loop | Ensure only one fetch in `useData`; redeploy after cleanup. |
| Blank map | Container needs height (see root div) / network blocked tiles. |
| Modal empty | Input object missing `offers` or address properties. |
| Scraper stalls | Site markup change → adjust selectors in `data-extractor/index.js`. |
| Puppeteer Chrome download error | See "Puppeteer troubleshooting" in `data-extractor/README.md`. |



## 10. Future Enhancements
- Streaming parser for very large NDJSON (progressive rendering)
- Configurable fetch endpoint (ENV var)
- Geometry simplification pipeline
- Offline bundle of tiles or vector layer switch
- CI workflow to rebuild dataset on schedule

## 11. License & Attribution
OpenStreetMap data © OpenStreetMap contributors. Tet brand/data belong to Tet. This project is for informational / analytical purposes.

---
Pull requests welcome. Keep `tet_offers.ndjson` lean for faster load.

❤️ Created by OxCone
