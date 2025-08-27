/**
 * Tet availability API scraper (non-browser)
 * Flow per feature (from export.geojson):
 *  1. Build address string (same formatting as Puppeteer version)
 *  2. Query search endpoint: https://gateway.tet.lv/api/addresses/search/<query>
 *     - <query> is lowercased transliterated address with spaces encoded as %20
 *     - Take first hit -> addressKey
 *  3. Query offers endpoint: https://gateway.tet.lv/api/sac/available-services?addressKey=<key>
 *  4. Extract ONLY internet offer objects (those containing speed / technology)
 *  5. Write incremental NDJSON record (same shape as Puppeteer output)
 *  6. On any failure record error entry and continue
 * Supports batching (concurrency) via BATCH_SIZE env or CLI flag.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const axios = require('axios');

const INPUT_GEOJSON = path.resolve(__dirname, 'export.geojson');
const OUTPUT_NDJSON = path.resolve(__dirname, 'tet_offers.ndjson');
const ERRORS_NDJSON = path.resolve(__dirname, 'tet_errors.ndjson');
const PROGRESS_JSON = path.resolve(__dirname, 'progress.json');

const DEFAULT_BATCH = 5; // default concurrent requests

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

async function readGeoJSON(file) {
    const content = await fsp.readFile(file, 'utf8');
    const data = JSON.parse(content);
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        throw new Error('Invalid GeoJSON: expected FeatureCollection with features');
    }
    return data.features;
}

async function ensureFiles() {
    for (const p of [OUTPUT_NDJSON, ERRORS_NDJSON]) {
        if (!fs.existsSync(p)) await fsp.writeFile(p, '', 'utf8');
    }
}

async function loadProgress() {
    try {
        const txt = await fsp.readFile(PROGRESS_JSON, 'utf8');
        return JSON.parse(txt);
    } catch (_) {
        return { doneIds: [] };
    }
}

async function saveProgress(doneIds) {
    await fsp.writeFile(PROGRESS_JSON, JSON.stringify({ doneIds, lastUpdated: new Date().toISOString() }, null, 2));
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

async function processFeature(feat, index, total, doneSet) {
    const id = feat.id || feat.properties?.['@id'] || `idx_${index}`;
    if (doneSet.has(id)) return null; // already processed
    const props = feat.properties || {};
    const addrProps = pickAddrProps(props);
    const address = buildAddressString(props);
    if (!addrProps['addr:street'] || !addrProps['addr:housenumber']) {
        // Skip silently (not an address with a housenumber => likely not a livable place per spec)
        doneSet.add(id);
        await saveProgress([...doneSet]);
        return null;
    }
    console.log(`[${index + 1}/${total}] Address: ${address}`);
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
        await appendLine(OUTPUT_NDJSON, record);
        doneSet.add(id);
        await saveProgress([...doneSet]);
        console.log(`  ✓ ${id} (${internetOffers.length} offers)`);
        return record;
    } catch (err) {
        console.warn(`  ✗ ${id} failed: ${err.message}`);
        await appendLine(ERRORS_NDJSON, { id, address, error: err.message, when: new Date().toISOString() });
        doneSet.add(id);
        await saveProgress([...doneSet]);
        return null;
    }
}

// Variant that forces reprocessing even if ID already in progress
async function reprocessFeature(feat, doneSet) {
    const id = feat.id || feat.properties?.['@id'];
    if (!id) return null;
    const props = feat.properties || {};
    const addrProps = pickAddrProps(props);
    const address = buildAddressString(props);
    if (!addrProps['addr:street'] || !addrProps['addr:housenumber']) return null;
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
        await appendLine(OUTPUT_NDJSON, record);
        doneSet.add(id);
        await saveProgress([...doneSet]);
        console.log(`  ↺ Recovery success ${id} (${internetOffers.length} offers)`);
        return record;
    } catch (err) {
        console.log(`  ↺ Recovery failed ${id}: ${err.message}`);
        return null;
    }
}

async function loadErrorRecords() {
    if (!fs.existsSync(ERRORS_NDJSON)) return [];
    const txt = await fsp.readFile(ERRORS_NDJSON, 'utf8');
    return txt.split('\n').filter(l => l.trim()).map(l => {
        try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
}

async function recoveryPass(features, doneSet, batchSize = 1) {
    // Batch-mode recovery: take first N error IDs (batchSize), attempt all concurrently,
    // then remove successes from error file, rewrite file, and continue with next batch.
    // This provides concurrency while still persisting progress after each batch.
    let errors = await loadErrorRecords();
    if (errors.length === 0) {
        console.log('No error records to recover.');
        return;
    }
    console.log(`Starting recovery pass for ${errors.length} error records (batch mode, batchSize=${batchSize})...`);

    const featureById = new Map();
    for (const f of features) {
        const fid = f.id || f.properties?.['@id'];
        if (fid) featureById.set(fid, f);
    }

    async function rewrite() {
        if (errors.length === 0) {
            if (fs.existsSync(ERRORS_NDJSON)) await fsp.unlink(ERRORS_NDJSON);
        } else {
            const content = errors.map(o => JSON.stringify(o)).join('\n') + '\n';
            await fsp.writeFile(ERRORS_NDJSON, content, 'utf8');
        }
    }

    let recovered = 0;
    let batchIndex = 0;
    while (errors.length > 0) {
        const slice = errors.slice(0, batchSize);
        console.log(`  • Recovering batch ${++batchIndex} (${slice.length} ids, remaining before batch: ${errors.length})`);
        const results = await Promise.all(slice.map(async (errRec) => {
            const fid = errRec.id;
            if (!fid) return { fid, ok: false };
            const feat = featureById.get(fid);
            if (!feat) return { fid, ok: false }; // can't map back
            const res = await reprocessFeature(feat, doneSet);
            return { fid, ok: !!res };
        }));
        // Remove successes from errors array (which currently holds original order).
        const successSet = new Set(results.filter(r => r.ok).map(r => r.fid));
        if (successSet.size > 0) {
            errors = errors.filter(e => !successSet.has(e.id));
            recovered += successSet.size;
            await rewrite();
        }
        const failedInBatch = results.filter(r => !r.ok).length - (slice.length - successSet.size - results.filter(r => !r.fid).length);
        console.log(`    Batch result: recovered ${successSet.size}, still failing (this batch) ${slice.length - successSet.size}. Remaining total: ${errors.length}`);
        if (slice.length === 0) break; // safety
    }

    if (errors.length === 0) {
        console.log(`Recovery complete. Recovered all (${recovered}) errors. Error file removed.`);
    } else {
        console.log(`Recovery complete. Recovered: ${recovered}. Remaining errors: ${errors.length}.`);
    }
}

function isValidateMode() {
    return process.argv.includes('--validate');
}

async function run() {
    const batchSize = getBatchSize();
    console.log(`Using batch size: ${batchSize}`);
    console.log('Reading GeoJSON…');
    const features = await readGeoJSON(INPUT_GEOJSON);
    const progress = await loadProgress();
    const doneSet = new Set(progress.doneIds || []);
    await ensureFiles();
    console.log(`Total features: ${features.length}. Already done: ${doneSet.size}.`);

    if (isValidateMode()) {
        console.log('Validate mode: only reprocessing previously failed addresses.');
        await recoveryPass(features, doneSet, batchSize);
        return;
    }

    for (let i = 0; i < features.length; i += batchSize) {
        const slice = features.slice(i, i + batchSize);
        await Promise.all(slice.map((feat, idx) => processFeature(feat, i + idx, features.length, doneSet)));
    }

    console.log('API scraping completed. Results in tet_offers.ndjson');
    // Post-run recovery attempt
    await recoveryPass(features, doneSet, batchSize);
}

if (require.main === module) {
    run().catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
}

module.exports = { run };
