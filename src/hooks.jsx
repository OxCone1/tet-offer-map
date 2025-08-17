import { useState, useEffect, useRef, useCallback } from 'react';
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

  const saveUserData = async (data, filename) => {
    return await storageManager.saveUserData(data, filename);
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
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const tetDataLoadedRef = useRef(false);

  // Load TET data - only once!
  const loadTETData = useCallback(async () => {
    if (tetDataLoadedRef.current) return tetData; // Return cached data if already loaded
    
    try {
      console.log('Loading TET data...');
      const response = await fetch('/tet_offers.ndjson');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      const data = DataUtils.parseNDJSON(text);
      setTetData(data);
      tetDataLoadedRef.current = true;
      console.log(`Loaded ${data.length} TET offers`);
      return data;
    } catch (error) {
      console.error('Error loading TET data:', error);
      // Show user-friendly error with restart suggestion
      if (typeof window !== 'undefined') {
        const shouldRestart = window.confirm(
          'Failed to load property data. This might be due to a network issue.\n\nWould you like to restart the page to try again?'
        );
        if (shouldRestart) {
          window.location.reload();
        }
      }
      tetDataLoadedRef.current = true; // Mark as loaded to prevent infinite retry
      return []; // Return empty array on error
    }
  }, [tetData]); // Only depend on tetData for return value

  // Load user data from storage
  const loadUserData = useCallback(async () => {
    if (!storageManager) return [];
    
    try {
      const userDataEntries = await storageManager.getAllUserData();
      const data = userDataEntries.flatMap(entry => entry.data);
      setUserData(data);
      console.log(`Loaded ${data.length} user data entries`);
      return data;
    } catch (error) {
      console.error('Error loading user data:', error);
      return [];
    }
  }, [storageManager]);

  // Add user data
  const addUserData = useCallback(async (newData, filename) => {
    if (!storageManager) return;

    // Validate data
    const validFeatures = newData.filter(feature => DataUtils.isValidGeoJSONFeature(feature));
    
    if (validFeatures.length === 0) {
      throw new Error('No valid GeoJSON features found in file');
    }

    // Save to storage
    await storageManager.saveUserData(validFeatures, filename);
    
    // Update state with functional update to avoid stale closure
    setUserData(prevData => [...prevData, ...validFeatures]);
    
    return validFeatures;
  }, [storageManager]); // Remove userData dependency to prevent infinite loops

  // Initialize data loading (only once)
  useEffect(() => {
    if (initialized || !storageManager) return;

    const initializeData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadTETData(),
          loadUserData()
        ]);
      } catch (error) {
        console.error('Error initializing data:', error);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeData();
  }, [storageManager, loadTETData, loadUserData, initialized]); // Properly memoized dependencies

  // Update allData when tetData or userData changes
  useEffect(() => {
    setAllData([...tetData, ...userData]);
  }, [tetData, userData]);

  return {
    tetData,
    userData,
    allData,
    loading,
    addUserData,
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
