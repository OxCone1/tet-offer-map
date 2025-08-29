import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
// pointer-utils imported elsewhere where needed
import { MapManager } from './map.js';
import { AddressSearch, DataUtils } from './utils.js';
import { StorageManager } from './storage.js';

/**
 * Custom hook for map management
 */
export const useMap = (onPropertyClick) => {
  const [mapManager, setMapManager] = useState(null);
  const mapInitialized = useRef(false);

  const initializeMap = (containerElement) => {
    if (!mapInitialized.current && containerElement) {
      const manager = new MapManager(containerElement);
      manager.showPropertyDetails = onPropertyClick;
      setMapManager(manager);
      mapInitialized.current = true;
    }
  };

  return { mapManager, initializeMap };
};

/**
 * Custom hook for search functionality
 */
export const useSearch = (data) => {
  const [addressSearch, setAddressSearch] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (data && data.length > 0) {
      setAddressSearch(new AddressSearch(data));
    }
  }, [data]);

  const performSearch = (query) => {
    if (!addressSearch || query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const results = addressSearch.search(query);
    setSearchResults(results.slice(0, 10));
    setShowResults(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    showResults,
    setShowResults,
    performSearch,
    clearSearch
  };
};

/**
 * Custom hook for storage management
 */
export const useStorage = () => {
  const [storageManager] = useState(() => new StorageManager());

  const saveUserData = async (data, filename, name) => {
    return await storageManager.saveUserData(data, filename, name);
  };

  const getAllUserData = async () => {
    return await storageManager.getAllUserData();
  };

  const deleteUserData = async (id) => {
    return await storageManager.deleteUserData(id);
  };

  return {
    saveUserData,
    getAllUserData,
    deleteUserData,
    // Region caching passthroughs
    saveRegionPointer: (p) => storageManager.saveRegionPointer(p),
    getRegionPointer: () => storageManager.getRegionPointer(),
    getOrInvalidateRegion: (name, ts) => storageManager.getOrInvalidateRegion(name, ts),
    saveRegionDataset: (name, records, updatedAt) => storageManager.saveRegionDataset(name, records, updatedAt),
    getRegionDataset: (name) => storageManager.getRegionDataset(name),
    getCachedRegionNames: () => storageManager.getCachedRegionNames(),
  // User pointer & dataset helpers
  getUserPointerIndex: () => storageManager.getUserPointerIndex(),
  getUserDataset: (id) => storageManager.getUserDataset(id),
  };
};

/**
 * Custom hook for data management
 */
export const useData = (storageManager) => {
  const [tetData, setTetData] = useState([]); // aggregated loaded region records
  const [regionPointers, setRegionPointers] = useState([]); // remote pointer.json regions
  const [userDatasetPointers, setUserDatasetPointers] = useState([]); // user dataset pointers (from storage)
  const [combinedPointers, setCombinedPointers] = useState([]); // merged for outline rendering
  const [loadedRegionNames, setLoadedRegionNames] = useState(new Set());
  const [loadedUserDatasetNames, setLoadedUserDatasetNames] = useState(new Set());
  const [userData, setUserData] = useState([]);
  const [userDataEntries, setUserDataEntries] = useState([]); // full entries with metadata
  // allData will be derived via useMemo instead of separate state to avoid render loops
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pointerLoaded = useRef(false);
  const loadingRegionsRef = useRef(new Set());
  const userDataMetaLoaded = useRef(false);
  const loadingUserDatasetsRef = useRef(new Set());
  const userDataEntriesLoadedRef = useRef(false); // prevent infinite loop when zero entries
  const regionEvictionTimersRef = useRef(new Map()); // regionName -> timeoutId
  const userDatasetEvictionTimersRef = useRef(new Map()); // dataset pointer name -> timeoutId
  const EVICT_IDLE_MS = 5000;

  // Determine base URL (local dev vs remote GitHub raw)
  const baseDataURL = (() => {
    // const isDev = import.meta.env.DEV; // unused currently, could switch to local exports path
    return 'https://raw.githubusercontent.com/OxCone1/data-tet-map/main/';
  })();


  // Fetch pointer.json once
  useEffect(() => {
  if (pointerLoaded.current) return;
    const loadPointer = async () => {
      try {
  // Mark early to avoid parallel duplicate fetches
  pointerLoaded.current = true;
  const url = baseDataURL + 'pointer.json';
  const resp = await axios.get(url);
        const arr = (Array.isArray(resp.data) ? resp.data : []).map(e => {
          // Derive bbox if not present
          if (!e.bbox && e.outline && e.outline.type === 'Polygon') {
            const ring = e.outline.coordinates?.[0] || [];
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            ring.forEach(p => { if (!p) return; if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
            e.bbox = [minX, minY, maxX, maxY];
          }
          // unify filename property to .file used later
          if (!e.file) e.file = e.path || e.name;
          return e;
        });
        setRegionPointers(arr);
        // Persist latest pointer for offline / caching logic
        if (storageManager?.saveRegionPointer) await storageManager.saveRegionPointer(arr);
      } catch (e) {
        console.error('Failed to load pointer.json', e);
        setError(e);
      } finally {
        setLoading(false);
      }
    };
    loadPointer();
  }, [baseDataURL, storageManager]);

  // Load user dataset pointer index (metadata) once
  useEffect(() => {
    if (!storageManager || userDataMetaLoaded.current) return;
    const loadUserPointers = async () => {
      try {
        const ptrs = await storageManager.getUserPointerIndex();
        // Ensure name uniqueness: prefix with user: if not already
        const normalized = ptrs.map(p => ({ ...p, originalName: p.name, name: p.name.startsWith('user:') ? p.name : `user:${p.name}` }));
        setUserDatasetPointers(normalized);
      } catch (e) {
        console.error('Failed loading user dataset pointers', e);
      } finally {
        userDataMetaLoaded.current = true;
      }
    };
    loadUserPointers();
  }, [storageManager]);

  // Keep combined pointers in sync
  useEffect(() => {
    if (!regionPointers && !userDatasetPointers) return;
    setCombinedPointers([...(regionPointers || []), ...(userDatasetPointers || [])]);
  }, [regionPointers, userDatasetPointers]);

  // Function: given current viewport bbox (Leaflet bounds), fetch any region ndjson not yet loaded and whose furthestPoints / bbox intersects
  const loadRegionsInView = useCallback(async (bbox) => {
    if (!bbox || !regionPointers || regionPointers.length === 0) return;
    const [west, south, east, north] = [bbox.west, bbox.south, bbox.east, bbox.north];
    // Simple bbox intersection test
    const intersects = (r) => {
      // pointer entries expected to have bbox: [minX, minY, maxX, maxY]
      if (!r || !Array.isArray(r.bbox) || r.bbox.length !== 4) return false;
      const [minX, minY, maxX, maxY] = r.bbox;
      return !(maxX < west || minX > east || maxY < south || minY > north);
    };
    const toLoad = regionPointers.filter(r => !loadedRegionNames.has(r.name) && intersects(r));
    for (const region of toLoad) {
      if (loadingRegionsRef.current.has(region.name)) continue;
      loadingRegionsRef.current.add(region.name);
      try {
        // Attempt cache retrieval first (expectedUpdatedAt uses region.updatedAt if provided)
        const cached = storageManager?.getOrInvalidateRegion ? await storageManager.getOrInvalidateRegion(region.name, region.updatedAt) : null;
        // Debug logging
        if (cached) {
          console.debug('[RegionCache] Using cached region', region.name, 'records:', cached.length);
        } else {
          console.debug('[RegionCache] Fetching region from network', region.name);
        }
        let records;
        if (cached) {
          records = cached;
        } else {
          const url = baseDataURL + region.file;
          const resp = await axios.get(url, { responseType: 'text' });
          records = DataUtils.parseNDJSON(resp.data).filter(DataUtils.isValidTETProperty);
          // Save cache with region.updatedAt or current time
          if (storageManager?.saveRegionDataset) {
            await storageManager.saveRegionDataset(region.name, records, region.updatedAt);
            console.debug('[RegionCache] Saved region to cache', region.name, 'count', records.length);
          }
        }
        setTetData(prev => {
          if (!records || records.length === 0) return prev;
          const map = new Map(prev.map(r => [r.id, r]));
          for (const rec of records) if (rec && rec.id) { rec._regionName = region.name; map.set(rec.id, rec); }
          return Array.from(map.values());
        });
        setLoadedRegionNames(prev => new Set(prev).add(region.name));
      } catch (e) {
        console.warn('Failed loading region', region.name, e);
      } finally {
        loadingRegionsRef.current.delete(region.name);
      }
    }
  }, [regionPointers, loadedRegionNames, baseDataURL, storageManager]);

  // Lazy load user datasets inside viewport (same threshold semantics)
  const loadUserDatasetsInView = useCallback(async (bbox) => {
    if (!bbox || !userDatasetPointers || userDatasetPointers.length === 0) return;
    const [west, south, east, north] = [bbox.west, bbox.south, bbox.east, bbox.north];
    const intersects = (p) => {
      if (!p || !Array.isArray(p.bbox) || p.bbox.length !== 4) return false;
      const [minX, minY, maxX, maxY] = p.bbox;
      return !(maxX < west || minX > east || maxY < south || minY > north);
    };
    const toLoad = userDatasetPointers.filter(p => !loadedUserDatasetNames.has(p.name) && intersects(p));
    for (const ptr of toLoad) {
      if (loadingUserDatasetsRef.current.has(ptr.name)) continue;
      loadingUserDatasetsRef.current.add(ptr.name);
      try {
        // Retrieve dataset by id (ptr.id stored earlier)
        const raw = ptr.id ? await storageManager.getUserDataset(ptr.id) : null;
        const features = raw?.data || [];
        if (features.length) {
          // Tag features with dataset id for filtering
          const tagged = features.map(f => ({ ...f, properties: { ...f.properties, dataset_id: ptr.id, _userDatasetName: ptr.originalName || ptr.name } }));
          setUserData(prev => {
            // Deduplicate by properties.id if present else by object identity reference
            const map = new Map(prev.map(f => [f.properties?.id || f._uuid || Math.random().toString(36), f]));
            for (const nf of tagged) {
              const key = nf.properties?.id || `${ptr.id}_${nf.properties?.address || Math.random().toString(36)}`;
              map.set(key, nf);
            }
            return Array.from(map.values());
          });
          setLoadedUserDatasetNames(prev => new Set(prev).add(ptr.name));
        }
      } catch (e) {
        console.warn('Failed loading user dataset', ptr.name, e);
      } finally {
        loadingUserDatasetsRef.current.delete(ptr.name);
      }
    }
  }, [userDatasetPointers, loadedUserDatasetNames, storageManager]);

  // Schedule eviction helpers
  const scheduleRegionEviction = useCallback((regionName) => {
    if (!regionName || regionEvictionTimersRef.current.has(regionName)) return;
    const t = setTimeout(() => {
      setTetData(prev => prev.filter(r => r._regionName !== regionName));
      setLoadedRegionNames(prev => {
        const next = new Set(prev);
        next.delete(regionName);
        return next;
      });
      regionEvictionTimersRef.current.delete(regionName);
      console.debug('[Evict] Region removed after idle:', regionName);
    }, EVICT_IDLE_MS);
    regionEvictionTimersRef.current.set(regionName, t);
  }, []);

  const cancelRegionEviction = useCallback((regionName) => {
    const t = regionEvictionTimersRef.current.get(regionName);
    if (t) { clearTimeout(t); regionEvictionTimersRef.current.delete(regionName); }
  }, []);

  const scheduleUserDatasetEviction = useCallback((pointerName) => {
    if (!pointerName || userDatasetEvictionTimersRef.current.has(pointerName)) return;
    const t = setTimeout(() => {
      setUserData(prev => prev.filter(f => f.properties?._userDatasetName !== pointerName.replace(/^user:/,'')));
      setLoadedUserDatasetNames(prev => {
        const next = new Set(prev);
        next.delete(pointerName);
        return next;
      });
      userDatasetEvictionTimersRef.current.delete(pointerName);
      console.debug('[Evict] User dataset removed after idle:', pointerName);
    }, EVICT_IDLE_MS);
    userDatasetEvictionTimersRef.current.set(pointerName, t);
  }, []);

  const cancelUserDatasetEviction = useCallback((pointerName) => {
    const t = userDatasetEvictionTimersRef.current.get(pointerName);
    if (t) { clearTimeout(t); userDatasetEvictionTimersRef.current.delete(pointerName); }
  }, []);

  // Expose a handler to be called by map move/zoom events for incremental region loading
  const handleViewportChange = useCallback((boundsInfo) => {
    if (!boundsInfo) return;
    if (boundsInfo.zoom >= 15) {
      loadRegionsInView({
        west: boundsInfo.west,
        south: boundsInfo.south,
        east: boundsInfo.east,
        north: boundsInfo.north
      });
      loadUserDatasetsInView({
        west: boundsInfo.west,
        south: boundsInfo.south,
        east: boundsInfo.east,
        north: boundsInfo.north
      });
      // Visibility tracking for eviction scheduling
      // Regions
      if (regionPointers && regionPointers.length && loadedRegionNames.size) {
        const [west, south, east, north] = [boundsInfo.west, boundsInfo.south, boundsInfo.east, boundsInfo.north];
        const intersects = (r) => {
          if (!r || !Array.isArray(r.bbox) || r.bbox.length !== 4) return false;
          const [minX, minY, maxX, maxY] = r.bbox; return !(maxX < west || minX > east || maxY < south || minY > north);
        };
        const loadedNamesArr = Array.from(loadedRegionNames);
        loadedNamesArr.forEach(name => {
          const ptr = regionPointers.find(p => p.name === name);
          if (ptr && intersects(ptr)) {
            cancelRegionEviction(name);
          } else {
            scheduleRegionEviction(name);
          }
        });
      }
      // User datasets
      if (userDatasetPointers && userDatasetPointers.length && loadedUserDatasetNames.size) {
        const [west, south, east, north] = [boundsInfo.west, boundsInfo.south, boundsInfo.east, boundsInfo.north];
        const intersects = (p) => {
          if (!p || !Array.isArray(p.bbox) || p.bbox.length !== 4) return false;
          const [minX, minY, maxX, maxY] = p.bbox; return !(maxX < west || minX > east || maxY < south || minY > north);
        };
        const loadedUserNamesArr = Array.from(loadedUserDatasetNames);
        loadedUserNamesArr.forEach(name => {
          const ptr = userDatasetPointers.find(p => p.name === name);
          if (ptr && intersects(ptr)) {
            cancelUserDatasetEviction(name);
          } else {
            scheduleUserDatasetEviction(name);
          }
        });
      }
    } else {
      // Clear only if we actually have data; prevents redundant state churn
      let changed = false;
      if (tetData.length > 0 || loadedRegionNames.size > 0) { setTetData([]); setLoadedRegionNames(new Set()); changed = true; }
      if (userData.length > 0 || loadedUserDatasetNames.size > 0) { setUserData([]); setLoadedUserDatasetNames(new Set()); changed = true; }
      if (changed) {
        // keep metadata & pointers; they render outlines at low zoom
      }
      // Cancel all pending eviction timers since everything cleared
      regionEvictionTimersRef.current.forEach(t => clearTimeout(t));
      regionEvictionTimersRef.current.clear();
      userDatasetEvictionTimersRef.current.forEach(t => clearTimeout(t));
      userDatasetEvictionTimersRef.current.clear();
    }
  }, [loadRegionsInView, loadUserDatasetsInView, tetData.length, loadedRegionNames, userData.length, loadedUserDatasetNames, regionPointers, userDatasetPointers, cancelRegionEviction, scheduleRegionEviction, cancelUserDatasetEviction, scheduleUserDatasetEviction]);

  // Load user dataset metadata (full entries) once (needed for counts & deletion UI)
  useEffect(() => {
    if (!storageManager || userDataEntriesLoadedRef.current) return;
    (async () => {
      try {
        const entries = await storageManager.getAllUserData();
        if (entries && entries.length) setUserDataEntries(entries); // only set if non-empty to avoid loop when empty
      } catch (e) {
        console.error('Failed loading user dataset metadata', e);
      } finally {
        userDataEntriesLoadedRef.current = true;
      }
    })();
  }, [storageManager]);

  // Add user data
  const addUserData = useCallback(async (newData, filename, datasetName) => {
    if (!storageManager) return;
    // Normalize incoming records into GeoJSON Features accepted by the app
    // Supported input shapes:
    // 1. Proper GeoJSON Feature with properties.address + properties.connection_type
    // 2. TET property objects (same shape as entries in tet_offers.ndjson) -> convert
    // 3. Plain objects that look like { id, address, geometry, offers } (minimal subset) -> convert
    const features = [];

    const toFeature = (item) => {
      // Already a valid feature
      if (DataUtils.isValidGeoJSONFeature(item)) return item;

      // TET style property object
      if (DataUtils.isValidTETProperty(item)) {
        const primaryOffer = item.offers[0] || {};
        const connectionType = DataUtils.normalizeConnectionType(primaryOffer.connectionType || primaryOffer.type || primaryOffer.connection_type);
        return {
          type: 'Feature',
          geometry: item.geometry,
          properties: {
            address: item.address,
            connection_type: connectionType,
            id: item.id,
            offers: item.offers,
            scrapedAt: item.scrapedAt,
            source: item.source,
            // Flatten original nested properties if present
            ...(item.properties || {})
          }
        };
      }

      // Attempt heuristic conversion if object resembles a TET property (no nested properties field)
      if (item && item.address && item.geometry && item.offers) {
        const primaryOffer = item.offers[0] || {};
        const connectionType = DataUtils.normalizeConnectionType(primaryOffer.connectionType || primaryOffer.type || primaryOffer.connection_type);
        return {
          type: 'Feature',
          geometry: item.geometry,
          properties: {
            address: item.address,
            connection_type: connectionType,
            id: item.id,
            offers: item.offers,
            scrapedAt: item.scrapedAt,
            source: item.source
          }
        };
      }
      return null;
    };

    (Array.isArray(newData) ? newData : [newData]).forEach(rec => {
      const f = toFeature(rec);
      if (f && DataUtils.isValidGeoJSONFeature(f)) {
        features.push(f);
      }
    });

    if (features.length === 0) {
      throw new Error('No valid features or TET properties found in file');
    }

    // Save normalized features to storage
    const id = await storageManager.saveUserData(features, filename, datasetName);
    // Refresh pointers
    try {
      const ptrs = await storageManager.getUserPointerIndex();
      const normalized = ptrs.map(p => ({ ...p, originalName: p.name, name: p.name.startsWith('user:') ? p.name : `user:${p.name}` }));
      setUserDatasetPointers(normalized);
    } catch {/* ignore */}
    setUserDataEntries(prev => [...prev, { id, filename, name: datasetName || filename, data: features }]);
    // Defer actual feature loading until viewport triggers (lazy) for consistency
    return { id, features, name: datasetName || filename };
  }, [storageManager]);

  // Delete a user dataset by id (updates local state immediately)
  const deleteUserDataset = useCallback(async (id) => {
    if (!storageManager || !id) return false;
    try {
      await storageManager.deleteUserData(id);
      setUserDataEntries(prev => {
        const updated = prev.filter(e => e.id !== id);
        // Rebuild flattened userData from remaining entries
        // Remove loaded data belonging to this dataset
        setUserData(curr => curr.filter(f => f.properties?.dataset_id !== id));
        // Update pointers list
        setUserDatasetPointers(curr => curr.filter(p => p.id !== id));
        return updated;
      });
      return true;
    } catch (e) {
      console.error('Failed to delete dataset', e);
      return false;
    }
  }, [storageManager]);

  // Derived merged collection for search
  const allData = useMemo(() => {
    if (tetData.length === 0 && userData.length === 0) return [];
    return [...tetData, ...userData];
  }, [tetData, userData]);

  // Dummy functions for compatibility
  const loadTETData = async () => tetData;
  const loadUserData = async () => userData;

  return {
    tetData,
  regionPointers,
  userDatasetPointers,
  combinedPointers,
  loadedRegionNames,
  loadedUserDatasetNames,
    userData,
    allData,
    loading,
    error,
    addUserData,
    userDataEntries,
    deleteUserDataset,
    loadTETData,
    loadUserData,
  handleViewportChange,
  // Expose manual eviction utilities (optional external use)
  scheduleRegionEviction,
  cancelRegionEviction,
  scheduleUserDatasetEviction,
  cancelUserDatasetEviction
  };
};

/**
 * Custom hook for mobile detection
 */
export const useMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

/**
 * Custom hook for notifications
 */
export const useNotifications = () => {
  const showNotification = (message, type = 'info') => {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-opacity duration-300 ${type === 'error' ? 'bg-red-600 text-white' :
      type === 'success' ? 'bg-green-600 text-white' :
        'bg-blue-600 text-white'
      }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  };

  return { showNotification };
};
