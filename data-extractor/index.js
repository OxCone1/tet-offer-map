/**
 * Tet availability scraper
 * - Reads features from export.geojson
 * - Builds address strings
 * - Uses Puppeteer to search availability on https://www.tet.lv/pieejamiba
 * - Handles nested shadow DOM for input and autocomplete
 * - Extracts connection type, speed, price, and terms
 * - Writes results incrementally as NDJSON, preserving geometry and key props
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');

const INPUT_GEOJSON = path.resolve(__dirname, 'export.geojson');
const OUTPUT_NDJSON = path.resolve(__dirname, 'tet_offers.ndjson');
const ERRORS_NDJSON = path.resolve(__dirname, 'tet_errors.ndjson');
const PROGRESS_JSON = path.resolve(__dirname, 'progress.json');

// Small helper: safe append line to file
async function appendLine(filePath, obj) {
  const line = JSON.stringify(obj, null, 0) + '\n';
  await fsp.appendFile(filePath, line, { encoding: 'utf8' });
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
  // Example format: "Laipu iela 2, Bukulti, Garkalnes pag., Ropažu nov."
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

// Deep traversal utilities executed in page context
const deepFindInputFn = () => {
  function dfs(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (
        node.tagName === 'INPUT' &&
        node.getAttribute('type') === 'text' &&
        /Piemēram/i.test(node.getAttribute('placeholder') || '')
      ) {
        return node;
      }
      if (node.shadowRoot) {
        const found = dfs(node.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }
  return dfs(document);
};

// Find autocomplete LI using shadow DOM piercing
const findAutocompleteLiFn = (fullAddress) => {
  try {
    const host = document.querySelector('#availability-check > tet-address-offers-view');
    if (!host || !host.shadowRoot) {
      console.log('Host not found or no shadowRoot');
      return null;
    }

    const searchBlock = host.shadowRoot.querySelector('section > div.search-block > tet-address-search');
    if (!searchBlock || !searchBlock.shadowRoot) {
      console.log('Search block not found or no shadowRoot');
      return null;
    }

    const autocomplete = searchBlock.shadowRoot.querySelector('tet-autocomplete');
    if (!autocomplete || !autocomplete.shadowRoot) {
      console.log('Autocomplete not found or no shadowRoot');
      return null;
    }

    const items = autocomplete.shadowRoot.querySelectorAll('li.autocomplete-options-item[role="option"]');
    console.log('Found', items.length, 'autocomplete items');

    if (!items || items.length === 0) return null;

    // Return first item that contains the address, or just the first item
    const target = Array.from(items).find((li) => {
      const text = (li.textContent || '').trim();
      return text.includes((fullAddress || '').trim());
    });
    const result = target || items[0];
    console.log('Selected item:', result ? result.textContent.trim() : 'none');
    return result;
  } catch (e) {
    console.warn('Error finding autocomplete:', e);
    return null;
  }
};

const deepFindOffersContainerFn = () => {
  function dfs(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    let node;
    while ((node = walker.nextNode())) {
      const txt = (node.textContent || '').toLowerCase();
      if (
        txt.includes('tet internets') ||
        txt.includes('optikas internets') ||
        txt.includes('mobilais internets') ||
        txt.includes('mēn.') ||
        txt.includes('mbit/s')
      ) {
        return node;
      }
      if (node.shadowRoot) {
        const found = dfs(node.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }
  return dfs(document);
};

const extractOffersFn = () => {
  const offers = [];

  try {
    // Navigate to offer cards using shadow DOM path
    const host = document.querySelector('#availability-check > tet-address-offers-view');
    if (!host || !host.shadowRoot) {
      console.log('Debug: Host element not found or no shadowRoot');
      return offers;
    }

    const offersSection = host.shadowRoot.querySelector('section.body > tet-address-offers');
    if (!offersSection || !offersSection.shadowRoot) {
      console.log('Debug: Offers section not found or no shadowRoot');
      return offers;
    }

    // Target only the "Internets" section, not bundles or TV
    const internetSection = Array.from(offersSection.shadowRoot.querySelectorAll('section.category')).find(section => {
      const h2 = section.querySelector('h2.category-title');
      return h2 && h2.textContent.trim() === 'Internets';
    });

    if (!internetSection) {
      console.log('Debug: No Internets section found. Available sections:', 
        Array.from(offersSection.shadowRoot.querySelectorAll('section.category h2.category-title'))
          .map(h2 => h2.textContent.trim())
      );
      return offers;
    }

    // Find all compare cards only within the Internets section
    const compareCards = internetSection.querySelectorAll('tet-compare-card');
    console.log('Debug: Found', compareCards.length, 'compare cards in Internets section');

    for (const card of compareCards) {
      if (!card.shadowRoot) {
        console.log('Debug: Card missing shadowRoot');
        continue;
      }

      const cardDiv = card.shadowRoot.querySelector('div');
      if (!cardDiv) {
        console.log('Debug: Card missing div element');
        continue;
      }

      try {
        // Extract title (connection type)
        const mainTitle = cardDiv.querySelector('.main-title');
        const connectionType = mainTitle ? mainTitle.textContent.trim() : 'Unknown';
        console.log('Debug: Found connection type:', connectionType);

        // Skip non-internet offers (TV, phone, etc.) - only keep internet offers
        const isInternetOffer = connectionType.toLowerCase().includes('internets') || 
                               connectionType.toLowerCase().includes('mobilais internets') ||
                               connectionType.toLowerCase().includes('optik');

        if (!isInternetOffer) {
          console.log('Debug: Skipping non-internet offer:', connectionType);
          continue;
        }

        // Extract speed from sub-title
        const subTitle = cardDiv.querySelector('.sub-title');
        const speedText = subTitle ? subTitle.textContent.trim() : '';
        console.log('Debug: Speed text:', speedText);

        let speed = null;
        const speedRangeMatch = speedText.match(/no\s*(\d+)\s*līdz\s*(\d+)\s*Mbit\/?s/i);
        const speedSingleMatch = speedText.match(/(\d{2,5})\s*Mbit\/?s/i);

        if (speedRangeMatch) {
          speed = { minMbit: Number(speedRangeMatch[1]), maxMbit: Number(speedRangeMatch[2]) };
        } else if (speedSingleMatch) {
          speed = { upToMbit: Number(speedSingleMatch[1]) };
        }

        // Classify connection type more specifically
        let techType = 'Unknown';
        const cardText = cardDiv.textContent.toLowerCase();
        if (cardText.includes('optikas') || cardText.includes('optisk')) {
          techType = 'Fiber (Optikas)';
        } else if (cardText.includes('mobilais') || cardText.includes('4g') || cardText.includes('5g')) {
          techType = 'Mobile (4G/5G)';
        } else if (cardText.includes('vdsl') || cardText.includes('dsl') || cardText.includes('vara kabeļ')) {
          techType = 'DSL/VDSL';
        } else if (connectionType.toLowerCase().includes('tet internets')) {
          techType = 'DSL/VDSL'; // Default Tet internets is usually DSL
        }

        // Extract price
        const priceElement = cardDiv.querySelector('.new-price');
        const currencyElement = cardDiv.querySelector('.currency span');
        let pricePerMonthEur = null;
        let currency = null;

        console.log('Debug: Price element found:', !!priceElement);
        console.log('Debug: Currency element found:', !!currencyElement);

        if (priceElement && currencyElement) {
          const priceText = priceElement.textContent.trim();
          const currencyText = currencyElement.textContent.trim();
          console.log('Debug: Price text:', priceText, 'Currency text:', currencyText);

          // Parse price like "9,00" -> 9.00 or "17,50" -> 17.50
          const priceMatch = priceText.match(/(\d+)[,.](\d{2})/);
          if (priceMatch && currencyText.includes('€')) {
            pricePerMonthEur = Number(priceMatch[1] + '.' + priceMatch[2]);
            currency = 'EUR';
          }
        } else {
          // Try alternative selectors for price
          const altPriceElements = cardDiv.querySelectorAll('[class*="price"], [class*="cost"]');
          const altCurrencyElements = cardDiv.querySelectorAll('[class*="currency"], [class*="euro"]');
          console.log('Debug: Alternative price elements found:', altPriceElements.length);
          console.log('Debug: Alternative currency elements found:', altCurrencyElements.length);
        }

        // Extract terms from helper section
        const terms = [];
        const termElements = cardDiv.querySelectorAll('.helper .term, .helper .term-text, [class*="term"]');
        termElements.forEach(el => {
          const text = el.textContent.trim();
          if (text) terms.push(text);
        });

        // Extract bullet points/features
        const features = [];
        const bulletPoints = cardDiv.querySelectorAll('.bullet-point div, [class*="bullet"] div, [class*="feature"] div');
        bulletPoints.forEach(el => {
          const text = el.textContent.trim();
          if (text) features.push(text);
        });

        // Extract tooltip info if available
        let techInfo = null;
        const tooltip = cardDiv.querySelector('tet-tooltip');
        if (tooltip) {
          const tooltipText = tooltip.textContent.trim();
          if (tooltipText) techInfo = tooltipText;
        }

        const offer = {
          connectionType: techType,
          originalTitle: connectionType,
          speed,
          pricePerMonthEur,
          currency,
          terms: terms.length ? terms : null,
          features: features.length ? features : null,
          techInfo,
        };

        console.log('Debug: Extracted offer:', JSON.stringify(offer, null, 2));

        // Only add if we have meaningful data (more lenient check)
        if (offer.connectionType !== 'Unknown' || offer.speed || offer.pricePerMonthEur || offer.features?.length > 0) {
          offers.push(offer);
        }
      } catch (cardError) {
        console.warn('Error parsing card:', cardError);
      }
    }

    console.log('Debug: Total offers extracted:', offers.length);
  } catch (e) {
    console.warn('Error extracting offers:', e);

    // Fallback to text-based extraction - focus only on internet offers
    const bodyText = document.body.innerText || '';
    const normalize = (s) => (s || '').replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').trim();
    const blocks = bodyText.split(/\n{2,}/).map((b) => normalize(b)).filter((b) => b);

    const priceRegex = /(?:(\d{1,3}(?:[ .]\d{3})*|\d+)[,.](\d{2}))\s*€\s*\/\s*mēn\./i;
    const speedRangeRegex = /no\s*(\d+)\s*līdz\s*(\d+)\s*Mbit\/?s/i;
    const speedSingleRegex = /(\d{2,5})\s*Mbit\/?s/i;

    function inferType(text) {
      const t = text.toLowerCase();
      if (t.includes('optikas') || t.includes('optisk')) return 'Fiber (Optikas)';
      if (t.includes('mobilais') || t.includes('4g') || t.includes('5g')) return 'Mobile (4G/5G)';
      if (t.includes('vdsl') || t.includes('dsl') || t.includes('vara kabeļ')) return 'DSL/VDSL';
      if (t.includes('tet internets')) return 'DSL/VDSL';
      return null; // Skip unknown types
    }

    for (const block of blocks) {
      // Only process blocks that contain internet-related content and exclude TV/phone
      if (!/(internets|Mbit\/s|€\/mēn\.)/i.test(block)) continue;
      if (/televīzija|tv|telefon/i.test(block) && !/internets/i.test(block)) continue;

      const type = inferType(block);
      if (!type) continue; // Skip non-internet offers

      const priceMatch = block.match(priceRegex);
      const rangeMatch = block.match(speedRangeRegex);
      const singleMatch = rangeMatch ? null : block.match(speedSingleRegex);
      const terms = [];
      const termRe = /(Līgums uz .*?mēnešiem\.?|Akcijas cena.*?\.)/gi;
      let m;
      while ((m = termRe.exec(block))) terms.push(m[1]);

      const offer = {
        connectionType: type,
        speed: rangeMatch
          ? { minMbit: Number(rangeMatch[1]), maxMbit: Number(rangeMatch[2]) }
          : singleMatch
            ? { upToMbit: Number(singleMatch[1]) }
            : null,
        pricePerMonthEur: priceMatch
          ? Number(priceMatch[1].replace(/[ .]/g, '').replace(',', '.'))
          : null,
        currency: priceMatch ? 'EUR' : null,
        terms: terms.length ? terms : null,
        blockPreview: block.slice(0, 500),
      };

      if (offer.speed || offer.pricePerMonthEur) {
        offers.push(offer);
      }
    }
  }

  return offers;
};

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
  await fsp.writeFile(PROGRESS_JSON, JSON.stringify({ doneIds }, null, 2), 'utf8');
}

async function run() {
  console.log('Reading GeoJSON…');
  const features = await readGeoJSON(INPUT_GEOJSON);
  const progress = await loadProgress();
  const done = new Set(progress.doneIds || []);

  console.log(`Total features: ${features.length}. Already done: ${done.size}.`);
  await ensureFiles();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(45000);

  // Soft throttling between items to avoid rate limits
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  try {
    // Navigate once; SPA will handle searches
    console.log('Opening Tet availability page…');
    await page.goto('https://www.tet.lv/pieejamiba', { waitUntil: 'domcontentloaded' });

    // Try to accept cookies/consent if a banner blocks interactions (best-effort)
    try {
      await page.evaluate(() => {
        const labels = ['Piekrist', 'Piekrītu', 'Accept', 'I agree', 'Apstiprināt'];
        function isVisible(el) {
          const s = el && getComputedStyle(el);
          const r = el && el.getBoundingClientRect();
          return !!(el && s && r && s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0 && r.width > 0);
        }
        function walk(root) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
          let node;
          while ((node = walker.nextNode())) {
            if (node.shadowRoot) {
              const b = walk(node.shadowRoot);
              if (b) return b;
            }
            if ((node.tagName === 'BUTTON' || node.tagName === 'A') && isVisible(node)) {
              const t = (node.innerText || node.textContent || '').trim();
              if (labels.some((x) => t.includes(x))) return node;
            }
          }
          return null;
        }
        const btn = walk(document);
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);
    } catch { }

    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      const id = feat.id || (feat.properties && feat.properties['@id']) || `idx_${i}`;
      if (done.has(id)) continue; // resume support

      const props = feat.properties || {};
      const addrProps = pickAddrProps(props);
      const address = buildAddressString(props);

      if (!addrProps['addr:street'] || !addrProps['addr:housenumber']) {
        await appendLine(ERRORS_NDJSON, {
          id,
          reason: 'missing street or housenumber',
          properties: addrProps,
        });
        done.add(id);
        await saveProgress([...done]);
        continue;
      }

      console.log(`[${i + 1}/${features.length}] Searching: ${address}`);
      try {
        // Find and focus input inside nested shadow DOM
        const inputHandle = await page.waitForFunction(deepFindInputFn, {
          polling: 'mutation',
          timeout: 30000,
        });
        const input = inputHandle.asElement();
        if (!input) throw new Error('Search input not found');

        // Clear and type
        await input.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await input.type(address, { delay: 5 });

        // Give time for autocomplete to appear
        await sleep(800);

        // Wait for autocomplete and click the specific list item
        const sugHandle = await page.waitForFunction(findAutocompleteLiFn, {
          polling: 'raf',
          timeout: 30000,
        }, address);
        const suggestion = sugHandle.asElement();
        if (!suggestion) throw new Error('Suggestion not found/visible');

        console.log('  Clicking autocomplete suggestion...');
        await suggestion.click();
        await sleep(300);

        // Click the Search button using correct shadow DOM path
        console.log('  Clicking search button...');
        const clickOk = await page.waitForFunction(() => {
          try {
            const host = document.querySelector('#availability-check > tet-address-offers-view');
            if (!host || !host.shadowRoot) return false;

            const btnHost = host.shadowRoot.querySelector('section.header.header--light.light > div.search-block > tet-button:nth-child(2)');
            if (!btnHost || !btnHost.shadowRoot) return false;

            const btn = btnHost.shadowRoot.querySelector('button');
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          } catch (e) {
            return false;
          }
        }, { polling: 'raf', timeout: 20000 });
        if (!clickOk) throw new Error('Search button not found');

        console.log('  Waiting for offers to load...');

        // Wait for offers to render (SPA; may not trigger navigation)
        await page.waitForFunction(deepFindOffersContainerFn, { polling: 'mutation', timeout: 45000 });
        
        // Wait specifically for offer cards to appear in the Internets section
        console.log('  Waiting for offer cards to populate...');
        await page.waitForFunction(() => {
          try {
            const host = document.querySelector('#availability-check > tet-address-offers-view');
            if (!host || !host.shadowRoot) return false;

            const offersSection = host.shadowRoot.querySelector('section.body > tet-address-offers');
            if (!offersSection || !offersSection.shadowRoot) return false;

            // Find the Internets section
            const internetSection = Array.from(offersSection.shadowRoot.querySelectorAll('section.category')).find(section => {
              const h2 = section.querySelector('h2.category-title');
              return h2 && h2.textContent.trim() === 'Internets';
            });

            if (!internetSection) return false;

            // Check if we have offer cards with actual data (price or speed)
            const compareCards = internetSection.querySelectorAll('tet-compare-card');
            if (compareCards.length === 0) return false;

            // Check if at least one card has meaningful content (price, speed, or connection type)
            for (const card of compareCards) {
              if (!card.shadowRoot) continue;
              const cardDiv = card.shadowRoot.querySelector('div');
              if (!cardDiv) continue;

              const hasPrice = cardDiv.querySelector('.new-price, .currency');
              const hasSpeed = cardDiv.textContent.includes('Mbit/s');
              const hasConnectionType = cardDiv.querySelector('.main-title');
              
              if (hasPrice || hasSpeed || hasConnectionType) {
                return true; // At least one card has loaded content
              }
            }
            return false;
          } catch (e) {
            return false;
          }
        }, { polling: 'raf', timeout: 30000 });

        // Give extra time for all content to fully populate
        await sleep(2000);

        // Extract offers
        const offers = await page.evaluate(extractOffersFn);

        // Filter to only include internet offers (DSL, Fiber, Mobile) - exclude TV and other services
        const internetOffers = offers.filter(offer => {
          const type = (offer.connectionType || '').toLowerCase();
          return type.includes('internets') || 
                 type.includes('optik') || 
                 type.includes('mobilais') ||
                 type.includes('dsl') ||
                 type.includes('vdsl') ||
                 type.includes('fiber') ||
                 type.includes('4g') ||
                 type.includes('5g');
        });

        const record = {
          id,
          address,
          properties: addrProps,
          geometry: feat.geometry || null,
          offers: internetOffers,
          scrapedAt: new Date().toISOString(),
          source: 'https://www.tet.lv/pieejamiba',
        };
        await appendLine(OUTPUT_NDJSON, record);
        done.add(id);

        // Save progress immediately after each successful scrape
        await saveProgress([...done]);

        // Small jittered delay between queries
        await sleep(500 + Math.floor(Math.random() * 800));
      } catch (err) {
        console.warn(`Failed for ${id}: ${err.message}`);
        await appendLine(ERRORS_NDJSON, {
          id,
          address,
          error: err.message,
          when: new Date().toISOString(),
        });
        // Persist failure and continue
        done.add(id);
        await saveProgress([...done]);
      }
    }
  } finally {
    await saveProgress([...done]);
    await browser.close();
  }

  console.log('Initial scraping completed. Results in tet_offers.ndjson');
  
  // Validate actual success and re-scrape false positives
  console.log('\n=== Validating actual success vs progress tracking ===');
  const falsePositiveIds = await validateActualSuccessInline();
  
  if (falsePositiveIds.length > 0) {
    console.log(`\nFound ${falsePositiveIds.length} false positives - re-scraping them now...`);
    await reScrapeSpecificIdsInline(falsePositiveIds);
  } else {
    console.log('\nAll marked IDs have valid offers - no re-scraping needed!');
  }
  
  console.log('\n=== All processing completed ===');
  console.log('Final results in tet_offers.ndjson');
}

/**
 * Validates actual success by checking if IDs marked as "done" in progress.json
 * actually have valid, non-empty offers in the output file.
 * Returns a list of IDs that need to be re-scraped.
 * (Inline version for use within main run function)
 */
async function validateActualSuccessInline() {
  try {
    // Read progress.json to get "successful" IDs
    let successfulIds = new Set();
    if (fs.existsSync(PROGRESS_JSON)) {
      const progressData = await fsp.readFile(PROGRESS_JSON, 'utf8');
      const progress = JSON.parse(progressData);
      successfulIds = new Set(progress.doneIds || progress.completedIds || []);
    }
    
    console.log(`Found ${successfulIds.size} IDs marked as successful in progress.json`);
    
    // Read all offers from output file to build a map of ID -> offers
    const validOffers = new Map();
    if (fs.existsSync(OUTPUT_NDJSON)) {
      const outputContent = await fsp.readFile(OUTPUT_NDJSON, 'utf8');
      const lines = outputContent.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (record.id && record.offers && Array.isArray(record.offers) && record.offers.length > 0) {
            validOffers.set(record.id, record.offers);
          }
        } catch (parseErr) {
          console.warn(`Failed to parse offer line: ${parseErr.message}`);
        }
      }
    }
    
    console.log(`Found ${validOffers.size} IDs with valid, non-empty offers in output file`);
    
    // Check each "successful" ID to see if it actually has valid offers
    const falsePositives = [];
    const actuallySuccessful = [];
    
    for (const id of successfulIds) {
      if (validOffers.has(id)) {
        actuallySuccessful.push(id);
      } else {
        falsePositives.push(id);
        console.log(`FALSE POSITIVE: ${id} marked as successful but has no valid offers`);
      }
    }
    
    console.log(`\nValidation Results:`);
    console.log(`Actually successful: ${actuallySuccessful.length}`);
    console.log(`False positives (need re-scraping): ${falsePositives.length}`);
    
    if (falsePositives.length > 0) {
      // Update progress.json to remove false positives
      const cleanedProgress = {
        doneIds: actuallySuccessful,
        lastUpdated: new Date().toISOString()
      };
      await fsp.writeFile(PROGRESS_JSON, JSON.stringify(cleanedProgress, null, 2));
      console.log(`Cleaned progress.json - removed ${falsePositives.length} false positives`);
    }
    
    return falsePositives;
    
  } catch (error) {
    console.error('Error during validation:', error);
    return [];
  }
}

/**
 * Re-scrapes a specific list of IDs that were identified as needing re-processing
 * (Inline version that reuses the main browser instance and page context)
 */
async function reScrapeSpecificIdsInline(idsToScrape) {
  if (!idsToScrape || idsToScrape.length === 0) {
    console.log('No specific IDs to re-scrape');
    return;
  }
  
  console.log(`Re-scraping ${idsToScrape.length} specific IDs...`);
  
  // Read the full GeoJSON to get features for these specific IDs
  const rawData = await fsp.readFile(INPUT_GEOJSON, 'utf8');
  const geojson = JSON.parse(rawData);
  
  // Filter to only the features we need to re-scrape
  const featuresToRescrape = geojson.features.filter(feat => 
    idsToScrape.includes(feat.properties?.['@id'])
  );
  
  console.log(`Found ${featuresToRescrape.length} features to re-scrape`);
  
  if (featuresToRescrape.length === 0) {
    console.log('No matching features found for the IDs to re-scrape');
    return;
  }
  
  // Load existing progress
  let done = new Set();
  if (fs.existsSync(PROGRESS_JSON)) {
    const progressData = await fsp.readFile(PROGRESS_JSON, 'utf8');
    const progress = JSON.parse(progressData);
    done = new Set(progress.doneIds || progress.completedIds || []);
  }
  
  // Launch new browser instance for re-scraping
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(45000);
    
    await page.goto('https://www.tet.lv/pieejamiba', { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    
    for (const feat of featuresToRescrape) {
      const id = feat.properties?.['@id'];
      if (!id) continue;
      
      console.log(`Re-scraping ${id}...`);
      
      const addrProps = pickAddrProps(feat.properties || {});
      const address = buildAddress(addrProps);
      
      if (!address) {
        console.log(`  Skipping ${id}: no valid address`);
        continue;
      }
      
      try {
        // Remove from done set so it gets processed
        done.delete(id);
        
        // Use the same scraping logic as main function
        await page.evaluate(deepFindInputFn);
        const inputEl = await page.waitForSelector('#address-input', { timeout: 10000 });
        await inputEl.click();
        await inputEl.evaluate(el => el.value = '');
        await inputEl.type(address, { delay: 50 });
        await sleep(1000);
        
        await page.evaluate(findAutocompleteLiFn, address);
        await page.waitForSelector('.offers-for-address-container', { timeout: 30000 });
        await sleep(2000);
        
        const allOffers = await page.evaluate(extractOffersFn);
        const internetOffers = allOffers.filter(offer => {
          const type = (offer.connectionType || '').toLowerCase();
          return type.includes('internets') || 
                 type.includes('optik') || 
                 type.includes('mobilais') ||
                 type.includes('dsl') ||
                 type.includes('vdsl') ||
                 type.includes('fiber') ||
                 type.includes('4g') ||
                 type.includes('5g');
        });
        
        const record = {
          id,
          address,
          properties: addrProps,
          geometry: feat.geometry || null,
          offers: internetOffers,
          scrapedAt: new Date().toISOString(),
          source: 'https://www.tet.lv/pieejamiba',
        };
        await appendLine(OUTPUT_NDJSON, record);
        done.add(id);
        await saveProgress([...done]);
        
        console.log(`  ✓ Successfully re-scraped ${id} - found ${internetOffers.length} internet offers`);
        await sleep(500 + Math.floor(Math.random() * 800));
        
      } catch (err) {
        console.warn(`  ✗ Failed to re-scrape ${id}: ${err.message}`);
        await appendLine(ERRORS_NDJSON, {
          id,
          address,
          error: err.message,
          when: new Date().toISOString(),
        });
        done.add(id);
        await saveProgress([...done]);
      }
    }
    
  } finally {
    await browser.close();
  }
  
  console.log(`Re-scraping completed`);
}

/**
 * Validates actual success by checking if IDs marked as "done" in progress.json
 * actually have valid, non-empty offers in the output file.
 * Returns a list of IDs that need to be re-scraped.
 */
async function validateActualSuccess() {
  console.log('=== Validating actual success vs progress tracking ===');
  
  try {
    // Read progress.json to get "successful" IDs
    let successfulIds = new Set();
    if (fs.existsSync(PROGRESS_JSON)) {
      const progressData = await fsp.readFile(PROGRESS_JSON, 'utf8');
      const progress = JSON.parse(progressData);
      successfulIds = new Set(progress.doneIds || progress.completedIds || []);
    }
    
    console.log(`Found ${successfulIds.size} IDs marked as successful in progress.json`);
    
    // Read all offers from output file to build a map of ID -> offers
    const validOffers = new Map();
    if (fs.existsSync(OUTPUT_NDJSON)) {
      const outputContent = await fsp.readFile(OUTPUT_NDJSON, 'utf8');
      const lines = outputContent.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (record.id && record.offers && Array.isArray(record.offers) && record.offers.length > 0) {
            validOffers.set(record.id, record.offers);
          }
        } catch (parseErr) {
          console.warn(`Failed to parse offer line: ${parseErr.message}`);
        }
      }
    }
    
    console.log(`Found ${validOffers.size} IDs with valid, non-empty offers in output file`);
    
    // Check each "successful" ID to see if it actually has valid offers
    const falsePositives = [];
    const actuallySuccessful = [];
    
    for (const id of successfulIds) {
      if (validOffers.has(id)) {
        actuallySuccessful.push(id);
      } else {
        falsePositives.push(id);
        console.log(`FALSE POSITIVE: ${id} marked as successful but has no valid offers`);
      }
    }
    
    console.log(`\n=== Validation Results ===`);
    console.log(`Actually successful: ${actuallySuccessful.length}`);
    console.log(`False positives (need re-scraping): ${falsePositives.length}`);
    
    if (falsePositives.length > 0) {
      console.log('\nFalse positive IDs:');
      falsePositives.forEach(id => console.log(`  - ${id}`));
      
      // Update progress.json to remove false positives
      const cleanedProgress = {
        doneIds: actuallySuccessful,
        lastUpdated: new Date().toISOString()
      };
      await fsp.writeFile(PROGRESS_JSON, JSON.stringify(cleanedProgress, null, 2));
      console.log(`\nCleaned progress.json - removed ${falsePositives.length} false positives`);
    }
    
    return falsePositives;
    
  } catch (error) {
    console.error('Error during validation:', error);
    return [];
  }
}

/**
 * Re-scrapes a specific list of IDs that were identified as needing re-processing
 */
async function reScrapeSpecificIds(idsToScrape) {
  if (!idsToScrape || idsToScrape.length === 0) {
    console.log('No specific IDs to re-scrape');
    return;
  }
  
  console.log(`\n=== Re-scraping ${idsToScrape.length} specific IDs ===`);
  
  // Read the full GeoJSON to get features for these specific IDs
  const rawData = await fsp.readFile(INPUT_GEOJSON, 'utf8');
  const geojson = JSON.parse(rawData);
  
  // Filter to only the features we need to re-scrape
  const featuresToRescrape = geojson.features.filter(feat => 
    idsToScrape.includes(feat.properties?.['@id'])
  );
  
  console.log(`Found ${featuresToRescrape.length} features to re-scrape`);
  
  if (featuresToRescrape.length === 0) {
    console.log('No matching features found for the IDs to re-scrape');
    return;
  }
  
  // Load existing progress
  let done = new Set();
  if (fs.existsSync(PROGRESS_JSON)) {
    const progressData = await fsp.readFile(PROGRESS_JSON, 'utf8');
    const progress = JSON.parse(progressData);
    done = new Set(progress.doneIds || progress.completedIds || []);
  }
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    const page = await browser.newPage();
    await page.goto('https://www.tet.lv/pieejamiba', { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    
    for (const feat of featuresToRescrape) {
      const id = feat.properties?.['@id'];
      if (!id) continue;
      
      console.log(`\nRe-scraping ${id}...`);
      
      const addrProps = pickAddrProps(feat.properties || {});
      const address = buildAddress(addrProps);
      
      if (!address) {
        console.log(`  Skipping ${id}: no valid address`);
        continue;
      }
      
      try {
        // Remove from done set so it gets processed
        done.delete(id);
        
        // Use the same scraping logic as main function
        await page.evaluate(deepFindInputFn);
        const inputEl = await page.waitForSelector('#address-input', { timeout: 10000 });
        await inputEl.click();
        await inputEl.evaluate(el => el.value = '');
        await inputEl.type(address, { delay: 50 });
        await sleep(1000);
        
        await page.evaluate(findAutocompleteLiFn, address);
        await page.waitForSelector('.offers-for-address-container', { timeout: 30000 });
        await sleep(2000);
        
        const allOffers = await page.evaluate(extractOffersFn);
        const internetOffers = allOffers.filter(offer => {
          const type = (offer.connectionType || '').toLowerCase();
          return type.includes('internets') || 
                 type.includes('optik') || 
                 type.includes('mobilais') ||
                 type.includes('dsl') ||
                 type.includes('vdsl') ||
                 type.includes('fiber') ||
                 type.includes('4g') ||
                 type.includes('5g');
        });
        
        const record = {
          id,
          address,
          properties: addrProps,
          geometry: feat.geometry || null,
          offers: internetOffers,
          scrapedAt: new Date().toISOString(),
          source: 'https://www.tet.lv/pieejamiba',
        };
        await appendLine(OUTPUT_NDJSON, record);
        done.add(id);
        await saveProgress([...done]);
        
        console.log(`  ✓ Successfully re-scraped ${id} - found ${internetOffers.length} internet offers`);
        await sleep(500 + Math.floor(Math.random() * 800));
        
      } catch (err) {
        console.warn(`  ✗ Failed to re-scrape ${id}: ${err.message}`);
        await appendLine(ERRORS_NDJSON, {
          id,
          address,
          error: err.message,
          when: new Date().toISOString(),
        });
        done.add(id);
        await saveProgress([...done]);
      }
    }
    
  } finally {
    await browser.close();
  }
  
  console.log(`\n=== Re-scraping completed ===`);
}

/**
 * Clean up error file by removing IDs that actually have valid offers
 * This handles cases where addresses were previously marked as errors
 * but have since been successfully scraped
 */
async function cleanupErrorFile() {
  console.log('=== Cleaning up error file ===');
  
  try {
    // Read all valid offers from output file
    const validOffers = new Map();
    if (fs.existsSync(OUTPUT_NDJSON)) {
      const outputContent = await fsp.readFile(OUTPUT_NDJSON, 'utf8');
      const lines = outputContent.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (record.id && record.offers && Array.isArray(record.offers) && record.offers.length > 0) {
            validOffers.set(record.id, record.offers);
          }
        } catch (parseErr) {
          console.warn(`Failed to parse offer line: ${parseErr.message}`);
        }
      }
    }
    
    console.log(`Found ${validOffers.size} IDs with valid offers in output file`);
    
    // Read error file and filter out resolved errors
    if (!fs.existsSync(ERRORS_NDJSON)) {
      console.log('No error file found - nothing to clean up');
      return;
    }
    
    const errorContent = await fsp.readFile(ERRORS_NDJSON, 'utf8');
    const errorLines = errorContent.trim().split('\n').filter(line => line.trim());
    
    const remainingErrors = [];
    const resolvedErrors = [];
    
    for (const line of errorLines) {
      try {
        const errorRecord = JSON.parse(line);
        const errorId = errorRecord.id;
        
        if (errorId && validOffers.has(errorId)) {
          // This error ID now has valid offers - it's resolved
          resolvedErrors.push(errorId);
          console.log(`RESOLVED: ${errorId} - now has ${validOffers.get(errorId).length} valid offers`);
        } else {
          // Keep this error as it's still unresolved
          remainingErrors.push(line);
        }
      } catch (parseErr) {
        // Keep malformed lines as-is
        remainingErrors.push(line);
        console.warn(`Failed to parse error line: ${parseErr.message}`);
      }
    }
    
    console.log(`\n=== Cleanup Results ===`);
    console.log(`Total errors checked: ${errorLines.length}`);
    console.log(`Resolved errors (removed): ${resolvedErrors.length}`);
    console.log(`Remaining errors: ${remainingErrors.length}`);
    
    if (resolvedErrors.length > 0) {
      console.log('\nResolved error IDs:');
      resolvedErrors.forEach(id => console.log(`  - ${id}`));
      
      // Write back only the remaining errors
      if (remainingErrors.length > 0) {
        const cleanedContent = remainingErrors.join('\n') + '\n';
        await fsp.writeFile(ERRORS_NDJSON, cleanedContent);
        console.log(`\nUpdated error file - removed ${resolvedErrors.length} resolved errors`);
      } else {
        // No errors left - remove the file entirely
        await fsp.unlink(ERRORS_NDJSON);
        console.log('\nAll errors resolved - removed error file entirely!');
      }
    } else {
      console.log('\nNo resolved errors found - error file unchanged');
    }
    
  } catch (error) {
    console.error('Error during error file cleanup:', error);
  }
}

if (require.main === module) {
  // Check for --validate parameter
  const args = process.argv.slice(2);
  const isValidateMode = args.includes('--validate');
  
  if (isValidateMode) {
    console.log('Running in validation mode - cleaning up error file');
    cleanupErrorFile().catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
  } else {
    run().catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
  }
}

// Export functions for external use
module.exports = {
  run,
  validateActualSuccess,
  reScrapeSpecificIds,
  cleanupErrorFile
};

