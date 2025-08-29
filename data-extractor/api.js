/**
 * Tet availability API scraper (non-browser) – NEW FILE HANDLING FLOW
 *
 * Major changes:
 *  - All input GeoJSON files are sourced from ./imports/*.geojson (any name)
 *  - On start each file is hashed (shake256 6 hex chars) and renamed to <hash>.geojson (idempotent)
 *  - Each source GeoJSON is enriched in-place with top-level arrays:
 *        progress: ["osm_id1", "osm_id2", ...]   // successful scraped feature ids
 *        errors:   ["osm_idX", ...]               // failed feature ids
 *    (Written back after every processed feature for crash safety.)
 *  - Output offers are NOT aggregated into a single tet_offers.ndjson any more.
 *    Instead, offers are routed into per-location NDJSON streams inside ./exports/ using naming rules:
 *       1. If feature has addr:city AND addr:subdistrict => city_subdistrict_country.ndjson
 *       2. Else if feature has addr:city (only)         => city_country.ndjson
 *       3. Otherwise feature is DISREGARDED (not scraped, not tracked).
 *    (Names are lowercase, diacritics removed, spaces/punctuation -> underscore, no "offers" suffix.)
 *  - Errors are NOT written to a separate ndjson file; only stored in the source geojson top-level.
 *  - Concurrency simplified to sequential per source file to avoid race conditions updating that file.
 *
 * Environment / CLI:
 *   --batch=N is still accepted but currently coerced to 1 (sequential) due to per-file progress mutation.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { createHash } = require('crypto');


const IMPORTS_DIR = path.resolve(__dirname, 'imports');
const EXPORTS_DIR = path.resolve(__dirname, 'exports');

const DEFAULT_BATCH = 5; // default concurrent requests (safe with write lock)

function shake256(content) {
  return createHash('shake256', {outputLength: 6}).update(content).digest('hex')
}

function getBatchSize() {
    const arg = process.argv.find(a => a.startsWith('--batch='));
    if (arg) {
        const v = Number(arg.split('=')[1]);
        if (!isNaN(v) && v > 0) return v;
    }
    const env = Number(process.env.BATCH_SIZE);
    if (!isNaN(env) && env > 0) return env;
    return DEFAULT_BATCH;
}

async function appendLine(filePath, obj) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const line = JSON.stringify(obj) + '\n';
    await fsp.appendFile(filePath, line, 'utf8');
}

function abbr(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        .replace(/\bpagasts\b/i, 'pag.')
        .replace(/\bnovads\b/i, 'nov.')
        .trim();
}

function pickAddrProps(props) {
    const keys = [
        'addr:street',
        'addr:housenumber',
        'addr:city',
        'addr:postcode',
        'addr:subdistrict',
        'addr:district',
        'addr:country',
        'ref:LV:addr',
    ];
    const out = {};
    for (const k of keys) if (props[k] != null) out[k] = props[k];
    return out;
}

function buildAddressString(props) {
    const street = props['addr:street'] || '';
    const house = props['addr:housenumber'] || '';
    const city = props['addr:city'] || '';
    const subdistrict = props['addr:subdistrict'] ? abbr(props['addr:subdistrict']) : '';
    const district = props['addr:district'] ? abbr(props['addr:district']) : '';
    const parts = [];
    const streetPart = [street, house].filter(Boolean).join(' ');
    if (streetPart) parts.push(streetPart);
    if (city) parts.push(city);
    if (subdistrict) parts.push(subdistrict);
    if (district) parts.push(district);
    return parts.join(', ');
}

async function readAndPrepareGeoJSON(fullPath) {
    const content = await fsp.readFile(fullPath, 'utf8');
    const data = JSON.parse(content);
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        throw new Error('Invalid GeoJSON in ' + fullPath + ': expected FeatureCollection with features');
    }
    if (!Array.isArray(data.progress)) data.progress = [];
    if (!Array.isArray(data.errors)) data.errors = [];
    return data;
}

async function persistGeoJSON(fullPath, obj) {
    // Pretty print minimal to reduce churn
    const out = JSON.stringify(obj, null, 2);
    await fsp.writeFile(fullPath, out, 'utf8');
}

function slugify(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacritics
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        || 'unknown';
}

function buildExportFileName(props) {
    const city = props['addr:city'];
    const sub = props['addr:subdistrict'];
    const country = props['addr:country'] || 'lv';
    if (city && sub) {
        return `${slugify(city)}_${slugify(sub)}_${slugify(country)}.ndjson`;
    }
    if (city) {
        return `${slugify(city)}_${slugify(country)}.ndjson`;
    }
    return null; // disregard
}

async function hashAndRenameImports() {
    await fsp.mkdir(IMPORTS_DIR, { recursive: true });
    const entries = await fsp.readdir(IMPORTS_DIR);
    const results = [];
    for (const name of entries) {
        if (!name.toLowerCase().endsWith('.geojson')) continue;
        const full = path.join(IMPORTS_DIR, name);
        const stat = await fsp.stat(full);
        if (!stat.isFile()) continue;

        // Already hashed & locked? Pattern: _<6hex>.geojson
        if (/^_[0-9a-f]{6}\.geojson$/i.test(name)) {
            results.push(full);
            continue;
        }
        // Backward compatibility: previously hashed without underscore -> rename to underscored
        if (/^[0-9a-f]{6}\.geojson$/i.test(name)) {
            const target = path.join(IMPORTS_DIR, '_' + name);
            if (!fs.existsSync(target)) await fsp.rename(full, target); else if (full !== target) await fsp.unlink(full);
            results.push(target);
            continue;
        }
        const text = await fsp.readFile(full, 'utf8');
        const h = shake256(text);
        const target = path.join(IMPORTS_DIR, `_${h}.geojson`);
        if (path.basename(full) !== `_${h}.geojson`) {
            if (!fs.existsSync(target)) {
                await fsp.rename(full, target);
                console.log(`Renamed ${name} -> _${h}.geojson`);
            } else {
                console.log(`Duplicate content ${name} matches existing _${h}.geojson, removing duplicate file.`);
                if (full !== target) await fsp.unlink(full);
            }
        }
        results.push(target);
    }
    return results;
}

// --- API helpers ---
function encodeSearchQuery(address) {
    // Lowercase, collapse multiple spaces, trim, encode spaces as %20 via encodeURIComponent
    const norm = address
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    return encodeURIComponent(norm);
}

async function fetchAddressKey(address) {
    const q = encodeSearchQuery(address);
    const url = `https://gateway.tet.lv/api/addresses/search/${q}`;
    const { data } = await axios.get(url, { timeout: 20000 });
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('no search hits');
    }
    return data.data[0].addressKey; // first hit most likely
}

async function fetchAvailableServices(addressKey) {
    const url = `https://gateway.tet.lv/api/sac/available-services?addressKey=${addressKey}`;
    const { data } = await axios.get(url, { timeout: 25000 });
    return data; // raw object (matches example.json style)
}

function extractInternetOffers(raw) {
    if (!raw || !raw.data || !Array.isArray(raw.data.structure)) return [];
    const offers = [];
    // Only use the object with key === 'internet'
    const internetGroup = raw.data.structure.find(g => g && g.key === 'internet' || g.key === 'mobile_internet');
    if (!internetGroup) return offers; // nothing to process
    const mapConnectionType = (tech, subgroupKey) => {
        if (tech === 'GPON') return 'Fiber (Optikas)';
        if (/vdsl|dsl|adsl/i.test(tech || '')) return 'DSL/VDSL';
        if (!tech) {
            // Null technology => treat as mobile (spec) optionally verify subgroup key
            if (subgroupKey && subgroupKey.includes('mobile')) return 'Mobile (4G/5G)';
            return 'Mobile (4G/5G)';
        }
        return 'DSL/VDSL'; // fallback (most remaining fixed-line non-GPON assumed DSL/VDSL)
    };

    if (Array.isArray(internetGroup.subgroups)) {
        for (const sg of internetGroup.subgroups) {
            if (!sg || !Array.isArray(sg.products)) continue;
            const subgroupKey = sg.key || '';
            for (const p of sg.products) {
                if (!p || typeof p !== 'object') continue;

                // Determine connection type as per spec using technology / subgroup
                const technology = p.technology || null; // may be null for mobile
                const connectionType = mapConnectionType(technology, subgroupKey);

                // Build speed object if available
                let speed = null;
                const ts = p.technologySpeed;
                if (ts && typeof ts === 'object') {
                    if (ts.min != null && ts.max != null) {
                        speed = { minMbit: Number(ts.min), maxMbit: Number(ts.max) };
                    } else if (ts.max != null) {
                        speed = { upToMbit: Number(ts.max) };
                    }
                }

                // Extract contract terms: pick one regular (promotionCode null) & one promo (promotionCode not null)
                const contractTerms = Array.isArray(p.contractTerms) ? p.contractTerms : [];
                const regularTerm = contractTerms.find(ct => !ct.promotionCode) || null;
                const promoTerm = contractTerms.find(ct => ct.promotionCode) || null;

                const baseOfferFields = () => ({
                    connectionType,
                    originalTitle: p.name?.lv || p.productCode || connectionType,
                    speed,
                    features: p.benefits && p.benefits.lv ? p.benefits.lv.split(/\r?\n/).filter(Boolean) : null,
                    techInfo: ts?.description?.lv || technology || null,
                });

                function buildTermsArray(termObj) {
                    const arr = [];
                    if (!termObj) return arr;
                    if (termObj.contractTerm > 0) arr.push(`Līgums uz ${termObj.contractTerm} mēnešiem`);
                    if (termObj.priceDescription?.lv) arr.push(termObj.priceDescription.lv);
                    if (termObj.description) arr.push(termObj.description);
                    return arr.length ? arr : null;
                }

                if (regularTerm) {
                    offers.push({
                        ...baseOfferFields(),
                        pricePerMonthEur: typeof regularTerm.amount === 'number' ? regularTerm.amount : null,
                        currency: typeof regularTerm.amount === 'number' ? 'EUR' : null,
                        terms: buildTermsArray(regularTerm),
                        promotion: false,
                        contractTermMonths: regularTerm.contractTerm || regularTerm.term || 0,
                        promotionCode: null
                    });
                }
                if (promoTerm) {
                    offers.push({
                        ...baseOfferFields(),
                        pricePerMonthEur: typeof promoTerm.amount === 'number' ? promoTerm.amount : null,
                        currency: typeof promoTerm.amount === 'number' ? 'EUR' : null,
                        terms: buildTermsArray(promoTerm),
                        promotion: true,
                        contractTermMonths: promoTerm.contractTerm || promoTerm.term || 0,
                        promotionCode: promoTerm.promotionCode || null
                    });
                }
            }
        }
    }
    return offers;
}

async function processFeatureInContext(feat, index, total, ctx) {
    const id = feat.id || feat.properties?.['@id'] || `idx_${index}`;
    if (ctx.progressSet.has(id) || ctx.errorSet.has(id)) return null; // already processed (success or failed)
    const props = feat.properties || {};
    const addrProps = pickAddrProps(props);
    const exportFileName = buildExportFileName(addrProps);
    if (!exportFileName) {
        // Disregarded silently (no city criteria) – do not mark progress per user spec
        return null;
    }
    if (!addrProps['addr:street'] || !addrProps['addr:housenumber']) {
        // Address incomplete -> treat as error & persist
        ctx.errorSet.add(id);
        ctx.geojson.errors.push(id);
        await persistGeoJSON(ctx.filePath, ctx.geojson);
        return null;
    }
    const address = buildAddressString(props);
    console.log(`[${index + 1}/${total}] (${path.basename(ctx.filePath)}) ${address}`);
    try {
        const addressKey = await fetchAddressKey(address);
        const rawServices = await fetchAvailableServices(addressKey);
        const internetOffers = extractInternetOffers(rawServices);
        const record = {
            id,
            address,
            properties: addrProps,
            geometry: feat.geometry || null,
            offers: internetOffers,
            scrapedAt: new Date().toISOString(),
            source: 'api',
        };
        const outPath = path.join(EXPORTS_DIR, exportFileName);
        await appendLine(outPath, record);
        // Serialize write to prevent race when batching
        await ctx.withLock(async () => {
            ctx.progressSet.add(id);
            ctx.geojson.progress.push(id);
            await persistGeoJSON(ctx.filePath, ctx.geojson);
        });
        console.log(`  ✓ ${id} (${internetOffers.length} offers) -> ${exportFileName}`);
        return record;
    } catch (err) {
        console.warn(`  ✗ ${id} failed: ${err.message}`);
        await ctx.withLock(async () => {
            if (!ctx.errorSet.has(id)) {
                ctx.errorSet.add(id);
                ctx.geojson.errors.push(id);
            }
            await persistGeoJSON(ctx.filePath, ctx.geojson);
        });
        return null;
    }
}

// Recovery logic deprecated under new per-file progress embedding; placeholder retained
async function reprocessFeature(feat, ctx) {
    const id = feat.id || feat.properties?.['@id'];
    if (!id) return null;
    const props = feat.properties || {};
    const addrProps = pickAddrProps(props);
    const exportFileName = buildExportFileName(addrProps);
    if (!exportFileName) return null; // still disregard
    if (!addrProps['addr:street'] || !addrProps['addr:housenumber']) return null;
    const address = buildAddressString(props);
    try {
        const addressKey = await fetchAddressKey(address);
        const rawServices = await fetchAvailableServices(addressKey);
        const internetOffers = extractInternetOffers(rawServices);
        const record = { id, address, properties: addrProps, geometry: feat.geometry || null, offers: internetOffers, scrapedAt: new Date().toISOString(), source: 'api' };
        const outPath = path.join(EXPORTS_DIR, exportFileName);
        await appendLine(outPath, record);
        await ctx.withLock(async () => {
            if (!ctx.progressSet.has(id)) {
                ctx.progressSet.add(id);
                ctx.geojson.progress.push(id);
            }
            // remove from errors array/set
            if (ctx.errorSet.has(id)) {
                ctx.errorSet.delete(id);
                ctx.geojson.errors = ctx.geojson.errors.filter(eid => eid !== id);
            }
            await persistGeoJSON(ctx.filePath, ctx.geojson);
        });
        console.log(`  ↺ Recovery success ${id} (${internetOffers.length} offers)`);
        return record;
    } catch (err) {
        console.log(`  ↺ Recovery failed ${id}: ${err.message}`);
        await ctx.withLock(async () => {
            if (!ctx.errorSet.has(id)) {
                ctx.errorSet.add(id);
                ctx.geojson.errors.push(id);
            }
            await persistGeoJSON(ctx.filePath, ctx.geojson);
        });
        return null;
    }
}

async function recoveryPass(ctx, features, batchSize) {
    const errorIds = ctx.geojson.errors.filter(id => !ctx.progressSet.has(id));
    if (!errorIds.length) {
        console.log('No errors to recover.');
        return;
    }
    console.log(`Starting recovery pass for ${errorIds.length} error IDs (batch ${batchSize})…`);
    const featureById = new Map();
    for (const f of features) {
        const fid = f.id || f.properties?.['@id'];
        if (fid) featureById.set(fid, f);
    }
    for (let i = 0; i < errorIds.length; ) {
        const slice = errorIds.slice(i, i + batchSize);
        const tasks = slice.map(id => {
            const feat = featureById.get(id);
            if (!feat) return Promise.resolve(null);
            return reprocessFeature(feat, ctx);
        });
        await Promise.all(tasks);
        i += batchSize;
    }
    console.log('Recovery pass finished.');
}

function isValidateMode() { return process.argv.includes('--validate'); }

async function run() {
    console.log('Preparing import GeoJSON files (hash + rename)…');
    const files = await hashAndRenameImports();
    if (!files.length) { console.log('No .geojson files found in imports directory. Nothing to do.'); return; }
    await fsp.mkdir(EXPORTS_DIR, { recursive: true });
    const batchSize = getBatchSize();
    console.log(`Using batch size: ${batchSize}`);

    let anyErrorsRemaining = false;

    for (const filePath of files) {
        console.log(`\n=== Processing source ${path.basename(filePath)} ===`);
        const geojson = await readAndPrepareGeoJSON(filePath);
        const ctx = {
            filePath,
            geojson,
            progressSet: new Set(geojson.progress),
            errorSet: new Set(geojson.errors),
            // simple promise-based mutex
            _lock: Promise.resolve(),
            withLock(fn){ this._lock = this._lock.then(fn, fn); return this._lock; }
        };
        const features = geojson.features;
        console.log(`Features: ${features.length}. Done: ${ctx.progressSet.size}. Errors: ${ctx.errorSet.size}.`);

        // Determine starting index: after last successful id in progress array
        let startIndex = 0;
        if (geojson.progress.length) {
            const lastId = geojson.progress[geojson.progress.length - 1];
            const idx = features.findIndex(f => (f.id || f.properties?.['@id']) === lastId);
            if (idx >= 0) startIndex = idx + 1;
        }
        if (startIndex >= features.length) {
            console.log('All features already processed (by success). Skipping to recovery.');
        }

        if (!isValidateMode()) {
            for (let i = startIndex; i < features.length; ) {
                // Build one batch of up to batchSize unprocessed features
                const batch = [];
                let collected = 0;
                while (i < features.length && collected < batchSize) {
                    const feat = features[i];
                    const id = feat.id || feat.properties?.['@id'] || `idx_${i}`;
                    i++;
                    if (ctx.progressSet.has(id) || ctx.errorSet.has(id)) continue; // skip processed
                    batch.push(processFeatureInContext(feat, i-1, features.length, ctx));
                    collected++;
                }
                if (batch.length) await Promise.all(batch);
                if (!batch.length && i >= features.length) break; // nothing more
            }
        } else {
            console.log('Validate mode: skipping main scrape, running recovery only.');
        }

        // Recovery pass (attempt previously failed IDs)
        await recoveryPass(ctx, features, batchSize);
        if (ctx.geojson.errors.length) anyErrorsRemaining = true;
        console.log(`Completed ${path.basename(filePath)}. Progress stored inside file.`);
    }
    console.log('\nAll import files processed. Outputs located in ./exports');

    if (!anyErrorsRemaining) {
        console.log('No errors remain. Building pointer.json index…');
        await buildPointerIndex();
        console.log('pointer.json written.');
    } else {
        console.log('Errors remain; skipping pointer.json generation.');
    }
}

if (require.main === module) {
    run().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
}

module.exports = { run };

// ---- Pointer index generation ----

async function buildPointerIndex() {
    const pointerPath = path.join(EXPORTS_DIR, 'pointer.json');
    const entries = await fsp.readdir(EXPORTS_DIR);
    const ndjsonFiles = entries.filter(f => f.toLowerCase().endsWith('.ndjson'));
    const index = [];
    for (const name of ndjsonFiles) {
        const full = path.join(EXPORTS_DIR, name);
        const stats = await computeFileStats(full, name);
        if (stats) index.push(stats);
    }
    index.sort((a,b)=>a.name.localeCompare(b.name));
    await fsp.writeFile(pointerPath, JSON.stringify(index, null, 2), 'utf8');
}

function collectCoords(geometry, collector) {
    if (!geometry) return;
    const type = geometry.type;
    const coords = geometry.coordinates;
    if (!type) return;
    switch (type) {
        case 'Point':
            if (Array.isArray(coords) && coords.length >= 2) collector(coords);
            break;
        case 'MultiPoint':
        case 'LineString':
            if (Array.isArray(coords)) coords.forEach(c => Array.isArray(c) && collector(c));
            break;
        case 'MultiLineString':
        case 'Polygon':
            if (Array.isArray(coords)) coords.forEach(r => Array.isArray(r) && r.forEach(c => Array.isArray(c) && collector(c)));
            break;
        case 'MultiPolygon':
            if (Array.isArray(coords)) coords.forEach(p => Array.isArray(p) && p.forEach(r => Array.isArray(r) && r.forEach(c => Array.isArray(c) && collector(c))));
            break;
        case 'GeometryCollection':
            if (Array.isArray(geometry.geometries)) geometry.geometries.forEach(g => collectCoords(g, collector));
            break;
    }
}

async function computeFileStats(fullPath, name) {
    return new Promise((resolve, reject) => {
        let count = 0;
        let north = null, south = null, east = null, west = null; // store {coord:[lon,lat], lat, lon}
        const lineReader = require('readline').createInterface({
            input: fs.createReadStream(fullPath, { encoding: 'utf8' }),
            crlfDelay: Infinity
        });
        lineReader.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            try {
                const obj = JSON.parse(trimmed);
                if (!obj || !Array.isArray(obj.offers) || obj.offers.length === 0) return;
                count++;
                collectCoords(obj.geometry, (c) => {
                    const lon = c[0];
                    const lat = c[1];
                    if (typeof lon !== 'number' || typeof lat !== 'number') return;
                    if (!north || lat > north.lat) north = { coord: [lon, lat], lat, lon };
                    if (!south || lat < south.lat) south = { coord: [lon, lat], lat, lon };
                    if (!east  || lon > east.lon)  east  = { coord: [lon, lat], lat, lon };
                    if (!west  || lon < west.lon)  west  = { coord: [lon, lat], lat, lon };
                });
            } catch { /* ignore malformed */ }
        });
        lineReader.on('close', () => {
            if (count === 0) return resolve({ name, path: name, count: 0, furthestPoints: [] });
            const pointsArr = [];
            if (north) pointsArr.push({ direction: 'north', coord: north.coord });
            if (south) pointsArr.push({ direction: 'south', coord: south.coord });
            if (east)  pointsArr.push({ direction: 'east',  coord: east.coord });
            if (west)  pointsArr.push({ direction: 'west',  coord: west.coord });
            resolve({ name, path: name, count, furthestPoints: pointsArr });
        });
        lineReader.on('error', reject);
    });
}
