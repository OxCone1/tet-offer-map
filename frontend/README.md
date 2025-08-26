# Tet Offer Map – Frontend

Live Demo: https://oxcone.com/tet-map/

Interactive web map for visualising Tet (Latvia) internet service availability combined with user‑supplied connectivity data. Built with React + Vite + Leaflet. Supports fuzzy address search, data layer toggles, connection type filtering, clustering / sector highlighting, and per‑property detail modals.

> IMPORTANT: Place the backend‑produced file `tet_offers.ndjson` into this folder's `public/` directory before building so it is served at `/tet_offers.ndjson`.

## 1. Quick Start

```powershell
cd frontend
npm install
copy ..\data-extractor\tet_offers.ndjson .\public\tet_offers.ndjson  # ensure latest data
npm run dev            # start dev server
```

Build production bundle:

```powershell
npm run build
npm run preview        # local preview of dist/
```

Deploy (Heroku / static host): serve `dist/` with any SPA static server that falls back to `index.html`.

## 2. Data Ingestion

The map expects a Tet offer dataset at `/tet_offers.ndjson` (fetched once on load). Each line is a JSON object with at minimum:

```json
{
  "id": "osm_way_or_node_id",
  "address": "Street 12, City",
  "geometry": { "type": "Polygon" | "Point" | "MultiPolygon", "coordinates": [...] },
  "offers": [ { "connectionType": "Fiber", "speed": {"minMbit": 300, "maxMbit": 1000}, "pricePerMonth": "19.99" } ],
  "scrapedAt": "2025-08-17T12:34:56.000Z",
  "source": "tet"
}
```

User uploads (GeoJSON Features or NDJSON) are stored locally (IndexedDB via localforage) and merged dynamically. Required fields for a user record:

```json
{
  "type": "Feature",
  "geometry": { ... },
  "properties": { "address": "...", "connection_type": "fiber" }
}
```

## 3. Architecture Overview

| Layer | Responsibility |
|-------|----------------|
| `App.jsx` | Top-level state orchestration, wiring hooks to components, modal and panel visibility. |
| `hooks.jsx` | Custom hooks (`useMap`, `useSearch`, `useStorage`, `useData`, etc.) handling data lifecycle & interaction logic. |
| `map.js` | `MapManager` class: Leaflet map init, layer management (Tet, user, sectors), clustering (DBSCAN), styling & filtering. |
| `utils.js` | `AddressSearch` (Fuse.js wrapper) + `DataUtils` (parsing, validation, formatting, color logic). |
| `storage.js` | `StorageManager` (localforage) – persistent user uploaded datasets. |
| `components/*` | UI pieces: navigation panel, legend, property modals, language selector, etc. |
| `contexts/LanguageContext.jsx` | Language state + provider for translations. |
| `hooks/useTranslation.jsx` | Translation lookup hook consumed throughout UI. |

### Data Flow
1. `useData` fetches Tet dataset (axios) → `tetData` state.
2. `StorageManager` loads user datasets → `userData`.
3. Combined array `allData` feeds `AddressSearch` (fuzzy search).
4. `MapManager` receives layer toggles & data → renders Leaflet layers.
5. User selects feature → property modal displays offers / metadata.

### Map Layer Logic
`MapManager.addTETData` & `addUserData` rebuild layer groups filtering by connection type set (`setTypeFilters`). Sector overlays are derived by:
1. Collecting centroids of visible items.
2. Grouping by normalized connection type.
3. Per‑type DBSCAN clustering (custom, distance using Leaflet `map.distance`).
4. Rendering convex hull (>=3 points) or buffered circle (<3).

### Filtering
`DataUtils.normalizeConnectionType` canonicalises strings (fiber, dsl, cable, mobile, satellite, unknown). Filters are stored as a `Set`; empty = show all.

## 4. Search
`AddressSearch` builds a Fuse index with boosted weight on house number. Query length < 2 aborts. House number matches are rescored to bubble exact / prefix matches.

## 5. User File Uploads
Accepted:
* NDJSON (one GeoJSON Feature or Tet-like object per line)
* JSON / GeoJSON (single Feature or array of Features)

Validation: `DataUtils.isValidGeoJSONFeature`. On success, features appended to stored list & immediately visible (user layer auto-enabled).

## 6. Internationalisation
`LanguageProvider` supplies translation function via `useTranslate`. Loading screen & various UI strings resolved at render time.

## 7. Styling & UI
Tailwind (via Vite) + custom components (`ui/*`). Legend dynamically reflects visible datasets; disclaimers & language switch rendered above map.

## 8. Building & Deploying

Ensure fresh data:

```powershell
copy ..\data-extractor\tet_offers.ndjson .\public\tet_offers.ndjson
npm run build
```

Serve `dist/` behind any static server (Heroku Node/Express example):

```js
app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'dist','index.html')))
```

## 9. Error Handling
* Tet fetch fails → confirm prompt suggesting page reload (single attempt only).
* User upload parse errors → notification via `useNotifications`.
* Map operations ignore invalid geometries silently.

## 10. Extending
Ideas:
* Add caching headers / ETag check for `tet_offers.ndjson`.
* Implement incremental loading (stream NDJSON lines) for very large datasets.
* Add export of current user layer to NDJSON / GeoJSON.
* Persist UI preferences (layer toggles, filters) in localforage.
* Code-split heavy map logic.

## 11. Development Tips
* Keep `tet_offers.ndjson` slim—remove unused properties to reduce JS bundle parse time.
* Large polygons: consider simplifying geometry before serving.
* Use devtools performance tab if sector clustering feels slow; adjust `epsMeters` / `minPts` defaults.

## 12. File Placement Summary
| Location | Purpose |
|----------|---------|
| `public/tet_offers.ndjson` | Required Tet dataset (copied from data-extractor output). |
| `src/map.js` | Leaflet integration & clustering. |
| `src/hooks.jsx` | Composite hooks (data, map, search, storage). |
| `src/utils.js` | Parsing, search, color, helpers. |
| `src/storage.js` | IndexedDB wrapper for user uploads. |
| `components/` | UI building blocks & modals. |

## 13. Troubleshooting
| Symptom | Fix |
|---------|-----|
| Blank map | Check div mounts & CSS height (container must have height). |
| 404 `/tet_offers.ndjson` | Ensure file copied into `public/` before build. |
| Infinite requests | Ensure fetch occurs once (see `useData`). |
| Missing offers in modal | Verify `offers` array present per line in NDJSON. |
| Sector overlay empty | Not enough clustered points (adjust radius / minPts). |

### Puppeteer / scraper Chrome download issues

If you run the scraper from the root `data-extractor` folder and see a Puppeteer error about missing Chrome, follow the steps in `data-extractor/README.md` under "Puppeteer troubleshooting". Short checklist:

1. Set `PUPPETEER_SKIP_DOWNLOAD` to `false`:

```powershell
setx PUPPETEER_SKIP_DOWNLOAD false
```

2. Run the explicit install:

```powershell
npx puppeteer browsers install chrome
```

3. If needed, clear the Puppeteer cache (path shown in error) and retry, or set `PUPPETEER_EXECUTABLE_PATH` to a local Chrome binary.

---
Place `tet_offers.ndjson` → run dev/build → explore. That’s it.