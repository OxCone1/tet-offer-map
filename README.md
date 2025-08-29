# Tet Offer Map – Monorepo

Live Demo: https://oxcone.com/tet-map/

Multi‑stage pipeline & web UI to extract Latvian Tet internet availability data, normalize it against OpenStreetMap (OSM) address geometry, and visualize per‑area internet technologies on an interactive map. Supports user‑provided connectivity overlays and fine‑grained per‑neighborhood slicing (Riga included).

## Motivation
I built this to give everyday users a clear, map‑based view of the real connectivity landscape around them: what kinds of internet technologies their neighbours already have, and where gaps still exist. Having that visibility helps people argue for upgrades, choose a better provider/technology, and generally raise local awareness about broadband availability (or the lack of it) in their area. The goal is empowerment through transparency – turning scattered, opaque availability checks into an explorable shared layer.

## Contents
| Folder | Purpose |
|--------|---------|
| [`data-extractor/`](data-extractor/README.md) | Scrapers (API-first + Puppeteer fallback) enriching OSM addresses with Tet offers → NDJSON. |
| [`frontend/`](frontend/README.md) | React + Vite application (Leaflet map, search, filters, sectors, uploads). |

## High‑Level Flow (Deployed Usage)
The production site fetches all authoritative datasets (pointer index + per‑area NDJSON partitions) directly from the external data repository:

https://github.com/OxCone1/data-tet-map

No local bundling of pointer / NDJSON files is required in the frontend build. End users can optionally add their own local connectivity information only via the in‑browser upload interface (user data layer). Local filesystem copies of exported NDJSON files are not used by the running app.

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

## 3. Data Consumption in Frontend
On load the frontend downloads the remote pointer index, then selectively fetches per‑area slices on demand. There is no need to place dataset files in `frontend/public/`.

## 4. Local Development Frontend
For development you also rely on the remote dataset. Only user‑generated uploads (GeoJSON / NDJSON) are stored locally (IndexedDB) after using the upload UI. No manual copying of pointer or NDJSON export files is necessary.

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
The build does not bundle dataset lines; network fetch is performed at runtime.

## 6. Technology Stack (Selected)
| Area | Tech | Notes |
|------|------|-------|
| Scraper | Node.js, Axios (API) + Puppeteer (fallback) | API first; browser only if needed. |
| Frontend Core | React 19, Vite, TypeScript (partial) | Fast dev + modern JSX runtime. |
| Styling | Tailwind CSS 4, shadcn/ui patterns (Radix primitives + class-variance-authority + tailwind-merge + lucide-react icons) | Utility-first styling with composable accessible components. |
| Map | Leaflet, custom clustering (DBSCAN + convex hull) | No heavyweight server; client clustering. |
| Search | Fuse.js fuzzy search | Boosted house number relevance. |
| Storage | localforage (IndexedDB wrapper) | Persistent user uploaded datasets. |
| Intl | Simple context + translation hook | Lightweight language switching. |
| Server (deploy) | Express 5 (optional) | Static file + SPA fallback; not required for static hosts. |

## 7. Data Contracts
Per-area NDJSON line shape:
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

## 8. Common Tasks (Maintainers Only)
| Goal | Notes |
|------|-------|
| Scrape & publish new dataset | Run extractor (private), push updated pointer + partitions to data repo. |
| Retry failed IDs | Use extractor `--validate` or recovery script, republish. |
| Adjust batch size | Configure extractor run; frontend unaffected. |
| Add new geographic coverage | Add additional import GeoJSON(s), scrape, publish. |

## 9. Troubleshooting (Frontend)
| Symptom | Fix |
|---------|-----|
| Dataset not loading | Check network access to data repo raw URLs (CORS / connectivity). |
| Blank map | Ensure container height & tile network access. |
| Modal empty | Underlying record has empty offers; verify upstream scrape. |
| User upload not appearing | Confirm file is valid GeoJSON Feature(s) with required fields. |



## 10. Future Enhancements
- Pointer‑driven lazy loading in frontend (if not yet merged)
- Streaming parser for very large NDJSON (progressive rendering)
- Configurable data endpoint / CDN base (ENV)
- Geometry simplification pipeline
- Scheduled CI scrape & publish to dataset repo
- Optional concave hull for outlines

## 11. Data Source Repository
All datasets (pointer + per‑area NDJSON partitions) are fetched dynamically from:

https://github.com/OxCone1/data-tet-map

Local substitution is intentionally not supported; use the web UI upload for custom local layers.

## 12. License & Attribution
OpenStreetMap data © OpenStreetMap contributors. Tet brand/data belong to Tet. This project is for informational / analytical purposes.

---
Pull requests welcome. Keep per‑area files lean (drop unused props) for faster load and smaller pointer outlines.

❤️ Created by OxCone
