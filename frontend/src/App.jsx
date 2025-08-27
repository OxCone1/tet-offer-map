"use client"

import { useState, useEffect } from "react"
import { useMap, useSearch, useStorage, useData, useMobile, useNotifications } from "./hooks.jsx"
import { DataUtils } from "./utils.js"
import NavigationPanel from "./components/NavigationPanel.jsx"
import MapContainer from "./components/MapContainer.jsx"
import PropertyDetailsModal from "./components/PropertyDetailsModal.jsx"
import MapLegend from "./components/MapLegend.jsx"
import DisclaimerModal from "./components/DisclaimerModal.jsx"
import { LanguageProvider } from "./contexts/LanguageContext.jsx"
import LanguageSelector from "./components/LanguageSelector"
import { useTranslate } from './hooks/useTranslation.jsx'

// Loading screen component that has access to translation context
const LoadingScreen = () => {
  const translate = useTranslate()

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">{translate('loading.title')}</p>
      </div>
    </div>
  )
}

// Main app content component that has access to translation context
const AppContent = () => {
  const translate = useTranslate()
  const isMobile = useMobile()
  const { showNotification } = useNotifications()
  const storage = useStorage()
  const { tetData, userData, userDataEntries, allData, loading, addUserData, deleteUserDataset } = useData(storage)
  // Per user dataset visibility map (id -> bool)
  const [datasetVisibility, setDatasetVisibility] = useState({});

  // Compute visible user features based on per-dataset visibility (default true)
  const visibleUserData = (userDataEntries && userDataEntries.length > 0)
    ? userDataEntries.reduce((acc, ds) => {
        if (datasetVisibility[ds.id] !== false) acc.push(...(ds.data || []));
        return acc;
      }, [])
    : userData;

  // Initialize any newly loaded datasets visibility to true
  useEffect(() => {
    if (!userDataEntries) return;
    setDatasetVisibility(prev => {
      const next = { ...prev };
      userDataEntries.forEach(ds => {
        if (next[ds.id] === undefined) next[ds.id] = true;
      });
      return next;
    });
  }, [userDataEntries]);

  // Map state
  const [showTetData, setShowTetData] = useState(true)
  const [showUserData, setShowUserData] = useState(true)
  const [showSectors, setShowSectors] = useState(false)
  const [sectorsRadius, setSectorsRadius] = useState(180) // meters
  const [sectorsMinPts, setSectorsMinPts] = useState(5)
  const [typeFilters, setTypeFilters] = useState([]) // default show all - will be auto-populated

  // Navigation panel state
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(!isMobile)

  // Property details modal state
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false)
  const [isUserDataProperty, setIsUserDataProperty] = useState(false)

  // Search state
  const { searchQuery, setSearchQuery, searchResults, showResults, setShowResults, performSearch } = useSearch(allData)

  // Map manager
  const { mapManager, initializeMap } = useMap((properties, isUserData) => {
    setSelectedProperty(properties)
    setIsUserDataProperty(isUserData)
    setIsPropertyModalOpen(true)
  })

  // Handle map initialization
  const handleMapReady = (containerElement) => {
    initializeMap(containerElement)
  }

  // Update map data when data or visibility toggles change
  useEffect(() => {
    if (!mapManager) return

    // Update cached data first
  if (tetData.length > 0) mapManager.tetDataCache = tetData
  mapManager.userDataCache = visibleUserData

    // Use toggle methods to respect visibility
    mapManager.toggleTETData(showTetData)
    mapManager.toggleUserData(showUserData)

    // Always refresh layers when visible (addUserData / addTETData internally clears layer first)
    if (showTetData) {
      mapManager.addTETData(tetData || [])
    } else {
      mapManager.tetLayer.clearLayers()
    }
    if (showUserData) {
      mapManager.addUserData(visibleUserData || []) // empty array clears existing features
    } else {
      mapManager.userLayer.clearLayers()
    }

    // Update sectors overlay whenever base layers change
    mapManager.toggleSectors(showSectors)
    mapManager.updateSectors({
      tet: tetData,
    user: visibleUserData,
      includeTet: showTetData,
      includeUser: showUserData,
      epsMeters: sectorsRadius,
      minPts: sectorsMinPts,
    })
    mapManager.setTypeFilters(typeFilters)
  }, [mapManager, tetData, visibleUserData, showTetData, showUserData, showSectors, sectorsRadius, sectorsMinPts, typeFilters, userDataEntries, datasetVisibility])

  // Handle search result selection
  const handleSearchResultSelect = (result) => {
    // Result items in AddressSearch are the raw objects from allData.
    // TET items have shape { id, address, geometry, offers, ... }
    // User items are GeoJSON Features { type: 'Feature', properties: { address, ... }, geometry }
    const address = result.address || result.properties?.address || "";
    setSearchQuery(address);
    setShowResults(false);

    if (mapManager) {
      // Build a GeoJSON-like feature for highlightLocation
      const feature = result.type === 'Feature'
        ? result
        : {
          type: 'Feature',
          geometry: result.geometry,
          properties: { address: result.address, ...result.properties }
        };

      mapManager.highlightLocation(feature);

      // Prepare properties for modal
      if (result.type === 'Feature') {
        setSelectedProperty(result.properties);
        setIsUserDataProperty(true);
      } else {
        setSelectedProperty(result);
        setIsUserDataProperty(false);
      }
      setIsPropertyModalOpen(true);
    }
  }

  // Handle file upload
  const handleFileUpload = async (file, datasetName) => {
    if (!file) return

    try {
      const text = await file.text()
      let data

      if (file.name.endsWith(".ndjson")) {
        data = DataUtils.parseNDJSON(text)
      } else {
        data = JSON.parse(text)
        if (!Array.isArray(data)) {
          data = [data]
        }
      }

  const { id, features } = await addUserData(data, file.name, datasetName)

      // Enable user data layer
      setShowUserData(true)

  // Ensure visibility on new dataset
  setDatasetVisibility(prev => ({ ...prev, [id]: true }))
  showNotification(translate('message.file.success', { count: features.length, filename: datasetName || file.name }), "success")
    } catch (error) {
      console.error("Error processing file:", error)
      showNotification(translate('message.file.error'), "error")
    }
  }

  // Delete a specific user dataset
  const handleDeleteDataset = async (id) => {
    if (!id) return;
    const confirmed = window.confirm(translate('controls.delete.dataset') + '?');
    if (!confirmed) return;
    const ok = await deleteUserDataset(id);
    if (ok) {
      setDatasetVisibility(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      showNotification(translate('message.dataset.deleted'), 'success');
    } else {
      showNotification(translate('ui.error'), 'error');
    }
  }

  // Handle search input
  const handleSearchInput = (query) => {
    setSearchQuery(query)

    if (query.length < 2) {
      setShowResults(false)
      return
    }

    // Debounce search
    const timeoutId = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }

  // Close property details
  const closePropertyDetails = () => {
    setIsPropertyModalOpen(false)
    setSelectedProperty(null)
  }

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="relative h-dvh w-full">
      <DisclaimerModal />

      <a
        href="https://linktr.ee/oxcone"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-0 left-1/2 transform min-w-max -translate-x-1/2 z-50 
                     bg-black/80 backdrop-blur-sm 
                     rounded-b-2xl px-4 py-1.5 text-xs text-white 
                     hover:bg-black/90 transition-all duration-300 
                     shadow-lg hover:shadow-xl flex items-center gap-1.5 "
      >
        Made with ❤️ by OxCone
        <svg className="h-2 w-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>

      {/* Navigation Panel */}
      <NavigationPanel
        isMobile={isMobile}
        onOpenChange={setIsControlPanelOpen}
        // Search props
        searchQuery={searchQuery}
        searchResults={searchResults}
        showResults={showResults}
        onSearchInput={handleSearchInput}
        onSearchResultSelect={handleSearchResultSelect}
        onClearResults={() => setShowResults(false)}
        // Controls props
        showTetData={showTetData}
        showUserData={showUserData}
  userDataCount={visibleUserData.length}
        onToggleTetData={setShowTetData}
        onToggleUserData={setShowUserData}
        onFileUpload={handleFileUpload}
        showSectors={showSectors}
        onToggleSectors={setShowSectors}
        sectorsRadius={sectorsRadius}
        onChangeSectorsRadius={setSectorsRadius}
        sectorsMinPts={sectorsMinPts}
        onChangeSectorsMinPts={setSectorsMinPts}
        typeFilters={typeFilters}
        onChangeTypeFilters={setTypeFilters}
  tetData={tetData}
  userData={visibleUserData}
  userDatasets={userDataEntries?.map(e => ({ id: e.id, name: e.name || e.filename, count: e.data?.length || 0 })) || []}
  datasetVisibility={datasetVisibility}
  onToggleDataset={(id, value) => setDatasetVisibility(prev => ({ ...prev, [id]: value }))}
  onDeleteDataset={handleDeleteDataset}
      />

      <div className={`h-full transition-all duration-300 ${!isMobile ? "ml-0" : ""}`}>
        <MapContainer onMapReady={handleMapReady} />
      </div>

      <LanguageSelector variant="map" />

      {/* Map Legend */}
      <MapLegend
        isMobile={isMobile}
        isControlPanelOpen={isControlPanelOpen}
        tetData={tetData}
  userData={visibleUserData}
        showTetData={showTetData}
        showUserData={showUserData}
        mapManager={mapManager}
      />

      {/* Property Details Modal */}
      <PropertyDetailsModal
        isOpen={isPropertyModalOpen}
        properties={selectedProperty}
        isUserData={isUserDataProperty}
        isMobile={isMobile}
        onClose={closePropertyDetails}
      />
    </div>
  )
}

// Main App wrapper with LanguageProvider
function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  )
}

export default App
