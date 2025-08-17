import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "./ui/button"
import { ChevronDown, ChevronUp, Palette } from "lucide-react"
import { DataUtils } from '../utils.js'
import { useTranslate } from '../hooks/useTranslation.jsx'

const MapLegend = ({ 
  isMobile, 
  isControlPanelOpen, 
  tetData, 
  userData, 
  showTetData, 
  showUserData, 
  mapManager // Direct access to map manager
}) => {
  const translate = useTranslate()
  const [isExpanded, setIsExpanded] = useState(!isMobile) // Desktop: always expanded, Mobile: collapsed by default
  const [autoHidden, setAutoHidden] = useState(false)

  // Use ref to access current expanded state in event handler
  const isExpandedRef = useRef(isExpanded)

  // Update ref when expanded state changes
  useEffect(() => {
    isExpandedRef.current = isExpanded
  }, [isExpanded])

  // Update expanded state when mobile state changes
  useEffect(() => {
    if (!isMobile) {
      setIsExpanded(true) // Desktop: always expanded
    }
  }, [isMobile])

  // Get available connection types from visible data
  const availableTypes = useMemo(() => {
    const types = new Set()

    if (showTetData && tetData) {
      tetData.forEach((property) => {
        if (property.offers && property.offers[0]) {
          const norm = DataUtils.normalizeConnectionType(property.offers[0].connectionType)
          if (norm) types.add(norm) // Show all types, not just filtered ones
        }
      })
    }

    if (showUserData && userData) {
      userData.forEach((feature) => {
        if (feature.properties && feature.properties.connection_type) {
          const norm = DataUtils.normalizeConnectionType(feature.properties.connection_type)
          if (norm) types.add(norm) // Show all types, not just filtered ones
        }
      })
    }

    return Array.from(types).sort()
  }, [showTetData, tetData, showUserData, userData])

  // Auto-hide when control panel is open (desktop) or when no types available
  useEffect(() => {
    if (!isMobile && isControlPanelOpen) {
      setAutoHidden(true)
    } else if (availableTypes.length === 0) {
      setAutoHidden(true)
    } else {
      setAutoHidden(false)
    }
  }, [isMobile, isControlPanelOpen, availableTypes.length])

  // Auto-collapse on mobile when map is moved (register handler via callback)
  useEffect(() => {
    if (isMobile && mapManager) {
      const handleMapMove = () => {
        if (isExpandedRef.current) {
          setIsExpanded(false)
        }
      }
      mapManager.onMapMove(handleMapMove)

      // Cleanup
      return () => {
        mapManager.offMapMove(handleMapMove)
      }
    }
  }, [isMobile, mapManager])

  if (autoHidden || availableTypes.length === 0) {
    return null
  }

  const positionClasses = isMobile
    ? "fixed top-11 right-16 z-30 max-w-[160px] sm:max-w-[180px]"
    : "fixed bottom-4 left-4 z-30 min-w-[140px] max-w-[200px]"

  return (
    <div
      className={`${positionClasses} bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-white/50 transition-all duration-300 ease-in-out ${isExpanded ? "opacity-100" : "opacity-95"}`}
    >
      <div
        className={`flex items-center justify-between px-2 py-1.5 border-b border-gray-100/80 ${isMobile ? "cursor-pointer" : ""}`}
        onClick={isMobile ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
          <Palette className="h-3 w-3" />
          {translate('legend.title')}
        </span>
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="h-6 w-6 p-0 hover:bg-gray-100/60 rounded"
            aria-label={isExpanded ? translate('ui.close') : translate('legend.title')}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded || !isMobile ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-2 py-1.5 space-y-1.5">
          {availableTypes.map((type) => {
            const tetColor = DataUtils.getConnectionColor(type, false)
            const userColor = DataUtils.getConnectionColor(type, true)
            const showBoth = showTetData && showUserData

            return (
              <div key={type} className="flex items-center gap-1.5 text-xs">
                <div className="flex gap-1 flex-shrink-0">
                  {showTetData && (
                    <div
                      className="w-2.5 h-2.5 rounded border border-gray-200"
                      style={{ backgroundColor: tetColor }}
                      title={translate('data.source.official')}
                    />
                  )}
                  {showUserData && (
                    <div
                      className="w-2.5 h-2.5 rounded border border-gray-200"
                      style={{ backgroundColor: userColor }}
                      title={translate('data.source.user')}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-gray-700 capitalize text-xs block truncate">
                    {translate(`connection.${type.toLowerCase()}`) || type}
                  </span>
                  {showBoth && (
                    <div className="text-gray-400 text-xs truncate leading-tight">
                      ({showTetData ? translate('data.source.official').slice(0, 3) : ''}
                      {showTetData && showUserData ? '/' : ''}
                      {showUserData ? translate('data.source.user').slice(0, 3) : ''})
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          
          {isMobile && (
            <div className="pt-1 mt-2 border-t border-gray-200/50">
              <div className="text-xs text-gray-500 italic">
                {translate('legend.mobile.hint')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MapLegend