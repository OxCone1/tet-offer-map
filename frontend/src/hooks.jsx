import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
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
    deleteUserData
  };
};

/**
 * Custom hook for data management
 */
export const useData = (storageManager) => {
  const [tetData, setTetData] = useState([]);
  const [userData, setUserData] = useState([]);
  const [userDataEntries, setUserDataEntries] = useState([]); // full entries with metadata
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tetDataLoaded = useRef(false);
  const userDataLoaded = useRef(false);

  // Load TET data once on mount
  useEffect(() => {
    if (tetDataLoaded.current) return;

    const fetchTetData = async () => {
      try {
        // console.log('Loading TET data...');
        const response = await axios.get('/tet_offers.ndjson');
        const data = DataUtils.parseNDJSON(response.data);
        setTetData(data);
        tetDataLoaded.current = true;
        // console.log(`Loaded ${data.length} TET offers`);
      } catch (err) {
        console.error('Error loading TET data:', err);
        setError(err);
        
        // Show user-friendly error with restart suggestion
        const shouldRestart = window.confirm(
          'Failed to load property data. This might be due to a network issue.\n\nWould you like to restart the page to try again?'
        );
        if (shouldRestart) {
          window.location.reload();
        }
        
        tetDataLoaded.current = true; // Prevent infinite retry
      }
    };

    fetchTetData();
  }, []);

  // Load user data from storage - ONLY ONCE
  useEffect(() => {
    if (!storageManager || userDataLoaded.current) return;

    const loadUserData = async () => {
      try {
  const entries = await storageManager.getAllUserData();
  const data = entries.flatMap(entry => entry.data);
  setUserData(data);
  setUserDataEntries(entries);
  // console.log(`Loaded ${data.length} user data features across ${entries.length} datasets`);
      } catch (err) {
        console.error('Error loading user data:', err);
      } finally {
        userDataLoaded.current = true; // Mark as loaded regardless of success/failure
        setLoading(false);
      }
    };

    loadUserData();
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
  setUserData(prev => [...prev, ...features]);
  setUserDataEntries(prev => [...prev, { id, filename, name: datasetName || filename, data: features }]);
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
        const flattened = updated.flatMap(e => e.data);
        setUserData(flattened);
        return updated;
      });
      return true;
    } catch (e) {
      console.error('Failed to delete dataset', e);
      return false;
    }
  }, [storageManager]);

  // Update allData when tetData or userData changes
  useEffect(() => {
    setAllData([...tetData, ...userData]);
  }, [tetData, userData]);

  // Dummy functions for compatibility
  const loadTETData = async () => tetData;
  const loadUserData = async () => userData;

  return {
    tetData,
    userData,
    allData,
    loading,
    error,
  addUserData,
  userDataEntries,
  deleteUserDataset,
    loadTETData,
    loadUserData
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
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-opacity duration-300 ${
      type === 'error' ? 'bg-red-600 text-white' : 
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
